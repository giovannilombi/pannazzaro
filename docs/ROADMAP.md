# Roadmap

1. ✅ Scaffold, interfacce dello stato, tabellone con Peppo.
2. Motore completo in `js/rules.js`: movimento (con i bordi), pedaggio, piazzamento, fine partita, `applyAction(state, action)`. Prove in `tools/test-rules.js`.
3. Interfaccia di gioco locale (passa e gioca): scelta direzione, dado animato, pedaggio, piazzamento del tappeto con anteprima.
4. Account e squadre nell'interfaccia (finestre di `twindoku/js/profile.js`), creazione di D1 e worker.
5. Partite online: tabella `games` (stato JSON + versione), il worker applica le azioni con `rules.js` e tiene il seme del dado;
   i client aggiornano con polling leggero (o Durable Objects / WebSocket se serve tempo reale).

## Decisioni aperte

- Account condivisi con Twindoku (un unico server "ziogiogames") o separati? Oggi: separati, stesso codice.
- Punti di classifica e squadre: come si contano in un gioco competitivo.
