// Pannazzaro — interfaccia di gioco (partita sullo stesso dispositivo, "passa e gioca").
// Tutte le regole stanno in rules.js: qui si mostra lo stato, si raccolgono le scelte e si chiamano le azioni.
// Comandi: vedi helpHtml() più sotto (stesso testo della finestra "Come si gioca").
import {
  createGame, applyAction, RuleError, walk, legalPlacements, zoneAt, turnDir, COLORS, COLOR_ORDER, DIRS, STEP, inside, sameCell,
} from './rules.js';
import { createBoard, arcId, DIR_NAME } from './board.js';

const $ = s => /** @type {HTMLElement} */ (document.querySelector(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage non disponibile */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ok */ } },
};
const AVATARS = ['🦊', '🐙', '🦉', '🐢', '🐱', '🐶', '🦁', '🐸', '🐼', '🦄', '🐧', '🐺', '🐯', '🐨', '🦝', '🐝'];
const DEFAULT_NAMES = ['Nunzia', 'Gennaro', 'Assunta', 'Ciro'];
const SAVE = 'pz:local:game', SETUP = 'pz:local:setup';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const coins = n => plural(n, 'moneta', 'monete');
const TURN_LABEL = { left: 'Sinistra', straight: 'Dritto', right: 'Destra' };

/** @type {import('./types.js').GameState | null} */
let G = null;
const ui = {
  busy: false,          // animazione in corso: niente comandi
  sel: /** @type {any} */ (null), // orient: { turn } o { dir }; place: indice in legal
  legal: /** @type {[import('./types.js').Cell, import('./types.js').Cell][]} */ ([]),
  anchor: /** @type {import('./types.js').Cell | null} */ (null), // casella toccata per ultima (per "Gira")
  face: 0,
};
const B = createBoard($('#board'));

/* =====================================================================
   Avvio e salvataggi
   ===================================================================== */
function save() { if (G) store.set(SAVE, G); }
function start(state) {
  G = state; ui.sel = null; ui.face = 0;
  save(); B.render(G); refresh(true);
}
function boot() {
  const saved = store.get(SAVE, null);
  if (saved && saved.v === 1 && saved.board && saved.turn) { G = saved; B.render(G); refresh(true); if (G.turn.phase === 'over') showEnd(); }
  else setupModal(true);
}

/* =====================================================================
   Disegno dello stato
   ===================================================================== */
const cur = () => G.players[G.turn.current];
const isFirstMove = () => G.log.length === 0;

function refresh(newTurn = false) {
  renderPlayers();
  renderLog();
  renderTurn(newTurn);
}

function renderPlayers() {
  const visible = G.players.map(() => 0);
  for (const row of G.board) for (const c of row) if (c) visible[c.owner]++;
  $('#players').innerHTML = G.players.map((p, i) => {
    const now = i === G.turn.current && G.turn.phase !== 'over';
    const col = COLORS[p.colors[0]];
    return `<li class="player${now ? ' now' : ''}${p.out ? ' out' : ''}" data-i="${i}" style="--rug:${col.hex};--rug-dark:${col.dark}">
      <span class="p-av" aria-hidden="true">${p.avatar}</span>
      <span class="p-name"><b>${esc(p.name)}</b>${p.out ? '<small>fuori dal gioco</small>' : `<small>${p.colors.map(c => `<i class="dot rug-${c}" style="--rug:${COLORS[c].hex}" title="${COLORS[c].name}"></i>`).join('')} ${p.colors.map(c => COLORS[c].name).join(' e ')}</small>`}</span>
      <span class="p-stat coins" title="Monete"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8"/><circle cx="10" cy="10" r="4.5"/></svg><b data-coins="${i}">${p.coins}</b><span class="sr"> monete</span></span>
      <span class="p-stat" title="Tappeti in mano"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="5" width="14" height="10" rx="1.5"/><path d="M3 8h14M3 12h14"/></svg><b>${p.pile.length}</b><span class="sr"> tappeti in mano</span></span>
      <span class="p-stat" title="Caselle visibili sul tabellone"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="6" height="6"/><rect x="11" y="3" width="6" height="6"/><rect x="3" y="11" width="6" height="6"/></svg><b>${visible[i]}</b><span class="sr"> caselle visibili</span></span>
    </li>`;
  }).join('');
}

