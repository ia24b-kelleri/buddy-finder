# Lernpartner App – Backend

Simples Node.js/Express Backend mit JSON-File Storage.

## Setup

```bash
npm install
```

## Server starten

**Normal (falls node im PATH ist):**
```bash
node server.js
```

**Windows (falls node nicht erkannt wird):**
```bash
& "C:\Program Files\nodejs\node.exe" server.js
```

Danach im Browser öffnen: http://localhost:3000

## Endpoints
- POST /register → Neuen User registrieren
- POST /login → Einloggen & Token holen  
- GET /profil → Eigenes Profil (Token nötig)
- GET /users → Alle User (Token nötig)

## Daten
User werden in `data/users.json` gespeichert.  
Passwörter werden mit **bcrypt** gehasht – nie im Klartext gespeichert!
