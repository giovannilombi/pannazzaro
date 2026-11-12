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
  pomodoro: { name: 'Pomodoro', hex: '#c8322b', dark: '#7d1712', light: '#f2a28f' },
  melanzana: { name: 'Melanzana', hex: '#6d3f9c', dark: '#3b1c5c', light: '#c9a8ea' },
  limone: { name: 'Limone', hex: '#e8b923', dark: '#8a6406', light: '#fbe7a1' },
  basilico: { name: 'Basilico', hex: '#2f8a4a', dark: '#13502a', light: '#a5dcb2' },
};
/** @type {PlayerColor[]} */
export const COLOR_ORDER = ['pomodoro', 'melanzana', 'limone', 'basilico'];

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


/* =====================================================================
   Movimento e bordi
   ===================================================================== */

/** Un passo di Peppo. Se esce dal tabellone segue l'arco (che non conta come passo) e rientra:
 * - archi a U: corsia accanto, verso opposto;
 * - archi d'angolo (solo Nord-Est e Sud-Ovest): stessa casella, girato di 90°.
 * Tabella completa in docs/REGOLE.md.
 * @param {Cell} pos @param {Direction} dir
 * @returns {{ pos: Cell, dir: Direction, arc: null | 'u' | 'corner' }} */
export function stepFrom(pos, dir) {
  const { dx, dy } = STEP[dir];
  const n = { x: pos.x + dx, y: pos.y + dy };
  if (inside(n)) return { pos: n, dir, arc: null };
  const { x, y } = pos;
  switch (dir) {
    case 'N': return x === SIZE - 1 ? { pos: { x, y }, dir: 'W', arc: 'corner' } : { pos: { x: x ^ 1, y }, dir: 'S', arc: 'u' };
    case 'E': return y === 0 ? { pos: { x, y }, dir: 'S', arc: 'corner' } : { pos: { x, y: ((y - 1) ^ 1) + 1 }, dir: 'W', arc: 'u' };
    case 'S': return x === 0 ? { pos: { x, y }, dir: 'E', arc: 'corner' } : { pos: { x: ((x - 1) ^ 1) + 1, y }, dir: 'N', arc: 'u' };
    case 'W': return y === SIZE - 1 ? { pos: { x, y }, dir: 'N', arc: 'corner' } : { pos: { x, y: y ^ 1 }, dir: 'E', arc: 'u' };
  }
  throw new Error('Direzione non valida: ' + dir);
}

/** Percorso di n passi. Ogni tappa ha la posizione, la direzione dopo il passo e l'eventuale arco attraversato.
 * @param {import('./types.js').Peppo} peppo @param {number} n
 * @returns {{ pos: Cell, dir: Direction, arc: null | 'u' | 'corner' }[]} */
export function walk(peppo, n) {
  const out = [];
  let cur = { pos: peppo.pos, dir: peppo.dir };
  for (let i = 0; i < n; i++) { const s = stepFrom(cur.pos, cur.dir); out.push(s); cur = s; }
  return out;
}

/* =====================================================================
   Pedaggio
   ===================================================================== */

/** Zona di caselle visibili connesse ortogonalmente con lo stesso proprietario e lo stesso colore.
 * @param {import('./types.js').Board} board @param {Cell} start @returns {Cell[]} */
export function zoneAt(board, start) {
  const c0 = board[start.y][start.x];
  if (!c0) return [];
  const seen = new Set([start.y * SIZE + start.x]), out = [start], q = [start];
  while (q.length) {
    const c = q.shift();
    for (const d of DIRS) {
      const n = { x: c.x + STEP[d].dx, y: c.y + STEP[d].dy };
      if (!inside(n) || seen.has(n.y * SIZE + n.x)) continue;
      const b = board[n.y][n.x];
      if (b && b.owner === c0.owner && b.color === c0.color) { seen.add(n.y * SIZE + n.x); out.push(n); q.push(n); }
    }
  }
  return out;
}

/** Pedaggio che deve pagare chi gioca, oppure null (casella vuota, tappeto proprio o neutro).
 * @param {GameState} state @returns {import('./types.js').Toll | null} */
export function tollFor(state) {
  const { board, peppo, players, turn } = state;
  const c = board[peppo.pos.y][peppo.pos.x];
  if (!c || c.owner === turn.current || players[c.owner].out) return null;
  const area = zoneAt(board, peppo.pos), payer = players[turn.current];
  return { from: turn.current, to: c.owner, amount: area.length, paid: Math.min(payer.coins, area.length), area };
}

/* =====================================================================
   Piazzamento
   ===================================================================== */