function eventText(ev) {
  const who = esc(G.players[ev.by].name), a = ev.action;
  if (ev.skipped) return `${who} non trova posto per il tappeto: lo perde.`;
  if (a.type === 'orient') return 'dir' in a ? `${who} fa partire Peppo verso ${DIR_NAME[a.dir]}.` : a.turn === 'straight' ? `${who} tira dritto.` : `${who} gira Peppo a ${a.turn === 'left' ? 'sinistra' : 'destra'}.`;
  if (a.type === 'roll') return `${who} lancia il dado: ${ev.roll}.`;
  if (a.type === 'pay') { const t = ev.toll; return `${who} paga ${coins(t.paid)} a ${esc(G.players[t.to].name)}${t.paid < t.amount ? ' ed esce dal gioco' : ''}.`; }
  if (a.type === 'place') return `${who} stende un tappeto.`;
  return '';
}
function renderLog() {
  $('#log').innerHTML = G.log.slice(-30).reverse().map(ev => `<li>${eventText(ev)}</li>`).join('') || '<li class="empty">La partita sta per cominciare.</li>';
}

/* ---------------- pannello del turno ---------------- */
function renderTurn(newTurn) {
  const t = G.turn, p = cur(), col = COLORS[p.colors[0]];
  const turnEl = $('#turn');
  turnEl.style.setProperty('--rug', col.hex);
  turnEl.style.setProperty('--rug-dark', col.dark);
  turnEl.style.setProperty('--rug-light', col.light);
  $('#turnAv').textContent = p.avatar;
  $('#turnName').textContent = t.phase === 'over' ? 'Partita finita' : `Tocca a ${p.name}`;
  if (newTurn && !reduced()) { turnEl.classList.remove('enter'); void turnEl.offsetWidth; turnEl.classList.add('enter'); }
  const order = ['orient', 'roll', 'pay', 'place'];
  const ph = t.phase === 'orient' && G.options.rotateAtEnd && !isFirstMove() ? 'orient' : t.phase;
  $('#steps').querySelectorAll('li').forEach(li => {
    const k = order.indexOf(li.dataset.step), now = order.indexOf(ph);
    li.classList.toggle('done', now > k || t.phase === 'over');
    li.classList.toggle('now', li.dataset.step === ph || (ph === 'orient' && li.dataset.step === 'roll' && !G.options.rotateAtEnd));
  });
  B.clearFx();
  ui.legal = []; ui.anchor = null;
  if (t.phase === 'orient') orientUI();
  else if (t.phase === 'roll') rollUI();
  else if (t.phase === 'pay') payUI();
  else if (t.phase === 'place') placeUI();
  else overUI();
}
const msg = (html, kind = '') => { const m = $('#msg'); m.innerHTML = html; m.className = 'msg' + (kind ? ' ' + kind : ''); };

