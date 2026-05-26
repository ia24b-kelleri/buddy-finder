# Lernpartner App – Backend

Simples Node.js/Express Backend mit JSON-File Storage.

## Setup

```bash
npm install
node server.js
```

## Endpoints

### Registrieren
```
POST http://localhost:3000/register
Content-Type: application/json

{
  "name": "Ivan Muster",
  "email": "ivan@example.com",
  "passwort": "sicheresPasswort123",
  "klasse": "AB24c"
}
```

### Login
```
POST http://localhost:3000/login
Content-Type: application/json

{
  "email": "ivan@example.com",
  "passwort": "sicheresPasswort123"
}
```
→ Gibt ein **JWT Token** zurück

### Profil anzeigen (Token nötig)
```
GET http://localhost:3000/profil
Authorization: Bearer <dein-token>
```

### Alle User anzeigen (Token nötig)
```
GET http://localhost:3000/users
Authorization: Bearer <dein-token>
```

## Daten
User werden in `data/users.json` gespeichert.  
Passwörter werden mit **bcrypt** gehasht – nie im Klartext gespeichert!
