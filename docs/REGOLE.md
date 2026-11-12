# Regole di Pannazzaro

Meccaniche ricavate dal regolamento ufficiale del gioco da tavolo a cui ci ispiriamo (edizioni 2007 e 2025) e dalle implementazioni
open source, in particolare quella ufficiale di Board Game Arena (https://github.com/Syarwin/bga-marrakech). Nome, personaggi e grafica
di Pannazzaro sono originali: **non usare mai il nome del gioco originale nell'interfaccia**.
Coordinate: `x` = colonna (0 = Ovest), `y` = riga (0 = Nord). Centro (3,3).

Scelte di Giovanni del 2026-11-12: tappeti e numero di giocatori come da regolamento ufficiale (2-4);
copertura vietata su **tutti** i tappeti; direzione **libera** al primo turno.

## Componenti

- Tabellone 7×7.
- Tappeti 1×2 (due caselle ortogonali), regola ufficiale: **4 giocatori → 12 a testa**, 3 → 15, 2 → 24 (12 per ciascuno di due colori).
- 30 monete a testa (nel digitale basta un intero).
- Dado: 1, 2, 2, 3, 3, 4.

## Preparazione

- Peppo parte dal centro (3,3). Al **primo turno della partita** il giocatore sceglie liberamente fra le 4 direzioni
  (scelta nostra: le regole non dicono il verso iniziale). Poi vale sempre dritto/sinistra/destra.
- Primo giocatore a caso. Si gioca in senso orario (ordine dei posti).

## Turno (fasi obbligatorie, in quest'ordine)

1. **Direzione**: dritto, 90° a sinistra o 90° a destra. Mai 180°. Restare dritti è una scelta valida.
2. **Dado e movimento**: Peppo avanza in linea retta di esattamente N caselle. Il movimento è obbligatorio.
3. **Pedaggio** (§ Pedaggio).
4. **Tappeto**: obbligatorio, uno per turno (§ Piazzamento).

## Bordi del tabellone

Quando Peppo esce dal tabellone, segue un arco e rientra. **L'arco non conta come passo**: il passo che esce atterra direttamente
sulla casella di rientro, poi i passi rimasti proseguono nella nuova direzione, che resta a fine turno.

- Su ogni lato gli archi uniscono coppie di corsie vicine (3 coppie per lato). Si rientra nella corsia accanto, in senso opposto.
- La 7ª corsia di ogni lato finisce in un **arco d'angolo a quarto di giro**: Peppo resta nella stessa casella d'angolo, ruotato di 90°.
- Solo due angoli opposti hanno l'arco (configurazione BGA: **NE e SW**). Il tabellone ha simmetria di rotazione di 180°.

Tabella di rientro, come (uscita) → casella di rientro, nuova direzione:

| Lato | Corsie | Rientro |
| --- | --- | --- |
| Nord (esce verso N da y=0) | x0↔x1, x2↔x3, x4↔x5 | casella partner in y=0, verso **S** |
| | x6 | (6,0) stessa casella, verso **W** (angolo NE) |
| Est (esce verso E da x=6) | y0 | (6,0) stessa casella, verso **S** (angolo NE) |
| | y1↔y2, y3↔y4, y5↔y6 | casella partner in x=6, verso **W** |
| Sud (esce verso S da y=6) | x0 | (0,6) stessa casella, verso **E** (angolo SW) |
| | x1↔x2, x3↔x4, x5↔x6 | casella partner in y=6, verso **N** |
| Ovest (esce verso W da x=0) | y0↔y1, y2↔y3, y4↔y5 | casella partner in x=0, verso **E** |
| | y6 | (0,6) stessa casella, verso **N** (angolo SW) |

Da implementare come tabella da 28 voci (7 corsie × 4 lati) con una prova per ogni voce.

## Pedaggio

- Si paga solo se Peppo si ferma su una casella il cui tappeto **visibile** è di un **avversario** ancora in gioco.
- Importo = numero di caselle della **zona connessa ortogonalmente** (diagonali escluse) dello stesso colore visibile, compresa
  quella sotto Peppo.
- Casella vuota o tappeto proprio: nessun pagamento.
- **Non può pagare tutto** (monete < importo): paga ciò che ha ed esce dal gioco. Se ha esattamente l'importo, paga, resta a 0
  e continua a giocare. I suoi tappeti in mano si scartano. Quelli sul tabellone restano ma diventano **neutri**: non fanno più
  pagare, però occupano spazio e contano per le regole di copertura.
- In 2 giocatori i due colori dello stesso giocatore formano zone **separate**.

## Piazzamento

- Almeno una metà del tappeto deve toccare **un lato** della casella di Peppo. Nessuna metà può stare sotto Peppo.
  Il tappeto deve stare tutto dentro il tabellone. Le posizioni possibili sono al massimo 12.
- Coperture ammesse: due caselle vuote; una vuota più mezzo tappeto qualsiasi; due metà di **tappeti diversi**, anche dello stesso colore.
- **Vietato**: coprire in una sola mossa un tappeto di cui si vedono ancora entrambe le metà (stesso id sulle due caselle).
  Coprirlo del tutto in due mosse è permesso.
- Il divieto vale per **tutti** i tappeti, anche i propri e i neutri (testo 2025). Il testo 2007 lo limitava agli avversari:
  resta disponibile come opzione `coverOwn: true`.
- Se nessuna posizione è valida (caso rarissimo): il turno passa senza tappeto. Non è previsto dalle regole: è la nostra scelta.
- 2 giocatori: il colore del tappeto da posare esce a caso fra i due del giocatore.

## Fine partita

- Finisce quando è stato posato l'ultimo tappeto, oppure quando resta un solo giocatore in gioco (questa seconda regola è di BGA).
- Punteggio = monete + caselle visibili del proprio colore. A parità vince chi ha più monete. Se c'è ancora parità, si vince a pari merito.
- Gli eliminati non entrano in classifica.

## Variante ufficiale (opzionale)

- **Rotazione a fine turno** (`rotateAtEnd: true`): il giocatore tira, muove, paga, posa il tappeto e poi gira Peppo, decidendo così la direzione per il giocatore dopo.
