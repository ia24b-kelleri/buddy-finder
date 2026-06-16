// test/api.test.js – Integrationstests der HTTP-API
// Nutzt ein temporäres DATA_DIR, damit keine echten Daten verändert werden.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Test-Umgebung VOR dem Laden von server.js setzen
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'buddyfinder-test-'));
process.env.DATA_DIR = TMP;
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const app = require('../server');

let server;
let basis;

before(async () => {
  await new Promise(res => { server = app.listen(0, res); });
  basis = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

async function req(pfad, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(basis + pfad, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function registriereUndLogin(email, name) {
  await req('/register', { method: 'POST', body: { email, passwort: 'geheim1', name, klasse: 'AB1' } });
  const { data } = await req('/login', { method: 'POST', body: { email, passwort: 'geheim1' } });
  return { token: data.token, id: data.user.id };
}

test('Registrierung: Pflichtfelder fehlen -> 400', async () => {
  const { status } = await req('/register', { method: 'POST', body: { email: 'x@y.de' } });
  assert.equal(status, 400);
});

test('Registrierung & doppelte E-Mail -> 409', async () => {
  const r1 = await req('/register', { method: 'POST', body: { email: 'a@b.de', passwort: 'geheim1', name: 'Anna', klasse: 'AB1' } });
  assert.equal(r1.status, 201);
  const r2 = await req('/register', { method: 'POST', body: { email: 'a@b.de', passwort: 'geheim1', name: 'Anna2', klasse: 'AB1' } });
  assert.equal(r2.status, 409);
});

test('Login falsch -> 401, geschützte Route ohne Token -> 401', async () => {
  const bad = await req('/login', { method: 'POST', body: { email: 'a@b.de', passwort: 'falsch' } });
  assert.equal(bad.status, 401);
  const noToken = await req('/profil');
  assert.equal(noToken.status, 401);
});

test('Profil speichern und wieder laden (MVP-03/04)', async () => {
  const { token } = await registriereUndLogin('profil@b.de', 'Pia');
  const put = await req('/profil', { method: 'PUT', token, body: {
    faecher: ['Mathematik', 'Informatik'],
    interessen: ['KI'],
    lernzeiten: [{ tag: 'Mo', von: '18:00', bis: '20:00' }],
    status: 'sucht aktiv',
    bio: 'Lerne gern abends',
  } });
  assert.equal(put.status, 200);

  const get = await req('/profil', { token });
  assert.deepEqual(get.data.profil.faecher, ['Mathematik', 'Informatik']);
  assert.equal(get.data.profil.lernzeiten.length, 1);
});

test('Buddies-Matching liefert passende Vorschläge (MVP-05)', async () => {
  const a = await registriereUndLogin('match-a@b.de', 'Alex');
  const b = await registriereUndLogin('match-b@b.de', 'Ben');
  const profil = { faecher: ['Physik'], interessen: ['Robotik'], lernzeiten: [] };
  await req('/profil', { method: 'PUT', token: a.token, body: profil });
  await req('/profil', { method: 'PUT', token: b.token, body: profil });

  const { status, data } = await req('/buddies', { token: a.token });
  assert.equal(status, 200);
  const ben = data.buddies.find(x => x.id === b.id);
  assert.ok(ben, 'Ben sollte als Buddy erscheinen');
  assert.ok(ben.score > 0);
  assert.ok(ben.gemeinsameFaecher.includes('physik'));
});

test('Kontaktanfrage senden, empfangen und annehmen (MVP-07)', async () => {
  const sender = await registriereUndLogin('sender@b.de', 'Sam');
  const empf = await registriereUndLogin('empf@b.de', 'Emi');

  const send = await req('/anfragen', { method: 'POST', token: sender.token, body: { an: empf.id, nachricht: 'Hallo!' } });
  assert.equal(send.status, 201);

  // doppelte offene Anfrage -> 409
  const dup = await req('/anfragen', { method: 'POST', token: sender.token, body: { an: empf.id } });
  assert.equal(dup.status, 409);

  const eingang = await req('/anfragen', { token: empf.token });
  assert.equal(eingang.data.eingehend.length, 1);
  const anfrageId = eingang.data.eingehend[0].id;

  const antwort = await req('/anfragen/' + anfrageId, { method: 'PUT', token: empf.token, body: { status: 'akzeptiert' } });
  assert.equal(antwort.status, 200);
  assert.equal(antwort.data.anfrage.status, 'akzeptiert');
});

test('Chat: Nachrichten senden, Verlauf und Gesprächsliste', async () => {
  const a = await registriereUndLogin('chat-a@b.de', 'Chatty');
  const b = await registriereUndLogin('chat-b@b.de', 'Bea');

  // leerer Text -> 400
  const leer = await req('/nachrichten', { method: 'POST', token: a.token, body: { an: b.id, text: '  ' } });
  assert.equal(leer.status, 400);

  // Hin und Her
  await req('/nachrichten', { method: 'POST', token: a.token, body: { an: b.id, text: 'Hallo Bea!' } });
  await req('/nachrichten', { method: 'POST', token: b.token, body: { an: a.id, text: 'Hi Chatty!' } });

  // Verlauf aus Sicht von A: chronologisch, vonMir korrekt
  const verlauf = await req('/nachrichten/' + b.id, { token: a.token });
  assert.equal(verlauf.status, 200);
  assert.equal(verlauf.data.nachrichten.length, 2);
  assert.equal(verlauf.data.nachrichten[0].text, 'Hallo Bea!');
  assert.equal(verlauf.data.nachrichten[0].vonMir, true);
  assert.equal(verlauf.data.nachrichten[1].vonMir, false);

  // Gesprächsliste von B enthält A mit letzter Nachricht
  const chats = await req('/chats', { token: b.token });
  assert.equal(chats.data.chats.length, 1);
  assert.equal(chats.data.chats[0].partnerId, a.id);
  assert.equal(chats.data.chats[0].letzteNachricht, 'Hi Chatty!');
});

test('Chat: an sich selbst schreiben -> 400', async () => {
  const a = await registriereUndLogin('chat-self@b.de', 'Solo');
  const r = await req('/nachrichten', { method: 'POST', token: a.token, body: { an: a.id, text: 'hi' } });
  assert.equal(r.status, 400);
});

test('Konto löschen entfernt User (MVP-08)', async () => {
  const { token } = await registriereUndLogin('loeschen@b.de', 'Leo');
  const del = await req('/profil', { method: 'DELETE', token });
  assert.equal(del.status, 200);
  const nachher = await req('/profil', { token });
  assert.equal(nachher.status, 404);
});

test('Gelöschtes Konto kann mit altem Token nicht mehr senden', async () => {
  const sender = await registriereUndLogin('ghost@b.de', 'Ghost');
  const empf = await registriereUndLogin('lebt@b.de', 'Lebt');
  await req('/profil', { method: 'DELETE', token: sender.token });

  // Token ist technisch noch gültig, das Konto existiert aber nicht mehr -> 401
  const nachricht = await req('/nachrichten', { method: 'POST', token: sender.token, body: { an: empf.id, text: 'spuk' } });
  assert.equal(nachricht.status, 401);
  const anfrage = await req('/anfragen', { method: 'POST', token: sender.token, body: { an: empf.id } });
  assert.equal(anfrage.status, 401);
});