const key2 = (a, b) => { const [p, q] = a.y * SIZE + a.x < b.y * SIZE + b.x ? [a, b] : [b, a]; return `${p.x},${p.y}-${q.x},${q.y}`; };

/** Il tappeto [a, b] si può posare? Restituisce null se sì, altrimenti il motivo (da mostrare al giocatore).
 * @param {GameState} state @param {[Cell, Cell]} cells @returns {string | null} */
export function placeError(state, cells) {
  const { board, peppo, options, turn } = state;
  if (!Array.isArray(cells) || cells.length !== 2) return 'Un tappeto copre due caselle.';
  const [a, b] = cells;
  if (![a, b].every(c => c && Number.isInteger(c.x) && Number.isInteger(c.y) && inside(c))) return 'Il tappeto deve stare tutto sul tabellone.';
  if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) return 'Le due metà del tappeto devono essere caselle vicine.';
  if (sameCell(a, peppo.pos) || sameCell(b, peppo.pos)) return 'Non puoi stendere il tappeto sotto Peppo.';
  const touches = c => Math.abs(c.x - peppo.pos.x) + Math.abs(c.y - peppo.pos.y) === 1;
  if (!touches(a) && !touches(b)) return 'Il tappeto deve toccare la casella di Peppo.';
  const ca = board[a.y][a.x], cb = board[b.y][b.x];
  if (ca && cb && ca.rug === cb.rug && !(options.coverOwn && ca.owner === turn.current)) return 'Non puoi coprire tutto un tappeto in una volta sola.';
  return null;
}

/** Tutte le posizioni valide (al massimo 12), senza doppioni.
 * @param {GameState} state @returns {[Cell, Cell][]} */
export function legalPlacements(state) {
  const p = state.peppo.pos, seen = new Set(), out = [];
  for (const d of DIRS) {
    const a = { x: p.x + STEP[d].dx, y: p.y + STEP[d].dy };
    if (!inside(a)) continue;
    for (const e of DIRS) {
      const b = { x: a.x + STEP[e].dx, y: a.y + STEP[e].dy };
      const k = key2(a, b);
      if (seen.has(k)) continue;
      seen.add(k);
      if (!placeError(state, [a, b])) out.push([a, b]);
    }
  }
  return out;
}

/* =====================================================================
   Turni
   ===================================================================== */

export class RuleError extends Error {}
const clone = s => JSON.parse(JSON.stringify(s));
const active = s => s.players.map((p, i) => i).filter(i => !s.players[i].out);

/** Prossimo giocatore in gioco che ha ancora tappeti, oppure -1. */
function nextPlayer(s) {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (s.turn.current + k) % n, p = s.players[i];
    if (!p.out && p.pile.length) return i;
  }
  return -1;
}

/** Classifica finale: monete + caselle visibili dei propri colori; a parità vince chi ha più monete.
 * @param {GameState} s @returns {import('./types.js').Score[]} */
export function finalScores(s) {
  const cells = s.players.map(() => 0);
  for (const row of s.board) for (const c of row) if (c) cells[c.owner]++;
  const list = active(s).map(i => ({ player: /** @type {any} */ (i), coins: s.players[i].coins, cells: cells[i], total: s.players[i].coins + cells[i], place: 0 }));
  list.sort((a, b) => b.total - a.total || b.coins - a.coins);
  list.forEach((r, i) => { const prev = list[i - 1]; r.place = prev && prev.total === r.total && prev.coins === r.coins ? prev.place : i + 1; });
  return list;
}

function endTurn(s) {
  s.turn.round++;
  const live = active(s);
  const nxt = live.length > 1 ? nextPlayer(s) : -1;
  if (nxt < 0) { s.turn.phase = 'over'; s.result = finalScores(s); return; }
  s.turn.current = nxt;
  s.turn.phase = s.options.rotateAtEnd ? 'roll' : 'orient';
  s.turn.roll = null; s.turn.path = []; s.turn.toll = null;
}

/** Applica un'azione e restituisce il NUOVO stato (quello vecchio non cambia).
 * Lancia RuleError con un messaggio comprensibile se l'azione non è permessa.
 * @param {GameState} state @param {import('./types.js').PlayerIndex} by chi agisce @param {import('./types.js').Action} action
 * @returns {GameState} */
