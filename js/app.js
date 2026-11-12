// Avvio di Pannazzaro. Per ora: partita locale da 4 con Peppo al centro.
// Con #demo nell'indirizzo mette qualche tappeto finto, per controllare la grafica.
import { createGame, COLORS } from './rules.js';
import { renderBoard } from './board.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = createGame({
  players: [
    { name: 'Nunzia', avatar: '🦊' }, { name: 'Gennaro', avatar: '🐙' },
    { name: 'Assunta', avatar: '🦉' }, { name: 'Ciro', avatar: '🐢' },
  ],
});

if (location.hash === '#demo') {
  const put = (owner, a, b) => {
    const id = state.rugs.length + 1;
    state.rugs.push({ id, owner, cells: [a, b], round: id });
    for (const c of [a, b]) state.board[c.y][c.x] = { rug: id, owner };
  };
  put(0, { x: 3, y: 2 }, { x: 4, y: 2 });
  put(1, { x: 2, y: 3 }, { x: 2, y: 4 });
  put(2, { x: 4, y: 3 }, { x: 4, y: 4 });
  put(0, { x: 3, y: 4 }, { x: 3, y: 5 });
  put(3, { x: 4, y: 1 }, { x: 5, y: 1 });
  put(1, { x: 5, y: 2 }, { x: 5, y: 3 });
  state.peppo.dir = 'E';
}

function renderPlayers() {
  $('#players').innerHTML = state.players.map((p, i) => `
    <li class="player${i === state.turn.current ? ' now' : ''}" style="--rug:${COLORS[p.color].hex}">
      <span class="swatch rug-${p.color}"></span>
      <span class="av">${p.avatar}</span>
      <b>${esc(p.name)}</b>
      <span class="stat" title="Monete">🪙 ${p.coins}</span>
      <span class="stat" title="Tappeti in mano">🧶 ${p.rugsLeft}</span>
    </li>`).join('');
}

renderBoard($('#board'), state);
renderPlayers();
$('#status').textContent = `Tocca a ${state.players[state.turn.current].name}: scegli dove far girare Peppo.`;
