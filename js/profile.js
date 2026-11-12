// Profili dei giocatori: chi gioca, registrazione, accesso, recupero del PIN, scheda del giocatore e squadre.
// Adattato da twindoku/js/profile.js (stesse regole e stesso server), senza distintivi né casi.
import * as acc from './account.js';

const $ = s => /** @type {HTMLElement} */ (document.querySelector(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PIN = (name, label, extra = '') => `<label class="fld"><span>${label}</span><input name="${name}" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required placeholder="••••" ${extra}></label>`;

/** @param {{ openModal: (html: string, cls?: string) => void, closeModal: () => void, onChange: () => void }} ctx */
export function initProfile(ctx) {
  const { openModal, closeModal } = ctx;
  const modal = $('#modal');
  let afterSignIn = null; // cosa fare dopo l'accesso (es. entrare in una partita o in una squadra)

  /* ---------------- pulsante in alto ---------------- */
  function renderButton() {
    const a = acc.active(), b = $('#profileBtn');
    if (!b) return;
    b.innerHTML = a ? `<span class="av" aria-hidden="true">${a.avatar}</span><span class="lbl">${esc(a.name)}</span>` : `<span class="av" aria-hidden="true">👤</span><span class="lbl">Entra</span>`;
    b.setAttribute('aria-label', a ? `Profilo di ${a.name}` : 'Entra con il tuo profilo');
    b.classList.toggle('guest', !a);
    ctx.onChange();
  }

  /* ---------------- messaggini ---------------- */
  function toast(html, ms = 4200) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = html;
    t.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
  }
  const err = (form, msg) => { const e = form.querySelector('.form-err'); if (e) { e.textContent = msg; e.hidden = !msg; } };
  async function busy(form, fn) {
    const btns = form.querySelectorAll('button'); btns.forEach(b => (b.disabled = true)); err(form, '');
    try { return await fn(); } catch (e) { err(form, e.message || 'Qualcosa è andato storto.'); return undefined; } finally { btns.forEach(b => (b.disabled = false)); }
  }

  /* ---------------- chi gioca? ---------------- */
  function who(msg) {
    const list = acc.profiles(), a = acc.active();
    openModal(`<h2 id="modalTitle">Chi gioca?</h2>
      ${msg ? `<p class="note">${msg}</p>` : '<p class="sub">Con un profilo giochi online con gli amici e accumuli punti per te e per la tua squadra, da qualsiasi telefono o computer.</p>'}
      ${list.length ? `<div class="who">${list.map(p => `<button type="button" class="whob${a && a.id === p.id ? ' on' : ''}" data-pa="pick" data-id="${p.id}"><span class="av">${p.avatar}</span><b>${esc(p.name)}</b>${p.token ? '' : '<small>serve il PIN</small>'}</button>`).join('')}</div>` : ''}
      <div class="row end">
        ${a ? '<button type="button" class="btn ghost" data-pa="guest">Gioca senza profilo</button>' : '<button type="button" class="btn ghost" data-close>Non ora</button>'}
        <button type="button" class="btn" data-pa="login">Ho già un profilo</button>
        <button type="button" class="btn primary" data-pa="signup" data-focus>Nuovo profilo</button>
      </div>`);
  }
  function pick(id) {
    const p = acc.profiles().find(x => x.id === id);
    if (!p) return;
    if (!p.token) return loginForm(p.name, 'Per sicurezza serve di nuovo il PIN.');
    acc.setActive(id); renderButton(); closeModal();
    toast(`Ciao <b>${esc(p.name)}</b>!`);
    acc.refreshMe().then(me => { renderButton(); mustChangeCheck(me); }).catch(() => {});
    runAfterSignIn();
  }

  /* ---------------- nuovo profilo ---------------- */
  function signupForm() {
    openModal(`<h2 id="modalTitle">Nuovo profilo</h2>
      <form data-form="signup" autocomplete="off">
        <label class="fld"><span>Soprannome</span><input name="name" required minlength="3" maxlength="16" placeholder="es. Volpe_Rossa" autocapitalize="off" spellcheck="false"></label>
        <p class="hint" id="nameHint">Senza spazi, da 3 a 16 caratteri. <b>Non usare nome e cognome veri</b>: inventa un soprannome!</p>
        <fieldset class="avs"><legend>Scegli il tuo animale</legend>${acc.AVATARS.map((x, i) => `<label><input type="radio" name="avatar" value="${x}"${i === 0 ? ' checked' : ''}><span>${x}</span></label>`).join('')}</fieldset>
        <div class="fld2">${PIN('pin', 'PIN segreto (4 cifre)')}${PIN('pin2', 'Ripeti il PIN')}</div>
        <p class="form-err" hidden></p>
        <div class="row end"><button type="button" class="btn ghost" data-pa="who">Indietro</button><button class="btn primary">Crea il profilo</button></div>
      </form>
      <p class="hint">Non chiediamo email né dati personali: solo il soprannome, l'animale e i punti.</p>`);
    modal.querySelector('input[name=name]').focus();
  }
  let nameTimer = 0;
  function liveName(input) {
    clearTimeout(nameTimer);
    const h = $('#nameHint'), v = input.value.trim();
    if (/\s/.test(v)) { h.innerHTML = 'Niente spazi: usa _ o - al loro posto.'; return; }
    if (v.length < 3) { h.innerHTML = 'Senza spazi, da 3 a 16 caratteri. <b>Non usare nome e cognome veri</b>: inventa un soprannome!'; return; }
    nameTimer = setTimeout(() => acc.checkName(v).then(r => {
      if (input.value.trim() !== v) return;
      h.innerHTML = r.ok ? '✓ Soprannome libero!' : r.taken ? `«${esc(r.similar)}» è già preso. Se sei tu, torna indietro e scegli «Ho già un profilo».` : `Esiste già «${esc(r.similar)}»: scegli un soprannome più diverso, così nessuno vi confonde.`;
    }).catch(e => { if (input.value.trim() === v) h.innerHTML = esc(e.message); }), 450);
  }
  async function doSignup(form) {
    const f = new FormData(form);
    if (f.get('pin') !== f.get('pin2')) return err(form, 'I due PIN non sono uguali.');
    const r = await busy(form, () => acc.signup(String(f.get('name')).trim(), f.get('pin'), f.get('avatar')));
    if (!r) return;
    renderButton();
    showRecovery(r.recovery, () => { closeModal(); toast(`<b>${r.me.player.avatar} Ciao ${esc(r.me.player.name)}, il tuo profilo è pronto!</b>`); runAfterSignIn(); });
  }
  function showRecovery(code, next) {
    openModal(`<div class="bigicon" aria-hidden="true">🗝️</div><h2 id="modalTitle">Il tuo codice segreto</h2>
      <p>Se un giorno dimentichi il PIN, con questo codice ne scegli uno nuovo. <b>Scrivilo sul diario o fagli una foto</b>: non te lo mostreremo più!</p>
      <p class="code">${esc(code)}</p>
      <label class="check"><input type="checkbox" id="codeOk"> <span>L'ho scritto (o fotografato)</span></label>
      <div class="row end"><button type="button" class="btn primary" id="codeNext" disabled>Avanti</button></div>`);
    $('#codeOk').addEventListener('change', e => { /** @type {HTMLButtonElement} */ ($('#codeNext')).disabled = !(/** @type {HTMLInputElement} */ (e.target)).checked; });
    $('#codeNext').addEventListener('click', next);
  }

  /* ---------------- accesso e recupero ---------------- */
  function loginForm(name = '', msg = '') {
    openModal(`<h2 id="modalTitle">Entra con il tuo profilo</h2>
      ${msg ? `<p class="note">${esc(msg)}</p>` : ''}
      <form data-form="login" autocomplete="off">
        <label class="fld"><span>Soprannome</span><input name="name" required value="${esc(name)}" autocapitalize="off" spellcheck="false"></label>
        ${PIN('pin', 'PIN')}
        <p class="form-err" hidden></p>
        <div class="row end"><button type="button" class="btn ghost" data-pa="who">Indietro</button><button class="btn primary">Entra</button></div>
      </form>
      <p class="hint"><a href="#" data-pa="recover">Ho dimenticato il PIN</a></p>`);
    modal.querySelector(name ? 'input[name=pin]' : 'input[name=name]').focus();
  }
  async function doLogin(form) {
    const f = new FormData(form);
    const me = await busy(form, () => acc.login(String(f.get('name')).trim(), f.get('pin')));
    if (!me) return;
    renderButton();
    if (mustChangeCheck(me)) return;
    closeModal(); toast(`Ciao di nuovo, <b>${esc(me.player.name)}</b>!`);
    runAfterSignIn();
  }
  function recoverForm() {
    const name = modal.querySelector('input[name=name]')?.value || '';
    openModal(`<h2 id="modalTitle">PIN dimenticato?</h2>
      <p>Nessun problema, hai due strade:</p>
      <ol><li>Usa il <b>codice segreto</b> che hai ricevuto quando hai creato il profilo (es. LIMONE-GUFO-73).</li>
      <li>Oppure chiedi al <b>capitano della tua squadra</b>: dalla sua scheda può darti un PIN temporaneo.</li></ol>
      <form data-form="recover" autocomplete="off">
        <label class="fld"><span>Soprannome</span><input name="name" required value="${esc(name)}" autocapitalize="off" spellcheck="false"></label>
        <label class="fld"><span>Codice segreto</span><input name="code" required placeholder="PAROLA-PAROLA-00" autocapitalize="characters" spellcheck="false"></label>
        <div class="fld2">${PIN('pin', 'Nuovo PIN')}${PIN('pin2', 'Ripeti il nuovo PIN')}</div>
        <p class="form-err" hidden></p>
        <div class="row end"><button type="button" class="btn ghost" data-pa="login">Indietro</button><button class="btn primary">Scegli il nuovo PIN</button></div>
      </form>`);
    modal.querySelector(name ? 'input[name=code]' : 'input[name=name]').focus();
  }
  async function doRecover(form) {
    const f = new FormData(form);
    if (f.get('pin') !== f.get('pin2')) return err(form, 'I due PIN non sono uguali.');
    const me = await busy(form, () => acc.recover(String(f.get('name')).trim(), f.get('code'), f.get('pin')));
    if (!me) return;
    renderButton(); closeModal();
    toast(`<b>✓ Nuovo PIN salvato.</b> Ciao ${esc(me.player.name)}!`);
    runAfterSignIn();
  }
  function mustChangeCheck(me) {
    if (!me || !me.player.mustChange) return false;
    openModal(`<h2 id="modalTitle">Scegli un nuovo PIN</h2>
      <p>Sei entrato con il PIN temporaneo del capitano. Ora scegline uno tuo, che sai solo tu.</p>
      <form data-form="newpin" autocomplete="off">
        <div class="fld2">${PIN('pin', 'Nuovo PIN')}${PIN('pin2', 'Ripeti il PIN')}</div>
        <p class="form-err" hidden></p>
        <div class="row end"><button class="btn primary">Salva</button></div>
      </form>`);
    modal.querySelector('input').focus();
    return true;
  }
  async function doNewPin(form) {
    const f = new FormData(form);
    if (f.get('pin') !== f.get('pin2')) return err(form, 'I due PIN non sono uguali.');
    const ok = await busy(form, () => acc.changePin(f.get('pin'), f.get('old') || undefined));
    if (!ok) return;
    await acc.refreshMe().catch(() => {});
    if (form.dataset.back) return card('✓ PIN cambiato.');
    closeModal(); toast('<b>✓ PIN salvato.</b>'); runAfterSignIn();
  }

  /* ---------------- scheda del giocatore ---------------- */
  async function card(msg) {
    const a = acc.active();
    if (!a) return who();
    if (!a.token) return loginForm(a.name, 'Per sicurezza serve di nuovo il PIN.');
    let me = acc.meCache();
    if (me) drawCard(me, msg);
    else openModal('<h2 id="modalTitle" class="loading">Apro la scheda…</h2>');
    const old = JSON.stringify(me);
    try {
      me = await acc.refreshMe(); renderButton();
      // ridisegno solo se è cambiato qualcosa e la scheda è ancora aperta (senza interrompere chi sta scrivendo)
      const open = !$('#overlay').hidden && modal.querySelector('.card, .loading');
      const typing = document.activeElement && modal.contains(document.activeElement) && document.activeElement.matches('input');
      if (open && (modal.querySelector('.loading') || (JSON.stringify(me) !== old && !typing))) drawCard(me, msg);
    } catch (e) {
      if (e.status === 401) return loginForm(a.name, 'Per sicurezza serve di nuovo il PIN.');
      if (!me) openModal(`<h2 id="modalTitle">Profilo</h2><p class="note">${esc(e.message)}</p><div class="row end"><button class="btn" data-close>Chiudi</button></div>`);
    }
  }
  function drawCard(me, msg) {
    openModal(`<div class="card">
      ${msg ? `<p class="note ok">${esc(msg)}</p>` : ''}
      <div class="card-head">
        <button type="button" class="card-av" data-pa="avatar" title="Cambia animale" aria-label="Cambia animale">${me.player.avatar}</button>
        <div><h2 id="modalTitle">${esc(me.player.name)}</h2>
          <p class="pts-line"><b>${me.stats.points}</b> punti</p>
          <p class="hint">Ogni partita online finita dà punti secondo il posto: in quattro 4, 3, 2, 1. Chi esce dal gioco non ne prende.</p>
        </div>
      </div>
      <div id="avPick" hidden class="avs pick">${acc.AVATARS.map(x => `<button type="button" data-pa="setav" data-av="${x}">${x}</button>`).join('')}</div>
      <h3>Squadra</h3>
      <div id="teamBox">${teamHTML(me)}</div>
      <div class="row end">
        <button type="button" class="btn ghost" data-pa="logout">Esci da questo dispositivo</button>
        <button type="button" class="btn ghost" data-pa="pinform">Cambia PIN</button>
        <button type="button" class="btn" data-pa="who">Cambia giocatore</button>
        <button type="button" class="btn primary" data-close data-focus>Chiudi</button>
      </div></div>`, 'wide');
  }

  /* ---------------- squadra ---------------- */
  const inviteUrl = code => `${location.origin}${location.pathname}#squadra-${code}`;
  function teamHTML(me) {
    const t = me.team;
    if (!t) return `<p>Non sei in nessuna squadra. Entra in quella dei tuoi amici o creane una nuova: il punteggio di squadra è la media dei 5 giocatori più bravi.</p>${teamFindForm()}`;
    return `<div class="team-head"><b class="tname">${esc(t.name)}</b><span>Punteggio di squadra: <b>${t.score}</b></span></div>
      <ol class="members">${t.members.map(m => `<li class="${m.me ? 'me' : ''}"><span class="av">${m.avatar}</span><span class="nm"><b>${esc(m.name)}</b>${m.captain ? ' <small class="cap">capitano</small>' : ''}</span>
        <span class="pts">${m.points}<small>punti</small></span>
        ${t.captain && !m.me ? `<button type="button" class="btn ghost sm" data-pa="resetpin" data-id="${m.id}" data-name="${esc(m.name)}" title="PIN temporaneo">🔑</button>` : ''}</li>`).join('')}</ol>
      <div class="invite"><span>Link per invitare amici nella squadra:</span><code>${esc(inviteUrl(t.invite))}</code>
        <div class="row"><button type="button" class="btn" data-pa="copyinv">Copia il link</button>${navigator.share ? '<button type="button" class="btn" data-pa="shareinv">Condividi</button>' : ''}${t.captain ? '<button type="button" class="btn ghost" data-pa="newinv">Nuovo link</button>' : ''}</div>
        <p class="hint">Chi apre il link entra senza password.${t.captain ? ' Se il link è finito alla persona sbagliata, crea un nuovo link: il vecchio smette di funzionare.' : ''}</p></div>
      <div id="pinBox"></div>
      <div class="row"><button type="button" class="btn" data-pa="teams">Classifica delle squadre</button><button type="button" class="btn ghost" data-pa="changeteam">Cambia squadra</button><button type="button" class="btn ghost" data-pa="leave">Esci dalla squadra</button></div>
      <div id="teamsBoard"></div><div id="teamFind" hidden>${teamFindForm()}</div>`;
  }
  const teamFindForm = () => `<form data-form="teamfind" autocomplete="off" class="inline">
      <label class="fld"><span>Nome della squadra</span><input name="team" required minlength="3" maxlength="24" placeholder="es. I Gatti Neri"></label>
      <button class="btn primary">Cerca</button></form><p class="form-err" hidden></p><div id="teamRes"></div>`;
  async function doTeamFind(form) {
    const name = String(new FormData(form).get('team')).trim();
    const box = $('#teamRes'), e = /** @type {HTMLElement} */ (form.nextElementSibling);
    e.hidden = true;
    let r;
    try { r = await acc.teamCheck(name); } catch (x) { e.textContent = x.message; e.hidden = false; return; }
    if (r.exists) box.innerHTML = joinForm(r.team, `La squadra «${esc(r.team)}» esiste. Scrivi la sua password per entrare (te la dice chi l'ha creata), oppure usa il link d'invito.`);
    else if (r.similar.length) box.innerHTML = `<p class="note">Esiste già ${r.similar.map(s => `«<b>${esc(s)}</b>»`).join(', ')}. È la tua squadra?</p>
        <div class="row">${r.similar.map(s => `<button type="button" class="btn" data-pa="pickteam" data-name="${esc(s)}">Sì, entra in «${esc(s)}»</button>`).join('')}</div>
        <p class="hint">Se è un'altra squadra, scegli un nome più diverso: questo si confonderebbe.</p>`;
    else box.innerHTML = `<p class="note">La squadra «<b>${esc(r.name)}</b>» non esiste ancora. Vuoi crearla? Diventerai il capitano.</p>
      <form data-form="teamcreate" autocomplete="off"><input type="hidden" name="name" value="${esc(r.name)}">
        <label class="fld"><span>Password della squadra</span><input name="password" type="text" required minlength="4" maxlength="40" placeholder="almeno 4 caratteri" autocapitalize="off" spellcheck="false"></label>
        <p class="hint">La dirai agli amici che vuoi in squadra. Oppure gli mandi il link d'invito, che trovi dopo.</p>
        <p class="form-err" hidden></p><button class="btn primary">Crea la squadra</button></form>`;
    box.querySelector('input:not([type=hidden])')?.focus();
  }
  const joinForm = (name, txt) => `<p class="note">${txt}</p><form data-form="teamjoin" autocomplete="off"><input type="hidden" name="name" value="${esc(name)}">
      <label class="fld"><span>Password della squadra</span><input name="password" type="text" required autocapitalize="off" spellcheck="false"></label>
      <p class="form-err" hidden></p><button class="btn primary">Entra in squadra</button></form>`;
  async function doTeam(form, kind) {
    const f = new FormData(form);
    const me = await busy(form, () => (kind === 'create' ? acc.teamCreate(f.get('name'), f.get('password')) : acc.teamJoin(f.get('name'), f.get('password'))));
    if (!me) return;
    drawCard(me, kind === 'create' ? `Squadra «${me.team.name}» creata! Sei il capitano: manda il link d'invito ai tuoi amici.` : `Sei entrato nella squadra «${me.team.name}»!`);
  }
  async function showTeams() {
    const box = $('#teamsBoard'); box.innerHTML = '<p class="hint">Carico la classifica…</p>';
    try {
      const { teams } = await acc.teamsBoard();
      box.innerHTML = teams.length ? `<ol class="board-teams">${teams.map(t => `<li class="${t.mine ? 'me' : ''}"><span class="pos">${t.pos}</span><b>${esc(t.name)}</b><small>${t.members} ${t.members === 1 ? 'giocatore' : 'giocatori'}</small><span class="pts">${t.score}</span></li>`).join('')}</ol>` : '<p class="hint">Nessuna squadra ancora.</p>';
    } catch (e) { box.innerHTML = `<p class="note">${esc(e.message)}</p>`; }
  }

  /* ---------------- accesso richiesto ---------------- */
  // true se c'è un profilo attivo con sessione valida; altrimenti chiede di entrare e poi esegue next
  function need(next, msg) {
    const a = acc.active();
    if (a && a.token) return true;
    afterSignIn = next;
    if (a) loginForm(a.name, 'Per sicurezza serve di nuovo il PIN.');
    else who(msg);
    return false;
  }
  function runAfterSignIn() { const f = afterSignIn; afterSignIn = null; if (f) f(); else handleInvite(); }

  /* ---------------- inviti nelle squadre ---------------- */
  async function handleInvite() {
    const code = acc.pendingInvite();
    if (!code) return;
    if (!need(handleInvite, '<b>Sei stato invitato in una squadra!</b> Prima scegli o crea il tuo profilo, poi entri in squadra.')) return;
    try {
      const me = await acc.teamJoinInvite(code);
      acc.setPendingInvite(null);
      drawCard(me, `Sei entrato nella squadra «${me.team.name}»!`);
    } catch (e) {
      acc.setPendingInvite(null);
      if (e.status) toast(`<b>${esc(e.message)}</b>`, 6000);
    }
  }

  /* ---------------- eventi ---------------- */
  modal.addEventListener('click', async e => {
    const b = /** @type {HTMLElement} */ (e.target).closest('[data-pa]'); if (!b) return;
    e.preventDefault();
    const act = b.dataset.pa;
    if (act === 'pick') return pick(+b.dataset.id);
    if (act === 'signup') return signupForm();
    if (act === 'login') return loginForm(modal.querySelector('input[name=name]')?.value || '');
    if (act === 'recover') return recoverForm();
    if (act === 'who') return who();
    if (act === 'guest') { acc.setActive(null); renderButton(); closeModal(); return toast('Giochi senza profilo: le partite online non sono disponibili.'); }
    if (act === 'avatar') { $('#avPick').hidden = !$('#avPick').hidden; return; }
    if (act === 'setav') { try { const me = await acc.changeAvatar(b.dataset.av); renderButton(); drawCard(me); } catch (x) { toast(esc(x.message)); } return; }
    if (act === 'logout') {
      if (b.dataset.sure) { await acc.logout(); renderButton(); return who('Profilo tolto da questo dispositivo. I suoi punti restano salvati: per riaverlo basta «Ho già un profilo».'); }
      b.dataset.sure = '1'; b.textContent = 'Sicuro? Tocca ancora'; return;
    }
    if (act === 'pinform') {
      openModal(`<h2 id="modalTitle">Cambia PIN</h2><form data-form="newpin" data-back="1" autocomplete="off">${PIN('old', 'PIN attuale')}<div class="fld2">${PIN('pin', 'Nuovo PIN')}${PIN('pin2', 'Ripeti il nuovo PIN')}</div>
        <p class="form-err" hidden></p><div class="row end"><button type="button" class="btn ghost" data-pa="card">Indietro</button><button class="btn primary">Salva</button></div></form>`);
      return modal.querySelector('input').focus();
    }
    if (act === 'card') return card();
    if (act === 'copyinv' || act === 'shareinv') {
      const url = modal.querySelector('.invite code').textContent;
      if (act === 'shareinv') return navigator.share({ title: 'Pannazzaro', text: 'Entra nella mia squadra di Pannazzaro!', url }).catch(() => {});
      try { await navigator.clipboard.writeText(url); b.textContent = '✓ Copiato!'; } catch (x) { b.textContent = 'Selezionalo e copialo a mano'; }
      return;
    }
    if (act === 'newinv') { try { drawCard(await acc.teamNewInvite(), 'Nuovo link creato: quello vecchio non funziona più.'); } catch (x) { toast(esc(x.message)); } return; }
    if (act === 'leave') {
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Sicuro? Tocca ancora'; return; }
      try { drawCard(await acc.teamLeave(), 'Sei uscito dalla squadra. I tuoi punti restano tuoi.'); } catch (x) { toast(esc(x.message)); } return;
    }
    if (act === 'changeteam') { const f = $('#teamFind'); f.hidden = false; f.querySelector('input').focus(); return; }
    if (act === 'teams') return showTeams();
    if (act === 'pickteam') { $('#teamRes').innerHTML = joinForm(b.dataset.name, `Scrivi la password della squadra «${esc(b.dataset.name)}».`); return $('#teamRes input[name=password]').focus(); }
    if (act === 'resetpin') {
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Nuovo PIN?'; return; }
      try {
        const r = await acc.teamResetPin(+b.dataset.id);
        $('#pinBox').innerHTML = `<p class="note ok">Il PIN temporaneo di <b>${esc(r.name)}</b> è <b class="code sm">${r.pin}</b>. Diglielo a voce: al prossimo accesso dovrà sceglierne uno nuovo.</p>`;
      } catch (x) { toast(esc(x.message)); }
    }
  });
  modal.addEventListener('submit', e => {
    const form = /** @type {HTMLFormElement} */ (/** @type {HTMLElement} */ (e.target).closest('form[data-form]')); if (!form) return;
    e.preventDefault();
    const k = form.dataset.form;
    if (k === 'signup') doSignup(form);
    else if (k === 'login') doLogin(form);
    else if (k === 'recover') doRecover(form);
    else if (k === 'newpin') doNewPin(form);
    else if (k === 'teamfind') doTeamFind(form);
    else if (k === 'teamcreate') doTeam(form, 'create');
    else if (k === 'teamjoin') doTeam(form, 'join');
  });
  modal.addEventListener('input', e => { const t = /** @type {HTMLElement} */ (e.target); if (t.matches('form[data-form=signup] input[name=name]')) liveName(t); });

  $('#profileBtn').addEventListener('click', () => (acc.active() ? card() : who()));

  function start() {
    renderButton();
    const a = acc.active();
    if (a && a.token) acc.refreshMe().then(me => { renderButton(); mustChangeCheck(me); }).catch(() => {});
  }

  return { start, need, toast, card, who, handleInvite, renderButton };
}
