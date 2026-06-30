const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { rateLimit } = require('./lib/rateLimit');
const { findeBuddies } = require('./lib/matching');
const {
  validiereRegister,
  validiereLogin,
  validiereAnfrage,
  validiereNachricht,
  baueProfil,
  STATUS_WERTE,
} = require('./lib/validation');

// ─── KONFIGURATION ─────────────────────────────────────────────

// .env laden, falls vorhanden (Node >= 20.6 / 22). Fehlt die Datei, ist das ok.
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  /* keine .env vorhanden -> Defaults / Umgebungsvariablen nutzen */
}

const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || `http://localhost:${PORT}`;

// JWT-Secret kommt aus der Umgebung. Nur für die lokale Entwicklung gibt es einen
// Fallback – im Produktivbetrieb MUSS JWT_SECRET gesetzt sein.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-unsicher-bitte-JWT_SECRET-setzen';
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET muss in der Produktion gesetzt sein.');
}
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET nicht gesetzt – verwende unsicheren Entwicklungs-Fallback. Lege eine .env an!');
}

const app = express();
app.use(express.json());

// CORS: erlaubte Origin reflektieren (statt offenem "*").
// localhost/127.0.0.1 auf beliebigem Port wird im Dev-Betrieb akzeptiert,
// damit die App auch beim Öffnen über die IDE-Vorschau funktioniert.
const LOCALHOST_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const erlaubt = !origin
    ? ALLOWED_ORIGIN
    : (origin === ALLOWED_ORIGIN || LOCALHOST_REGEX.test(origin)) ? origin : ALLOWED_ORIGIN;
  res.header('Access-Control-Allow-Origin', erlaubt);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Frontend statisch servieren
app.use(express.static(path.join(__dirname)));

// ─── DATEN-STORAGE (JSON-Dateien) ──────────────────────────────

// DATA_DIR ist überschreibbar (z. B. für Tests in einem temporären Verzeichnis).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ANFRAGEN_FILE = path.join(DATA_DIR, 'anfragen.json');
const NACHRICHTEN_FILE = path.join(DATA_DIR, 'nachrichten.json');

function ensureFile(datei, standard) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(datei)) fs.writeFileSync(datei, JSON.stringify(standard, null, 2));
}
ensureFile(USERS_FILE, []);
ensureFile(ANFRAGEN_FILE, []);
ensureFile(NACHRICHTEN_FILE, []);

function readJson(datei) {
  return JSON.parse(fs.readFileSync(datei, 'utf-8'));
}
function writeJson(datei, daten) {
  fs.writeFileSync(datei, JSON.stringify(daten, null, 2));
}

const getUsers = () => readJson(USERS_FILE);
const saveUsers = users => writeJson(USERS_FILE, users);
const getAnfragen = () => readJson(ANFRAGEN_FILE);
const saveAnfragen = anfragen => writeJson(ANFRAGEN_FILE, anfragen);
const getNachrichten = () => readJson(NACHRICHTEN_FILE);
const saveNachrichten = nachrichten => writeJson(NACHRICHTEN_FILE, nachrichten);

function gibtAkzeptierteAnfrage(userAId, userBId) {
  return getAnfragen().some(a =>
    a.status === 'akzeptiert' &&
    ((a.von === userAId && a.an === userBId) ||
     (a.von === userBId && a.an === userAId))
  );
}

// Stellt sicher, dass ein User ein vollständiges Profil hat (Migration alter User).
function mitProfil(user) {
  return { ...user, profil: baueProfil(user.profil) };
}

// ─── AUTH-MIDDLEWARE ───────────────────────────────────────────

function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Kein Token angegeben' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Ungültiger Token' });
  }
}

// Stellt sicher, dass der eingeloggte User noch existiert (Token könnte z. B. nach
// einer Konto-Löschung noch gültig sein). Für schreibende Aktionen verwenden.
function userMussExistieren(req, res, next) {
  if (!getUsers().find(u => u.id === req.user.id)) {
    return res.status(401).json({ error: 'Dein Konto existiert nicht mehr.' });
  }
  next();
}

