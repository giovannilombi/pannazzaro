// Profili, server e squadre: stesso modello di Twindoku (soprannome + PIN, niente email).
// Sul dispositivo possono esserci più profili: si sceglie chi gioca, come i profili di una TV.
// Prefisso delle chiavi locali: pz: (Twindoku usa tw: e gq3:).

export const API = (() => {
  try { const o = localStorage.getItem('pz:api'); if (o) return o; } catch (e) { /* ok */ }
  return 'https://pannazzaro-api.giovanni-lombi.workers.dev';
})();
// stessa lista del server (worker/src/index.js)
export const AVATARS = ['🦊', '🐙', '🦉', '🐢', '🐱', '🐶', '🦁', '🐸', '🐼', '🦄', '🐧', '🐺', '🐯', '🐨', '🦝', '🐝'];

const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage pieno o bloccato */ } };
const del = k => { try { localStorage.removeItem(k); } catch (e) { /* ok */ } };

/* ---------------- profili sul dispositivo ---------------- */
// pz:profiles = [{ id, name, avatar, token }]   pz:active = id del profilo che gioca (null = ospite)
export const profiles = () => get('pz:profiles', []);
export const active = () => { const id = get('pz:active', null); return profiles().find(p => p.id === id) || null; };
export function setActive(id) { set('pz:active', id); }
function upsertProfile(p) {
  const list = profiles().filter(x => x.id !== p.id);
  list.push(p); set('pz:profiles', list);
}
export function forget(id) {
  set('pz:profiles', profiles().filter(x => x.id !== id));
  if (get('pz:active', null) === id) set('pz:active', null);
  Object.keys(localStorage).filter(k => k.startsWith(`pz:p${id}:`)).forEach(del);
}

// Chiavi di salvataggio: ogni profilo le sue, l'ospite pz:guest:...
export const ns = k => { const a = active(); return a ? `pz:p${a.id}:${k}` : `pz:guest:${k}`; };

/* ---------------- server ---------------- */
export class ApiError extends Error { constructor(msg, status, data) { super(msg); this.status = status; this.data = data || {}; } }
export async function api(method, path, body, token) {
  let r;
  try {
    r = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) { throw new ApiError('Non riesco a collegarmi al server. Controlla la connessione e riprova.', 0); }
  let data = {};
  try { data = await r.json(); } catch (e) { /* risposta vuota */ }
  if (!r.ok) throw new ApiError(data.error || 'Qualcosa è andato storto. Riprova tra poco.', r.status, data);
  return data;
}
const authed = (method, path, body) => {
  const a = active();
  if (!a || !a.token) return Promise.reject(new ApiError('Entra con il tuo profilo.', 401));
  return api(method, path, body, a.token).catch(e => { if (e.status === 401) dropToken(a.id); throw e; });
};
// sessione non più valida (es. PIN recuperato da un altro dispositivo): il profilo resta, ma va riaperto con il PIN
function dropToken(id) { const p = profiles().find(x => x.id === id); if (p) { delete p.token; upsertProfile(p); } }

/* ---------------- dati del giocatore (copia locale di /api/me) ---------------- */
export const meCache = () => { const a = active(); return a ? get(`pz:p${a.id}:me`, null) : null; };
function applyMe(me) {
  const a = profiles().find(x => x.id === me.player.id);
  if (a) upsertProfile({ ...a, name: me.player.name, avatar: me.player.avatar });
  set(`pz:p${me.player.id}:me`, me);
  return me;
}
// login / registrazione / recupero riusciti
export function signedIn(res) {
  upsertProfile({ id: res.player.id, name: res.player.name, avatar: res.player.avatar, token: res.token });
  setActive(res.player.id);
  return applyMe(res);
}

export const signup = (name, pin, avatar) => api('POST', '/api/signup', { name, pin, avatar }).then(r => ({ recovery: r.recovery, me: signedIn(r) }));
export const login = (name, pin) => api('POST', '/api/login', { name, pin }).then(signedIn);
export const recover = (name, code, pin) => api('POST', '/api/recover', { name, code, pin }).then(signedIn);
export const checkName = name => api('GET', '/api/name?name=' + encodeURIComponent(name));
export const refreshMe = () => authed('GET', '/api/me').then(applyMe);
export async function logout() {
  const a = active(); if (!a) return;
  if (a.token) api('POST', '/api/logout', null, a.token).catch(() => {});
  forget(a.id);
}
export const changePin = (pin, old) => authed('POST', '/api/pin', { pin, old });
export const changeAvatar = avatar => authed('POST', '/api/avatar', { avatar }).then(refreshMe);
export const teamCheck = name => api('GET', '/api/team/check?name=' + encodeURIComponent(name));
export const teamCreate = (name, password) => authed('POST', '/api/team/create', { name, password }).then(applyMe);
export const teamJoin = (name, password) => authed('POST', '/api/team/join', { name, password }).then(applyMe);
export const teamJoinInvite = invite => authed('POST', '/api/team/join', { invite }).then(applyMe);
export const teamLeave = () => authed('POST', '/api/team/leave').then(applyMe);
export const teamNewInvite = () => authed('POST', '/api/team/invite').then(applyMe);
export const teamResetPin = playerId => authed('POST', '/api/team/reset-pin', { playerId });
export const teamsBoard = () => { const a = active(); return api('GET', '/api/teams', null, a && a.token); };

/* ---------------- partite online ---------------- */
// Ogni risposta è { game: { code, status, version, host, you, seats, options }, state: GameState pubblico | null }.
const C = c => encodeURIComponent(String(c || '').toUpperCase());
export const gameNew = options => authed('POST', '/api/game/new', options || {});
export const gameJoin = code => authed('POST', '/api/game/join', { code });
export const gameStart = code => authed('POST', '/api/game/start', { code });
export const gameGet = (code, v) => authed('GET', `/api/game?code=${C(code)}${v != null ? '&v=' + v : ''}`);
export const gameAct = (code, v, action) => authed('POST', '/api/game/act', { code, v, action });
export const gameLeave = code => authed('POST', '/api/game/leave', { code });
export const gamesList = () => authed('GET', '/api/games');

/* ---------------- inviti ---------------- */
export const pendingInvite = () => get('pz:invite', null);
export const setPendingInvite = code => (code ? set('pz:invite', code) : del('pz:invite'));
