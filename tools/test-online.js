// Prova delle partite online contro un server vero (locale o pubblicato):
//   node tools/test-online.js http://127.0.0.1:8788            (circa 10 secondi)
//   node tools/test-online.js http://127.0.0.1:8788 --tempo    + partita a 30 s: un turno scaduto (40 s in più)
//   node tools/test-online.js http://127.0.0.1:8788 --lungo    + fino all'uscita per tre turni saltati (3 minuti in più)
// Crea 3 giocatori di prova, una partita, la gioca fino in fondo e controlla turni, errori e punti.
// Sul server pubblicato lascia i giocatori di prova (nomi "pAnna…", "pBeppe…"): usarlo solo in locale, salvo controlli veloci.
import { legalPlacements } from '../js/rules.js';

const BASE = process.argv[2] || 'http://127.0.0.1:8788';
const LONG = process.argv.includes('--lungo'), TIMED = LONG || process.argv.includes('--tempo');
let fails = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
async function call(method, path, body, token) {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:8766', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, ...data };
}

const tag = Math.random().toString(36).slice(2, 7);
const names = ['pAnna', 'pBeppe', 'pCarmela'].map(n => n + tag);
const P = [];
for (const [i, name] of names.entries()) {
  const r = await call('POST', '/api/signup', { name, pin: '2580', avatar: ['🦊', '🐙', '🦉'][i] });
  ok(r.token && r.recovery, `registrazione ${name}`);
  P.push({ name, token: r.token, id: r.player.id });
}

const g = await call('POST', '/api/game/new', { rotateAtEnd: false }, P[0].token);
ok(g.game && g.game.status === 'lobby' && g.game.host && g.game.code.length === 5, 'sala d\'attesa creata ' + g.game.code);
const code = g.game.code;
const early = await call('POST', '/api/game/start', { code }, P[0].token);
ok(early.status === 400, 'da soli non si comincia');
for (const p of P.slice(1)) { const j = await call('POST', '/api/game/join', { code: code.toLowerCase() }, p.token); ok(j.game && j.game.seats.length >= 2, `${p.name} entra con il codice`); }
const notHost = await call('POST', '/api/game/start', { code }, P[1].token);
ok(notHost.status === 403, 'solo chi crea fa cominciare');
const st = await call('POST', '/api/game/start', { code }, P[0].token);
ok(st.game.status === 'play' && st.state && st.state.rng === 0, 'si comincia, senza seme visibile');
ok(st.state.clock && st.state.clock.secs === 86400 && st.state.clock.deadline > st.game.now, 'senza scelta: un giorno per turno');
const late = await call('POST', '/api/game/join', { code }, (await call('POST', '/api/signup', { name: 'pDario' + tag, pin: '2580', avatar: '🐢' })).token);
ok(late.status === 409, 'a partita cominciata non si entra');

let view = st, v = st.game.version;
const same = await call('GET', `/api/game?code=${code}&v=${v}`, null, P[1].token);
ok(same.same === true, 'polling senza novità: risposta corta');
const tokenOf = idx => P.find(p => p.name === view.state.players[idx].name).token;

// mossa fuori turno
const other = (view.state.turn.current + 1) % 3;
const wrong = await call('POST', '/api/game/act', { code, v, action: { type: 'orient', dir: 'N' } }, tokenOf(other));
ok(wrong.status === 409 && /turno/.test(wrong.error), 'fuori turno: rifiutata (' + wrong.error + ')');
const stale = await call('POST', '/api/game/act', { code, v: v - 1, action: { type: 'orient', dir: 'N' } }, tokenOf(view.state.turn.current));
ok(stale.status === 409 && stale.stale, 'tabellone vecchio: rifiutata');