/* ---------------- 1. direzione (+ lancio) ---------------- */
// La direzione scelta si vede subito sul tabellone (Peppo girato + caselle dove può arrivare con 1, 2, 3 o 4).
// "Lancia il dado" conferma la direzione e lancia in un colpo solo.
function orientOptions() {
  const pos = G.peppo.pos;
  if (isFirstMove()) return DIRS.map(d => ({ key: d, dir: d, action: { type: 'orient', dir: d } }));
  return ['left', 'straight', 'right'].map(tn => ({ key: tn, dir: turnDir(G.peppo.dir, tn), action: { type: 'orient', turn: tn } }));
}
function orientUI() {
  const first = isFirstMove(), endVariant = G.options.rotateAtEnd && !first;
  const opts = orientOptions();
  if (!ui.sel || !opts.some(o => o.key === ui.sel)) ui.sel = first ? G.peppo.dir : 'straight';
  const icon = { left: '<path d="M30 34 V20 a6 6 0 0 0 -6 -6 H12 M18 7 L11 14 L18 21"/>', straight: '<path d="M20 34 V8 M12 15 L20 7 L28 15"/>', right: '<path d="M10 34 V20 a6 6 0 0 1 6 -6 H28 M22 7 L29 14 L22 21"/>' };
  const btn = o => first
    ? `<button type="button" class="dirb compass-${o.key}" data-key="${o.key}" aria-pressed="${ui.sel === o.key}"><span class="arrowi" style="--rot:${{ N: 0, E: 90, S: 180, W: 270 }[o.key]}deg"><svg viewBox="0 0 40 40">${icon.straight}</svg></span><span>${DIR_NAME[o.key]}</span></button>`
    : `<button type="button" class="dirb" data-key="${o.key}" aria-pressed="${ui.sel === o.key}"><svg viewBox="0 0 40 40" aria-hidden="true">${icon[o.key]}</svg><span>${TURN_LABEL[o.key]}</span><kbd>${{ left: '←', straight: '↑', right: '→' }[o.key]}</kbd></button>`;
  $('#act').innerHTML = `
    <p class="lead">${first ? 'Prima mossa: scegli da che parte guarda Peppo.' : endVariant ? 'Fine turno: gira Peppo per chi gioca dopo di te.' : 'Dove va Peppo? Non può tornare indietro.'}</p>
    <div class="dirs ${first ? 'compass' : 'three'}" role="group" aria-label="Direzione di Peppo">${opts.map(btn).join('')}${first ? '<span class="compass-mid" aria-hidden="true"></span>' : ''}</div>
    ${endVariant
      ? `<button type="button" class="btn primary big" id="goBtn">Conferma la direzione <kbd>Invio</kbd></button>`
      : `<button type="button" class="btn primary big roll" id="goBtn"><span class="die mini" aria-hidden="true">${dieFace(ui.face || 3)}</span>Lancia il dado <kbd>Spazio</kbd></button>`}
    <p class="tip">${endVariant ? 'Tocca una freccia accanto a Peppo o usa i tasti ← ↑ →.' : 'I numeri sul tabellone mostrano dove arriva Peppo con ogni lancio: 2 e 3 escono il doppio delle volte. Se esce dal bordo, segue l\'arco e rientra.'}</p>`;
  $('#act').querySelectorAll('.dirb').forEach(b => b.addEventListener('click', () => { ui.sel = b.dataset.key; orientUI(); }));
  $('#goBtn').addEventListener('click', go);
  orientPreview();
  msg('');
}
function orientPreview() {
  const o = orientOptions().find(x => x.key === ui.sel);
  if (!o) return;
  B.setPeppo(G.peppo.pos, o.dir);
  B.arrows(orientOptions().map(x => ({ key: x.key, dir: x.dir, pos: { x: G.peppo.pos.x + STEP[x.dir].dx, y: G.peppo.pos.y + STEP[x.dir].dy } })).filter(x => inside(x.pos)));
  $('#board').querySelectorAll('.arrow').forEach(a => a.classList.toggle('on', a.dataset.key === ui.sel));
  if (G.options.rotateAtEnd && !isFirstMove()) { B.marks([]); return; }
  showReach({ pos: G.peppo.pos, dir: o.dir });
}
/** Segni 1-4 sulle caselle raggiungibili, con il pedaggio che costerebbero a chi gioca. */
function showReach(peppo) {
  const path = walk(peppo, 4), arcs = [];
  let prev = peppo;
  path.forEach(s => { if (s.arc) arcs.push(arcId(prev.pos, prev.dir)); prev = s; });
  const groups = new Map();
  path.forEach((s, i) => {
    const k = `${s.pos.x},${s.pos.y}`;
    if (!groups.has(k)) groups.set(k, { pos: s.pos, n: [] });
    groups.get(k).n.push(i + 1);
  });
  const me = G.turn.current;
  B.marks([...groups.values()].map(g => {
    const c = G.board[g.pos.y][g.pos.x];
    let cost = '';
    if (c && c.owner !== me && !G.players[c.owner].out) cost = `<em class="cost">−${zoneAt(G.board, g.pos).length}</em>`;
    else if (c && c.owner === me) cost = '<em class="cost own">tuo</em>';
    return { pos: g.pos, label: g.n.join('·') + cost, weight: g.n.some(n => n === 2 || n === 3) ? 2 : 1 };
  }), arcs);
}
async function go() {
  if (ui.busy || !G || G.turn.phase !== 'orient') return;
  const o = orientOptions().find(x => x.key === ui.sel);
  if (!o) return;
  const endVariant = G.options.rotateAtEnd && !isFirstMove(); // variante: la rotazione chiude il turno, non si lancia
  if (!act(/** @type {any} */ (o.action))) return;
  if (!endVariant && G.turn.phase === 'roll') return roll();
  B.render(G);
  refresh(true);
}

/* ---------------- 2. dado ---------------- */
const PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9] };
const dieFace = n => `<span class="pips f${n}">${PIPS[n].map(p => `<i style="grid-area:p${p}"></i>`).join('')}</span>`;
function rollUI() {
  B.setPeppo(G.peppo.pos, G.peppo.dir);
  $('#act').innerHTML = `
    <p class="lead">Lancia il dado: Peppo avanza verso ${DIR_NAME[G.peppo.dir]}.</p>
    <button type="button" class="btn primary big roll" id="goBtn"><span class="die mini" aria-hidden="true">${dieFace(3)}</span>Lancia il dado <kbd>Spazio</kbd></button>`;
  $('#goBtn').addEventListener('click', roll);
  showReach(G.peppo);
  msg('');
}
async function roll() {
  if (ui.busy || G.turn.phase !== 'roll') return;
  const before = G.peppo, who = G.turn.current;
  if (!act({ type: 'roll' })) return;
  ui.busy = true;
  const face = G.turn.roll;
  B.marks([]); B.arrows([]);
  // dado che rotola
  $('#act').innerHTML = `<div class="die-stage"><span class="die big rolling" id="die" role="img" aria-label="Dado">${dieFace(1)}</span></div>`;
  const die = $('#die');
  if (!reduced()) {
    for (let i = 0; i < 9; i++) { die.innerHTML = dieFace(1 + ((i * 3 + face) % 4)); await wait(65 + i * 8); }
  }
  die.innerHTML = dieFace(face);
  die.classList.remove('rolling'); die.classList.add('landed');
  die.setAttribute('aria-label', `Dado: ${face}`);
  ui.face = face;
  msg(`È uscito <b>${face}</b>. Peppo avanza di ${plural(face, 'casella', 'caselle')}.`);
  await wait(reduced() ? 0 : 350);
  await B.movePeppo(before, walk(before, face));
  B.render(G);
  ui.busy = false;
  if (G.turn.phase === 'over') return finish();
  refresh(G.turn.current !== who);
  if (G.turn.current !== who) msg(`${esc(G.players[who].name)} non trova posto per il tappeto e lo perde.`, 'bad');
}

