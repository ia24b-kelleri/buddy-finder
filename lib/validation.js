// lib/validation.js
// Serverseitige Eingabe-Validierung & Normalisierung an den API-Grenzen.
// Bewusst ohne externe Abhängigkeiten (kein zod), passend zum Projekt-Setup.

const PASSWORT_MIN_LAENGE = 6;
const MAX_FELD_LAENGE = 80;     // einzelne Fächer/Interessen
const MAX_LISTEN_LAENGE = 30;   // Anzahl Fächer/Interessen/Lernzeiten
const MAX_BIO_LAENGE = 500;
const MAX_NACHRICHT_LAENGE = 1000;
const STATUS_WERTE = ['verfügbar', 'beschäftigt', 'sucht Lernpartner'];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZEIT_REGEX = /^(\d{1,2}):(\d{2})$/;

function istNichtLeererString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Validiert Registrierungsdaten.
 * @returns {string[]} Liste von Fehlermeldungen (leer = gültig)
 */
function validiereRegister({ email, passwort, name } = {}) {
  const fehler = [];
  if (!istNichtLeererString(name)) fehler.push('Name ist erforderlich.');
  if (!istNichtLeererString(email)) {
    fehler.push('E-Mail ist erforderlich.');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    fehler.push('E-Mail-Format ist ungültig.');
  }
  if (typeof passwort !== 'string' || passwort.length < PASSWORT_MIN_LAENGE) {
    fehler.push(`Passwort muss mindestens ${PASSWORT_MIN_LAENGE} Zeichen lang sein.`);
  }
  return fehler;
}

/**
 * Validiert Login-Daten.
 * @returns {string[]}
 */
function validiereLogin({ email, passwort } = {}) {
  const fehler = [];
  if (!istNichtLeererString(email)) fehler.push('E-Mail ist erforderlich.');
  if (!istNichtLeererString(passwort)) fehler.push('Passwort ist erforderlich.');
  return fehler;
}

/**
 * Bereinigt eine String-Liste (Fächer / Interessen): trimmen, Leeres/zu langes raus,
 * Duplikate entfernen, auf Maximalanzahl begrenzen.
 * @param {unknown} liste
 * @returns {string[]}
 */
function bereinigeStringListe(liste) {
  if (!Array.isArray(liste)) return [];
  const gesehen = new Set();
  const ergebnis = [];
  for (const eintrag of liste) {
    if (typeof eintrag !== 'string') continue;
    const wert = eintrag.trim().slice(0, MAX_FELD_LAENGE);
    if (!wert) continue;
    const schluessel = wert.toLowerCase();
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    ergebnis.push(wert);
    if (ergebnis.length >= MAX_LISTEN_LAENGE) break;
  }
  return ergebnis;
}

/**
 * Bereinigt Lernzeiten zu gültigen { tag, von, bis }-Objekten.
 * Ungültige Einträge (fehlende/kaputte Zeiten, von >= bis) werden verworfen.
 * @param {unknown} liste
 * @returns {Array<{tag: string, von: string, bis: string}>}
 */
function bereinigeLernzeiten(liste) {
  if (!Array.isArray(liste)) return [];
  const ergebnis = [];
  for (const eintrag of liste) {
    if (!eintrag || typeof eintrag !== 'object') continue;
    const tag = typeof eintrag.tag === 'string' ? eintrag.tag.trim() : '';
    const von = typeof eintrag.von === 'string' ? eintrag.von.trim() : '';
    const bis = typeof eintrag.bis === 'string' ? eintrag.bis.trim() : '';
    if (!tag || !ZEIT_REGEX.test(von) || !ZEIT_REGEX.test(bis)) continue;

    const [vh, vm] = von.split(':').map(Number);
    const [bh, bm] = bis.split(':').map(Number);
    if (vh > 23 || bh > 23 || vm > 59 || bm > 59) continue;
    if (vh * 60 + vm >= bh * 60 + bm) continue; // von muss vor bis liegen

    ergebnis.push({ tag, von, bis });
    if (ergebnis.length >= MAX_LISTEN_LAENGE) break;
  }
  return ergebnis;
}

/**
 * Baut aus beliebiger Eingabe ein sauberes, vollständiges Profil-Objekt.
 * Fehlende Felder bekommen sichere Defaults -> auch für die Migration alter User.
 * @param {object} [eingabe]
 * @returns {{ faecher: string[], interessen: string[], lernzeiten: Array, status: string, bio: string }}
 */
function baueProfil(eingabe = {}) {
  const quelle = eingabe && typeof eingabe === 'object' ? eingabe : {};
  return {
    faecher: bereinigeStringListe(quelle.faecher),
    interessen: bereinigeStringListe(quelle.interessen),
    lernzeiten: bereinigeLernzeiten(quelle.lernzeiten),
    status: STATUS_WERTE.includes(quelle.status) ? quelle.status : 'verfügbar',
    bio: typeof quelle.bio === 'string' ? quelle.bio.trim().slice(0, MAX_BIO_LAENGE) : '',
  };
}

/**
 * Validiert eine Chat-Nachricht (Text ist Pflicht).
 * @returns {string[]}
 */
function validiereNachricht({ an, text } = {}) {
  const fehler = [];
  if (!istNichtLeererString(an)) fehler.push('Empfänger ist erforderlich.');
  if (!istNichtLeererString(text)) {
    fehler.push('Nachricht darf nicht leer sein.');
  } else if (text.length > MAX_NACHRICHT_LAENGE) {
    fehler.push(`Nachricht darf höchstens ${MAX_NACHRICHT_LAENGE} Zeichen haben.`);
  }
  return fehler;
}

/**
 * Validiert eine Kontaktanfrage.
 * @returns {string[]}
 */
function validiereAnfrage({ an, nachricht } = {}) {
  const fehler = [];
  if (!istNichtLeererString(an)) fehler.push('Empfänger ist erforderlich.');
  if (nachricht !== undefined && typeof nachricht !== 'string') {
    fehler.push('Nachricht muss Text sein.');
  } else if (typeof nachricht === 'string' && nachricht.length > MAX_NACHRICHT_LAENGE) {
    fehler.push(`Nachricht darf höchstens ${MAX_NACHRICHT_LAENGE} Zeichen haben.`);
  }
  return fehler;
}

module.exports = {
  PASSWORT_MIN_LAENGE,
  STATUS_WERTE,
  MAX_NACHRICHT_LAENGE,
  istNichtLeererString,
  validiereRegister,
  validiereLogin,
  bereinigeStringListe,
  bereinigeLernzeiten,
  baueProfil,
  validiereAnfrage,
  validiereNachricht,
};
