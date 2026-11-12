// Pannazzaro — interfacce dello stato di gioco (JSDoc, niente build: l'editor le controlla come TypeScript).
// Per usarle in un altro file:  /** @typedef {import('./types.js').GameState} GameState */
//
// Principio: lo stato è un oggetto JSON puro (niente classi, niente Map/Set), così si può salvare in localStorage,
// mandare al server e confrontare/ripetere. Tutte le regole sono funzioni pure in rules.js: (stato, azione) → nuovo stato.

/* ---------------- tabellone ---------------- */

/** Coordinata di una casella. x = colonna (0 a sinistra), y = riga (0 in alto). Il centro è { x: 3, y: 3 }.
 * @typedef {{ x: number, y: number }} Cell */

/** Punto cardinale verso cui guarda Peppo. N = verso la riga 0.
 * @typedef {'N' | 'E' | 'S' | 'W'} Direction */

/** Scelta di inizio turno: Peppo non può mai girarsi di 180°.
 * @typedef {'straight' | 'left' | 'right'} Turn */

/** Faccia del dado speciale: 1, 2, 2, 3, 3, 4.
 * @typedef {1 | 2 | 3 | 4} DieFace */

/** Una casella del tabellone: il tappeto visibile in cima (quelli sotto non contano più), oppure null se è vuota.
 * @typedef {{ rug: number, owner: PlayerIndex } | null} BoardCell */

/** Tabellone 7×7, indicizzato board[y][x].
 * @typedef {BoardCell[][]} Board */

/** Un tappeto posato (1×2). Resta nello storico anche quando viene coperto in tutto o in parte.
 * @typedef {object} Rug
 * @property {number} id        progressivo, 1 = primo tappeto posato nella partita
 * @property {PlayerIndex} owner
 * @property {[Cell, Cell]} cells due caselle ortogonalmente adiacenti
 * @property {number} round     turno (globale) in cui è stato posato */

/* ---------------- Peppo o' Pannazzaro ---------------- */

/** La pedina comune a tutti: posizione e direzione in cui guarda.
 * @typedef {object} Peppo
 * @property {Cell} pos
 * @property {Direction} dir */

/* ---------------- giocatori ---------------- */

/** Da 0 a 3, è anche l'ordine di gioco.
 * @typedef {0 | 1 | 2 | 3} PlayerIndex */

/** Colore dei tappeti di un giocatore (vedi COLORS in rules.js).
 * @typedef {'pomodoro' | 'golfo' | 'limone' | 'basilico'} PlayerColor */

/** @typedef {object} PlayerState
 * @property {number | null} accountId id del giocatore sul server (stesso sistema di Twindoku); null = ospite / gioco sullo stesso dispositivo
 * @property {string} name
 * @property {string} avatar   emoji, come in Twindoku
 * @property {PlayerColor} color
 * @property {number} coins    parte da 30
 * @property {number} rugsLeft tappeti ancora in mano (parte da RUGS_PER_PLAYER)
 * @property {boolean} out     true = senza soldi per pagare: è fuori, i suoi tappeti restano sul tabellone */

/* ---------------- turno ---------------- */

/** Fasi del turno, sempre in quest'ordine:
 *   orient → (scelta della direzione)  roll → (lancio e movimento)  pay → (pedaggio, anche se è 0)  place → (tappeto)  → turno dopo.
 * 'over' = partita finita.
 * @typedef {'orient' | 'roll' | 'pay' | 'place' | 'over'} Phase */

/** Pedaggio calcolato dopo il movimento: chi paga, a chi e quanto (= caselle contigue del colore su cui si è fermato Peppo).
 * @typedef {object} Toll
 * @property {PlayerIndex} from
 * @property {PlayerIndex} to
 * @property {number} amount quanto dovrebbe pagare
 * @property {number} paid   quanto paga davvero (meno, se non ha abbastanza monete: allora esce dal gioco)
 * @property {Cell[]} area   le caselle contate, per evidenziarle sullo schermo */

/** @typedef {object} TurnState
 * @property {PlayerIndex} current chi gioca
 * @property {Phase} phase
 * @property {number} round        turni giocati dall'inizio (0, 1, 2...)
 * @property {DieFace | null} roll ultimo lancio, null prima di 'roll'
 * @property {Cell[]} path         caselle attraversate da Peppo nell'ultimo movimento (per l'animazione)
 * @property {Toll | null} toll    null se Peppo è su una casella vuota o su un tappeto proprio */

/* ---------------- partita ---------------- */

/** 'local' = tutti sullo stesso dispositivo (passa e gioca); 'online' = ogni giocatore sul suo, stato tenuto dal server.
 * @typedef {'local' | 'online'} GameMode */

/** @typedef {object} GameState
 * @property {1} v               versione del formato: se cambia serve una migrazione dei salvataggi
 * @property {string | null} id  codice della partita online (null in locale)
 * @property {GameMode} mode
 * @property {number} rng        stato del generatore del dado (online lo tiene solo il server, così nessuno può prevedere i lanci)
 * @property {Board} board
 * @property {Rug[]} rugs        tutti i tappeti posati, in ordine
 * @property {Peppo} peppo
 * @property {PlayerState[]} players da 2 a 4 (le regole di partenza sono pensate per 4)
 * @property {TurnState} turn
 * @property {GameEvent[]} log   cronaca della partita, per lo storico e per rigiocarla
 * @property {Score[] | null} result classifica finale, null finché si gioca */

/** Punteggio finale: monete + caselle visibili del proprio colore. A parità vince chi ha più monete.
 * @typedef {object} Score
 * @property {PlayerIndex} player
 * @property {number} coins
 * @property {number} cells
 * @property {number} total
 * @property {number} place 1 = primo (ex aequo possibili) */

/* ---------------- azioni (quello che un giocatore può fare) ---------------- */

/** @typedef {{ type: 'orient', turn: Turn }} OrientAction */
/** @typedef {{ type: 'roll' }} RollAction */
/** @typedef {{ type: 'pay' }} PayAction  conferma del pedaggio (anche 0), così tutti vedono chi paga chi */
/** @typedef {{ type: 'place', cells: [Cell, Cell] }} PlaceAction */
/** @typedef {OrientAction | RollAction | PayAction | PlaceAction} Action */

/** Voce della cronaca: l'azione, chi l'ha fatta e l'esito (per il dado: la faccia uscita).
 * @typedef {{ by: PlayerIndex, round: number, action: Action, roll?: DieFace, toll?: Toll }} GameEvent */

export {};
