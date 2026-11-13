// Partite online: elenco delle mie partite, creazione, sala d'attesa (codice e link d'invito) e aggiornamenti dal server.
// Il server applica le mosse con js/rules.js; qui si chiede ogni 2 secondi se è cambiato qualcosa (?v=versione).
import * as acc from './account.js';
import { COLORS, seatColors, ONE_COLOR_RUGS } from './rules.js';

const $ = s => /** @type {HTMLElement} */ (document.querySelector(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const inviteUrl = code => `${location.origin}${location.pathname}#partita-${code}`;
const POLL = 2000, POLL_SLOW = 6000;
// tempo per turno: le stesse scelte che accetta il server (worker TURN_SECS)
export const TIMES = [[30, '30 s'], [60, '1 min'], [90, '1 min e ½'], [120, '2 min'], [300, '5 min'], [86400, 'Senza fretta']];
export const timeName = secs => (secs >= 86400 ? 'senza fretta: un giorno per turno' : `${(TIMES.find(t => t[0] === secs) || [0, secs + ' s'])[1]} per turno`);
const LAST_SECS = 'pz:secs';

/**
 * @param {{ openModal: (html: string, cls?: string) => void, closeModal: () => void, toast: (html: string, ms?: number) => void,
 *   need: (next: () => void, msg?: string) => boolean, enter: (r: any) => void, status: (ok: boolean) => void }} ctx
 */
export function initOnline(ctx) {
  const { openModal, closeModal, toast } = ctx;
  const modal = $('#modal');

  /* ---------------- aggiornamenti ---------------- */
  let watching = null, timer = 0, inflight = false;
  /** Segue la partita code: cb(r) a ogni novità, cb(null, errore) se la partita non è più raggiungibile. */
  function watch(code, v, cb) { stop(); watching = { code, v, cb }; timer = setTimeout(tick, POLL); }
  /** Chiede subito, senza aspettare il prossimo giro. */
  const now = () => { if (watching) { clearTimeout(timer); tick(); } };
  function stop() { clearTimeout(timer); watching = null; }
  const setVersion = v => { if (watching) watching.v = v; };
  async function tick() {
    const w = watching;
    if (!w || inflight) return;
    let delay = POLL;
    if (document.visibilityState === 'hidden') delay = POLL_SLOW;
    else {
      inflight = true;
      try {
        const r = await acc.gameGet(w.code, w.v);
        ctx.status(true);
        // la versione avanza solo quando la pagina ha davvero applicato lo stato (setVersion):
        // se era occupata (animazione in corso), al giro dopo si richiede
        if (watching === w && !r.same && r.game.version > w.v) await w.cb(r);
      } catch (e) {
        if (!e.status && e.status !== 0) console.error(e);
        if (watching === w) {
          if (e.status === 404 || e.status === 403 || e.status === 401) { stop(); inflight = false; return w.cb(null, e); }
          ctx.status(false); delay = POLL_SLOW;
        }
      } finally { inflight = false; }
    }
    if (watching === w) { clearTimeout(timer); timer = setTimeout(tick, delay); }
  }
  // tornando sulla pagina si aggiorna subito
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && watching) { clearTimeout(timer); tick(); } });
  window.addEventListener('online', () => { if (watching) { clearTimeout(timer); tick(); } });

  /* ---------------- le mie partite ---------------- */
  function home(msg = '') {
    if (!ctx.need(() => home(msg), 'Per giocare online serve un profilo: così gli amici ti riconoscono.')) return;
    stop();
    openModal(`<h2 id="modalTitle">Gioca online</h2>
      ${msg ? `<p class="note">${msg}</p>` : '<p class="sub">Ognuno gioca dal suo telefono o computer. Chi crea la partita riceve un codice da mandare agli amici: si gioca in 2, 3 o 4.</p>'}
      <div class="online-grid">
        <section class="tile">
          <h3>Nuova partita</h3>
          <fieldset class="secs"><legend>Tempo per turno</legend>
            ${TIMES.map(([v, l]) => `<label><input type="radio" name="onSecs" value="${v}"${v === lastSecs() ? ' checked' : ''}><span>${l}</span></label>`).join('')}
          </fieldset>
          <p class="hint">Allo scadere Peppo gioca da solo il turno di chi non ha mosso; chi salta tre turni di fila esce dal gioco.</p>
          <fieldset class="secs two"><legend>Tipo di partita</legend>
            <label><input type="radio" name="onMode" value="0" checked><span>Classica: da 2 a 4 giocatori (in due, due colori a testa)</span></label>
            <label><input type="radio" name="onMode" value="1"><span>Veloce in due: un colore a testa, ${ONE_COLOR_RUGS} tappeti</span></label>
          </fieldset>
          <label class="check"><input type="checkbox" id="onVar"> <span><b>Variante:</b> Peppo si gira a fine turno.</span></label>
          <button type="button" class="btn primary" data-on="new">Crea la partita</button>
        </section>
        <section class="tile">
          <h3>Hai un codice?</h3>
          <form data-on-form="join" class="inline" autocomplete="off">
            <label class="fld"><span>Codice della partita</span><input name="code" required minlength="5" maxlength="5" placeholder="K7PQM" autocapitalize="characters" spellcheck="false" class="codein"></label>
            <button class="btn">Entra</button>
          </form>
          <p class="form-err" hidden></p>
        </section>
      </div>
      <h3>Le tue partite</h3>
      <div id="myGames" class="gamelist"><p class="hint">Carico le partite…</p></div>
      <div class="row end"><button type="button" class="btn ghost" data-close>Chiudi</button></div>`, 'wide online');
    loadList();
  }
  function lastSecs() { try { const v = +localStorage.getItem(LAST_SECS); return TIMES.some(t => t[0] === v) ? v : 86400; } catch (e) { return 86400; } }
  async function loadList() {
    const box = $('#myGames');
    try {
      const { games } = await acc.gamesList();
      if (!$('#myGames')) return;
      box.innerHTML = games.length ? `<ul>${games.map(g => {
        const state = g.status === 'lobby' ? 'In sala d\'attesa' : g.status === 'play' ? (g.turn.me ? '<b class="yours">Tocca a te!</b>' : `Tocca a ${esc(g.turn.name)}`) : (g.winners.length ? `Finita: ${g.winners.length > 1 ? 'pari merito' : 'vince ' + esc(g.winners[0])}` : 'Finita');
        return `<li class="${g.turn && g.turn.me ? 'mine' : ''}"><button type="button" class="gl" data-on="open" data-code="${g.code}">
          <span class="gl-code">${g.code}</span>
          <span class="gl-avs" aria-hidden="true">${g.seats.map(s => s.avatar).join('')}</span>
          <span class="gl-txt"><span class="gl-names">${g.seats.map(s => (s.me ? 'tu' : esc(s.name))).join(', ')}</span><small>${state}${g.secs < 86400 && g.status !== 'over' ? ` · ⏱ ${(TIMES.find(t => t[0] === g.secs) || [0, ''])[1]}` : ''}</small></span>
        </button>${g.status === 'over' ? `<button type="button" class="btn ghost sm" data-on="hide" data-code="${g.code}" title="Togli dalla lista" aria-label="Togli dalla lista">✕</button>` : ''}</li>`;
      }).join('')}</ul>` : '<p class="hint">Nessuna partita, per ora. Creane una o fatti mandare un codice.</p>';
    } catch (e) {
      if (e.status === 401) return ctx.need(() => home());
      if ($('#myGames')) box.innerHTML = `<p class="note">${esc(e.message)}</p>`;
    }
  }

  /* ---------------- aprire una partita ---------------- */
  async function open(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!ctx.need(() => open(code), `<b>Sei stato invitato a una partita!</b> Prima scegli o crea il tuo profilo, poi entri.`)) return;
    try {
      let r = await acc.gameGet(code);
      if (r.game.status === 'lobby' && !r.seated) r = await acc.gameJoin(code);
      if (r.game.status === 'lobby') return lobby(r);
      ctx.enter(r);
    } catch (e) {
      if (e.status === 401) return ctx.need(() => open(code));
      home(esc(e.message));
    }
  }

  /* ---------------- sala d'attesa ---------------- */
  function lobby(r) {
    drawLobby(r);
    watch(r.game.code, r.game.version, (r2, e) => {
      if (!modal.querySelector('.lobby') || $('#overlay').hidden) { stop(); return; } // finestra chiusa: smetto di chiedere
      if (!r2) return home(esc(e.message));
      if (r2.game.status === 'play') { stop(); return ctx.enter(r2); }
      setVersion(r2.game.version);
      drawLobby(r2);
    });
  }
  function drawLobby(r) {
    const g = r.game, n = g.seats.length;
    const fast = !!g.options.oneColor, colorsFor = i => seatColors(fast ? 2 : n, i, g.options);
    const host = g.seats.find(s => s.host);
    openModal(`<div class="lobby">
      <h2 id="modalTitle">Sala d'attesa</h2>
      <div class="lobby-code">
        <span>Codice della partita</span>
        <b class="code big-code">${g.code}</b>
        <code class="link">${esc(inviteUrl(g.code))}</code>
        <div class="row center">
          <button type="button" class="btn" data-on="copy" data-code="${g.code}">Copia il link</button>
          ${navigator.share ? `<button type="button" class="btn" data-on="share" data-code="${g.code}">Condividi</button>` : ''}
        </div>
        <p class="hint">Manda il link agli amici, oppure dettagli il codice: lo scrivono in «Gioca online».</p>
      </div>
      <ol class="seats lobby-seats">
        ${Array.from({ length: fast ? 2 : 4 }, (_, i) => {
          const s = g.seats[i];
          if (!s) return `<li class="empty"><span class="seat-av">?</span><span>Posto libero</span></li>`;
          return `<li class="${s.me ? 'me' : ''}"><span class="seat-av">${s.avatar}</span><span class="nm"><b>${esc(s.name)}</b>${s.me ? ' <small>(tu)</small>' : ''}${s.host ? ' <small class="cap">ha creato la partita</small>' : ''}</span>
            <span class="seat-rugs">${colorsFor(i).map(c => `<span class="mini-rug" title="${COLORS[c].name}"><svg viewBox="0 0 160 80" aria-hidden="true"><use href="#pz-rug-${c}"/></svg></span>`).join('')}</span></li>`;
        }).join('')}
      </ol>
      <p class="hint"><b>⏱ ${timeName(g.options.turnSecs || 86400)[0].toUpperCase() + timeName(g.options.turnSecs || 86400).slice(1)}.</b> ${fast ? `<b>Partita veloce in due:</b> un colore a testa e ${ONE_COLOR_RUGS} tappeti. ` : ''}${g.options.rotateAtEnd ? '<b>Variante:</b> Peppo si gira a fine turno. ' : ''}Chi comincia lo sceglie la sorte. La pagina si aggiorna da sola quando arriva qualcuno.</p>
      <div class="row end">
        <button type="button" class="btn ghost" data-on="leave" data-code="${g.code}">${g.host ? 'Chiudi la sala' : 'Esci dalla sala'}</button>
        <button type="button" class="btn ghost" data-on="home">Le mie partite</button>
        ${g.host
          ? `<button type="button" class="btn primary big" data-on="start" data-code="${g.code}" ${n < 2 ? 'disabled' : ''} data-focus>${n < 2 ? 'Aspetta almeno un amico' : `Si comincia in ${n}!`}</button>`
          : `<p class="waiting"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span> Aspettiamo che ${esc(host ? host.name : 'chi ha creato la partita')} faccia cominciare.</p>`}
      </div></div>`, 'wide online');
  }

  /* ---------------- eventi ---------------- */
  modal.addEventListener('click', async e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('[data-on]'); if (!b) return;
    e.preventDefault();
    const k = b.dataset.on, code = b.dataset.code;
    const busy = async fn => { b.setAttribute('disabled', ''); try { await fn(); } catch (x) { toast(`<b>${esc(x.message)}</b>`, 5000); } finally { b.removeAttribute('disabled'); } };
    if (k === 'home') return home();
    if (k === 'open') return open(code);
    if (k === 'new') return busy(async () => {
      const secs = +(/** @type {HTMLInputElement} */ (modal.querySelector('input[name="onSecs"]:checked'))?.value || 86400);
      try { localStorage.setItem(LAST_SECS, String(secs)); } catch (x) { /* niente */ }
      lobby(await acc.gameNew({ rotateAtEnd: /** @type {HTMLInputElement} */ ($('#onVar')).checked, oneColor: (/** @type {HTMLInputElement} */ (modal.querySelector('input[name="onMode"]:checked'))?.value) === '1', turnSecs: secs }));
    });
    if (k === 'start') return busy(async () => { const r = await acc.gameStart(code); stop(); ctx.enter(r); });
    if (k === 'leave') {
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Sicuro? Tocca ancora'; return; }
      return busy(async () => { stop(); await acc.gameLeave(code); home(); });
    }
    if (k === 'hide') return busy(async () => { await acc.gameLeave(code); loadList(); });
    if (k === 'copy' || k === 'share') {
      const url = inviteUrl(code);
      if (k === 'share') return navigator.share({ title: 'Pannazzaro', text: `Giochiamo a Pannazzaro! Codice ${code}`, url }).catch(() => {});
      try { await navigator.clipboard.writeText(url); b.textContent = '✓ Copiato!'; } catch (x) { b.textContent = 'Selezionalo e copialo a mano'; }
    }
  });
  modal.addEventListener('submit', async e => {
    const form = /** @type {HTMLFormElement} */ (/** @type {HTMLElement} */ (e.target).closest('form[data-on-form]')); if (!form) return;
    e.preventDefault();
    const code = String(new FormData(form).get('code') || '').trim();
    const err = /** @type {HTMLElement} */ (form.nextElementSibling);
    form.querySelector('button').disabled = true; err.hidden = true;
    try {
      let r = await acc.gameGet(code);
      if (r.game.status === 'lobby' && !r.seated) r = await acc.gameJoin(code);
      if (r.game.status === 'lobby') lobby(r); else ctx.enter(r);
    } catch (x) { err.textContent = x.message; err.hidden = false; }
    finally { const btn = form.querySelector('button'); if (btn) btn.disabled = false; }
  });

  return { home, open, watch, stop, setVersion, now };
}