/* ---------------- 3. pedaggio ---------------- */
function payUI() {
  const t = G.turn.toll, to = G.players[t.to], me = cur(), broke = t.paid < t.amount;
  B.tint(t.area, 'zone');
  $('#act').innerHTML = `
    <div class="die-stage small"><span class="die" aria-label="Dado: ${G.turn.roll}">${dieFace(G.turn.roll)}</span></div>
    <div class="toll ${broke ? 'broke' : ''}" style="--rug:${COLORS[G.board[G.peppo.pos.y][G.peppo.pos.x].color].hex}">
      <p class="lead">Peppo si ferma su un tappeto di <b>${esc(to.name)}</b> ${to.avatar}.</p>
      <p class="toll-sum"><span class="toll-n">${t.amount}</span> ${t.amount === 1 ? 'casella' : 'caselle unite'} di quel colore = <b>${coins(t.amount)}</b> di pedaggio.</p>
      ${broke ? `<p class="warn">Hai solo ${coins(me.coins)}: le dai tutte e <b>esci dalla partita</b>. I tuoi tappeti restano, ma non fanno più pagare.</p>` : ''}
    </div>
    <button type="button" class="btn primary big" id="goBtn">${broke ? `Paga ${coins(t.paid)} ed esci` : `Paga ${coins(t.paid)} a ${esc(to.name)}`} <kbd>Invio</kbd></button>
    <p class="tip">Le caselle illuminate sono quelle che contano: si sommano solo i tappeti dello stesso colore che si toccano di lato.</p>`;
  $('#goBtn').addEventListener('click', pay);
  msg('');
}
async function pay() {
  if (ui.busy || G.turn.phase !== 'pay') return;
  const t = G.turn.toll, out = t.paid < t.amount, who = G.turn.current;
  if (!act({ type: 'pay' })) return;
  renderPlayers();
  bump(t.from, -t.paid); bump(t.to, +t.paid);
  if (out) { B.render(G); msg(`${esc(G.players[t.from].name)} è fuori dal gioco.`, 'bad'); await wait(900); }
  else B.render(G);
  if (G.turn.phase === 'over') return finish();
  refresh(G.turn.current !== who);
}
function bump(i, delta) {
  const el = $(`#players [data-i="${i}"] .coins`);
  if (!el || !delta) return;
  const f = document.createElement('span');
  f.className = 'delta ' + (delta > 0 ? 'plus' : 'minus');
  f.textContent = (delta > 0 ? '+' : '−') + Math.abs(delta);
  el.appendChild(f);
  setTimeout(() => f.remove(), 1400);
}

