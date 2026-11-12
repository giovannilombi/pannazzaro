# Pannazzaro — note di progetto

Questo file è il passaggio di consegne tra una sessione e l'altra: Claude Code lo legge da solo a ogni avvio.
Aggiornalo (sezione **Storico decisioni** in fondo) ogni volta che cambia qualcosa di importante.

## Cos'è

Gioco da tavolo digitale per 2–4 giocatori, in italiano, ambientato in un vicolo napoletano. Si guida **Peppo o' Pannazzaro**
(il venditore di stoffe) su un tabellone 7×7, si pagano pedaggi quando si finisce sui tappeti degli avversari e si stendono i propri.
Le **meccaniche** sono ispirate a un gioco da tavolo esistente; nome, personaggi, grafica e testi sono **originali**.

Fa parte della famiglia di giochi di Giovanni (hub "ziogiogames", ancora da creare) insieme a **Twindoku** (`~/Dev/twindoku`):
stesso stack, stesso sistema di account e squadre.

- Repo: https://github.com/giovannilombi/pannazzaro (pubblico dal 2026-11-12)
- Sito: https://giovannilombi.github.io/pannazzaro/ (GitHub Pages da `main`, si aggiorna a ogni push)
- Sito statico puro (niente build, niente dipendenze), come Twindoku. Server: Cloudflare Worker `pannazzaro-api` (https://pannazzaro-api.giovanni-lombi.workers.dev) + D1 `pannazzaro`, pubblicati il 2026-11-12.
  Il PEPPER di produzione è lo stesso di `worker/.dev.vars` (copia locale, non nel repo): **non cambiarlo mai**, altrimenti nessuno entra più con il PIN.

## Vincoli da rispettare sempre

- **Mai usare il nome del gioco originale né il nome del suo personaggio** in interfaccia, testi, metadati e nomi di file pubblici:
  è un marchio. Il gioco si chiama **Pannazzaro**, la pedina **Peppo o' Pannazzaro**. Niente grafica, testi o immagini copiati.
- **Lingua**: tutto in italiano (qualche parola napoletana va bene), tono adatto anche a ragazzi.
- **Account come Twindoku**: soprannome + PIN 4 cifre + avatar emoji + codice segreto di recupero, squadre con password e link d'invito.
  Niente email né dati personali. Il codice del server per account e squadre viene da `twindoku/worker/src/index.js`: se si corregge un bug lì, va corretto anche qui.
- **Regole pure e condivise**: tutto il motore sta in `js/rules.js` (funzioni pure, stato JSON), usato dal browser e, online, dal worker.
- Push su GitHub: il repo locale deve avere `git config user.email "11275618+giovannilombi@users.noreply.github.com"`.
- I commit terminano con la riga `Co-Authored-By:` di Claude.

## Struttura

| Percorso | Cosa contiene |
| --- | --- |
| `index.html`, `css/style.css` | Pagina e grafica: chiostro di maioliche la sera (fondo cobalto, piastrelle smaltate, tappeti con frange). Token in `:root`. ≤900px: tabellone sopra, pannello sotto |
| `js/types.js` | **Interfacce dello stato** (JSDoc): `GameState`, `Board`, `Rug`, `Peppo`, `PlayerState`, `TurnState`, `Toll`, `Action`… |
| `js/rules.js` | **Motore completo, funzioni pure**: `createGame`, `applyAction(state, by, action)` → nuovo stato (o `RuleError`), `stepFrom`/`walk` (bordi), `zoneAt`/`tollFor`, `placeError`/`legalPlacements`, `finalScores`, `publicView` (per l'online) |
| `js/board.js` | Componente tabellone `createBoard(el)`: render, `movePeppo` animato, archi (`arcId`), segni di raggiungibilità, tappeto fantasma, frecce, evidenziazioni |
| `js/app.js` | Interfaccia di gioco, sul dispositivo e online: fasi del turno, comandi (tocco, mouse, tastiera), dado, pedaggio, classifica, regole. Online: `act()` manda la mossa al server, `applyRemote()` rivede animate le mosse degli altri. Salvataggi: `pz:local:game`, partita online in corso `pz:online:code` |
| `js/account.js` | Profili, chiamate al server (account, squadre, partite), chiavi locali `pz:`. `localStorage pz:api` cambia server (es. locale) |
| `js/profile.js` | Finestre di profilo e squadra (da `twindoku/js/profile.js`, senza distintivi). `need(next)` chiede l'accesso e poi riprende |
| `js/online.js` | Gioca online: le mie partite, creazione, sala d'attesa con codice e link `#partita-CODICE`, aggiornamenti ogni 2 s (`watch`) |
| `worker/` | Server: `src/index.js` (account, squadre, partite `/api/game*`, importa `js/rules.js`), `schema.sql`, `wrangler.toml`, `.dev.vars.example` |
| `tools/test-rules.js` | Prove delle regole (`npm test`) |
| `tools/test-online.js` | Prova completa delle partite online contro un server (`node tools/test-online.js http://127.0.0.1:8788`, `--tempo` +40 s, `--lungo` +3 min per le partite a tempo). Sul server pubblicato lascia giocatori di prova: cancellarli dopo |
| `docs/REGOLE.md` | Regole del gioco da implementare |
| `docs/ROADMAP.md` | Passi successivi e decisioni aperte |

## Comandi

```sh
python3 -m http.server 8766          # prova in locale: http://127.0.0.1:8766/
npm test                             # prove delle regole
cd worker && npx wrangler dev --port 8788   # server locale (serve worker/.dev.vars con PEPPER)
#   poi nel browser: localStorage.setItem('pz:api', 'http://127.0.0.1:8788')
cd worker && npx wrangler deploy             # pubblica il server
cd worker && npx wrangler d1 execute pannazzaro --remote --file=schema.sql   # dopo aver cambiato lo schema (solo CREATE IF NOT EXISTS)
```

## Comandi di gioco (non cambiarli senza aggiornare la finestra "Come si gioca" in `js/app.js`)

- **Direzione**: Sinistra / Dritto / Destra (default Dritto) o la freccia accanto a Peppo sul tabellone; tasti ← ↑ →.
  Prima mossa: bussola N/E/S/O. La scelta si vede subito: Peppo si gira e compaiono i numeri 1–4 sulle caselle d'arrivo
  (più grandi 2 e 3, che escono il doppio), con il pedaggio che costerebbero (−N) e l'arco che attraverserebbe.
- **Lancia il dado** (Spazio) conferma la direzione e lancia in un colpo solo. Variante "gira a fine turno": c'è "Conferma la direzione".
- **Pedaggio**: zona illuminata sul tabellone, pulsante Paga (Invio).
- **Tappeto**: tocca una casella illuminata → tappeto fantasma lì (prima posizione: quella che si allontana da Peppo);
  ritocca la stessa casella o Gira (R) per cambiarne il verso; ‹ › o ← → scorrono tutte le posizioni; Stendi il tappeto (Invio); Esc annulla.
  Col mouse il passaggio sopra una casella mostra un'anteprima leggera.
- **Online**: in alto «Online» (le mie partite, crea, entra con un codice) e il profilo. Quando non tocca a te il pannello
  dice cosa sta facendo l'altro e le sue mosse si vedono animate; quando tocca a te il titolo della pagina diventa «● Tocca a te».
  Sopra il pannello: codice della partita, pallino di connessione, «Le mie partite», «Abbandona».
- **Tempo per turno** (online): scelto da chi crea la partita (30 s, 1 min, 1 min e ½, 2 min, 5 min, «senza fretta» = 1 giorno).
  Conto alla rovescia nell'intestazione del turno, rosso negli ultimi 10 s. Allo scadere Peppo gioca da solo (`autoTurn`), al terzo turno saltato di fila si esce.

## Storico decisioni

- **2026-11-12** — Scaffold iniziale allineato a Twindoku: vanilla JS a moduli, niente build, GitHub Pages + Cloudflare Worker/D1.
  Interfacce dello stato in JSDoc (non TypeScript, per non introdurre una build). Tabellone con Peppo al centro (3,3) rivolto a Nord.
  Account e squadre copiati dal server di Twindoku (tolti casi, caso del giorno e progressi). Database separato da Twindoku.
- **2026-11-12** — Regole fissate (dettagli in `docs/REGOLE.md`, ricerca su regolamenti ufficiali 2007/2025 e codice BGA):
  2–4 giocatori con tappeti ufficiali (12/15/24, in 2 due colori a testa); copertura in una mossa vietata su **tutti** i tappeti;
  direzione libera al primo turno; bordi con archi d'angolo NE e SW. Multiplayer **online subito**.
- **2026-11-12** — Motore completo con prove (28 uscite dai bordi, pedaggi, piazzamento, 900 partite casuali da 2-4 giocatori).
  Interfaccia "passa e gioca" completa. Grafica: chiostro di maioliche la sera (Alfa Slab One + Nunito, cobalto, giallo maiolica).
  Il colore "golfo" è diventato **melanzana** per non confondersi con lo sfondo blu. Se non c'è posto per il tappeto, il tappeto si perde.
- **2026-11-12** — Online: worker e D1 pubblicati. Partite con sala d'attesa (codice di 5 caratteri e link `#partita-CODICE`), chi crea
  fa cominciare, primo di turno a sorte, colori nell'ordine di arrivo. Il server applica le mosse con `rules.js` e controlla la
  versione (mossa su tabellone vecchio → 409). **Polling ogni 2 s** invece di WebSocket. Abbandono = esce come chi non può pagare
  (`resign` in `rules.js`). Punti di classifica provvisori: N, N−1… secondo il posto (vedi `docs/ROADMAP.md`).
  Avatar: animali (niente detective); parole del codice segreto a tema napoletano (es. LIMONE-GUFO-73).
- **2026-11-12** — **Partite a tempo** e soluzione ai giocatori che spariscono: ogni partita online ha un tempo per turno
  (default «senza fretta» = 1 giorno, così nessuno blocca gli altri per sempre). Allo scadere (+5 s di tolleranza) Peppo gioca
  il turno da solo (`autoTurn` in `rules.js`: dritto, dado, pedaggio, tappeto in un posto valido a caso; eventi con `auto: true`);
  al terzo turno saltato **di fila** il giocatore esce come con «Abbandona»: tappeti sul tabellone restano ma neutri, monete perse.
  Nessun timer sul server: lo controlla chi guarda la partita (`tick()` nel worker, colonna `games.deadline` per il controllo veloce).
  Orologio in `state.clock` { secs, deadline, strikes }.
- **2026-11-12** — Account **separati** da Twindoku, per scelta di Giovanni (per ora). Non unirli senza chiederlo.
