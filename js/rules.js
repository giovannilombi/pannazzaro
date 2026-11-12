// Pannazzaro — costanti e regole pure. Condiviso browser/server (come gamify.js in Twindoku):
// in modalità online il worker importa questo file e decide lui, così le regole sono sempre le stesse.
/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Direction} Direction */
/** @typedef {import('./types.js').Turn} Turn */
/** @typedef {import('./types.js').PlayerState} PlayerState */
/** @typedef {import('./types.js').PlayerColor} PlayerColor */

export const SIZE = 7;
export const CENTER = Object.freeze({ x: 3, y: 3 });
export const START_COINS = 30;
export const RUGS_PER_PLAYER = 15; // da confermare: vedi docs/REGOLE.md
export const DIE = Object.freeze([1, 2, 2, 3, 3, 4]);

/** @type {Record<PlayerColor, { name: string, hex: string }>} */
export const COLORS = {
  pomodoro: { name: 'Pomodoro', hex: '#c8322b' },
  golfo: { name: 'Golfo', hex: '#1f5fa8' },
  limone: { name: 'Limone', hex: '#e2b31b' },
  basilico: { name: 'Basilico', hex: '#2f8a4a' },
};
/** @type {PlayerColor[]} */
export const COLOR_ORDER = ['pomodoro', 'golfo', 'limone', 'basilico'];

/** @type {Direction[]} in senso orario */
export const DIRS = ['N', 'E', 'S', 'W'];
/** @type {Record<Direction, { dx: number, dy: number }>} */
export const STEP = { N: { dx: 0, dy: -1 }, E: { dx: 1, dy: 0 }, S: { dx: 0, dy: 1 }, W: { dx: -1, dy: 0 } };

/** Nuova direzione dopo la scelta del giocatore (mai 180°).
 * @param {Direction} dir @param {Turn} turn @returns {Direction} */
export function turnDir(dir, turn) {
  const i = DIRS.indexOf(dir);
  if (turn === 'straight') return dir;
  if (turn === 'right') return DIRS[(i + 1) % 4];
  if (turn === 'left') return DIRS[(i + 3) % 4];
  throw new Error('Svolta non valida: ' + turn);
}

export const inside = ({ x, y }) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
export const sameCell = (a, b) => a.x === b.x && a.y === b.y;

/** Giocatore di partenza.
 * @param {Partial<PlayerState>} p @param {number} i @returns {PlayerState} */
function newPlayer(p, i) {
  return {
    accountId: p.accountId ?? null,
    name: p.name || `Giocatore ${i + 1}`,
    avatar: p.avatar || '🙂',
    color: p.color || COLOR_ORDER[i],
    coins: START_COINS,
    rugsLeft: RUGS_PER_PLAYER,
    out: false,
  };
}

/** Partita nuova: tabellone vuoto, Peppo al centro rivolto a Nord, tocca al primo giocatore scegliere la direzione.
 * @param {{ players: Partial<PlayerState>[], mode?: import('./types.js').GameMode, seed?: number }} opts
 * @returns {GameState} */
export function createGame({ players, mode = 'local', seed = (Math.random() * 2 ** 32) >>> 0 }) {
  if (!Array.isArray(players) || players.length < 2 || players.length > 4) throw new Error('Servono da 2 a 4 giocatori.');
  return {
    v: 1,
    id: null,
    mode,
    rng: seed >>> 0,
    board: Array.from({ length: SIZE }, () => Array(SIZE).fill(null)),
    rugs: [],
    peppo: { pos: { ...CENTER }, dir: 'N' },
    players: players.map(newPlayer),
    turn: { current: 0, phase: 'orient', round: 0, roll: null, path: [], toll: null },
    log: [],
    result: null,
  };
}

/** Lancio del dado con generatore deterministico (mulberry32): stesso seme → stessi lanci, utile per test e repliche.
 * @param {number} rng @returns {{ face: import('./types.js').DieFace, rng: number }} */
export function rollDie(rng) {
  let t = (rng + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), t | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  const u = ((r ^ (r >>> 14)) >>> 0) / 2 ** 32;
  return { face: /** @type {any} */ (DIE[Math.floor(u * DIE.length)]), rng: t };
}

// Prossimi passi (step 2): moveSteps (con i bordi), tollAt (caselle contigue), canPlace, applyAction, finalScore.
