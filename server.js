const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// CORS erlauben
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// index.html statisch servieren
app.use(express.static(path.join(__dirname)));

const DB_FILE = path.join(__dirname, 'data', 'users.json');
const JWT_SECRET = 'lernpartner-secret-key-2024';

// Sicherstellen dass data-Ordner und users.json existieren
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

// Hilfsfunktionen
function getUsers() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function saveUsers(users) {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

// Middleware: Token prüfen
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Kein Token angegeben' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Ungültiger Token' });
  }
}

// ─── ROUTES ────────────────────────────────────────────────────

// POST /register
app.post('/register', async (req, res) => {
  const { email, passwort, name, klasse } = req.body;

  if (!email || !passwort || !name) {
    return res.status(400).json({ error: 'Email, Passwort und Name sind Pflichtfelder' });
  }

  const users = getUsers();

  // Prüfen ob E-Mail schon vorhanden
  if (users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'Diese E-Mail ist bereits registriert' });
  }

  // Passwort hashen
  const hashedPw = await bcrypt.hash(passwort, 10);

  const neuerUser = {
    id: Date.now().toString(),
    name,
    email,
    klasse: klasse || '',
    passwort: hashedPw,
    erstellt_am: new Date().toISOString()
  };

  users.push(neuerUser);
  saveUsers(users);

  res.status(201).json({
    message: 'Registrierung erfolgreich!',
    user: { id: neuerUser.id, name: neuerUser.name, email: neuerUser.email }
  });
});

// POST /login
app.post('/login', async (req, res) => {
  const { email, passwort } = req.body;

  if (!email || !passwort) {
    return res.status(400).json({ error: 'Email und Passwort erforderlich' });
  }

  const users = getUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
  }

  const passwortKorrekt = await bcrypt.compare(passwort, user.passwort);
  if (!passwortKorrekt) {
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
    user: { id: user.id, name: user.name, email: user.email }
  });
});

// GET /profil (geschützte Route - nur mit Token)
app.get('/profil', authMiddleware, (req, res) => {
  const users = getUsers();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User nicht gefunden' });

  const { passwort, ...userOhnePasswort } = user;
  res.json(userOhnePasswort);
});

// GET /users (alle User anzeigen - ohne Passwörter)
app.get('/users', authMiddleware, (req, res) => {
  const users = getUsers().map(({ passwort, ...u }) => u);
  res.json(users);
});

// Server starten
app.listen(3000, () => {
  console.log('✅ Server läuft auf http://localhost:3000');
  console.log('');
  console.log('📌 Endpoints:');
  console.log('  POST /register  → Neuen User registrieren');
  console.log('  POST /login     → Einloggen & Token holen');
  console.log('  GET  /profil    → Eigenes Profil (Token nötig)');
  console.log('  GET  /users     → Alle User (Token nötig)');
});