// ─── AUTH-ROUTES (MVP-01 / MVP-02) ─────────────────────────────

// In der Testumgebung kein Rate-Limit, damit die Testsuite nicht ausgebremst wird.
const authLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : rateLimit({ fensterMs: 15 * 60 * 1000, maxAnfragen: 20 });

// POST /register
app.post('/register', authLimiter, async (req, res) => {
  const { email, passwort, name, klasse } = req.body || {};

  const fehler = validiereRegister({ email, passwort, name });
  if (fehler.length) return res.status(400).json({ error: fehler.join(' ') });

  const users = getUsers();
  if (users.find(u => u.email === email.trim().toLowerCase())) {
    return res.status(409).json({ error: 'Diese E-Mail ist bereits registriert' });
  }

  const hashedPw = await bcrypt.hash(passwort, 10);
  const neuerUser = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    klasse: (klasse || '').trim(),
    passwort: hashedPw,
    erstellt_am: new Date().toISOString(),
    profil: baueProfil({}), // leeres, gültiges Profil
  };

  users.push(neuerUser);
  saveUsers(users);

  res.status(201).json({
    message: 'Registrierung erfolgreich!',
    user: { id: neuerUser.id, name: neuerUser.name, email: neuerUser.email },
  });
});

// POST /login
app.post('/login', authLimiter, async (req, res) => {
  const { email, passwort } = req.body || {};

  const fehler = validiereLogin({ email, passwort });
  if (fehler.length) return res.status(400).json({ error: fehler.join(' ') });

  const users = getUsers();
  const user = users.find(u => u.email === email.trim().toLowerCase());

  // Bei unbekannter E-Mail trotzdem hashen wäre ideal; hier bewusst einfach gehalten.
  if (!user || !(await bcrypt.compare(passwort, user.passwort))) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    message: 'Login erfolgreich!',
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});

// ─── PROFIL-ROUTES (MVP-03 / MVP-04 / MVP-08-Löschung) ─────────

// GET /profil – eigenes Profil (inkl. E-Mail, da es das eigene ist)
app.get('/profil', authMiddleware, (req, res) => {
  const user = getUsers().find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User nicht gefunden' });

  const { passwort, ...rest } = mitProfil(user);
  res.json(rest);
});

// PUT /profil – Lernprofil erstellen/bearbeiten
app.put('/profil', authMiddleware, (req, res) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === req.user.id);
  if (index === -1) return res.status(404).json({ error: 'User nicht gefunden' });

  const neuesProfil = baueProfil(req.body || {});
  // optionale Stammdaten Name/Klasse dürfen mitgepflegt werden
  const name = typeof req.body?.name === 'string' && req.body.name.trim()
    ? req.body.name.trim()
    : users[index].name;
  const klasse = typeof req.body?.klasse === 'string'
    ? req.body.klasse.trim()
    : users[index].klasse;

  users[index] = { ...users[index], name, klasse, profil: neuesProfil };
  saveUsers(users);

  const { passwort, ...rest } = users[index];
  res.json({ message: 'Profil gespeichert!', profil: rest.profil, user: { name, klasse } });
});

// DELETE /profil – Konto + zugehörige Anfragen löschen (DSGVO, MVP-08)
app.delete('/profil', authMiddleware, (req, res) => {
  const users = getUsers();
  if (!users.find(u => u.id === req.user.id)) {
    return res.status(404).json({ error: 'User nicht gefunden' });
  }
  saveUsers(users.filter(u => u.id !== req.user.id));

  const anfragen = getAnfragen();
  saveAnfragen(anfragen.filter(a => a.von !== req.user.id && a.an !== req.user.id));

  const nachrichten = getNachrichten();
  saveNachrichten(nachrichten.filter(n => n.von !== req.user.id && n.an !== req.user.id));

  res.json({ message: 'Konto und zugehörige Daten wurden gelöscht.' });
});

// ─── BUDDIES (MVP-05 / MVP-06) ─────────────────────────────────

