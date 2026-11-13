// Server di Pannazzaro (Cloudflare Worker + database D1).
// Account (soprannome + PIN + codice segreto) e squadre: stesse regole e stesso codice di Twindoku.
// Partite online: il server tiene lo stato completo e applica le mosse con le stesse regole del browser (js/rules.js).
import { createGame, applyAction, resign, autoTurn, publicView, RuleError, seatColors } from '../../js/rules.js';

const AVATARS = ['🦊', '🐙', '🦉', '🐢', '🐱', '🐶', '🦁', '🐸', '🐼', '🦄', '🐧', '🐺', '🐯', '🐨', '🦝', '🐝'];
const now = () => Math.floor(Date.now() / 1000);

/* ---------------- risposte ---------------- */
class Oops extends Error { constructor(msg, status = 400, extra = {}) { super(msg); this.status = status; this.extra = extra; } }
const ALLOWED = [/^https:\/\/giovannilombi\.github\.io$/, /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/];
function cors(req) {
  const o = req.headers.get('Origin') || '';
  return ALLOWED.some(r => r.test(o))
    ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
    : {};
}
const json = (req, data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req) } });

/* ---------------- nomi: normalizzazione, somiglianze, parolacce ---------------- */
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '€': 'e' };
const ARTICLES = new Set(['i', 'il', 'lo', 'la', 'le', 'gli', 'l', 'the', 'un', 'una', 'uno']);
// "I Gatti Neri!", "gatti neri", "GATI NERI" e "gattineri" diventano tutti "gatineri".
function norm(s, dropArticles) {
  let t = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  t = [...t].map(c => LEET[c] || c).join('').replace(/[^a-z0-9]+/g, ' ').trim();
  let w = t.split(' ').filter(Boolean);
  if (dropArticles && w.length > 1 && ARTICLES.has(w[0])) w = w.slice(1);
  return w.join('').replace(/(.)\1+/g, '$1');
}
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// Due nomi si confondono se, normalizzati, sono uguali o differiscono per 1 lettera (2 se lunghi).
const tooSimilar = (a, b) => a === b || lev(a, b) <= (Math.max(a.length, b.length) <= 6 ? 1 : 2);
// Radici scelte per non bloccare nomi innocui (Penelope, Figaro, Nazionale, Negri...).
const BAD = ['caz', 'merd', 'stronz', 'putan', 'troia', 'vafa', 'fancul', 'coglion', 'minchi', 'bastard', 'porcod', 'porcam', 'diocan', 'zocol', 'mignot',
  'frocio', 'ricchion', 'nazist', 'hitler', 'mussolini', 'fuck', 'shit', 'bitch', 'tete', 'culo', 'sesso', 'sex', 'porn', 'puzzon'];
const rude = n => BAD.some(w => n.includes(w));

function checkPlayerName(name) {
  if (typeof name !== 'string') throw new Oops('Scrivi un nome.');
  name = name.trim();
  if (/\s/.test(name)) throw new Oops('Il nome non può avere spazi. Puoi usare _ o - al posto dello spazio.');
  if (name.length < 3 || name.length > 16) throw new Oops('Il nome deve avere da 3 a 16 caratteri.');
  if (!/^[\p{L}\p{N}_.-]+$/u.test(name)) throw new Oops('Nel nome puoi usare solo lettere, numeri, _ . e -');
  const n = norm(name, false);
  if (n.length < 2) throw new Oops('Il nome deve avere almeno qualche lettera.');
  if (rude(n)) throw new Oops('Questo nome non va bene: scegline un altro.');
  return { name, norm: n };
}
function checkTeamName(name) {
  if (typeof name !== 'string') throw new Oops('Scrivi il nome della squadra.');
  name = name.trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 24) throw new Oops('Il nome della squadra deve avere da 3 a 24 caratteri.');
  if (!/^[\p{L}\p{N} _.'!-]+$/u.test(name)) throw new Oops('Nel nome della squadra puoi usare lettere, numeri, spazi e _ . \' ! -');
  const n = norm(name, true);
  if (n.length < 2) throw new Oops('Il nome della squadra deve avere almeno qualche lettera.');
  if (rude(n)) throw new Oops('Questo nome non va bene: scegline un altro.');
  return { name, norm: n };
}
const checkPin = pin => { if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) throw new Oops('Il PIN deve essere di 4 cifre.'); if (/^(\d)\1{3}$|^1234$|^4321$/.test(pin)) throw new Oops('Questo PIN è troppo facile da indovinare: scegline un altro.'); return pin; };
const checkPass = p => { if (typeof p !== 'string' || p.length < 4 || p.length > 40) throw new Oops('La password della squadra deve avere da 4 a 40 caratteri.'); return p; };

