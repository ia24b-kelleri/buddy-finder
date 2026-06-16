# 🤝 BuddyFinder – Lernpartner-App

BuddyFinder hilft Studierenden, passende Lernpartner:innen ("Buddies") zu finden.
Man erstellt ein Lernprofil mit Fächern, Interessen und Lernzeiten und bekommt
automatisch passende Vorschläge. Buddies kann man kontaktieren und in einem Chat
miteinander schreiben.

Kleines Full-Stack-Projekt: **Node.js + Express** als Backend mit **JSON-File-Storage**,
Frontend als **mehrseitige Vanilla-HTML/CSS/JS-App**, die vom Backend ausgeliefert wird.

---

## ✨ Funktionen

| # | Funktion | Beschreibung |
|---|----------|--------------|
| 01 | Registrierung | Konto mit E-Mail + Passwort erstellen |
| 02 | Login | Anmelden via JWT-Token (24 h gültig) |
| 03 | Lernprofil erstellen | Fächer, Interessen, Lernzeiten, Status, Bio erfassen |
| 04 | Lernprofil bearbeiten | Profildaten jederzeit ändern |
| 05 | Lernpartner anzeigen | Vorschläge per Matching-Score (gemeinsame Fächer/Interessen/Zeiten) |
| 06 | Lernstatus anzeigen | Name, Klasse und Status der Buddies sehen |
| 07 | Buddy kontaktieren | Kontaktanfrage senden, annehmen oder ablehnen |
| 💬 | Chat | Fortlaufend Nachrichten mit Buddies austauschen (Live-Aktualisierung) |
| 08 | Datenschutz | Daten geschützt gespeichert, Datenschutzseite, Konto-Löschung |

---

## 🚀 Setup

Voraussetzung: **Node.js 20+** (entwickelt mit Node 22).

```bash
npm install
cp .env.example .env
```

Anschließend in `.env` ein sicheres `JWT_SECRET` setzen. Wert generieren mit:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## ▶️ Starten

```bash
npm start
```

> **Windows (falls `node` nicht im PATH ist):**
> ```bash
> & "C:\Program Files\nodejs\node.exe" server.js
> ```

Danach im Browser öffnen: **http://localhost:3000**

> ⚠️ **Wichtig:** Die App über `http://localhost:3000` öffnen – also über den Server –,
> **nicht** die `index.html` direkt aus der IDE/Datei. Sonst findet das Frontend das
> Backend nicht (das verursacht 404-Fehler). Nach Änderungen am Backend (`server.js`,
> `lib/`) den Server neu starten; Frontend-Änderungen wirken sofort beim Neuladen.

---

## 🧪 Tests

```bash
npm test
```

Es laufen Unit-Tests (Matching-Logik, Validierung) und Integrationstests (komplette
HTTP-API inkl. Registrierung, Login, Profil, Matching, Anfragen, Chat, Löschung).

---

## 🔌 API-Endpoints

| Methode | Pfad | Auth | Zweck |
|---------|------|:----:|-------|
| POST | `/register` | – | Konto erstellen |
| POST | `/login` | – | Login & Token holen |
| GET | `/profil` | ✅ | Eigenes Profil lesen |
| PUT | `/profil` | ✅ | Lernprofil speichern/ändern |
| DELETE | `/profil` | ✅ | Konto + alle Daten löschen |
| GET | `/buddies` | ✅ | Lernpartner-Vorschläge (Matching) |
| GET | `/users` | ✅ | Alle User (ohne sensible Felder) |
| POST | `/anfragen` | ✅ | Kontaktanfrage senden |
| GET | `/anfragen` | ✅ | Eigene ein-/ausgehende Anfragen |
| PUT | `/anfragen/:id` | ✅ | Anfrage annehmen/ablehnen |
| POST | `/nachrichten` | ✅ | Chat-Nachricht senden |
| GET | `/nachrichten/:partnerId` | ✅ | Verlauf mit einer Person |
| GET | `/chats` | ✅ | Liste der Gesprächspartner |

Geschützte Routen erwarten den Header `Authorization: Bearer <token>`.

### Matching-Score

```
Score = 3 × gemeinsame Fächer
      + 2 × gemeinsame Interessen
      + 1 × überlappende Lernzeit-Fenster
```
Vorschläge mit Score 0 werden ausgeblendet, der Rest absteigend sortiert.

---

## 🗂️ Projektstruktur

```
server.js              Express-App + alle Routen
lib/
  ├─ matching.js       Matching-Logik (Score-Berechnung)
  ├─ validation.js     Eingabe-Validierung & Profil-Normalisierung
  └─ rateLimit.js      In-Memory Rate-Limiter (Login/Registrierung)
style.css              Geteilte Styles aller Seiten
app.js                 Geteiltes Frontend-JS (API, Auth-Guard, Navigation)
index.html             Login (Einstieg)
register.html          Registrierung
dashboard.html         Übersicht
profil.html            Lernprofil bearbeiten
buddies.html           Lernpartner-Vorschläge
anfragen.html          Kontaktanfragen
chat.html              Chat zwischen Nutzer:innen
datenschutz.html       Datenschutzerklärung
data/
  ├─ users.json        Nutzer inkl. profil (faecher, interessen, lernzeiten, status, bio)
  ├─ anfragen.json     Kontaktanfragen (von, an, nachricht, status)
  └─ nachrichten.json  Chat-Nachrichten (von, an, text, erstellt_am)
test/                  Unit- & Integrationstests
```

---

## 🔐 Sicherheit & Datenschutz

- Passwörter werden mit **bcrypt** gehasht – nie im Klartext gespeichert.
- Das **JWT_SECRET** liegt in `.env` (per `.gitignore` ausgeschlossen, nicht im Code).
- Eingaben werden **serverseitig validiert** (E-Mail-Format, Passwortlänge, Profilfelder).
- **Rate-Limiting** auf Login/Registrierung gegen Brute-Force.
- Buddies sehen nur unkritische Daten (Name, Klasse, gemeinsame Treffer, Status) –
  **niemals** E-Mail, Passwort oder interne ID.
- **Konto-Löschung** entfernt Nutzer, Anfragen und Nachrichten (DSGVO).

---

## 🛠️ Tech-Stack

- **Backend:** Node.js, Express
- **Auth:** JSON Web Tokens (jsonwebtoken), bcryptjs
- **Storage:** JSON-Dateien (kein externer DB-Server nötig)
- **Frontend:** Vanilla HTML/CSS/JS (mehrseitig, vom Backend ausgeliefert)
- **Tests:** node:test (eingebaut), HTTP-Integrationstests via fetch
