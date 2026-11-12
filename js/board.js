// Componente tabellone: disegna la griglia 7×7, i tappeti visibili e Peppo o' Pannazzaro.
// Vanilla DOM come in Twindoku: renderBoard(el, state) riscrive le caselle; Peppo è un elemento a parte
// spostato con variabili CSS (--x, --y, --rot), così in futuro il movimento si anima con una transizione.
/** @typedef {import('./types.js').GameState} GameState */
import { SIZE, COLORS } from './rules.js';

const ROT = { N: 0, E: 90, S: 180, W: 270 };
const DIR_NAME = { N: 'Nord', E: 'Est', S: 'Sud', W: 'Ovest' };

// Peppo visto dall'alto: cappello, spalle, e una freccia che indica dove guarda (disegno originale).
export const PEPPO_SVG = `<svg viewBox="0 0 40 40" aria-hidden="true">
  <path d="M20 1.5 L26 9 H14 Z" fill="#fbf3dc" stroke="#2a1d14" stroke-width="1.6" stroke-linejoin="round"/>
  <ellipse cx="20" cy="24" rx="13" ry="10" fill="#7a3b1e" stroke="#2a1d14" stroke-width="2"/>
  <circle cx="20" cy="21" r="8.5" fill="#f2c79b" stroke="#2a1d14" stroke-width="2"/>
  <path d="M11.5 20 a8.5 8.5 0 0 1 17 0 Z" fill="#2a1d14"/>
  <rect x="9" y="27" width="22" height="4.5" rx="2" fill="#e2b31b" stroke="#2a1d14" stroke-width="1.5"/>
</svg>`;

/** Disegna (o ridisegna) il tabellone.
 * @param {HTMLElement} el contenitore
 * @param {GameState} state */
export function renderBoard(el, state) {
  const { board, peppo, players } = state;
  el.classList.add('board');
  el.style.setProperty('--n', String(SIZE));
  el.setAttribute('role', 'grid');
  el.setAttribute('aria-label', `Tabellone ${SIZE} per ${SIZE}`);

  let html = '';
  for (let y = 0; y < SIZE; y++) {
    html += '<div role="row" class="row">';
    for (let x = 0; x < SIZE; x++) {
      const c = board[y][x];
      // cuciture: bordo spesso dove la casella vicina appartiene a un altro tappeto (o è vuota)
      const seam = d => { const [nx, ny] = d; const o = board[ny]?.[nx]; return !c || !o || o.rug !== c.rug; };
      const cls = ['cell', (x + y) % 2 ? 'odd' : 'even'];
      let style = '', label = `Casella ${x + 1},${y + 1}`;
      if (c) {
        const p = players[c.owner];
        cls.push('rug', `rug-${c.color}`);
        if (p.out) cls.push('neutral');
        if (seam([x, y - 1])) cls.push('sn');
        if (seam([x + 1, y])) cls.push('se');
        if (seam([x, y + 1])) cls.push('ss');
        if (seam([x - 1, y])) cls.push('sw');
        style = ` style="--rug:${COLORS[c.color].hex}"`;
        label += p.out ? `, tappeto neutro (era di ${p.name})` : `, tappeto di ${p.name}`;
      }
      html += `<div role="gridcell" class="${cls.join(' ')}" data-x="${x}" data-y="${y}"${style} aria-label="${label}"></div>`;
    }
    html += '</div>';
  }
  html += `<div class="peppo" role="img" aria-label="Peppo o' Pannazzaro in ${peppo.pos.x + 1},${peppo.pos.y + 1}, guarda verso ${DIR_NAME[peppo.dir]}">${PEPPO_SVG}</div>`;
  el.innerHTML = html;
  placePeppo(el, peppo);
}

/** Sposta solo Peppo (senza ridisegnare le caselle): da usare per le animazioni del movimento.
 * @param {HTMLElement} el @param {import('./types.js').Peppo} peppo */
export function placePeppo(el, peppo) {
  const p = /** @type {HTMLElement} */ (el.querySelector('.peppo'));
  if (!p) return;
  p.style.setProperty('--x', String(peppo.pos.x));
  p.style.setProperty('--y', String(peppo.pos.y));
  p.style.setProperty('--rot', ROT[peppo.dir] + 'deg');
  p.dataset.dir = peppo.dir;
}
