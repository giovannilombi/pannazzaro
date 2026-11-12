// Prove rapide delle regole pure:  npm test  (oppure node tools/test-rules.js)
import { createGame, turnDir, rollDie, DIE, SIZE, START_COINS, RUGS_PER_PLAYER } from '../js/rules.js';

let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails++; };

const g = createGame({ players: [{}, {}, {}, {}], seed: 42 });
ok(g.board.length === SIZE && g.board.every(r => r.length === SIZE && r.every(c => c === null)), 'tabellone 7×7 vuoto');
ok(g.peppo.pos.x === 3 && g.peppo.pos.y === 3, 'Peppo al centro (3,3)');
ok(g.players.length === 4 && g.players.every(p => p.coins === START_COINS && p.rugsLeft === RUGS_PER_PLAYER), '4 giocatori con monete e tappeti');
ok(new Set(g.players.map(p => p.color)).size === 4, 'colori tutti diversi');
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