/* ---------------- 4. tappeto ---------------- */
// Tocca una casella illuminata: il tappeto appare lì. Ritocca la stessa casella (o "Gira", tasto R) per cambiarne il verso.
// Frecce ← → = scorri tutte le posizioni possibili. "Stendi il tappeto" (Invio) conferma.
function placeUI() {
  const me = cur(), color = me.pile[0], col = COLORS[color];
  ui.legal = legalPlacements(G);
  if (typeof ui.sel !== 'number' || ui.sel >= ui.legal.length) ui.sel = null;
  B.setPeppo(G.peppo.pos, G.peppo.dir);
  B.tint(uniqCells(ui.legal.flat()), 'can');
  const roll = G.turn.roll ? `<span class="die" aria-label="Dado: ${G.turn.roll}">${dieFace(G.turn.roll)}</span>` : '';
  const free = !G.turn.toll ? (() => { const c = G.board[G.peppo.pos.y][G.peppo.pos.x]; return c && c.owner === G.turn.current ? 'Sei sul tuo tappeto: niente pedaggio.' : c ? 'Tappeto neutro: niente pedaggio.' : 'Casella libera: niente pedaggio.'; })() : '';
  $('#act').innerHTML = `
    <div class="place-head">${roll}
      <div class="next-rug" style="--rug:${col.hex};--rug-dark:${col.dark};--rug-light:${col.light}"><span class="mini-rug rug-${color}"><i class="weave"></i></span>
      <span>Tappeto <b>${col.name}</b><small>${plural(me.pile.length, 'tappeto', 'tappeti')} in mano, questo compreso</small></span></div>
    </div>
    <p class="lead">Stendi un tappeto che tocchi la casella di Peppo.</p>
    <ol class="howto">
      <li>Tocca una casella illuminata: il tappeto appare lì.</li>
      <li>Ritocca la stessa casella o premi <b>Gira</b> per cambiarne il verso.</li>
    </ol>
    <div class="row">
      <button type="button" class="btn" id="prevBtn" aria-label="Posizione precedente">‹</button>
      <button type="button" class="btn" id="rotBtn">↻ Gira <kbd>R</kbd></button>
      <button type="button" class="btn" id="nextBtn" aria-label="Posizione successiva">›</button>
    </div>
    <button type="button" class="btn primary big" id="goBtn" ${ui.sel == null ? 'disabled' : ''}>Stendi il tappeto <kbd>Invio</kbd></button>`;
  $('#rotBtn').addEventListener('click', rotate);
  $('#prevBtn').addEventListener('click', () => cycle(-1));
  $('#nextBtn').addEventListener('click', () => cycle(1));
  $('#goBtn').addEventListener('click', place);
  showSel();
  msg(free);
}
const uniqCells = cells => { const m = new Map(); cells.forEach(c => m.set(`${c.x},${c.y}`, c)); return [...m.values()]; };
const has = (pl, q) => pl.some(c => sameCell(c, q));
function showSel() {
  const color = cur().pile[0];
  const pl = ui.sel != null ? ui.legal[ui.sel] : null;
  B.ghost(pl, color);
  B.tint(pl || [], 'pick');
  const g = $('#goBtn'); if (g && G.turn.phase === 'place') g.toggleAttribute('disabled', !pl);
}
// sceglie la posizione per la casella q: la prima volta quella "naturale" (che si allontana da Peppo), poi le altre a giro
function pickAt(q) {
  const opts = ui.legal.map((pl, i) => [pl, i]).filter(([pl]) => has(pl, q));
  if (!opts.length) { msg('Qui non si può: scegli una delle caselle illuminate, accanto a Peppo.', 'bad'); return; }
  const i = opts.findIndex(([, idx]) => idx === ui.sel);
  if (i >= 0 && ui.anchor && sameCell(ui.anchor, q)) ui.sel = opts[(i + 1) % opts.length][1];
  else {
    const p = G.peppo.pos, dist = c => Math.abs(c.x - p.x) + Math.abs(c.y - p.y);
    opts.sort((a, b) => b[0].reduce((s, c) => s + dist(c), 0) - a[0].reduce((s, c) => s + dist(c), 0));
    ui.sel = opts[0][1];
  }
  ui.anchor = q;
  msg('');
  showSel();
}
function rotate() {
  if (G.turn.phase !== 'place') return;
  if (ui.anchor) return pickAt(ui.anchor);
  cycle(1);
}
function cycle(d) {
  if (G.turn.phase !== 'place' || !ui.legal.length) return;
  ui.sel = ui.sel == null ? (d > 0 ? 0 : ui.legal.length - 1) : (ui.sel + d + ui.legal.length) % ui.legal.length;
  ui.anchor = null;
  showSel();
}
async function place() {
  if (ui.busy || G.turn.phase !== 'place' || ui.sel == null) return;
  const pl = ui.legal[ui.sel];
  if (!act({ type: 'place', cells: pl })) return;
  ui.sel = null;
  B.render(G);
  const els = pl.map(c => $(`#board .cell[data-x="${c.x}"][data-y="${c.y}"]`));
  els.forEach(e => e && e.classList.add('just'));
  if (G.turn.phase === 'over') return finish();
  refresh(true);
}

/* ---------------- fine ---------------- */
function overUI() {
  $('#act').innerHTML = `<p class="lead">Tutti i tappeti sono stesi.</p><button type="button" class="btn primary big" id="goBtn">Vedi la classifica</button>`;
  $('#goBtn').addEventListener('click', showEnd);
  msg('');
}
async function finish() { B.render(G); refresh(); await wait(500); showEnd(); }

/* =====================================================================
   Azioni
   ===================================================================== */
function act(action) {
  try {
    G = applyAction(G, G.turn.current, action);
    save();
    return true;
  } catch (e) {
    if (e instanceof RuleError) { msg(esc(e.message), 'bad'); return false; }
    throw e;
  }
}

