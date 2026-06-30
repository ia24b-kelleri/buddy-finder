// test/validation.test.js – Unit-Tests der Eingabe-Validierung/Normalisierung
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  validiereRegister,
  validiereLogin,
  bereinigeStringListe,
  bereinigeLernzeiten,
  baueProfil,
  validiereAnfrage,
} = require('../lib/validation');

test('validiereRegister meldet fehlende/ungültige Felder', () => {
  assert.equal(validiereRegister({ name: 'A', email: 'a@b.de', passwort: 'geheim1' }).length, 0);
  assert.ok(validiereRegister({ name: '', email: 'a@b.de', passwort: 'geheim1' }).length > 0);
  assert.ok(validiereRegister({ name: 'A', email: 'keine-mail', passwort: 'geheim1' }).length > 0);
  assert.ok(validiereRegister({ name: 'A', email: 'a@b.de', passwort: '123' }).length > 0);
});

test('validiereLogin verlangt E-Mail und Passwort', () => {
  assert.equal(validiereLogin({ email: 'a@b.de', passwort: 'x' }).length, 0);
  assert.ok(validiereLogin({ email: '', passwort: '' }).length > 0);
});

test('bereinigeStringListe trimmt, entfernt Leeres und Duplikate', () => {
  assert.deepEqual(bereinigeStringListe(['  Mathe ', 'Mathe', '', 'Info']), ['Mathe', 'Info']);
  assert.deepEqual(bereinigeStringListe('kein array'), []);
});

test('bereinigeLernzeiten verwirft ungültige Einträge (von >= bis, kaputte Zeit)', () => {
  const ein = [
    { tag: 'Mo', von: '18:00', bis: '20:00' }, // ok
    { tag: 'Di', von: '20:00', bis: '19:00' }, // von >= bis -> raus
    { tag: '', von: '18:00', bis: '20:00' },   // kein Tag -> raus
    { tag: 'Mi', von: 'xx', bis: '20:00' },    // kaputte Zeit -> raus
  ];
  assert.deepEqual(bereinigeLernzeiten(ein), [{ tag: 'Mo', von: '18:00', bis: '20:00' }]);
});

test('baueProfil liefert sichere Defaults und gültigen Status', () => {
  const p = baueProfil({});
  assert.deepEqual(p, { faecher: [], interessen: [], lernzeiten: [], status: 'verfügbar', bio: '' });
  assert.equal(baueProfil({ status: 'quatsch' }).status, 'verfügbar');
  assert.equal(baueProfil({ status: 'beschäftigt' }).status, 'beschäftigt');
  assert.equal(baueProfil({ status: 'sucht Lernpartner' }).status, 'sucht Lernpartner');
});

test('validiereAnfrage verlangt Empfänger', () => {
  assert.equal(validiereAnfrage({ an: '123', nachricht: 'hi' }).length, 0);
  assert.ok(validiereAnfrage({ an: '' }).length > 0);
});