/* ---------------- crittografia ---------------- */
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const randBytes = n => crypto.getRandomValues(new Uint8Array(n));
const randFrom = (n, abc) => { let s = ''; while (s.length < n) for (const x of randBytes(n)) if (x < 256 - (256 % abc.length) && s.length < n) s += abc[x % abc.length]; return s; };
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
// PIN, codici e password: PBKDF2 con sale casuale + "pepe" segreto del server (env.PEPPER).
async function hashSecret(env, secret, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(env.PEPPER + '\u0000' + secret), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 5000 }, key, 256));
}
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
async function newSecret(env, secret) { const salt = hex(randBytes(12)); return { salt, hash: await hashSecret(env, secret, salt) }; }

const WORDS = ['TAPPETO', 'MAIOLICA', 'LIMONE', 'VESUVIO', 'MANDOLINO', 'SFOGLIA', 'PIZZA', 'CORNETTO', 'GOLFO', 'BARCA', 'VELA', 'FARO',
  'CHIOSTRO', 'FONTANA', 'PALMA', 'ARANCIA', 'CAFFE', 'TAZZINA', 'BABA', 'PASTIERA', 'STOFFA', 'FRANGIA', 'TELAIO', 'GOMITOLO', 'MONETA', 'DADO',
  'LUNA', 'SOLE', 'STELLA', 'GABBIANO', 'GATTO', 'VOLPE', 'GUFO', 'POLPO', 'PESCE', 'CONCHIGLIA', 'SCOGLIO', 'ONDA', 'CASTELLO', 'CAMPANA'];
const rnd = k => crypto.getRandomValues(new Uint32Array(1))[0] % k;
// es. LIMONE-GUFO-73: facile da scrivere sul diario, circa 144.000 combinazioni (e i tentativi sono limitati)
const recoveryCode = () => { const a = rnd(WORDS.length), b = (a + 1 + rnd(WORDS.length - 1)) % WORDS.length; return `${WORDS[a]}-${WORDS[b]}-${rnd(90) + 10}`; }; // due parole diverse
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const INVITE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/* ---------------- tentativi sbagliati ---------------- */
async function lockedUntil(db, keys) {
  if (!keys.length) return 0;
  const rows = (await db.prepare(`SELECT until FROM attempts WHERE k IN (${keys.map(() => '?').join(',')})`).bind(...keys).all()).results;
  return Math.max(0, ...rows.map(r => r.until).filter(u => u > now()));
}
function lockMsg(until) { const m = Math.max(1, Math.ceil((until - now()) / 60)); return `Troppi tentativi sbagliati. Riprova tra ${m} ${m === 1 ? 'minuto' : 'minuti'}.`; }
// max errori in un'ora → blocco per lock secondi
async function failed(db, k, max, lock) {
  const t = now(), r = await db.prepare('SELECT fails, updated FROM attempts WHERE k = ?').bind(k).first();
  let fails = r && t - r.updated < 3600 ? r.fails + 1 : 1, until = 0;
  if (fails >= max) { until = t + lock; fails = 0; }
  await db.prepare('INSERT INTO attempts (k, fails, until, updated) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(k) DO UPDATE SET fails = ?2, until = ?3, updated = ?4').bind(k, fails, until, t).run();
  return until;
}
const cleared = (db, k) => db.prepare('DELETE FROM attempts WHERE k = ?').bind(k).run();
async function guard(env, req, keyName, check, max = 5, lock = 900) {
  const ip = 'ip:' + (await sha256(env.PEPPER + (req.headers.get('CF-Connecting-IP') || '?'))).slice(0, 20);
  const until = await lockedUntil(env.DB, [keyName, ip]);
  if (until) throw new Oops(lockMsg(until), 429);
  if (await check()) { await cleared(env.DB, keyName); return true; }
  const u1 = await failed(env.DB, keyName, max, lock);
  await failed(env.DB, ip, 40, 3600); // da una stessa rete (es. una scuola) al massimo 40 errori l'ora
  return u1 ? lockMsg(u1) : false;
}

