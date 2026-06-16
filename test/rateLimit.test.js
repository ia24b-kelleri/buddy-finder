// test/rateLimit.test.js – Unit-Tests des In-Memory Rate-Limiters
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { rateLimit } = require('../lib/rateLimit');

// Minimaler Fake für req/res
function fakeReq(ip = '1.2.3.4') { return { ip, socket: {} }; }
function fakeRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

test('lässt Anfragen bis zum Limit durch', () => {
  const mw = rateLimit({ fensterMs: 1000, maxAnfragen: 3 });
  let durchgelassen = 0;
  for (let i = 0; i < 3; i++) {
    const res = fakeRes();
    mw(fakeReq(), res, () => durchgelassen++);
  }
  assert.equal(durchgelassen, 3);
});

test('blockiert mit 429 nach Überschreiten des Limits', () => {
  const mw = rateLimit({ fensterMs: 1000, maxAnfragen: 2 });
  const req = fakeReq('9.9.9.9');
  mw(req, fakeRes(), () => {});
  mw(req, fakeRes(), () => {});
  const res = fakeRes();
  let next = false;
  mw(req, res, () => { next = true; });
  assert.equal(next, false);
  assert.equal(res.statusCode, 429);
  assert.ok(res.headers['Retry-After']);
});

test('zählt pro IP getrennt', () => {
  const mw = rateLimit({ fensterMs: 1000, maxAnfragen: 1 });
  let a = false, b = false;
  mw(fakeReq('10.0.0.1'), fakeRes(), () => { a = true; });
  mw(fakeReq('10.0.0.2'), fakeRes(), () => { b = true; });
  assert.ok(a && b, 'verschiedene IPs sollen unabhängig durchkommen');
});
