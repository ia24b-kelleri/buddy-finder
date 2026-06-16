// app.js – geteilte Logik für alle Seiten von BuddyFinder

// API-Basis: Wird die Seite vom Backend (Port 3000) ausgeliefert, gleiche Origin
// (relativ). Sonst – z. B. beim Öffnen über die IDE-Vorschau oder als Datei –
// wird das lokale Backend direkt angesprochen. Das verhindert die 404-Fehler.
const API = (location.port === '3000') ? '' : 'http://localhost:3000';

// ── Auth ──────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('token'); }
function getUserName() { return localStorage.getItem('userName') || 'Nutzer'; }

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userName');
  location.href = 'index.html';
}

// Auf geschützten Seiten aufrufen: ohne Token zurück zum Login.
function requireAuth() {
  if (!getToken()) { location.href = 'index.html'; return false; }
  return true;
}

// ── API-Helfer ────────────────────────────────────────────────
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(API + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { logout(); }
  return { ok: res.ok, status: res.status, data };
}

// ── Nachrichten ───────────────────────────────────────────────
function showMsg(id, text, type) {
  const e = document.getElementById(id);
  if (!e) return;
  e.textContent = text;
  e.className = 'message ' + type;
}
function clearMsg(id) {
  const e = document.getElementById(id);
  if (!e) return;
  e.textContent = '';
  e.className = 'message';
}

// ── DOM-Helfer (XSS-sicher: textContent statt innerHTML) ──────
function el(tag, props = {}, kinder = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') { /* bewusst nicht unterstützt */ }
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const kind of [].concat(kinder)) {
    if (kind || kind === 0) node.append(kind.nodeType ? kind : document.createTextNode(String(kind)));
  }
  return node;
}
function chip(text, klasse = '') { return el('span', { class: 'chip ' + klasse, text }); }

// ── Header + Navigation rendern ───────────────────────────────
// Erwartet <div id="app-header"></div> und <nav id="app-nav"></nav> im HTML.
const NAV_LINKS = [
  { href: 'dashboard.html', label: 'Übersicht' },
  { href: 'profil.html',    label: 'Mein Profil' },
  { href: 'buddies.html',   label: 'Buddies finden' },
  { href: 'anfragen.html',  label: 'Anfragen' },
  { href: 'chat.html',      label: 'Chat' },
];

function renderShell(aktiveSeite) {
  const header = document.getElementById('app-header');
  if (header) {
    header.replaceChildren(
      el('div', {}, [
        el('div', { class: 'brand', text: 'BuddyFinder' }),
        el('div', { class: 'hello', text: 'Willkommen, ' + getUserName() + '!' }),
      ]),
      el('button', { class: 'danger', text: 'Abmelden', onclick: logout }),
    );
  }
  const nav = document.getElementById('app-nav');
  if (nav) {
    nav.replaceChildren(...NAV_LINKS.map(l =>
      el('a', { href: l.href, class: l.href === aktiveSeite ? 'active' : '', text: l.label })
    ));
  }
}