/* ---------------- sessioni ---------------- */
async function newSession(env, playerId) {
  const token = hex(randBytes(32));
  await env.DB.prepare('INSERT INTO sessions (token_hash, player_id, created) VALUES (?, ?, ?)').bind(await sha256(token), playerId, now()).run();
  return token;
}
async function auth(env, req) {
  const m = (req.headers.get('Authorization') || '').match(/^Bearer ([0-9a-f]{64})$/);
  if (!m) throw new Oops('Devi entrare con il tuo profilo.', 401);
  const p = await env.DB.prepare('SELECT p.* FROM sessions s JOIN players p ON p.id = s.player_id WHERE s.token_hash = ?').bind(await sha256(m[1])).first();
  if (!p) throw new Oops('Sessione scaduta: rientra con nome e PIN.', 401);
  if (now() - p.last_seen > 3600) await env.DB.prepare('UPDATE players SET last_seen = ? WHERE id = ?').bind(now(), p.id).run();
  return p;
}

/* ---------------- dati del giocatore ---------------- */
async function teamInfo(env, p) {
  if (!p.team_id) return null;
  const t = await env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(p.team_id).first();
  if (!t) return null;
  const members = (await env.DB.prepare('SELECT id, name, avatar, points, last_seen FROM players WHERE team_id = ? ORDER BY points DESC, name').bind(t.id).all()).results;
  return {
    name: t.name, captain: t.captain_id === p.id, invite: t.invite, score: teamScore(members.map(m => m.points)),
    members: members.map(m => ({ id: m.id, name: m.name, avatar: m.avatar, points: m.points, captain: m.id === t.captain_id, me: m.id === p.id })),
  };
}
// Punteggio di squadra: media dei 5 giocatori migliori (le squadre piccole non sono svantaggiate).
const teamScore = pts => { const top = [...pts].sort((a, b) => b - a).slice(0, 5); return top.length ? Math.round(top.reduce((s, x) => s + x, 0) / top.length) : 0; };

async function me(env, p) {
  return {
    player: { id: p.id, name: p.name, avatar: p.avatar, mustChange: !!p.must_change },
    stats: { points: p.points },
    team: await teamInfo(env, p),
  };
}

/* ---------------- squadre ---------------- */
async function findTeams(env, n) {
  const all = (await env.DB.prepare('SELECT id, name, norm FROM teams').all()).results;
  const exact = all.find(t => t.norm === n) || null;
  const similar = exact ? [] : all.filter(t => tooSimilar(t.norm, n)).map(t => t.name).slice(0, 3);
  return { exact, similar };
}
async function leaveTeam(env, p) {
  if (!p.team_id) return;
  const t = await env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(p.team_id).first();
  await env.DB.prepare('UPDATE players SET team_id = NULL WHERE id = ?').bind(p.id).run();
  p.team_id = null;
  if (!t) return;
  const left = await env.DB.prepare('SELECT id FROM players WHERE team_id = ? ORDER BY points DESC, created LIMIT 1').bind(t.id).first();
  if (!left) await env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(t.id).run(); // squadra vuota: si chiude
  else if (t.captain_id === p.id) await env.DB.prepare('UPDATE teams SET captain_id = ? WHERE id = ?').bind(left.id, t.id).run(); // nuovo capitano: il più bravo
}
async function joinTeam(env, p, t) {
  if (p.team_id === t.id) return;
  await leaveTeam(env, p);
  await env.DB.prepare('UPDATE players SET team_id = ? WHERE id = ?').bind(t.id, p.id).run();
  p.team_id = t.id;
}

