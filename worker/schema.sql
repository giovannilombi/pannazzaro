-- Database D1 di Pannazzaro (account e squadre come Twindoku). Applicare con:
--   npx wrangler d1 execute pannazzaro --remote --file=schema.sql
-- Nessun dato personale: solo soprannome, avatar (emoji) e progressi.

CREATE TABLE IF NOT EXISTS players (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,             -- come l'ha scritto il giocatore
  norm        TEXT NOT NULL UNIQUE,      -- forma normalizzata, per unicità e somiglianze
  avatar      TEXT NOT NULL,
  pin_hash    TEXT NOT NULL,
  pin_salt    TEXT NOT NULL,
  rec_hash    TEXT NOT NULL,             -- codice segreto di recupero
  rec_salt    TEXT NOT NULL,
  must_change INTEGER NOT NULL DEFAULT 0, -- 1 = PIN temporaneo dato dal capitano
  team_id     INTEGER,
  points      INTEGER NOT NULL DEFAULT 0, -- punti di classifica (regola da decidere)
  created    INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS players_team ON players(team_id);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  player_id  INTEGER NOT NULL,
  created    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_player ON sessions(player_id);

CREATE TABLE IF NOT EXISTS teams (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  norm       TEXT NOT NULL UNIQUE,
  pass_hash  TEXT NOT NULL,
  pass_salt  TEXT NOT NULL,
  invite     TEXT NOT NULL UNIQUE,
  captain_id INTEGER,
  created    INTEGER NOT NULL
);

-- Tentativi sbagliati (PIN, password di squadra, codice di recupero), per bloccare chi prova a indovinare.
CREATE TABLE IF NOT EXISTS attempts (
  k       TEXT PRIMARY KEY,
  fails   INTEGER NOT NULL,
  until   INTEGER NOT NULL,
  updated INTEGER NOT NULL
);

-- Partite online. Lo stato completo (con il seme del dado e l'ordine delle pile) resta qui: ai giocatori va solo publicView().
CREATE TABLE IF NOT EXISTS games (
  id      INTEGER PRIMARY KEY,
  code    TEXT NOT NULL UNIQUE,         -- 5 caratteri, per gli inviti (#partita-CODICE)
  host_id INTEGER NOT NULL,             -- chi l'ha creata: fa cominciare la partita
  status  TEXT NOT NULL,                -- lobby | play | over | gone (sala d'attesa chiusa)
  options TEXT NOT NULL,                -- JSON RuleOptions
  seats   TEXT NOT NULL,                -- JSON [{ id, name, avatar }] in ordine di arrivo
  state   TEXT,                         -- JSON GameState, null finché si è in sala d'attesa
  version INTEGER NOT NULL DEFAULT 0,   -- cresce a ogni mossa: serve per non applicare mosse su un tabellone vecchio
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS game_seats (
  game_id   INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  PRIMARY KEY (game_id, player_id)
);
CREATE INDEX IF NOT EXISTS game_seats_player ON game_seats(player_id);
