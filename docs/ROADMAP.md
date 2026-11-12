# Roadmap

1. ✅ Scaffold, interfacce dello stato, tabellone con Peppo.
Scelta del 2026-11-12: **multiplayer online subito** (ognuno sul suo dispositivo), la modalità locale viene gratis dallo stesso motore.

2. ✅ Motore completo in `js/rules.js`: movimento (con i bordi), pedaggio, piazzamento, fine partita, `applyAction(state, action)`. Prove in `tools/test-rules.js`.
3. Server di gioco: creazione di D1 e worker, account e squadre nell'interfaccia (finestre di `twindoku/js/profile.js`),
   partite online con codice d'invito. Il worker applica le azioni con `rules.js` e tiene seme del dado e pile dei tappeti;
   ai client manda lo stato filtrato. Da scegliere: D1 + polling oppure Durable Objects + WebSocket (tempo reale).
4. ✅ (locale) Interfaccia di gioco: lobby, scelta direzione, dado animato, pedaggio, piazzamento del tappeto con anteprima; passa e gioca sullo stesso dispositivo.

## Decisioni aperte

- Account condivisi con Twindoku (un unico server "ziogiogames") o separati? Oggi: separati, stesso codice.
- Punti di classifica e squadre: come si contano in un gioco competitivo.
