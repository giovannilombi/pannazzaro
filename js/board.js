// Componente tabellone: pavimento di maioliche 7×7, archi sul bordo, tappeti, Peppo o' Pannazzaro e livelli di anteprima.
// Uso:  const b = createBoard(el); b.render(state); b.movePeppo(...); b.marks(...); b.ghost(...)
// Le caselle si ridisegnano a ogni render; Peppo resta lo stesso elemento, così i movimenti si animano.
/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Cell} Cell */
import { SIZE, COLORS } from './rules.js';

const ROT = { N: 0, E: 90, S: 180, W: 270 };
export const DIR_NAME = { N: 'Nord', E: 'Est', S: 'Sud', W: 'Ovest' };
const wait = ms => new Promise(r => setTimeout(r, ms));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Peppo visto dall'alto: coppola con la visiera in avanti, giacca, fagotto di stoffe sulla schiena (disegno originale).
export const PEPPO_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <path class="peppo-ray" d="M50 2 L62 16 H38 Z" />
  <g class="peppo-bundle">
    <rect x="24" y="66" width="52" height="24" rx="11" fill="#c8322b" stroke="#26303b" stroke-width="3"/>
    <path d="M34 66 v24 M46 66 v24 M58 66 v24 M68 67 v22" stroke="#e8b923" stroke-width="4"/>
    <path d="M30 70 q20 8 40 0" stroke="#fbf7ee" stroke-width="2" fill="none" opacity=".7"/>
  </g>
  <ellipse cx="50" cy="58" rx="31" ry="20" fill="#5a3a26" stroke="#26303b" stroke-width="3"/>
  <path d="M24 56 q26 10 52 0" stroke="#3f281a" stroke-width="3" fill="none"/>
  <circle cx="50" cy="48" r="17" fill="#f1c8a0" stroke="#26303b" stroke-width="3"/>
  <path d="M33 50 a17 17 0 0 1 34 0 q-17 6 -34 0 Z" fill="#3b4652" stroke="#26303b" stroke-width="3" stroke-linejoin="round"/>
  <path d="M36 37 q14 -16 28 0 l-3 4 q-11 -9 -22 0 Z" fill="#2c353f" stroke="#26303b" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="50" cy="44" r="2.4" fill="#8a96a3"/>
</svg>`;

/* ---------------- archi del bordo ---------------- */
// Disegno in unità: casella = 100, tabellone 0..700, margine M tutto intorno.
const M = 58;
export const FRAME_PAD = (M / (SIZE * 100 + 2 * M)) * 100; // % di padding della cornice
const c = i => i * 100 + 50;
function arcPaths() {
  const out = [];
  const h = 52; // quanto l'arco esce dal tabellone
  for (let k = 0; k < 3; k++) {
    // Nord: colonne (0,1) (2,3) (4,5)
    const a = 2 * k, b = 2 * k + 1;
    out.push([`N${k}`, `M${c(a)} 0 C${c(a)} ${-h} ${c(b)} ${-h} ${c(b)} 0`]);
    // Ovest: righe (0,1) (2,3) (4,5)
    out.push([`W${k}`, `M0 ${c(a)} C${-h} ${c(a)} ${-h} ${c(b)} 0 ${c(b)}`]);
    // Sud: colonne (1,2) (3,4) (5,6)
    const p = 2 * k + 1, q = 2 * k + 2;
    out.push([`S${k}`, `M${c(p)} 700 C${c(p)} ${700 + h} ${c(q)} ${700 + h} ${c(q)} 700`]);
    // Est: righe (1,2) (3,4) (5,6)
    out.push([`E${k}`, `M700 ${c(p)} C${700 + h} ${c(p)} ${700 + h} ${c(q)} 700 ${c(q)}`]);
  }
  // archi d'angolo: Nord-Est (6,0) e Sud-Ovest (0,6), un quarto di giro attorno allo spigolo
  out.push(['NE', `M${c(6)} 0 C${c(6)} ${-h * 1.05} ${700 + h * 1.05} ${c(0)} 700 ${c(0)}`]);
  out.push(['SW', `M${c(0)} 700 C${c(0)} ${700 + h * 1.05} ${-h * 1.05} ${c(6)} 0 ${c(6)}`]);
  return out;
}
/** Quale arco attraversa Peppo uscendo da pos in direzione dir (id dei path qui sopra). */
export function arcId(pos, dir) {
  const { x, y } = pos;
  if (dir === 'N') return x === SIZE - 1 ? 'NE' : 'N' + (x >> 1);
  if (dir === 'E') return y === 0 ? 'NE' : 'E' + ((y - 1) >> 1);
  if (dir === 'S') return x === 0 ? 'SW' : 'S' + ((x - 1) >> 1);
  return y === SIZE - 1 ? 'SW' : 'W' + (y >> 1);
}
const ARCS_SVG = `<svg class="arcs" viewBox="${-M} ${-M} ${700 + 2 * M} ${700 + 2 * M}" aria-hidden="true">
  ${arcPaths().map(([id, d]) => `<g class="arc" data-arc="${id}"><path class="arc-bed" d="${d}"/><path class="arc-tile" d="${d}"/></g>`).join('')}
