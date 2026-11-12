// Componente tabellone 7×7: cornice con pavimento e archi, tappeti, Peppo o' Pannazzaro e livelli di anteprima.
// I disegni (tre grafiche) stanno in skins.js; qui si montano e si animano.
// Uso:  const b = createBoard(el); b.render(state); b.movePeppo(...); b.marks(...); b.ghost(...)
// Le caselle si ridisegnano a ogni render; Peppo resta lo stesso elemento, così i movimenti si animano.
/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Cell} Cell */
import { SIZE, COLORS } from './rules.js';
import { SKINS } from './skins.js';

const ROT = { N: 0, E: 90, S: 180, W: 270 };
export const DIR_NAME = { N: 'Nord', E: 'Est', S: 'Sud', W: 'Ovest' };
const wait = ms => new Promise(r => setTimeout(r, ms));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Quale arco attraversa Peppo uscendo da pos in direzione dir (id degli archi in skins.js). */
export function arcId(pos, dir) {
  const { x, y } = pos;
  if (dir === 'N') return x === SIZE - 1 ? 'NE' : 'N' + (x >> 1);
  if (dir === 'E') return y === 0 ? 'NE' : 'E' + ((y - 1) >> 1);
  if (dir === 'S') return x === 0 ? 'SW' : 'S' + ((x - 1) >> 1);
  return y === SIZE - 1 ? 'SW' : 'W' + (y >> 1);
}

/** Metà di un tappeto dentro una casella. half = 0 (sinistra o alto) oppure 1; i disegni sono in orizzontale, 160×80. */
const rugHalf = (color, horiz, half) => `<svg class="rugart" viewBox="${horiz ? half * 80 : 0} ${horiz ? 0 : half * 80} 80 80" aria-hidden="true"><use href="#pz-rug-${color}"${horiz ? '' : ' transform="translate(80,0) rotate(90)"'}/></svg>`;
/** Tappeto intero (anteprima del piazzamento). */
const rugWhole = (color, horiz) => `<svg class="rugart" viewBox="0 0 ${horiz ? '160 80' : '80 160'}" aria-hidden="true"><use href="#pz-rug-${color}"${horiz ? '' : ' transform="translate(80,0) rotate(90)"'}/></svg>`;

/* ---------------- componente ---------------- */
/** @param {HTMLElement} root @param {'a' | 'b' | 'c'} [skinName] */
export function createBoard(root, skinName = 'a') {
  root.classList.add('frame');
  root.innerHTML = `<svg class="arcs" aria-hidden="true"></svg>
    <svg class="sprite" width="0" height="0" aria-hidden="true"><defs></defs></svg>
    <div class="board" role="grid" aria-label="Tabellone 7 per 7">
      <div class="cells"></div>
      <div class="fx" aria-hidden="true"></div>
      <div class="peppo" role="img"></div>
    </div>`;
  const frameEl = /** @type {SVGElement} */ (root.querySelector('.arcs'));
  const spriteEl = /** @type {SVGElement} */ (root.querySelector('.sprite defs'));
  const board = /** @type {HTMLElement} */ (root.querySelector('.board'));
  const cellsEl = /** @type {HTMLElement} */ (root.querySelector('.cells'));
  const fx = /** @type {HTMLElement} */ (root.querySelector('.fx'));
  const peppoEl = /** @type {HTMLElement} */ (root.querySelector('.peppo'));
  let angle = 0; // rotazione cumulativa: così da Ovest a Nord gira di 90°, non di 270° all'indietro
  let onCell = null, onHover = null;

  /** Cambia grafica: cornice, pavimento, archi, tappeti e Peppo. Le caselle e le anteprime restano dove sono. */
  function setSkin(name) {
    const sk = SKINS[name] || SKINS.a, [v0, side] = sk.view;
    frameEl.setAttribute('viewBox', `${v0} ${v0} ${side} ${side}`);
    frameEl.innerHTML = sk.frame;
    // tappeti: dal disegno 152×72 al riquadro 160×80 di due caselle (frange comprese)
    spriteEl.innerHTML = Object.entries(sk.rugs).map(([k, art]) => `<g id="pz-rug-${k}" transform="translate(6,5) scale(.9737,.9722)">${art}</g>`).join('');
    peppoEl.innerHTML = sk.peppo;
    root.style.setProperty('--pad', ((120 - v0) / side) * 100 + '%');
  }
  setSkin(skinName);

  function setPeppo(pos, dir, label = true) {
    const target = ROT[dir];
    let delta = ((target - (angle % 360)) + 540) % 360 - 180;
    angle += delta;
    peppoEl.dataset.dir = dir;
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
        const cls = ['cell'];
        let label = `Casella ${x + 1},${y + 1}`, inner = '';
        if (cell) {
          const p = players[cell.owner], col = COLORS[cell.color];
          const rug = rugById.get(cell.rug);
          const [c0, c1] = rug ? rug.cells : [{ x, y }, { x: x + 1, y }];
          const horiz = c0.y === c1.y;
          const first = horiz ? Math.min(c0.x, c1.x) === x : Math.min(c0.y, c1.y) === y;
          cls.push('rug', `rug-${cell.color}`);
          if (p.out) cls.push('neutral');
          label += p.out ? `, tappeto neutro (era di ${p.name})` : `, tappeto ${col.name} di ${p.name}`;
          inner = rugHalf(cell.color, horiz, first ? 0 : 1);
        }
        html += `<div role="gridcell" class="${cls.join(' ')}" data-x="${x}" data-y="${y}" aria-label="${label}">${inner}</div>`;
      }
      html += '</div>';
    }
    cellsEl.innerHTML = html;
    // il tappeto arrotolato che Peppo porta è del colore di chi gioca
    const cur = players[state.turn.current];
    if (cur) peppoEl.style.setProperty('--roll', COLORS[cur.pile[0] || cur.colors[0]].hex);
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
        // saltello a ogni passo
        peppoEl.classList.remove('hop'); void peppoEl.offsetWidth; peppoEl.classList.add('hop');
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
    const el = document.createElement('div');
    el.className = `ghost rug-${color} ${horiz ? 'horiz' : 'vert'}`;
    el.style.cssText = at(x, y, horiz ? 2 : 1, horiz ? 1 : 2);
    el.innerHTML = rugWhole(color, horiz);
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
    el: board, render, movePeppo, setPeppo, setSkin, marks, tint, ghost, arrows, clearFx,
    onCell: fn => (onCell = fn), onHover: fn => (onHover = fn),
    peppoEl,
  };
}