// GET /buddies – passende Lernpartner-Vorschläge basierend auf dem eigenen Profil
app.get('/buddies', authMiddleware, (req, res) => {
  const users = getUsers().map(mitProfil);
  const ich = users.find(u => u.id === req.user.id);
  if (!ich) return res.status(404).json({ error: 'User nicht gefunden' });

  const buddies = findeBuddies(ich, users);
  res.json({ buddies, anzahl: buddies.length });
});

// GET /users – knappe öffentliche Übersicht aller User (nur unkritische Felder).
// Detaillierte Treffer liefert /buddies; hier bewusst kein vollständiges Profil.
app.get('/users', authMiddleware, (req, res) => {
  res.json(getUsers().map(u => {
    const profil = baueProfil(u.profil);
    return { id: u.id, name: u.name, klasse: u.klasse || '', status: profil.status };
  }));
});

// ─── KONTAKTANFRAGEN (MVP-07) ──────────────────────────────────

// POST /anfragen – Kontaktanfrage senden
app.post('/anfragen', authMiddleware, userMussExistieren, (req, res) => {
  const { an, nachricht } = req.body || {};

  const fehler = validiereAnfrage({ an, nachricht });
  if (fehler.length) return res.status(400).json({ error: fehler.join(' ') });
  if (an === req.user.id) {
    return res.status(400).json({ error: 'Du kannst dir nicht selbst eine Anfrage senden.' });
  }

  const users = getUsers();
  if (!users.find(u => u.id === an)) {
    return res.status(404).json({ error: 'Empfänger nicht gefunden.' });
  }

  const anfragen = getAnfragen();
  const existiert = anfragen.find(
    a => a.von === req.user.id && a.an === an && a.status === 'offen'
  );
  if (existiert) {
    return res.status(409).json({ error: 'Es gibt bereits eine offene Anfrage an diese Person.' });
  }

  const neue = {
    id: crypto.randomUUID(),
    von: req.user.id,
    an,
    nachricht: typeof nachricht === 'string' ? nachricht.trim() : '',
    status: 'offen', // offen | akzeptiert | abgelehnt
    erstellt_am: new Date().toISOString(),
  };
  anfragen.push(neue);
  saveAnfragen(anfragen);

  res.status(201).json({ message: 'Anfrage gesendet!', anfrage: neue });
});

// GET /anfragen – eigene ein-/ausgehende Anfragen (mit Namen angereichert)
app.get('/anfragen', authMiddleware, (req, res) => {
  const users = getUsers();
  const nameVon = id => users.find(u => u.id === id)?.name || 'Unbekannt';

  const alle = getAnfragen();
  const anreichern = a => ({
    ...a,
    vonName: nameVon(a.von),
    anName: nameVon(a.an),
  });

  res.json({
    eingehend: alle.filter(a => a.an === req.user.id).map(anreichern),
    ausgehend: alle.filter(a => a.von === req.user.id).map(anreichern),
  });
});

// PUT /anfragen/:id – Anfrage akzeptieren/ablehnen (nur Empfänger:in)
app.put('/anfragen/:id', authMiddleware, (req, res) => {
  const { status } = req.body || {};
  if (!['akzeptiert', 'abgelehnt'].includes(status)) {
    return res.status(400).json({ error: 'Status muss "akzeptiert" oder "abgelehnt" sein.' });
  }

  const anfragen = getAnfragen();
  const index = anfragen.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Anfrage nicht gefunden.' });
  if (anfragen[index].an !== req.user.id) {
    return res.status(403).json({ error: 'Nur die empfangende Person darf antworten.' });
  }

  anfragen[index] = { ...anfragen[index], status };
  saveAnfragen(anfragen);
  res.json({ message: 'Anfrage aktualisiert.', anfrage: anfragen[index] });
});

// ─── CHAT / NACHRICHTEN ────────────────────────────────────────

