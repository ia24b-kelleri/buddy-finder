// lib/matching.js
// Reine, testbare Matching-Logik für BuddyFinder (MVP-05/06).
// Keine Abhängigkeiten zu Express oder Dateisystem -> gut unit-testbar.

// Gewichtung des Scorings (siehe Plan): Fächer > Interessen > Lernzeiten.
const GEWICHT_FACH = 3;
const GEWICHT_INTERESSE = 2;
const GEWICHT_LERNZEIT = 1;

const MAX_VORSCHLAEGE = 10;

/**
 * Normalisiert eine Liste von Strings: trimmen, kleinschreiben, Leeres entfernen,
 * Duplikate raus.
 * @param {unknown} liste
 * @returns {string[]}
 */
function normalisiere(liste) {
  if (!Array.isArray(liste)) return [];
  const sauber = liste
    .filter(x => typeof x === 'string')
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(sauber)];
}

/**
 * Gemeinsame Einträge zweier Listen (case-insensitive).
 * @param {unknown} a
 * @param {unknown} b
 * @returns {string[]}
 */
function gemeinsame(a, b) {
  const mengeB = new Set(normalisiere(b));
  return normalisiere(a).filter(x => mengeB.has(x));
}

/**
 * Wandelt "HH:MM" in Minuten seit Mitternacht. Ungültiges -> null.
 * @param {unknown} zeit
 * @returns {number|null}
 */
function zeitZuMinuten(zeit) {
  if (typeof zeit !== 'string') return null;
  const treffer = zeit.match(/^(\d{1,2}):(\d{2})$/);
  if (!treffer) return null;
  const stunden = Number(treffer[1]);
  const minuten = Number(treffer[2]);
  if (stunden > 23 || minuten > 59) return null;
  return stunden * 60 + minuten;
}

/**
 * Zählt, an wie vielen Wochentagen sich die Lernzeiten zweier Profile zeitlich
 * überlappen (mindestens 1 Minute gemeinsame Zeit am selben Tag).
 * @param {Array<{tag?: string, von?: string, bis?: string}>} zeitenA
 * @param {Array<{tag?: string, von?: string, bis?: string}>} zeitenB
 * @returns {number}
 */
function zaehleZeitUeberlappungen(zeitenA, zeitenB) {
  if (!Array.isArray(zeitenA) || !Array.isArray(zeitenB)) return 0;

  let treffer = 0;
  for (const a of zeitenA) {
    for (const b of zeitenB) {
      if (!a || !b) continue;
      const tagA = typeof a.tag === 'string' ? a.tag.trim().toLowerCase() : '';
      const tagB = typeof b.tag === 'string' ? b.tag.trim().toLowerCase() : '';
      if (!tagA || tagA !== tagB) continue;

      const vonA = zeitZuMinuten(a.von);
      const bisA = zeitZuMinuten(a.bis);
      const vonB = zeitZuMinuten(b.von);
      const bisB = zeitZuMinuten(b.bis);
      if (vonA === null || bisA === null || vonB === null || bisB === null) continue;

      // Überlappung: Start des einen liegt vor Ende des anderen, in beide Richtungen.
      if (vonA < bisB && vonB < bisA) {
        treffer++;
      }
    }
  }
  return treffer;
}

/**
 * Berechnet den Match-Score zwischen zwei Profilen.
 * @param {object} meinProfil  - { faecher, interessen, lernzeiten }
 * @param {object} andererProfil
 * @returns {{ score: number, gemeinsameFaecher: string[], gemeinsameInteressen: string[], zeitUeberlappungen: number }}
 */
function berechneScore(meinProfil = {}, andererProfil = {}) {
  const gemeinsameFaecher = gemeinsame(meinProfil.faecher, andererProfil.faecher);
  const gemeinsameInteressen = gemeinsame(meinProfil.interessen, andererProfil.interessen);
  const zeitUeberlappungen = zaehleZeitUeberlappungen(
    meinProfil.lernzeiten,
    andererProfil.lernzeiten
  );

  const score =
    GEWICHT_FACH * gemeinsameFaecher.length +
    GEWICHT_INTERESSE * gemeinsameInteressen.length +
    GEWICHT_LERNZEIT * zeitUeberlappungen;

  return { score, gemeinsameFaecher, gemeinsameInteressen, zeitUeberlappungen };
}

/**
 * Findet passende Buddies für einen User aus der Gesamtliste.
 * Schließt den User selbst aus, behält nur Treffer mit score > 0,
 * sortiert absteigend nach Score und begrenzt auf maxVorschlaege.
 *
 * @param {object} ich           - der suchende User (mit .id und .profil)
 * @param {object[]} alleUser    - alle User
 * @param {number} [maxVorschlaege]
 * @returns {Array<object>} sichere Buddy-Ansichten (ohne sensible Felder)
 */
function findeBuddies(ich, alleUser, maxVorschlaege = MAX_VORSCHLAEGE) {
  if (!ich || !Array.isArray(alleUser)) return [];

  const meinProfil = ich.profil || {};

  return alleUser
    .filter(u => u && u.id !== ich.id)
    .map(u => {
      const { score, gemeinsameFaecher, gemeinsameInteressen, zeitUeberlappungen } =
        berechneScore(meinProfil, u.profil || {});
      return {
        id: u.id,
        name: u.name,
        klasse: u.klasse || '',
        faecher: (u.profil && u.profil.faecher) || [],
        status: (u.profil && u.profil.status) || 'sucht aktiv',
        gemeinsameFaecher,
        gemeinsameInteressen,
        zeitUeberlappungen,
        score,
      };
    })
    .filter(b => b.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxVorschlaege);
}

module.exports = {
  GEWICHT_FACH,
  GEWICHT_INTERESSE,
  GEWICHT_LERNZEIT,
  MAX_VORSCHLAEGE,
  normalisiere,
  gemeinsame,
  zeitZuMinuten,
  zaehleZeitUeberlappungen,
  berechneScore,
  findeBuddies,
};
