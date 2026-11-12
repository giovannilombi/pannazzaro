// Prove rapide delle regole pure:  npm test  (oppure node tools/test-rules.js)
import { createGame, turnDir, rollDie, DIE, SIZE, START_COINS, stepFrom, walk, zoneAt, tollFor, placeError, legalPlacements, applyAction, finalScores, publicView, resign, autoTurn, RuleError } from '../js/rules.js';

let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails++; };

const g = createGame({ players: [{}, {}, {}, {}], seed: 42 });
ok(g.board.length === SIZE && g.board.every(r => r.length === SIZE && r.every(c => c === null)), 'tabellone 7×7 vuoto');
ok(g.peppo.pos.x === 3 && g.peppo.pos.y === 3, 'Peppo al centro (3,3)');
ok(g.players.length === 4 && g.players.every(p => p.coins === START_COINS && p.pile.length === 12 && p.colors.length === 1), '4 giocatori: 30 monete e 12 tappeti a testa');
ok(new Set(g.players.flatMap(p => p.colors)).size === 4, 'colori tutti diversi');
ok(createGame({ players: [{}, {}, {}] }).players.every(p => p.pile.length === 15), '3 giocatori: 15 tappeti a testa');
const g2 = createGame({ players: [{}, {}], seed: 9 });
ok(g2.players.every(p => p.colors.length === 2 && p.pile.length === 24 && p.colors.every(c => p.pile.filter(x => x === c).length === 12)), '2 giocatori: due colori, 12 + 12 tappeti');
ok(g2.players.some(p => p.pile.slice(0, 12).some(c => c !== p.pile[0])), '2 giocatori: pila mescolata');
ok(JSON.stringify(createGame({ players: [{}, {}], seed: 9 })) === JSON.stringify(g2), 'stesso seme → stessa partita');
ok(g.options.coverOwn === false && g.options.rotateAtEnd === false, 'opzioni di default');
ok(g.turn.phase === 'orient' && g.turn.current === 0, 'si parte dalla scelta della direzione');
ok(turnDir('N', 'left') === 'W' && turnDir('N', 'right') === 'E' && turnDir('W', 'right') === 'N' && turnDir('S', 'straight') === 'S', 'svolte di 90°');
let threw = false; try { turnDir('N', 'back'); } catch (e) { threw = true; }
ok(threw, 'mai indietro di 180°');
ok(JSON.stringify(JSON.parse(JSON.stringify(g))) === JSON.stringify(g), 'stato serializzabile in JSON');

let rng = 7; const count = { 1: 0, 2: 0, 3: 0, 4: 0 };
for (let i = 0; i < 60000; i++) { const r = rollDie(rng); rng = r.rng; count[r.face]++; }
const exp = f => (DIE.filter(x => x === f).length / 6) * 60000;
ok([1, 2, 3, 4].every(f => Math.abs(count[f] - exp(f)) < exp(f) * 0.05), `dado 1,2,2,3,3,4 ben distribuito ${JSON.stringify(count)}`);
ok(rollDie(123).face === rollDie(123).face, 'dado deterministico con lo stesso seme');

