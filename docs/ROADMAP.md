# Roadmap

1. ✅ Scaffold, interfacce dello stato, tabellone con Peppo.
Scelta del 2026-11-12: **multiplayer online subito** (ognuno sul suo dispositivo), la modalità locale viene gratis dallo stesso motore.

2. ✅ Motore completo in `js/rules.js`: movimento (con i bordi), pedaggio, piazzamento, fine partita, `applyAction(state, action)`. Prove in `tools/test-rules.js`.
3. ✅ Server di gioco (2026-11-12): D1 `pannazzaro` e worker `pannazzaro-api` pubblicati. Account e squadre nell'interfaccia
   (`js/profile.js`, da Twindoku), partite online con codice/link d'invito (`js/online.js`). Il worker applica le azioni con
   `rules.js` e tiene seme del dado e pile; ai client va `publicView`. Scelto **D1 + polling ogni 2 s** (`?v=versione`,
   risposta corta se non cambia niente): semplice, gratuito, basta per giochi a turni. Prove: `tools/test-online.js`.
4. ✅ (locale) Interfaccia di gioco: lobby, scelta direzione, dado animato, pedaggio, piazzamento del tappeto con anteprima; passa e gioca sullo stesso dispositivo.

5. Prossimi passi possibili:
   - ✅ giocatore che sparisce a metà partita: tempo per turno (da 30 s a 1 giorno), poi gioca Peppo; al terzo turno saltato si esce;
   - notifiche quando tocca a te (oggi: titolo della pagina che cambia e vibrazione);
   - hub "ziogiogames" con Twindoku.

## Decisioni aperte

- Account condivisi con Twindoku (un unico server "ziogiogames") o separati? Oggi: separati, stesso codice.
- Punti di classifica (scelta provvisoria di Claude, da confermare): a fine partita online, in N giocatori
  il 1° prende N punti, il 2° N−1… chi esce 0; contano solo le partite con almeno 2 tappeti a testa sul tabellone.
  La squadra fa la media dei 5 migliori, come in Twindoku.
