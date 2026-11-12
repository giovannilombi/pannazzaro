// Prove rapide delle regole pure:  npm test  (oppure node tools/test-rules.js)
import { createGame, turnDir, rollDie, DIE, SIZE, START_COINS } from '../js/rules.js';

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

if (fails) { console.log(`\n${fails} prove fallite`); process.exit(1); }
console.log('\nTutto a posto.');
