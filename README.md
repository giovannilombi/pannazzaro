# Pannazzaro

Gioco da tavolo digitale per 2–4 giocatori, in italiano. Guida **Peppo o' Pannazzaro** per il vicolo, stendi i tuoi tappeti
e fai pagare il pedaggio a chi ci passa sopra. Vince chi alla fine ha più monete e più tappeti in vista.

Si gioca su https://giovannilombi.github.io/pannazzaro/ in due modi:
- **sullo stesso dispositivo**, passandoselo a turno;
- **online**, ognuno dal suo telefono o computer: serve un profilo (soprannome + PIN, niente email) e un codice d'invito.

## Sviluppo

Non serve nessuna installazione: è un sito statico (moduli JavaScript, niente build).

```sh
python3 -m http.server 8766    # poi apri http://127.0.0.1:8766/
npm test                       # prove delle regole (Node 18+)
```

Il server (account, squadre, partite online) è un Cloudflare Worker con database D1: vedi `worker/wrangler.toml`.
In locale: `cd worker && npx wrangler dev --port 8788`, poi nella console del browser `localStorage.setItem('pz:api', 'http://127.0.0.1:8788')`.
Prova completa delle partite online: `node tools/test-online.js http://127.0.0.1:8788`.

## Licenza

© 2026 Giovanni Lombi. Codice: [PolyForm Noncommercial 1.0.0](LICENSE). Contenuti: [CC BY-NC-SA 4.0](LICENSE-CONTENUTI.md).