</svg>`;

/* ---------------- componente ---------------- */
/** @param {HTMLElement} root */
export function createBoard(root) {
  root.classList.add('frame');
  root.style.setProperty('--pad', FRAME_PAD + '%');
  root.innerHTML = `${ARCS_SVG}
    <div class="board" role="grid" aria-label="Tabellone 7 per 7">
      <div class="cells"></div>
      <div class="fx" aria-hidden="true"></div>
      <div class="peppo" role="img">${PEPPO_SVG}</div>
    </div>`;
  const board = /** @type {HTMLElement} */ (root.querySelector('.board'));
  const cellsEl = /** @type {HTMLElement} */ (root.querySelector('.cells'));
  const fx = /** @type {HTMLElement} */ (root.querySelector('.fx'));
  const peppoEl = /** @type {HTMLElement} */ (root.querySelector('.peppo'));
  let angle = 0; // rotazione cumulativa: così da Ovest a Nord gira di 90°, non di 270° all'indietro
  let onCell = null, onHover = null;

  function setPeppo(pos, dir, label = true) {
    const target = ROT[dir];
    let delta = ((target - (angle % 360)) + 540) % 360 - 180;
    angle += delta;
    peppoEl.style.setProperty('--x', String(pos.x));
    peppoEl.style.setProperty('--y', String(pos.y));
    peppoEl.style.setProperty('--rot', angle + 'deg');
    if (label) peppoEl.setAttribute('aria-label', `Peppo o' Pannazzaro nella casella ${pos.x + 1},${pos.y + 1}, guarda verso ${DIR_NAME[dir]}`);
  }

  /** @param {GameState} state */
  function render(state) {
    const { board: b, players, rugs } = state;
    const rugById = new Map(rugs.map(r => [r.id, r]));
    let html = '';
    for (let y = 0; y < SIZE; y++) {
      html += '<div role="row" class="row">';
      for (let x = 0; x < SIZE; x++) {
        const cell = b[y][x];
        const cls = ['cell', (x + y) % 2 ? 'odd' : 'even'];
        let style = '', label = `Casella ${x + 1},${y + 1}`, inner = '';
        if (cell) {
          const p = players[cell.owner], col = COLORS[cell.color];
          const rug = rugById.get(cell.rug);
          // dov'è l'altra metà (se si vede ancora): da quel lato niente bordo, dal lato opposto le frange
          let side = '';
          if (rug) {
            const o = rug.cells.find(q => q.x !== x || q.y !== y);
            if (o && b[o.y][o.x] && b[o.y][o.x].rug === cell.rug) side = o.y < y ? 'n' : o.y > y ? 's' : o.x > x ? 'e' : 'w';
          }
          cls.push('rug', `rug-${cell.color}`);
          if (side) cls.push('half', `p-${side}`);
          if (p.out) cls.push('neutral');
          style = ` style="--rug:${col.hex};--rug-dark:${col.dark};--rug-light:${col.light}"`;
          label += p.out ? `, tappeto neutro (era di ${p.name})` : `, tappeto ${col.name} di ${p.name}`;
          inner = '<i class="weave"></i><i class="fringe"></i>';
        }
        html += `<div role="gridcell" class="${cls.join(' ')}" data-x="${x}" data-y="${y}"${style} aria-label="${label}">${inner}</div>`;
      }
      html += '</div>';
    }
    cellsEl.innerHTML = html;
    setPeppo(state.peppo.pos, state.peppo.dir);
  }

  /** Muove Peppo lungo un percorso, passo per passo. steps = [{ pos, dir, arc }] (da walk()). */
  async function movePeppo(from, steps) {
    const ms = reduced() ? 0 : 300;
    let prev = from;
    for (const s of steps) {
      if (s.arc) {
        const id = arcId(prev.pos, prev.dir);
        const g = root.querySelector(`[data-arc="${id}"]`);
        g && g.classList.add('flash');
        setTimeout(() => g && g.classList.remove('flash'), 700);
        if (s.arc === 'corner') { setPeppo(s.pos, s.dir, false); await wait(ms); continue; }
        // arco a U: prima si gira verso l'esterno, poi rientra nella corsia accanto già voltato
        setPeppo(s.pos, s.dir, false);
        await wait(ms * 1.3);
      } else {
        setPeppo(s.pos, s.dir, false);
        await wait(ms);
      }
      prev = s;
    }
    const last = steps[steps.length - 1];
    if (last) setPeppo(last.pos, last.dir);
  }

  /* ---------------- livelli di anteprima ---------------- */
  const at = (x, y, w = 1, h = 1) => `grid-column:${x + 1} / span ${w};grid-row:${y + 1} / span ${h}`;

  /** Segni sulle caselle dove Peppo può arrivare: [{ pos, label, weight }] + archi attraversati. */
  function marks(list, arcs = []) {
    fx.querySelectorAll('.mark, .trail').forEach(e => e.remove());
    root.querySelectorAll('.arc.hot').forEach(e => e.classList.remove('hot'));
    for (const m of list) {
      const el = document.createElement('div');
      el.className = `mark w${m.weight || 1}`;
      el.style.cssText = at(m.pos.x, m.pos.y);
      el.innerHTML = `<span>${m.label}</span>`;
      fx.appendChild(el);
    }
    for (const id of arcs) { const g = root.querySelector(`[data-arc="${id}"]`); g && g.classList.add('hot'); }
  }

  /** Caselle evidenziate (zona del pedaggio, caselle disponibili per il tappeto...). kind = classe CSS. */
  function tint(cells, kind) {
    cellsEl.querySelectorAll('.' + kind).forEach(e => e.classList.remove(kind));
    for (const q of cells) { const el = cellsEl.querySelector(`[data-x="${q.x}"][data-y="${q.y}"]`); el && el.classList.add(kind); }
  }

  /** Tappeto fantasma (anteprima del piazzamento). cells = null per toglierlo. */
  function ghost(cells, color) {
    fx.querySelectorAll('.ghost').forEach(e => e.remove());
    if (!cells) return;
    const [a, b2] = cells;
    const x = Math.min(a.x, b2.x), y = Math.min(a.y, b2.y), horiz = a.y === b2.y;
    const col = COLORS[color];
    const el = document.createElement('div');
    el.className = `ghost rug-${color} ${horiz ? 'horiz' : 'vert'}`;
    el.style.cssText = `${at(x, y, horiz ? 2 : 1, horiz ? 1 : 2)};--rug:${col.hex};--rug-dark:${col.dark};--rug-light:${col.light}`;
    el.innerHTML = '<i class="weave"></i><i class="fringe f1"></i><i class="fringe f2"></i>';
    fx.appendChild(el);
  }

  /** Frecce accanto a Peppo per scegliere la direzione toccando il tabellone. opts = [{ pos, dir, key }] */
  function arrows(opts) {
    fx.querySelectorAll('.arrow').forEach(e => e.remove());
    for (const o of opts) {
      const el = document.createElement('div');
      el.className = 'arrow';
      el.dataset.key = o.key;
      el.style.cssText = `${at(o.pos.x, o.pos.y)};--rot:${ROT[o.dir]}deg`;
      el.innerHTML = '<svg viewBox="0 0 40 40"><path d="M20 6 L33 22 H25 V34 H15 V22 H7 Z"/></svg>';
      fx.appendChild(el);
    }
  }

  function clearFx() { fx.innerHTML = ''; marks([]); tint([], 'zone'); tint([], 'can'); tint([], 'pick'); }

  // tocchi e passaggi del mouse sulle caselle
  const cellAt = e => { const el = e.target.closest('.cell'); return el ? { x: +el.dataset.x, y: +el.dataset.y } : null; };
  cellsEl.addEventListener('click', e => { const q = cellAt(e); if (q && onCell) onCell(q); });
  cellsEl.addEventListener('mouseover', e => { const q = cellAt(e); if (onHover) onHover(q); });
  cellsEl.addEventListener('mouseleave', () => onHover && onHover(null));

  return {
    el: board, render, movePeppo, setPeppo, marks, tint, ghost, arrows, clearFx,
    onCell: fn => (onCell = fn), onHover: fn => (onHover = fn),
    peppoEl,
  };
}