let moves = 0, seed = 7;
const pick = k => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % k; };
while (view.state.turn.phase !== 'over' && moves < 400) {
  const s = view.state, by = s.turn.current, ph = s.turn.phase;
  const action = ph === 'orient' ? (s.log.length === 0 ? { type: 'orient', dir: 'E' } : { type: 'orient', turn: ['straight', 'left', 'right'][pick(3)] })
    : ph === 'roll' ? { type: 'roll' } : ph === 'pay' ? { type: 'pay' } : { type: 'place', cells: legalPlacements(s)[pick(legalPlacements(s).length)] };
  const r = await call('POST', '/api/game/act', { code, v: view.game.version, action }, tokenOf(by));
  if (!r.game) { ok(false, 'mossa rifiutata: ' + r.error); break; }
  view = r; moves++;
}
ok(view.game.status === 'over' && view.state.result, `partita finita dopo ${moves} mosse`);
const coins = view.state.players.reduce((a, p) => a + p.coins, 0);
ok(coins === 90, 'monete totali conservate');
const me0 = await call('GET', '/api/me', null, P[0].token);
const place0 = view.state.result.find(r => view.state.players[r.player].name === P[0].name);
ok(me0.stats.points === (place0 ? 3 - place0.place + 1 : 0), `punti di classifica assegnati (${me0.stats.points})`);
const list = await call('GET', '/api/games', null, P[1].token);
ok(list.games.some(x => x.code === code && x.status === 'over'), 'la partita compare tra le mie, finita');
const left = await call('POST', '/api/game/leave', { code }, P[1].token);
const list2 = await call('GET', '/api/games', null, P[1].token);
ok(left.ok && !list2.games.some(x => x.code === code), 'tolta dalla lista');

// abbandono e chiusura della sala
const g2 = await call('POST', '/api/game/new', {}, P[0].token);
await call('POST', '/api/game/join', { code: g2.game.code }, P[1].token);
const s2 = await call('POST', '/api/game/start', { code: g2.game.code }, P[0].token);
const res = await call('POST', '/api/game/act', { code: g2.game.code, action: { type: 'resign' } }, P[1].token);
ok(res.game.status === 'over' && res.state.result.length === 1, 'in due, chi abbandona fa finire la partita');
const g3 = await call('POST', '/api/game/new', {}, P[2].token);
await call('POST', '/api/game/leave', { code: g3.game.code }, P[2].token);
const gone = await call('POST', '/api/game/join', { code: g3.game.code }, P[0].token);
ok(gone.status === 404, 'sala chiusa da chi l\'ha creata');

// partita a tempo: chi non muove si vede giocare il turno da Peppo, al terzo di fila esce
if (TIMED) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const bad = await call('POST', '/api/game/new', { turnSecs: 7 }, P[1].token);
  ok(bad.game.options.turnSecs === 86400, 'tempo non previsto: un giorno');
  await call('POST', '/api/game/leave', { code: bad.game.code }, P[1].token);
  const t = await call('POST', '/api/game/new', { turnSecs: 30 }, P[1].token), tc = t.game.code;
  await call('POST', '/api/game/join', { code: tc }, P[2].token);
  let tv = await call('POST', '/api/game/start', { code: tc }, P[1].token);
  const first = tv.state.turn.current, left = tv.state.clock.deadline - tv.game.now;
  ok(tv.state.clock.secs === 30 && left > 30000 && left <= 35000, `30 secondi a turno (+ tolleranza: ${left} ms)`);
  const waitTurn = async (limit) => {
    const v0 = tv.game.version;
    for (let k = 0; k < limit / 2000; k++) {
      await sleep(2000);
      const r = await call('GET', `/api/game?code=${tc}&v=${tv.game.version}`, null, P[1].token);
      if (!r.same) { tv = r; if (r.game.version > v0) return true; }
    }
    return false;
  };
  ok(await waitTurn(45000), 'allo scadere il server gioca da solo');
  const auto = tv.state.log.filter(ev => ev.auto);
  ok(tv.state.turn.current !== first && auto.length >= 3 && tv.state.rugs.length === 1 && tv.state.clock.strikes[first] === 1, `Peppo gioca il turno intero (${auto.map(e => e.action.type).join(', ')})`);
  if (LONG) {
    for (let k = 0; k < 4 && tv.game.status === 'play'; k++) await waitTurn(45000);
    ok(tv.game.status === 'over' && tv.state.players[first].out && tv.state.log.some(ev => ev.auto && ev.action.type === 'resign'), 'al terzo turno saltato di fila si esce');
  } else {
    // chi gioca azzera il conto
    const by = tv.state.turn.current, tok = P.find(p => p.name === tv.state.players[by].name).token;
    const r = await call('POST', '/api/game/act', { code: tc, v: tv.game.version, action: { type: 'orient', turn: 'straight' } }, tok);
    ok(r.game && r.state.clock.strikes[by] === 0, 'chi muove ha il conto dei turni saltati a zero');
    await call('POST', '/api/game/act', { code: tc, action: { type: 'resign' } }, tok);
  }
}

if (fails) { console.log(`\n${fails} prove fallite`); process.exit(1); }
console.log('\nTutto a posto.');