/* =====================================================================
   Comandi: tabellone e tastiera
   ===================================================================== */
B.onCell(q => {
  if (!G || ui.busy || isModal()) return;
  const ph = G.turn.phase;
  if (ph === 'orient') {
    const o = orientOptions().find(x => { const n = { x: G.peppo.pos.x + STEP[x.dir].dx, y: G.peppo.pos.y + STEP[x.dir].dy }; return sameCell(n, q); });
    if (o) { ui.sel = o.key; orientUI(); }
  } else if (ph === 'place') pickAt(q);
});
B.onHover(q => {
  if (!G || ui.busy || G.turn.phase !== 'place' || ui.sel != null) return;
  // anteprima leggera al passaggio del mouse, finché non si è scelto niente
  if (!q) { B.ghost(null); return; }
  const opts = ui.legal.filter(pl => has(pl, q));
  if (!opts.length) { B.ghost(null); return; }
  const p = G.peppo.pos, dist = c => Math.abs(c.x - p.x) + Math.abs(c.y - p.y);
  opts.sort((a, b) => b.reduce((s, c) => s + dist(c), 0) - a.reduce((s, c) => s + dist(c), 0));
  B.ghost(opts[0], cur().pile[0]);
  $('#board .ghost')?.classList.add('hover');
});

const isModal = () => !$('#overlay').hidden;
document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (isModal()) { if (e.key === 'Escape' && G) closeModal(); return; }
  if (!G || ui.busy || e.metaKey || e.ctrlKey || e.altKey) return;
  const ph = G.turn.phase, k = e.key;
  const enter = k === 'Enter' || k === ' ';
  if (enter && e.target instanceof HTMLButtonElement && e.target.id !== 'goBtn') return; // lascia lavorare il pulsante a fuoco
  if (ph === 'orient') {
    if (isFirstMove()) {
      const d = { ArrowUp: 'N', ArrowRight: 'E', ArrowDown: 'S', ArrowLeft: 'W' }[k];
      if (d) { ui.sel = d; orientUI(); e.preventDefault(); return; }
    } else {
      const tn = { ArrowLeft: 'left', ArrowUp: 'straight', ArrowRight: 'right', a: 'left', w: 'straight', d: 'right' }[k];
      if (tn) { ui.sel = tn; orientUI(); e.preventDefault(); return; }
    }
    if (enter) { e.preventDefault(); go(); }
  } else if (ph === 'roll' && enter) { e.preventDefault(); roll(); }
  else if (ph === 'pay' && enter) { e.preventDefault(); pay(); }
  else if (ph === 'place') {
    if (k === 'r' || k === 'R') { rotate(); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'ArrowDown') { cycle(1); e.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp') { cycle(-1); e.preventDefault(); }
    else if (k === 'Escape') { ui.sel = null; ui.anchor = null; showSel(); }
    else if (k === 'Enter') { e.preventDefault(); place(); }
  }
});

/* =====================================================================
   Finestre
   ===================================================================== */