export function applyAction(state, by, action) {
  if (state.turn.phase === 'over') throw new RuleError('La partita è finita.');
  if (by !== state.turn.current) throw new RuleError('Non è il tuo turno.');
  if (!action || action.type !== state.turn.phase) throw new RuleError('Adesso non si può fare questa mossa.');
  const s = clone(state), t = s.turn, me = s.players[by];
  const ev = { by, round: t.round, action: clone(action) };

  if (action.type === 'orient') {
    const first = s.log.length === 0; // primissima mossa della partita: direzione libera
    if (first && 'dir' in action) {
      if (!DIRS.includes(action.dir)) throw new RuleError('Direzione non valida.');
      s.peppo.dir = action.dir;
    } else {
      if (!('turn' in action) || !['straight', 'left', 'right'].includes(action.turn)) throw new RuleError('Peppo può andare dritto, a sinistra o a destra.');
      s.peppo.dir = turnDir(s.peppo.dir, action.turn);
    }
    s.log.push(ev);
    // variante: la rotazione chiude il turno (tranne al primissimo, dove apre la partita)
    if (s.options.rotateAtEnd && !first) endTurn(s); else t.phase = 'roll';
    return s;
  }

  if (action.type === 'roll') {
    const r = rollDie(s.rng); s.rng = r.rng;
    const path = walk(s.peppo, r.face);
    const last = path[path.length - 1];
    s.peppo = { pos: { ...last.pos }, dir: last.dir };
    t.roll = r.face; t.path = path.map(p => ({ ...p.pos }));
    t.toll = tollFor(s);
    s.log.push({ ...ev, roll: r.face });
    t.phase = t.toll ? 'pay' : 'place';
    if (t.phase === 'place') skipIfStuck(s);
    return s;
  }

  if (action.type === 'pay') {
    const toll = /** @type {import('./types.js').Toll} */ (t.toll);
    me.coins -= toll.paid;
    s.players[toll.to].coins += toll.paid;
    s.log.push({ ...ev, toll: clone(toll) });
    if (toll.paid < toll.amount) {
      // non basta: paga quello che ha ed esce; i suoi tappeti sul tabellone diventano neutri
      me.out = true; me.pile = [];
      endTurn(s);
      return s;
    }
    t.phase = 'place';
    skipIfStuck(s);
    return s;
  }

  if (action.type === 'place') {
    const err = placeError(s, action.cells);
    if (err) throw new RuleError(err);
    const color = me.pile.shift();
    const id = s.rugs.length + 1;
    const cells = /** @type {[Cell, Cell]} */ (action.cells.map(c => ({ x: c.x, y: c.y })));
    s.rugs.push({ id, owner: by, color, cells, round: t.round });
    for (const c of cells) s.board[c.y][c.x] = { rug: id, owner: by, color };
    s.log.push(ev);
    if (s.options.rotateAtEnd) t.phase = 'orient'; else endTurn(s);
    return s;
  }
  throw new RuleError('Mossa sconosciuta.');
}

/** Un giocatore abbandona (solo online: si può fare anche fuori turno). Esce come chi non può pagare:
 * tappeti in mano scartati, quelli sul tabellone diventano neutri.
 * @param {GameState} state @param {import('./types.js').PlayerIndex} by @returns {GameState} */
export function resign(state, by) {
  if (state.turn.phase === 'over') throw new RuleError('La partita è finita.');
  const s = clone(state), me = s.players[by], t = s.turn;
  if (!me) throw new RuleError('Non sei in questa partita.');
  if (me.out) throw new RuleError('Sei già fuori dal gioco.');
  me.out = true; me.pile = [];
  s.log.push({ by, round: t.round, action: { type: 'resign' } });
  if (t.current === by) { endTurn(s); return s; }
  if (active(s).length <= 1) { t.phase = 'over'; s.result = finalScores(s); return s; }
  // chi sta per pagare proprio a chi se ne va non paga più
  if (t.phase === 'pay' && t.toll && t.toll.to === by) { t.toll = null; t.phase = 'place'; skipIfStuck(s); }
  return s;
}

/** Caso rarissimo: nessuna posizione valida per il tappeto. Il tappeto si scarta e il turno va avanti. */
function skipIfStuck(s) {
  if (legalPlacements(s).length) return;
  s.players[s.turn.current].pile.shift();
  s.log.push({ by: s.turn.current, round: s.turn.round, action: { type: 'place', cells: null }, skipped: true });
  if (s.options.rotateAtEnd) s.turn.phase = 'orient'; else endTurn(s);
}

/** Cosa può vedere un giocatore (online): niente seme del dado, delle pile si vede solo quanti tappeti restano
 * e il colore del prossimo. @param {GameState} s @returns {GameState} */
export function publicView(s) {
  const v = clone(s);
  v.rng = 0;
  for (const p of v.players) p.pile = p.pile.map((c, i) => (i === 0 ? c : null));
  return v;
}