/* ---------------- bordi: tutte le 28 uscite ---------------- */
const exp28 = [];
for (let x = 0; x < 7; x++) exp28.push([{ x, y: 0 }, 'N', x === 6 ? [{ x: 6, y: 0 }, 'W'] : [{ x: x ^ 1, y: 0 }, 'S']]);
for (let y = 0; y < 7; y++) exp28.push([{ x: 6, y }, 'E', y === 0 ? [{ x: 6, y: 0 }, 'S'] : [{ x: 6, y: [0, 2, 1, 4, 3, 6, 5][y] }, 'W']]);
for (let x = 0; x < 7; x++) exp28.push([{ x, y: 6 }, 'S', x === 0 ? [{ x: 0, y: 6 }, 'E'] : [{ x: [0, 2, 1, 4, 3, 6, 5][x], y: 6 }, 'N']]);
for (let y = 0; y < 7; y++) exp28.push([{ x: 0, y }, 'W', y === 6 ? [{ x: 0, y: 6 }, 'N'] : [{ x: 0, y: y ^ 1 }, 'E']]);
const bad = exp28.filter(([pos, dir, [p2, d2]]) => { const r = stepFrom(pos, dir); return r.pos.x !== p2.x || r.pos.y !== p2.y || r.dir !== d2; });
ok(bad.length === 0, `28 uscite dal tabellone come da tabella ${bad.length ? JSON.stringify(bad[0]) : ''}`);
// ogni arco è percorribile nei due sensi: uscendo dal rientro in senso opposto si torna al punto di partenza
const back = { N: 'S', S: 'N', E: 'W', W: 'E' };
ok(exp28.filter(([, , [, d2]], i) => exp28[i][1] !== undefined).every(([pos, dir]) => {
  const r = stepFrom(pos, dir); if (r.arc !== 'u') return true;
  const b = stepFrom(r.pos, back[r.dir]); return b.pos.x === pos.x && b.pos.y === pos.y && b.dir === back[dir];
}), 'gli archi a U sono reversibili');
const w = walk({ pos: { x: 3, y: 1 }, dir: 'N' }, 4);
ok(w.map(s => `${s.pos.x},${s.pos.y}`).join(' ') === '3,0 2,0 2,1 2,2' && w[3].dir === 'S', 'percorso che passa da un arco (l\'arco non conta come passo)');
ok(walk({ pos: { x: 6, y: 1 }, dir: 'N' }, 3).map(s => `${s.pos.x},${s.pos.y},${s.dir}`).join(' ') === '6,0,N 6,0,W 5,0,W', 'arco d\'angolo: stessa casella, girato di 90°');

/* ---------------- pedaggio ---------------- */
const put = (st, owner, a, b, color = st.players[owner].colors[0]) => { const id = st.rugs.length + 1; st.rugs.push({ id, owner, color, cells: [a, b], round: 0 }); for (const c of [a, b]) st.board[c.y][c.x] = { rug: id, owner, color }; };
const t1 = createGame({ players: [{}, {}, {}, {}], seed: 1 });
put(t1, 1, { x: 3, y: 3 }, { x: 4, y: 3 }); put(t1, 1, { x: 4, y: 4 }, { x: 4, y: 5 }); put(t1, 1, { x: 5, y: 5 }, { x: 6, y: 6 /* diagonale finta */ });
t1.board[6][6] = null; t1.board[5][5] = { rug: 3, owner: 1, color: t1.players[1].colors[0] }; // 5,5 tocca 4,5? no: è in diagonale con 4,4 e accanto a 4,5
ok(zoneAt(t1.board, { x: 3, y: 3 }).length === 5, 'zona connessa ortogonale (5 caselle)');
put(t1, 2, { x: 2, y: 3 }, { x: 2, y: 4 });
ok(zoneAt(t1.board, { x: 3, y: 3 }).length === 5, 'altri colori non si sommano');
const tl = tollFor(t1);
ok(tl && tl.from === 0 && tl.to === 1 && tl.amount === 5 && tl.paid === 5, 'pedaggio = caselle della zona');
t1.players[0].coins = 3;
ok(tollFor(t1).paid === 3, 'paga solo quello che ha');
t1.turn.current = 1; ok(tollFor(t1) === null, 'sul proprio tappeto non si paga');
t1.turn.current = 0; t1.players[1].out = true; ok(tollFor(t1) === null, 'i tappeti di chi è uscito sono neutri');
const t2p = createGame({ players: [{}, {}], seed: 3 });
put(t2p, 1, { x: 3, y: 3 }, { x: 3, y: 4 }, t2p.players[1].colors[0]); put(t2p, 1, { x: 4, y: 3 }, { x: 5, y: 3 }, t2p.players[1].colors[1]);
ok(tollFor(t2p).amount === 2, '2 giocatori: i due colori dello stesso giocatore sono zone separate');

