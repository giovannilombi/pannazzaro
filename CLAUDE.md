# Pannazzaro — note di progetto

Questo file è il passaggio di consegne tra una sessione e l'altra: Claude Code lo legge da solo a ogni avvio.
Aggiornalo (sezione **Storico decisioni** in fondo) ogni volta che cambia qualcosa di importante.

## Cos'è

Gioco da tavolo digitale per 2–4 giocatori, in italiano, ambientato in un vicolo napoletano. Si guida **Peppo o' Pannazzaro**
(il venditore di stoffe) su un tabellone 7×7, si pagano pedaggi quando si finisce sui tappeti degli avversari e si stendono i propri.
Le **meccaniche** sono ispirate a un gioco da tavolo esistente; nome, personaggi, grafica e testi sono **originali**.

Fa parte della famiglia di giochi di Giovanni (hub "ziogiogames", ancora da creare) insieme a **Twindoku** (`~/Dev/twindoku`):
stesso stack, stesso sistema di account e squadre.

- Repo: https://github.com/giovannilombi/pannazzaro (privato per ora)
- Sito statico puro (niente build, niente dipendenze), come Twindoku. Server: Cloudflare Worker `pannazzaro-api` + D1 `pannazzaro` (**non ancora creati**).

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
| `index.html`, `css/style.css` | Pagina e grafica (tufo e maioliche). Token in `:root` |
| `js/types.js` | **Interfacce dello stato** (JSDoc): `GameState`, `Board`, `Rug`, `Peppo`, `PlayerState`, `TurnState`, `Toll`, `Action`… |
| `js/rules.js` | Costanti (7×7, 30 monete, dado 1-2-2-3-3-4, tappeti per n. giocatori, colori, opzioni) e regole pure: `createGame`, `turnDir`, `rand`, `rollDie` |
| `js/board.js` | Componente tabellone: `renderBoard(el, state)`, `placePeppo(el, peppo)` |
| `js/app.js` | Avvio (per ora partita locale di prova; `#demo` mette dei tappeti finti) |
| `js/account.js` | Profili, chiamate al server, squadre (da Twindoku, chiavi locali `pz:`) |
| `worker/` | Server: `src/index.js` (account e squadre), `schema.sql`, `wrangler.toml`, `.dev.vars.example` |
| `tools/test-rules.js` | Prove delle regole (`npm test`) |
| `docs/REGOLE.md` | Regole del gioco da implementare |
| `docs/ROADMAP.md` | Passi successivi e decisioni aperte |

## Comandi

```sh
python3 -m http.server 8766          # prova in locale: http://127.0.0.1:8766/  (#demo per i tappeti finti)
npm test                             # prove delle regole
cd worker && npx wrangler dev --port 8788   # server locale (serve worker/.dev.vars con PEPPER)
```

## Storico decisioni

- **2026-11-12** — Scaffold iniziale allineato a Twindoku: vanilla JS a moduli, niente build, GitHub Pages + Cloudflare Worker/D1.
  Interfacce dello stato in JSDoc (non TypeScript, per non introdurre una build). Tabellone con Peppo al centro (3,3) rivolto a Nord.
  Account e squadre copiati dal server di Twindoku (tolti casi, caso del giorno e progressi). Database separato da Twindoku.
- **2026-11-12** — Regole fissate (dettagli in `docs/REGOLE.md`, ricerca su regolamenti ufficiali 2007/2025 e codice BGA):
  2–4 giocatori con tappeti ufficiali (12/15/24, in 2 due colori a testa); copertura in una mossa vietata su **tutti** i tappeti;
  direzione libera al primo turno; bordi con archi d'angolo NE e SW. Multiplayer **online subito**.