/* ---------------- partite online ---------------- */
const MAX_SEATS = 4, MAX_OPEN = 12;
// Tempo per turno (secondi). 86400 = "senza fretta": un giorno, così chi sparisce non blocca gli altri per sempre.
// Ai secondi scelti si aggiungono GRACE ms di tolleranza (rete, aggiornamento ogni 2 s, animazioni).
// Allo scadere Peppo gioca da solo il turno (autoTurn); al terzo turno saltato di fila il giocatore esce.
const TURN_SECS = [30, 60, 90, 120, 300, 86400], DEFAULT_SECS = 86400, GRACE = 5000, MAX_STRIKES = 3;
const restartClock = s => { if (s.clock) s.clock.deadline = Date.now() + s.clock.secs * 1000 + GRACE; };
const seatOf = p => ({ id: p.id, name: p.name, avatar: p.avatar });
const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
async function loadGame(env, code) {
  const g = await env.DB.prepare('SELECT * FROM games WHERE code = ?').bind(cleanCode(code)).first();
  if (!g || g.status === 'gone') throw new Oops('Questa partita non c\'è più, oppure il codice è sbagliato.', 404);
  g.seats = JSON.parse(g.seats); g.options = JSON.parse(g.options); g.state = g.state ? JSON.parse(g.state) : null;
  return g;
}
const seated = (g, p) => g.seats.some(s => s.id === p.id);
// Quello che vede il giocatore p: la sala d'attesa e lo stato pubblico (senza seme del dado né ordine delle pile).
function gameView(g, p) {
  return {
    game: {
      code: g.code, status: g.status, version: g.version, updated: g.updated, options: g.options, now: Date.now(),
      host: g.host_id === p.id, you: g.state ? g.state.players.findIndex(x => x.accountId === p.id) : -1,
      seats: g.seats.map(s => ({ name: s.name, avatar: s.avatar, me: s.id === p.id, host: s.id === g.host_id })),
    },
    state: g.state ? publicView(g.state) : null,
  };
}
// Salva solo se nessun altro ha cambiato la partita nel frattempo (version).
async function saveGame(env, g) {
  const t = now();
  const deadline = g.status === 'play' && g.state && g.state.clock ? g.state.clock.deadline : null;
  const r = await env.DB.prepare('UPDATE games SET status = ?, seats = ?, state = ?, deadline = ?, version = version + 1, updated = ? WHERE id = ? AND version = ?')
    .bind(g.status, JSON.stringify(g.seats), g.state ? JSON.stringify(g.state) : null, deadline, t, g.id, g.version).run();
  if (!r.meta.changes) throw new Oops('Nel frattempo la partita è andata avanti: riprova.', 409);
  g.version++; g.updated = t;
}
// Punti di classifica a fine partita: in 4 giocatori 4, 3, 2, 1 secondo il posto (in 3: 3, 2, 1; in 2: 2, 1). Chi esce: 0.
// Contano solo le partite vere (almeno due tappeti a testa sul tabellone), così non si fanno punti abbandonando subito.
async function award(env, g) {
  const s = g.state, n = s.players.length;
  if (s.rugs.length < n * 2) return;
  const stmts = (s.result || []).map(r => env.DB.prepare('UPDATE players SET points = points + ? WHERE id = ?').bind(n - r.place + 1, s.players[r.player].accountId));
  if (stmts.length) await env.DB.batch(stmts);
}

// Tempo scaduto? Peppo gioca il turno di chi non ha mosso (al terzo di fila quel giocatore esce).
// Non c'è un timer sul server: lo controlla chiunque guardi la partita (ogni 2 s) o provi una mossa.
async function tick(env, g) {
  const c = g.state && g.state.clock;
  if (g.status !== 'play' || !c || Date.now() <= c.deadline) return g;
  const seat = g.state.turn.current;
  c.strikes[seat] = (c.strikes[seat] || 0) + 1;
  g.state = autoTurn(g.state, { out: c.strikes[seat] >= MAX_STRIKES });
  restartClock(g.state);
  if (g.state.turn.phase === 'over') g.status = 'over';
  try { await saveGame(env, g); }
  catch (e) { if (e instanceof Oops && e.status === 409) return loadGame(env, g.code); throw e; } // l'ha già fatto qualcun altro
  if (g.status === 'over') await award(env, g);
  return g;
}