/* ---------------- piazzamento ---------------- */
const g3 = createGame({ players: [{}, {}, {}, {}], seed: 5 });
ok(legalPlacements(g3).length === 12, 'al centro, tabellone vuoto: 12 posizioni');
g3.peppo.pos = { x: 0, y: 0 };
ok(legalPlacements(g3).length === 4, 'nell\'angolo: 4 posizioni');
g3.peppo.pos = { x: 3, y: 3 };
ok(placeError(g3, [{ x: 3, y: 3 }, { x: 3, y: 2 }]) !== null, 'mai sotto Peppo');
ok(placeError(g3, [{ x: 5, y: 3 }, { x: 6, y: 3 }]) !== null, 'deve toccare Peppo');
ok(placeError(g3, [{ x: 4, y: 3 }, { x: 5, y: 4 }]) !== null, 'niente tappeti in diagonale');
put(g3, 1, { x: 4, y: 3 }, { x: 5, y: 3 });
ok(placeError(g3, [{ x: 4, y: 3 }, { x: 5, y: 3 }]) !== null, 'non si copre tutto un tappeto in una volta');
ok(placeError(g3, [{ x: 4, y: 3 }, { x: 4, y: 2 }]) === null, 'si può coprirne metà');
put(g3, 0, { x: 2, y: 3 }, { x: 1, y: 3 });
ok(placeError(g3, [{ x: 2, y: 3 }, { x: 1, y: 3 }]) !== null, 'divieto anche sul proprio (scelta di default)');
g3.options.coverOwn = true;
ok(placeError(g3, [{ x: 2, y: 3 }, { x: 1, y: 3 }]) === null, 'con coverOwn il proprio si può coprire');

/* ---------------- partita intera ---------------- */
let threw2 = false;
let s = createGame({ players: [{}, {}, {}, {}], seed: 11 });
try { applyAction(s, 1, { type: 'orient', dir: 'E' }); } catch (e) { threw2 = e instanceof RuleError; }
ok(threw2, 'fuori turno: errore');
threw2 = false; try { applyAction(s, 0, { type: 'roll' }); } catch (e) { threw2 = e instanceof RuleError; }
ok(threw2, 'fasi in ordine: prima la direzione');
s = applyAction(s, 0, { type: 'orient', dir: 'E' });
ok(s.peppo.dir === 'E' && s.turn.phase === 'roll', 'prima mossa: direzione libera');
threw2 = false; try { applyAction(s, 0, { type: 'orient', dir: 'W' }); } catch (e) { threw2 = true; }
ok(threw2, 'dopo, niente scelta libera');

function playOut(seed, n, options = {}) {
  let st = createGame({ players: Array.from({ length: n }, () => ({})), seed, options });
  let r = seed, guard = 0;
  const pick = k => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r % k; };
  while (st.turn.phase !== 'over' && guard++ < 5000) {
    const by = st.turn.current, ph = st.turn.phase;
    if (ph === 'orient') st = applyAction(st, by, st.log.length === 0 ? { type: 'orient', dir: ['N', 'E', 'S', 'W'][pick(4)] } : { type: 'orient', turn: ['straight', 'left', 'right'][pick(3)] });
    else if (ph === 'roll') st = applyAction(st, by, { type: 'roll' });
    else if (ph === 'pay') st = applyAction(st, by, { type: 'pay' });
    else { const L = legalPlacements(st); st = applyAction(st, by, { type: 'place', cells: L[pick(L.length)] }); }
  }
  return st;
}
let allOk = true, coinsOk = true, outSeen = 0;
for (let seed = 1; seed <= 300; seed++) {
  for (const n of [2, 3, 4]) {
    const st = playOut(seed, n, seed % 5 === 0 ? { rotateAtEnd: true } : {});
    if (st.turn.phase !== 'over' || !st.result) { allOk = false; console.log('non finita', seed, n); break; }
    const coins = st.players.reduce((a, p) => a + p.coins, 0);
    if (coins !== 30 * n) coinsOk = false;
    outSeen += st.players.filter(p => p.out).length;
    const live = st.players.filter(p => !p.out);
    if (live.length > 1 && live.some(p => p.pile.length)) allOk = false;
  }
}
ok(allOk, '900 partite casuali arrivano alla fine (2, 3 e 4 giocatori, anche con la variante)');
ok(coinsOk, 'le monete totali non cambiano mai');
ok(outSeen > 0, `capita che qualcuno esca dal gioco (${outSeen} volte)`);
const fin = playOut(42, 4);
ok(fin.result.every((r, i, a) => i === 0 || a[i - 1].total > r.total || (a[i - 1].total === r.total && a[i - 1].coins >= r.coins)), 'classifica ordinata per punti e monete');
const pv = publicView(fin);
ok(pv.rng === 0 && pv.players.every(p => p.pile.slice(1).every(c => c === null)), 'vista pubblica senza seme né ordine delle pile');

