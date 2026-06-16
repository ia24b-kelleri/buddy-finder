# Code Review: BuddyFinder (lokale Änderungen)

**Datum**: 2026-06-16
**Branch**: feature/mvp-lernprofil-matching
**Entscheidung**: REQUEST CHANGES (1 HIGH; übrige MEDIUM/LOW, viele kontextbedingt akzeptabel)

## Zusammenfassung
Solide, gut strukturierte Erweiterung: Auth → vollständiger MVP + Chat, mehrseitiges
Frontend, ausgelagerte testbare Logik, 22 grüne Tests. Sicherheits-Grundlagen stimmen
(Secret in .env, Validierung, Rate-Limit, XSS-sicheres DOM). Ein HIGH-Punkt (getrackte
Personendaten) und einige MEDIUM-Punkte (JSON-Race-Conditions, trust proxy, ID-Kollision,
Sender-Prüfung) sollten adressiert werden.

## Findings

### CRITICAL
Keine aktiven. (Hinweis: altes Secret `lernpartner-secret-key-2024` liegt in der
Git-History, ist aber durch die Rotation auf ein neues .env-Secret nicht mehr nutzbar.)

### HIGH
- **data/users.json im Git getrackt** – enthält echte E-Mails + bcrypt-Hashes, Repo ist
  öffentlich. `.gitignore` schließt `data/` nicht aus. → `data/*.json` ignorieren und
  mit `git rm --cached` aus dem Tracking nehmen (Seed-Daten ggf. als `data/seed.example.json`).

### MEDIUM
- **JSON-Race-Conditions** (server.js): read-modify-write ohne Locking auf users/anfragen/
  nachrichten.json. Parallele Schreibzugriffe können verloren gehen. Für Lern-MVP ok,
  Post-MVP: echte DB (SQLite) oder Schreib-Queue.
- **`app.set('trust proxy', true)`** (server.js:~41) + IP-basiertes Rate-Limit: `req.ip`
  übernimmt dann ungeprüft `X-Forwarded-For` → Rate-Limit per Header umgehbar. Lokal nicht
  nötig → entfernen oder auf konkrete Proxy-Anzahl setzen.
- **Sender-Existenz nicht geprüft** in `POST /nachrichten` und `POST /anfragen`: ein
  gelöschter Account mit noch gültigem (24h) Token könnte weiter senden. Prüfung
  `getUsers().find(u => u.id === req.user.id)` ergänzen.
- **ID-Kollision**: `Date.now().toString()` für User/Anfragen kann bei zwei Aktionen in
  derselben Millisekunde kollidieren (Nachrichten haben bereits einen Zufallssuffix).
  Einheitlich `crypto.randomUUID()` verwenden.
- **GET /users** liefert allen eingeloggten Nutzern die vollständigen Profile (faecher,
  interessen, lernzeiten, bio) – mehr als nötig. Auf das Nötige reduzieren oder Endpoint
  entfernen, falls ungenutzt.
- **Kein Test für lib/rateLimit.js**.

### LOW
- **User-Enumeration** via Timing in `/login` (bcrypt nur wenn User existiert). Optional
  Dummy-Hash-Vergleich.
- **console.log/warn** in server.js (Startup-Logs) – laut Hausregel kein console.log;
  hier vertretbar, ein Logger wäre überengineered.
- **node_modules im Git getrackt** – Repo-Bloat. `git rm -r --cached node_modules`.
- **Passwort-Mindestlänge 6** – schwach; 8+ empfohlen.
- **Kein lint/typecheck/build-Script** – ESLint ergänzen für CI/Hausregeln.
- **Keine Frontend-/E2E-Tests** (Playwright) – Web-Testregeln empfehlen Visual/Smoke-Tests.

## Positiv
- XSS-sicheres Rendering von Fremddaten via `el()`/textContent statt innerHTML.
- Secret aus dem Code in `.env` + `.gitignore`.
- Validierung & Matching in `lib/` ausgelagert und unit-getestet.
- Gute Testabdeckung (Matching, Validierung, komplette API inkl. Chat) – 22 Tests grün.
- Sensible Felder (passwort/email) werden vor Responses entfernt.
- Rate-Limiting auf Auth-Routen; in Testumgebung sauber deaktiviert.

## Validation

| Check | Ergebnis |
|---|---|
| Type check | Übersprungen (kein TS/Script) |
| Lint | Übersprungen (nicht konfiguriert) |
| Tests | Pass (22/22) |
| Build | Entfällt (kein Build-Schritt) |

## Geprüfte Dateien
server.js (M), index.html (M), datenschutz.html (M), package.json (M), README.md (M),
data/users.json (M), app.js (A), style.css (A), register/dashboard/profil/buddies/anfragen/
chat.html (A), lib/matching.js (A), lib/validation.js (A), lib/rateLimit.js (A),
test/*.test.js (A), .env.example (A), .gitignore (A), data/anfragen.json (A),
data/nachrichten.json (A)
