// lib/rateLimit.js
// Einfacher In-Memory-Rate-Limiter als Express-Middleware (ohne externe Pakete).
// Begrenzt Anfragen pro IP innerhalb eines Zeitfensters. Für Lern-MVP ausreichend;
// für echten Mehrserver-Betrieb wäre ein geteilter Store (z. B. Redis) nötig.

/**
 * @param {object} [opt]
 * @param {number} [opt.fensterMs]  Zeitfenster in Millisekunden
 * @param {number} [opt.maxAnfragen] Max. Anfragen pro IP im Fenster
 * @param {string} [opt.nachricht]   Fehlertext bei Überschreitung
 * @returns {import('express').RequestHandler}
 */
function rateLimit({ fensterMs = 15 * 60 * 1000, maxAnfragen = 20, nachricht } = {}) {
  /** @type {Map<string, { anzahl: number, reset: number }>} */
  const treffer = new Map();

  return function rateLimitMiddleware(req, res, next) {
    const jetzt = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || 'unbekannt';
    const eintrag = treffer.get(ip);

    if (!eintrag || jetzt > eintrag.reset) {
      treffer.set(ip, { anzahl: 1, reset: jetzt + fensterMs });
      return next();
    }

    eintrag.anzahl++;
    if (eintrag.anzahl > maxAnfragen) {
      const sekunden = Math.ceil((eintrag.reset - jetzt) / 1000);
      res.setHeader('Retry-After', String(sekunden));
      return res.status(429).json({
        error: nachricht || `Zu viele Anfragen. Bitte in ${sekunden} Sekunden erneut versuchen.`,
      });
    }
    next();
  };
}

module.exports = { rateLimit };