// abbandono (online)
{
  let st = createGame({ players: [{}, {}, {}], seed: 7 });
  st = resign(st, 1);
  ok(st.players[1].out && st.turn.current === 0 && st.turn.phase === 'orient', 'chi abbandona fuori turno esce e il turno resta');
  st = resign(st, 0);
  ok(st.turn.phase === 'over' && st.result.length === 1 && st.result[0].player === 2, 'se resta uno solo la partita finisce');
  let s2 = createGame({ players: [{}, {}, {}], seed: 9 });
  s2 = resign(s2, 0);
  ok(s2.turn.current === 1 && s2.turn.phase === 'orient', 'chi abbandona nel suo turno passa la mano');
  let t3 = false; try { resign(s2, 0); } catch (e) { t3 = e instanceof RuleError; }
  ok(t3, 'non si abbandona due volte');
  let s4 = playOut(11, 4);
  let t4 = false; try { resign(s4, 0); } catch (e) { t4 = true; }
  ok(t4, 'a partita finita non si abbandona');
}

// partita veloce in due: un colore a testa
{
  const q = createGame({ players: [{}, {}], seed: 3, options: { oneColor: true } });
  ok(q.players.every(p => p.colors.length === 1 && p.pile.length === 15 && p.pile.every(c => c === p.colors[0])) && q.players[0].colors[0] !== q.players[1].colors[0],
    'partita veloce: un colore e 15 tappeti a testa');
  const q4 = createGame({ players: [{}, {}, {}, {}], options: { oneColor: true } });
  ok(q4.players.every(p => p.pile.length === 12), 'con 4 giocatori la partita veloce non cambia niente');
  const c2 = createGame({ players: [{}, {}], seed: 1 }), two = c2.players[1].colors;
  c2.board[3][1] = c2.board[3][2] = { rug: 1, owner: 1, color: two[0] };
  c2.board[3][3] = c2.board[3][4] = { rug: 2, owner: 1, color: two[1] };
  c2.peppo.pos = { x: 2, y: 3 };
  ok(tollFor(c2).amount === 2, 'in due, i due colori dello stesso giocatore non si sommano nel pedaggio');
  const o2 = createGame({ players: [{}, {}], seed: 1, options: { oneColor: true } }), one = o2.players[1].colors[0];
  o2.board[3][1] = o2.board[3][2] = { rug: 1, owner: 1, color: one };
  o2.board[3][3] = o2.board[3][4] = { rug: 2, owner: 1, color: one };
  o2.peppo.pos = { x: 2, y: 3 };
  ok(tollFor(o2).amount === 4, 'con un colore a testa i tappeti attaccati fanno una zona sola');
  let allQ = true;
  for (let seed = 1; seed <= 60; seed++) { let g = createGame({ players: [{}, {}], seed, options: { oneColor: true } }); for (let k = 0; k < 100 && g.turn.phase !== 'over'; k++) g = autoTurn(g); if (g.turn.phase !== 'over') allQ = false; }
  ok(allQ, '60 partite veloci arrivano alla fine');
}

// tempo scaduto: Peppo gioca da solo
{
  let st = createGame({ players: [{}, {}, {}], seed: 21 });
  const a = autoTurn(st);
  ok(a.turn.current === 1 && a.turn.phase === 'orient' && a.rugs.length === 1 && a.log.every(ev => ev.auto), 'a tempo scaduto Peppo gioca il turno intero');
  ok(st.log.length === 0, 'autoTurn non cambia lo stato vecchio');
  let allAuto = true, coinsAuto = true;
  for (let seed = 1; seed <= 120; seed++) {
    let g = createGame({ players: Array.from({ length: 2 + (seed % 3) }, () => ({})), seed, options: { rotateAtEnd: seed % 2 === 0 } });
    const total = g.players.reduce((n, p) => n + p.coins, 0);
    for (let k = 0; k < 200 && g.turn.phase !== 'over'; k++) g = autoTurn(g);
    if (g.turn.phase !== 'over') allAuto = false;
    if (g.players.reduce((n, p) => n + p.coins, 0) !== total) coinsAuto = false;
  }
  ok(allAuto && coinsAuto, '120 partite giocate solo da Peppo arrivano alla fine, monete conservate (anche con la variante)');
  const o = autoTurn(st, { out: true });
  ok(o.players[0].out && o.turn.current === 1 && o.log[0].auto && o.log[0].action.type === 'resign', 'al terzo turno saltato si esce');
}

if (fails) { console.log(`\n${fails} prove fallite`); process.exit(1); }
console.log('\nTutto a posto.');
