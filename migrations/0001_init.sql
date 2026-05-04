CREATE TABLE teams (
  guild_id TEXT PRIMARY KEY,
  henrik_team_id TEXT,
  region TEXT,
  conference TEXT,
  captain_role_id TEXT,
  member_role_id TEXT,
  announcements_channel_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE players (
  guild_id TEXT NOT NULL,
  discord_id TEXT NOT NULL,
  riot_name TEXT NOT NULL,
  riot_tag TEXT NOT NULL,
  puuid TEXT NOT NULL,
  role TEXT,
  added_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, discord_id)
);
CREATE UNIQUE INDEX players_puuid_per_guild ON players (guild_id, puuid);

CREATE TABLE matches (
  guild_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  season_id TEXT,
  played_at INTEGER NOT NULL,
  map TEXT,
  result TEXT,
  score_us INTEGER,
  score_them INTEGER,
  raw_json TEXT NOT NULL,
  thread_id TEXT,
  PRIMARY KEY (guild_id, match_id)
);
CREATE INDEX matches_season ON matches (guild_id, season_id);

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  run_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL
);
CREATE INDEX jobs_status_run_at ON jobs (status, run_at);
