// test/matching.test.js – Unit-Tests der reinen Matching-Logik
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  gemeinsame,
  zeitZuMinuten,
  zaehleZeitUeberlappungen,
  berechneScore,
  findeBuddies,
} = require('../lib/matching');

test('gemeinsame findet Schnittmenge case-insensitive und ohne Duplikate', () => {
  assert.deepEqual(gemeinsame(['Mathe', 'Info'], ['mathe', 'Bio']), ['mathe']);
  assert.deepEqual(gemeinsame([], ['Bio']), []);
  assert.deepEqual(gemeinsame(undefined, null), []);
});

test('zeitZuMinuten parst gültige Zeiten und lehnt ungültige ab', () => {
  assert.equal(zeitZuMinuten('18:30'), 18 * 60 + 30);
  assert.equal(zeitZuMinuten('00:00'), 0);
  assert.equal(zeitZuMinuten('25:00'), null);
  assert.equal(zeitZuMinuten('abc'), null);
});

test('zaehleZeitUeberlappungen erkennt überlappende Slots am selben Tag', () => {
  const a = [{ tag: 'Mo', von: '18:00', bis: '20:00' }];
  const b = [{ tag: 'Mo', von: '19:00', bis: '21:00' }];
  assert.equal(zaehleZeitUeberlappungen(a, b), 1);
});

test('zaehleZeitUeberlappungen ignoriert verschiedene Tage und nicht-überlappende Zeiten', () => {
  const a = [{ tag: 'Mo', von: '18:00', bis: '20:00' }];
  assert.equal(zaehleZeitUeberlappungen(a, [{ tag: 'Di', von: '18:00', bis: '20:00' }]), 0);
  assert.equal(zaehleZeitUeberlappungen(a, [{ tag: 'Mo', von: '20:00', bis: '21:00' }]), 0);
});

test('berechneScore gewichtet Fächer > Interessen > Zeiten', () => {
  const meins = { faecher: ['Mathe'], interessen: ['KI'], lernzeiten: [{ tag: 'Mo', von: '18:00', bis: '20:00' }] };
  const anders = { faecher: ['mathe'], interessen: ['ki'], lernzeiten: [{ tag: 'Mo', von: '19:00', bis: '20:00' }] };
  const { score, gemeinsameFaecher, gemeinsameInteressen } = berechneScore(meins, anders);
  assert.equal(score, 3 + 2 + 1);
  assert.deepEqual(gemeinsameFaecher, ['mathe']);
  assert.deepEqual(gemeinsameInteressen, ['ki']);
});

test('findeBuddies schließt einen selbst aus und sortiert nach Score', () => {
  const ich = { id: '1', profil: { faecher: ['Mathe', 'Info'], interessen: ['KI'], lernzeiten: [] } };
  const alle = [
    ich,
    { id: '2', name: 'Bob', profil: { faecher: ['Mathe'], interessen: [], lernzeiten: [] } },         // score 3
    { id: '3', name: 'Cara', profil: { faecher: ['Mathe', 'Info'], interessen: ['KI'], lernzeiten: [] } }, // score 8
    { id: '4', name: 'Dan', profil: { faecher: ['Bio'], interessen: [], lernzeiten: [] } },             // score 0 -> raus
  ];
  const result = findeBuddies(ich, alle);
  assert.equal(result.length, 2);
  assert.equal(result[0].name, 'Cara'); // höchster Score zuerst
  assert.equal(result[1].name, 'Bob');
  assert.ok(result.every(b => b.id !== '1'));
});

test('findeBuddies liefert leere Liste, wenn keine Überschneidung besteht', () => {
  const ich = { id: '1', profil: { faecher: ['Mathe'], interessen: [], lernzeiten: [] } };
  const alle = [ich, { id: '2', name: 'X', profil: { faecher: ['Bio'], interessen: [], lernzeiten: [] } }];
  assert.deepEqual(findeBuddies(ich, alle), []);
});