/* ---------------- rotte ---------------- */
const routes = {
  'GET /api/ping': async () => ({ ok: true }),

  // controllo "dal vivo" mentre si scrive il nome
  'GET /api/name': async (env, req, url) => {
    const { norm: n } = checkPlayerName(url.searchParams.get('name') || '');
    const all = (await env.DB.prepare('SELECT name, norm FROM players').all()).results;
    const hit = all.find(x => tooSimilar(x.norm, n));
    return hit ? { ok: false, taken: hit.norm === n, similar: hit.name } : { ok: true };
  },

  'POST /api/signup': async (env, req, url, body) => {
    const { name, norm: n } = checkPlayerName(body.name);
    const pin = checkPin(body.pin);
    const avatar = AVATARS.includes(body.avatar) ? body.avatar : AVATARS[0];
    const all = (await env.DB.prepare('SELECT name, norm FROM players').all()).results;
    const hit = all.find(x => tooSimilar(x.norm, n));
    if (hit) throw new Oops(hit.norm === n ? `Il nome «${hit.name}» è già preso. Se sei tu, usa «Ho già un profilo».` : `Esiste già un giocatore che si chiama «${hit.name}»: scegli un nome più diverso, così nessuno vi confonde.`, 409);
    const code = recoveryCode(), s1 = await newSecret(env, pin), s2 = await newSecret(env, normCode(code)), t = now();
    const r = await env.DB.prepare('INSERT INTO players (name, norm, avatar, pin_hash, pin_salt, rec_hash, rec_salt, created, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *')
      .bind(name, n, avatar, s1.hash, s1.salt, s2.hash, s2.salt, t, t).first();
    return { token: await newSession(env, r.id), recovery: code, ...(await me(env, r)) };
  },

  'POST /api/login': async (env, req, url, body) => {
    const name = String(body.name || '').trim(), n = norm(name, false);
    const pin = String(body.pin || '');
    const p = n ? await env.DB.prepare('SELECT * FROM players WHERE norm = ?').bind(n).first() : null;
    const ok = await guard(env, req, 'pin:' + n, async () => !!p && same(await hashSecret(env, pin, p.pin_salt), p.pin_hash));
    if (ok !== true) throw new Oops(typeof ok === 'string' ? ok : 'Nome o PIN sbagliati.', 401);
    return { token: await newSession(env, p.id), ...(await me(env, p)) };
  },

  'POST /api/recover': async (env, req, url, body) => {
    const n = norm(String(body.name || ''), false), code = normCode(body.code);
    const pin = checkPin(body.pin);
    const p = n ? await env.DB.prepare('SELECT * FROM players WHERE norm = ?').bind(n).first() : null;
    const ok = await guard(env, req, 'rec:' + n, async () => !!p && same(await hashSecret(env, code, p.rec_salt), p.rec_hash), 5, 3600);
    if (ok !== true) throw new Oops(typeof ok === 'string' ? ok : 'Nome o codice segreto sbagliati.', 401);
    const s = await newSecret(env, pin);
    await env.DB.batch([
      env.DB.prepare('UPDATE players SET pin_hash = ?, pin_salt = ?, must_change = 0 WHERE id = ?').bind(s.hash, s.salt, p.id),
      env.DB.prepare('DELETE FROM sessions WHERE player_id = ?').bind(p.id), // fuori da tutti gli altri dispositivi
    ]);
    return { token: await newSession(env, p.id), ...(await me(env, p)) };
  },

  'GET /api/me': async (env, req) => me(env, await auth(env, req)),

  'POST /api/logout': async (env, req) => {
    const m = (req.headers.get('Authorization') || '').match(/^Bearer ([0-9a-f]{64})$/);
    if (m) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(m[1])).run();
    return { ok: true };
  },

  'POST /api/pin': async (env, req, url, body) => {
    const p = await auth(env, req), pin = checkPin(body.pin);
    if (!p.must_change) {
      const ok = await guard(env, req, 'pin:' + p.norm, async () => same(await hashSecret(env, String(body.old || ''), p.pin_salt), p.pin_hash));
      if (ok !== true) throw new Oops(typeof ok === 'string' ? ok : 'Il PIN attuale è sbagliato.', 401);
    }
    const s = await newSecret(env, pin);
    await env.DB.prepare('UPDATE players SET pin_hash = ?, pin_salt = ?, must_change = 0 WHERE id = ?').bind(s.hash, s.salt, p.id).run();
    return { ok: true };
  },

  'POST /api/avatar': async (env, req, url, body) => {
    const p = await auth(env, req);
    if (!AVATARS.includes(body.avatar)) throw new Oops('Avatar non valido.');
    await env.DB.prepare('UPDATE players SET avatar = ? WHERE id = ?').bind(body.avatar, p.id).run();
    return { ok: true };
  },

  // la squadra esiste? ce ne sono di simili?
  'GET /api/team/check': async (env, req, url) => {
    const { name, norm: n } = checkTeamName(url.searchParams.get('name') || '');
    const { exact, similar } = await findTeams(env, n);
    return { name, exists: !!exact, team: exact ? exact.name : null, similar };
  },

  'POST /api/team/create': async (env, req, url, body) => {
    const p = await auth(env, req);
    const { name, norm: n } = checkTeamName(body.name), pass = checkPass(body.password);
    const { exact, similar } = await findTeams(env, n);
    if (exact) throw new Oops(`La squadra «${exact.name}» esiste già: per entrarci serve la sua password.`, 409);
    if (similar.length) throw new Oops(`Esiste già la squadra «${similar[0]}». Se è la tua, entra in quella; altrimenti scegli un nome più diverso.`, 409, { similar });
    const s = await newSecret(env, pass);
    const t = await env.DB.prepare('INSERT INTO teams (name, norm, pass_hash, pass_salt, invite, captain_id, created) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *')
      .bind(name, n, s.hash, s.salt, randFrom(6, INVITE_ABC), p.id, now()).first();
    await joinTeam(env, p, t);
    return me(env, p);
  },

  'POST /api/team/join': async (env, req, url, body) => {
    const p = await auth(env, req);
    let t;
    if (body.invite) {
      t = await env.DB.prepare('SELECT * FROM teams WHERE invite = ?').bind(String(body.invite).toUpperCase()).first();
      if (!t) throw new Oops('Questo link d\'invito non vale più: chiedi al capitano quello nuovo.', 404);
    } else {
      const { norm: n } = checkTeamName(body.name);
      t = await env.DB.prepare('SELECT * FROM teams WHERE norm = ?').bind(n).first();
      if (!t) throw new Oops('Questa squadra non esiste.', 404);
      const ok = await guard(env, req, 'team:' + t.id + ':' + p.id, async () => same(await hashSecret(env, String(body.password || ''), t.pass_salt), t.pass_hash), 6, 900);
      if (ok !== true) throw new Oops(typeof ok === 'string' ? ok : 'Password della squadra sbagliata.', 401);
    }
    await joinTeam(env, p, t);
    return me(env, p);
  },

  'POST /api/team/leave': async (env, req) => { const p = await auth(env, req); await leaveTeam(env, p); return me(env, p); },

  // solo il capitano: nuovo link d'invito (quello vecchio smette di funzionare)
  'POST /api/team/invite': async (env, req) => {
    const p = await auth(env, req);
    const t = p.team_id && await env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(p.team_id).first();
    if (!t || t.captain_id !== p.id) throw new Oops('Solo il capitano può farlo.', 403);
    await env.DB.prepare('UPDATE teams SET invite = ? WHERE id = ?').bind(randFrom(6, INVITE_ABC), t.id).run();
    return me(env, p);
  },

  // solo il capitano: PIN temporaneo per un compagno che l'ha dimenticato
  'POST /api/team/reset-pin': async (env, req, url, body) => {
    const p = await auth(env, req);
    const t = p.team_id && await env.DB.prepare('SELECT * FROM teams WHERE id = ?').bind(p.team_id).first();
    if (!t || t.captain_id !== p.id) throw new Oops('Solo il capitano può farlo.', 403);
    const m = await env.DB.prepare('SELECT * FROM players WHERE id = ? AND team_id = ?').bind(body.playerId | 0, t.id).first();
    if (!m || m.id === p.id) throw new Oops('Questo giocatore non è nella tua squadra.', 404);
    let pin; do pin = randFrom(4, '0123456789'); while (/^(\d)\1{3}$/.test(pin));
    const s = await newSecret(env, pin);
    await env.DB.prepare('UPDATE players SET pin_hash = ?, pin_salt = ?, must_change = 1 WHERE id = ?').bind(s.hash, s.salt, m.id).run();
    await cleared(env.DB, 'pin:' + m.norm);
    return { pin, name: m.name };
  },

  // classifica delle squadre (solo nomi di squadra e punteggi, nessun nome di giocatore)
  'GET /api/teams': async (env, req) => {
    let mine = null;
    try { mine = (await auth(env, req)).team_id; } catch (e) { /* anche senza accesso */ }
    const rows = (await env.DB.prepare('SELECT t.id, t.name, p.points FROM teams t JOIN players p ON p.team_id = t.id').all()).results;
    const by = new Map();
    for (const r of rows) { if (!by.has(r.id)) by.set(r.id, { id: r.id, name: r.name, pts: [] }); by.get(r.id).pts.push(r.points); }
    const list = [...by.values()].map(t => ({ name: t.name, members: t.pts.length, score: teamScore(t.pts), mine: t.id === mine }))
      .sort((a, b) => b.score - a.score || b.members - a.members || a.name.localeCompare(b.name));
    list.forEach((t, i) => (t.pos = i + 1));
    return { teams: list.filter((t, i) => i < 30 || t.mine) };
  },

  /* ---------- partite online ---------- */
  // nuova sala d'attesa: chi la crea è il primo seduto
  'POST /api/game/new': async (env, req, url, body) => {
    const p = await auth(env, req);
    const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM games g JOIN game_seats s ON s.game_id = g.id WHERE s.player_id = ? AND g.status IN ('lobby', 'play')").bind(p.id).first();
    if (open.n >= MAX_OPEN) throw new Oops('Hai già troppe partite aperte: finiscine o abbandonane qualcuna.', 429);
    const options = { rotateAtEnd: !!body.rotateAtEnd, oneColor: !!body.oneColor, turnSecs: TURN_SECS.includes(+body.turnSecs) ? +body.turnSecs : DEFAULT_SECS };
    let g = null;
    for (let i = 0; i < 6 && !g; i++) {
      try {
        g = await env.DB.prepare("INSERT INTO games (code, host_id, status, options, seats, version, created, updated) VALUES (?, ?, 'lobby', ?, ?, 0, ?, ?) RETURNING *")
          .bind(randFrom(5, INVITE_ABC), p.id, JSON.stringify(options), JSON.stringify([seatOf(p)]), now(), now()).first();
      } catch (e) { if (!/UNIQUE/i.test(String(e))) throw e; }
    }
    if (!g) throw new Oops('Non riesco a creare la partita: riprova.', 500);
    await env.DB.prepare('INSERT INTO game_seats (game_id, player_id) VALUES (?, ?)').bind(g.id, p.id).run();
    g.seats = JSON.parse(g.seats); g.options = options; g.state = null;
    return gameView(g, p);
  },

  'POST /api/game/join': async (env, req, url, body) => {
    const p = await auth(env, req), g = await loadGame(env, body.code);
    if (seated(g, p)) return gameView(g, p);
    if (g.status !== 'lobby') throw new Oops('Questa partita è già cominciata: chiedi agli amici di crearne una nuova.', 409);
    if (g.options.oneColor && g.seats.length >= 2) throw new Oops('È una partita veloce in due ed è già al completo.', 409);
    if (g.seats.length >= MAX_SEATS) throw new Oops('La partita è al completo: ci sono già 4 giocatori.', 409);
    g.seats.push(seatOf(p));
    await saveGame(env, g);
    await env.DB.prepare('INSERT OR IGNORE INTO game_seats (game_id, player_id) VALUES (?, ?)').bind(g.id, p.id).run();
    return gameView(g, p);
  },

  // solo chi l'ha creata: si comincia. Il primo di turno lo sceglie la sorte, poi si va nell'ordine di arrivo.
  'POST /api/game/start': async (env, req, url, body) => {
    const p = await auth(env, req), g = await loadGame(env, body.code);
    if (g.status !== 'lobby') return gameView(g, p);
    if (g.host_id !== p.id) throw new Oops('Solo chi ha creato la partita può farla cominciare.', 403);
    if (g.seats.length < 2) throw new Oops('Servono almeno 2 giocatori.');
    // i colori seguono l'ordine di arrivo (come si vedono in sala d'attesa); poi si ruota l'ordine di gioco
    // un colore a testa vale solo in due: con 3-4 giocatori l'opzione si ignora
    const n = g.seats.length, opts = { ...g.options, oneColor: n === 2 && !!g.options.oneColor };
    const seats = g.seats.map((s, i) => ({ accountId: s.id, name: s.name, avatar: s.avatar, colors: seatColors(n, i, opts) }));
    const k = rnd(n), order = [...seats.slice(k), ...seats.slice(0, k)];
    g.state = createGame({ players: order, mode: 'online', seed: crypto.getRandomValues(new Uint32Array(1))[0], options: opts });
    g.state.id = g.code;
    g.state.clock = { secs: g.options.turnSecs || DEFAULT_SECS, deadline: 0, strikes: order.map(() => 0) };
    restartClock(g.state);
    g.status = 'play';
    await saveGame(env, g);
    return gameView(g, p);
  },

  // stato della partita. Con v = versione che il giocatore ha già, risponde { same: true } se non è cambiato niente
  // (il browser chiede ogni 2 secondi: così la risposta è piccola).
  'GET /api/game': async (env, req, url) => {
    const p = await auth(env, req), code = cleanCode(url.searchParams.get('code')), v = url.searchParams.get('v');
    if (v != null) {
      const r = await env.DB.prepare('SELECT g.version, g.deadline FROM games g JOIN game_seats s ON s.game_id = g.id AND s.player_id = ? WHERE g.code = ? AND g.status != \'gone\'').bind(p.id, code).first();
      if (r && r.version === +v && !(r.deadline && Date.now() > r.deadline)) return { same: true, version: r.version };
    }
    let g = await loadGame(env, code);
    if (seated(g, p)) g = await tick(env, g);
    if (!seated(g, p)) {
      if (g.status === 'lobby') return { ...gameView(g, p), seated: false };
      throw new Oops('Non sei in questa partita.', 403);
    }
    return { ...gameView(g, p), seated: true };
  },

  // una mossa (le stesse azioni del gioco sul dispositivo, più { type: 'resign' } per abbandonare)
  'POST /api/game/act': async (env, req, url, body) => {
    const p = await auth(env, req);
    const g = await tick(env, await loadGame(env, body.code));
    if (g.status !== 'play') throw new Oops(g.status === 'over' ? 'La partita è finita.' : 'La partita non è ancora cominciata.', 409);
    if (body.v != null && +body.v !== g.version) throw new Oops('Nel frattempo la partita è andata avanti: aggiorno il tabellone.', 409, { stale: true });
    const seat = g.state.players.findIndex(x => x.accountId === p.id);
    if (seat < 0) throw new Oops('Non sei in questa partita.', 403);
    const action = body.action && typeof body.action === 'object' ? body.action : {};
    const round = g.state.turn.round;
    try { g.state = action.type === 'resign' ? resign(g.state, seat) : applyAction(g.state, seat, action); }
    catch (e) { if (e instanceof RuleError) throw new Oops(e.message, 409); throw e; }
    if (g.state.clock) {
      if (action.type !== 'resign') g.state.clock.strikes[seat] = 0; // ha giocato: si riparte da zero
      if (g.state.turn.round !== round) restartClock(g.state);
    }
    if (g.state.turn.phase === 'over') g.status = 'over';
    await saveGame(env, g);
    if (g.status === 'over') await award(env, g);
    return gameView(g, p);
  },

  // esce dalla sala d'attesa (se è chi l'ha creata, la sala si chiude) oppure toglie una partita finita dalla lista
  'POST /api/game/leave': async (env, req, url, body) => {
    const p = await auth(env, req), g = await loadGame(env, body.code);
    if (!seated(g, p)) return { ok: true };
    if (g.status === 'play') throw new Oops('La partita è in corso: per uscire usa «Abbandona».', 409);
    if (g.status === 'lobby') {
      if (g.host_id === p.id) g.status = 'gone';
      else g.seats = g.seats.filter(s => s.id !== p.id);
      await saveGame(env, g);
    }
    await env.DB.prepare('DELETE FROM game_seats WHERE game_id = ? AND player_id = ?').bind(g.id, p.id).run();
    return { ok: true };
  },

  // le mie partite: in attesa, in corso e finite da poco
  'GET /api/games': async (env, req) => {
    const p = await auth(env, req);
    const rows = (await env.DB.prepare(`SELECT g.* FROM games g JOIN game_seats s ON s.game_id = g.id WHERE s.player_id = ?
      AND (g.status IN ('lobby', 'play') OR (g.status = 'over' AND g.updated > ?)) ORDER BY g.updated DESC LIMIT 20`).bind(p.id, now() - 14 * 86400).all()).results;
    return {
      games: rows.map(g => {
        const st = g.state ? JSON.parse(g.state) : null, seats = JSON.parse(g.seats);
        const cur = st && g.status === 'play' ? st.players[st.turn.current] : null;
        const win = st && st.result ? st.result.filter(r => r.place === 1).map(r => st.players[r.player].name) : [];
        return {
          code: g.code, status: g.status, updated: g.updated, host: g.host_id === p.id, secs: JSON.parse(g.options).turnSecs || DEFAULT_SECS,
          seats: seats.map(s => ({ name: s.name, avatar: s.avatar, me: s.id === p.id })),
          turn: cur ? { name: cur.name, me: cur.accountId === p.id } : null, winners: win,
        };
      }),
    };
  },
};

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url), fn = routes[`${req.method} ${url.pathname}`];
    if (!fn) return json(req, { error: 'Pagina non trovata.' }, 404);
    try {
      let body = {};
      if (req.method === 'POST') {
        const txt = await req.text();
        if (txt.length > 64 * 1024) throw new Oops('Richiesta troppo grande.', 413);
        try { body = txt ? JSON.parse(txt) : {}; } catch (e) { throw new Oops('Dati non validi.'); }
      }
      return json(req, await fn(env, req, url, body || {}));
    } catch (e) {
      if (e instanceof Oops) return json(req, { error: e.message, ...e.extra }, e.status);
      console.error(e);
      return json(req, { error: 'Qualcosa è andato storto sul server. Riprova tra poco.' }, 500);
    }
  },
};