let lastFocus = null;
function openModal(html, cls = '') {
  lastFocus = document.activeElement;
  const m = $('#modal');
  m.className = 'modal ' + cls;
  m.innerHTML = html;
  $('#overlay').hidden = false;
  (m.querySelector('[data-focus]') || m.querySelector('button, input'))?.focus();
}
function closeModal() {
  $('#overlay').hidden = true;
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
$('#overlay').addEventListener('click', e => { if (e.target === $('#overlay') && G) closeModal(); });
$('#modal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });

/* ---------------- nuova partita ---------------- */
function setupModal(firstTime = false) {
  const prev = store.get(SETUP, null);
  const st = {
    n: prev?.n || 4,
    players: prev?.players || DEFAULT_NAMES.map((name, i) => ({ name, avatar: AVATARS[i] })),
    rotateAtEnd: !!prev?.rotateAtEnd,
  };
  const colorsFor = (n, i) => n === 2 ? COLOR_ORDER.slice(i * 2, i * 2 + 2) : [COLOR_ORDER[i]];
  const draw = () => {
    openModal(`
      <h2 id="modalTitle">${firstTime ? 'Benvenuti nel chiostro' : 'Nuova partita'}</h2>
      <p class="sub">Peppo o' Pannazzaro gira tra le maioliche con il suo fagotto di stoffe. Stendete i vostri tappeti dove passerà: chi ci finisce sopra paga.</p>
      <form id="setup" autocomplete="off">
        <fieldset class="count"><legend>Quanti giocate?</legend>
          ${[2, 3, 4].map(n => `<label><input type="radio" name="n" value="${n}" ${st.n === n ? 'checked' : ''}><span>${n}</span></label>`).join('')}
        </fieldset>
        <ol class="seats">
          ${Array.from({ length: st.n }, (_, i) => {
            const p = st.players[i] || { name: DEFAULT_NAMES[i], avatar: AVATARS[i] };
            return `<li><button type="button" class="seat-av" data-av="${i}" aria-label="Cambia l'animale di ${esc(p.name)}">${p.avatar}</button>
              <input name="name${i}" value="${esc(p.name)}" maxlength="14" required aria-label="Nome del giocatore ${i + 1}">
              <span class="seat-rugs">${colorsFor(st.n, i).map(c => `<span class="mini-rug rug-${c}" style="--rug:${COLORS[c].hex};--rug-dark:${COLORS[c].dark};--rug-light:${COLORS[c].light}" title="${COLORS[c].name}"><i class="weave"></i></span>`).join('')}</span></li>`;
          }).join('')}
        </ol>
        <p class="hint">${st.n === 2 ? 'In due ognuno ha due colori: 12 tappeti per colore, pescati a caso.' : `Ognuno ha 30 monete e ${st.n === 3 ? 15 : 12} tappeti.`} Chi comincia lo decide la sorte.</p>
        <label class="check"><input type="checkbox" name="rotateAtEnd" ${st.rotateAtEnd ? 'checked' : ''}> <span><b>Variante:</b> Peppo si gira a fine turno, così decidi tu la direzione per chi gioca dopo.</span></label>
        <div class="row end">
          ${firstTime ? '<button type="button" class="btn ghost" id="setupHelp">Come si gioca</button>' : '<button type="button" class="btn ghost" data-close>Annulla</button>'}
          <button class="btn primary big" data-focus>Si comincia!</button>
        </div>
      </form>`, 'setup');
    const f = /** @type {HTMLFormElement} */ ($('#setup'));
    const grab = () => { for (let i = 0; i < st.n; i++) { const v = f.elements[`name${i}`].value.trim(); st.players[i] = { ...(st.players[i] || {}), name: v || DEFAULT_NAMES[i], avatar: st.players[i]?.avatar || AVATARS[i] }; } st.rotateAtEnd = f.elements.rotateAtEnd.checked; };
    f.querySelectorAll('input[name=n]').forEach(r => r.addEventListener('change', () => { grab(); st.n = +r.value; draw(); }));
    f.querySelectorAll('[data-av]').forEach(b => b.addEventListener('click', () => {
      grab();
      const i = +b.dataset.av, used = st.players.slice(0, st.n).map(p => p.avatar);
      let k = AVATARS.indexOf(st.players[i].avatar);
      do k = (k + 1) % AVATARS.length; while (used.includes(AVATARS[k]) && AVATARS[k] !== st.players[i].avatar);
      st.players[i].avatar = AVATARS[k];
      b.textContent = AVATARS[k];
    }));
    $('#setupHelp')?.addEventListener('click', () => helpModal(() => setupModal(true)));
    f.addEventListener('submit', e => {
      e.preventDefault(); grab();
      store.set(SETUP, st);
      const seats = st.players.slice(0, st.n).map((p, i) => ({ ...p, colors: colorsFor(st.n, i) }));
      const k = Math.floor(Math.random() * st.n); // chi comincia: a caso, poi in ordine
      const order = [...seats.slice(k), ...seats.slice(0, k)];
      closeModal();
      start(createGame({ players: order, options: { rotateAtEnd: st.rotateAtEnd } }));
      msg(`Comincia <b>${esc(order[0].name)}</b>, scelto dalla sorte.`);
    });
  };
  draw();
}

/* ---------------- regole e comandi ---------------- */
function helpHtml() {
  return `
  <h2 id="modalTitle">Come si gioca</h2>
  <div class="help">
    <section>
      <h3>Lo scopo</h3>
      <p>Alla fine vince chi ha più <b>monete + caselle dei propri tappeti ancora in vista</b>. A pari punti vince chi ha più monete.</p>
      <h3>Il turno, in quattro tempi</h3>
      <ol class="help-steps">
        <li><b>Gira Peppo</b> a sinistra, a destra o lascialo dritto. Indietro mai.</li>
        <li><b>Lancia il dado</b> (facce 1, 2, 2, 3, 3, 4): Peppo avanza di tante caselle. Se esce dal bordo segue l'arco e rientra nella corsia accanto, voltato; l'arco non conta come passo.</li>
        <li><b>Pedaggio</b>: se si ferma sul tappeto di un altro, paghi 1 moneta per ogni casella di quel colore unita a quella (solo di lato, non in diagonale). Chi non ha abbastanza monete esce dal gioco.</li>
        <li><b>Stendi un tappeto</b> che tocchi la casella di Peppo (non sotto di lui). Puoi coprire metà di altri tappeti, ma non un tappeto intero in una volta sola.</li>
      </ol>
      <p>La partita finisce quando tutti hanno steso i loro tappeti.</p>
    </section>
    <section>
      <h3>Comandi</h3>
      <table class="keys">
        <tr><th>Girare Peppo</th><td>Tocca <b>Sinistra / Dritto / Destra</b>, oppure la freccia accanto a Peppo sul tabellone. Vedi subito dove può arrivare.</td><td><kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd></td></tr>
        <tr><th>Lanciare il dado</th><td><b>Lancia il dado</b> conferma la direzione e lancia.</td><td><kbd>Spazio</kbd></td></tr>
        <tr><th>Pagare</th><td><b>Paga</b>: le caselle che contano sono illuminate.</td><td><kbd>Invio</kbd></td></tr>
        <tr><th>Mettere il tappeto</th><td>Tocca una casella illuminata accanto a Peppo: il tappeto appare lì.</td><td></td></tr>
        <tr><th>Girare il tappeto</th><td>Ritocca la stessa casella o premi <b>Gira</b>. Con ‹ › scorri tutte le posizioni.</td><td><kbd>R</kbd> <kbd>←</kbd> <kbd>→</kbd></td></tr>
        <tr><th>Stendere il tappeto</th><td><b>Stendi il tappeto</b>.</td><td><kbd>Invio</kbd></td></tr>
      </table>
      <h3>Sul tabellone</h3>
      <ul class="legend">
        <li><span class="lg-mark">2</span> dove arriva Peppo con quel lancio; <span class="lg-cost">−3</span> quanto pagheresti lì.</li>
        <li><span class="lg-arc"></span> gli archi del bordo: indicano dove rientra Peppo. Negli angoli in alto a destra e in basso a sinistra c'è un arco d'angolo: Peppo resta lì e gira.</li>
      </ul>
    </section>
  </div>
  <div class="row end"><button type="button" class="btn primary" data-close data-focus>Ho capito</button></div>`;
}
function helpModal(after) {
  openModal(helpHtml(), 'wide');
  if (after) $('#modal').querySelector('[data-close]').addEventListener('click', () => setTimeout(after, 0), { once: true });
}

/* ---------------- classifica ---------------- */
function showEnd() {
  const res = G.result || [];
  const out = G.players.map((p, i) => ({ p, i })).filter(x => x.p.out);
  const winners = res.filter(r => r.place === 1).map(r => G.players[r.player].name);
  openModal(`
    <h2 id="modalTitle">${winners.length > 1 ? `Pari merito: ${winners.map(esc).join(' e ')}` : `Vince ${esc(winners[0] || '')}!`}</h2>
    <ol class="podium">
      ${res.map(r => { const p = G.players[r.player], col = COLORS[p.colors[0]]; return `<li class="pl${r.place}" style="--rug:${col.hex};--rug-dark:${col.dark}">
        <span class="pos">${r.place}°</span><span class="p-av">${p.avatar}</span><b>${esc(p.name)}</b>
        <span class="calc">${coins(r.coins)} + ${plural(r.cells, 'casella', 'caselle')}</span><span class="tot">${r.total}</span></li>`; }).join('')}
      ${out.map(({ p }) => `<li class="outp"><span class="pos">–</span><span class="p-av">${p.avatar}</span><b>${esc(p.name)}</b><span class="calc">fuori dal gioco</span><span class="tot"></span></li>`).join('')}
    </ol>
    <div class="row end">
      <button type="button" class="btn ghost" data-close>Guarda il tabellone</button>
      <button type="button" class="btn" id="againBtn">Rivincita</button>
      <button type="button" class="btn primary" id="newGameBtn" data-focus>Nuova partita</button>
    </div>`, 'end');
  $('#againBtn').addEventListener('click', () => {
    const seats = G.players.map(p => ({ name: p.name, avatar: p.avatar, colors: p.colors }));
    const k = 1 % seats.length; // la rivincita la comincia il secondo
    closeModal();
    start(createGame({ players: [...seats.slice(k), ...seats.slice(0, k)], options: G.options }));
  });
  $('#newGameBtn').addEventListener('click', () => setupModal());
}

$('#helpBtn').addEventListener('click', () => helpModal());
$('#newBtn').addEventListener('click', () => {
  if (G && G.turn.phase !== 'over' && G.log.length > 2) {
    openModal(`<h2 id="modalTitle">Lasciare questa partita?</h2><p>La partita in corso si perde.</p>
      <div class="row end"><button type="button" class="btn ghost" data-close data-focus>Continua a giocare</button><button type="button" class="btn warn" id="dropBtn">Nuova partita</button></div>`);
    $('#dropBtn').addEventListener('click', () => setupModal());
  } else setupModal();
});

boot();
