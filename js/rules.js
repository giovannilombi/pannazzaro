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
// Tappeti a testa secondo il numero di giocatori (regola ufficiale). In 2 ognuno ha due colori, 12 per colore.
export const RUGS_BY_PLAYERS = Object.freeze({ 2: 24, 3: 15, 4: 12 });
export const COLORS_BY_PLAYERS = Object.freeze({ 2: 2, 3: 1, 4: 1 });
/** @type {import('./types.js').RuleOptions} */
export const DEFAULT_OPTIONS = Object.freeze({ coverOwn: false, rotateAtEnd: false });
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

/** Mescola un array con il generatore del dado (stesso seme → stesso ordine). @returns {number} nuovo stato rng */
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const r = rand(rng); rng = r.rng;
    const j = Math.floor(r.u * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return rng;
}

/** Partita nuova: tabellone vuoto, Peppo al centro. Il verso iniziale (N) è solo grafico: al primo turno
 * il giocatore sceglie liberamente fra le 4 direzioni. I giocatori vanno passati già nell'ordine di gioco
 * (il primo a caso lo sceglie chi crea la partita).
 * @param {{ players: Partial<PlayerState>[], mode?: import('./types.js').GameMode, seed?: number, options?: Partial<import('./types.js').RuleOptions> }} opts
 * @returns {GameState} */
export function createGame({ players, mode = 'local', seed = (Math.random() * 2 ** 32) >>> 0, options = {} }) {
  const n = Array.isArray(players) ? players.length : 0;
  if (n < 2 || n > 4) throw new Error('Servono da 2 a 4 giocatori.');
  let rng = seed >>> 0, nextColor = 0;
  const perColor = RUGS_BY_PLAYERS[n] / COLORS_BY_PLAYERS[n];
  const list = players.map((p, i) => {
    /** @type {PlayerColor[]} */
    const colors = p.colors && p.colors.length === COLORS_BY_PLAYERS[n] ? [...p.colors] : COLOR_ORDER.slice(nextColor, nextColor + COLORS_BY_PLAYERS[n]);
    nextColor += COLORS_BY_PLAYERS[n];
    const pile = colors.flatMap(c => Array(perColor).fill(c));
    if (colors.length > 1) rng = shuffle(pile, rng);
    return { accountId: p.accountId ?? null, name: p.name || `Giocatore ${i + 1}`, avatar: p.avatar || '🙂', colors, coins: START_COINS, pile, out: false };
  });
  return {
    v: 1,
    id: null,
    mode,
    rng,
    options: { ...DEFAULT_OPTIONS, ...options },
    board: Array.from({ length: SIZE }, () => Array(SIZE).fill(null)),
    rugs: [],
    peppo: { pos: { ...CENTER }, dir: 'N' },
    players: list,
    turn: { current: 0, phase: 'orient', round: 0, roll: null, path: [], toll: null },
    log: [],
    result: null,
  };
}

/** Generatore deterministico (mulberry32): stesso seme → stessa sequenza, utile per test e repliche.
 * @param {number} rng @returns {{ u: number, rng: number }} u in [0, 1) */
export function rand(rng) {
  const t = (rng + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), t | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return { u: ((r ^ (r >>> 14)) >>> 0) / 2 ** 32, rng: t };
}

/** Lancio del dado. @param {number} rng @returns {{ face: import('./types.js').DieFace, rng: number }} */
export function rollDie(rng) {
  const r = rand(rng);
  return { face: /** @type {any} */ (DIE[Math.floor(r.u * DIE.length)]), rng: r.rng };
}

// Prossimi passi: moveSteps (bordi, tabella in docs/REGOLE.md), tollAt (zona connessa), canPlace, applyAction, finalScore.