// POST /nachrichten – Nachricht an eine andere Person senden
app.post('/nachrichten', authMiddleware, userMussExistieren, (req, res) => {
  const { an, text } = req.body || {};

  const fehler = validiereNachricht({ an, text });
  if (fehler.length) return res.status(400).json({ error: fehler.join(' ') });
  if (an === req.user.id) {
    return res.status(400).json({ error: 'Du kannst dir nicht selbst schreiben.' });
  }
  if (!getUsers().find(u => u.id === an)) {
    return res.status(404).json({ error: 'Empfänger nicht gefunden.' });
  }
  if (!gibtAkzeptierteAnfrage(req.user.id, an)) {
    return res.status(403).json({ error: 'Kein Chat möglich – die Kontaktanfrage muss zuerst akzeptiert werden.' });
  }

  const nachrichten = getNachrichten();
  const neue = {
    id: crypto.randomUUID(),
    von: req.user.id,
    an,
    text: text.trim(),
    erstellt_am: new Date().toISOString(),
  };
  nachrichten.push(neue);
  saveNachrichten(nachrichten);

  res.status(201).json({ message: 'Nachricht gesendet.', nachricht: neue });
});

// GET /nachrichten/:partnerId – kompletter Verlauf mit einer Person (chronologisch)
app.get('/nachrichten/:partnerId', authMiddleware, (req, res) => {
  const meineId = req.user.id;
  const partnerId = req.params.partnerId;

  const partner = getUsers().find(u => u.id === partnerId);
  if (!partner) return res.status(404).json({ error: 'Person nicht gefunden.' });
  if (!gibtAkzeptierteAnfrage(meineId, partnerId)) {
    return res.status(403).json({ error: 'Kein Chat möglich – die Kontaktanfrage muss zuerst akzeptiert werden.' });
  }

  const verlauf = getNachrichten()
    .filter(n =>
      (n.von === meineId && n.an === partnerId) ||
      (n.von === partnerId && n.an === meineId))
    .sort((a, b) => a.erstellt_am.localeCompare(b.erstellt_am))
    .map(n => ({ ...n, vonMir: n.von === meineId }));

  res.json({ partner: { id: partner.id, name: partner.name }, nachrichten: verlauf });
});

// GET /chats – Liste der Gesprächspartner mit letzter Nachricht
app.get('/chats', authMiddleware, (req, res) => {
  const meineId = req.user.id;
  const users = getUsers();
  const nameVon = id => users.find(u => u.id === id)?.name || 'Unbekannt';

  // Pro Partner die neueste Nachricht ermitteln
  const proPartner = new Map();
  for (const n of getNachrichten()) {
    if (n.von !== meineId && n.an !== meineId) continue;
    const partnerId = n.von === meineId ? n.an : n.von;
    const bisher = proPartner.get(partnerId);
    if (!bisher || n.erstellt_am > bisher.erstellt_am) proPartner.set(partnerId, n);
  }

  const chats = [...proPartner.entries()]
    .map(([partnerId, letzte]) => ({
      partnerId,
      partnerName: nameVon(partnerId),
      letzteNachricht: letzte.text,
      erstellt_am: letzte.erstellt_am,
    }))
    .sort((a, b) => b.erstellt_am.localeCompare(a.erstellt_am));

  res.json({ chats });
});

// ─── SERVERSTART ───────────────────────────────────────────────

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Server läuft auf http://localhost:${PORT}`);
    console.log('');
    console.log('📌 Endpoints:');
    console.log('  POST   /register      → Registrieren');
    console.log('  POST   /login         → Login & Token');
    console.log('  GET    /profil        → Eigenes Profil');
    console.log('  PUT    /profil        → Profil speichern');
    console.log('  DELETE /profil        → Konto löschen');
    console.log('  GET    /buddies       → Lernpartner-Vorschläge');
    console.log('  GET    /users         → Alle User');
    console.log('  POST   /anfragen      → Kontaktanfrage senden');
    console.log('  GET    /anfragen      → Eigene Anfragen');
    console.log('  PUT    /anfragen/:id  → Anfrage beantworten');
    console.log('  POST   /nachrichten   → Chat-Nachricht senden');
    console.log('  GET    /nachrichten/:id → Verlauf mit Person');
    console.log('  GET    /chats         → Gesprächsliste');
  });
}

module.exports = app;
