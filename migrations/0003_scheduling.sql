CREATE TABLE team_match_nights (
  guild_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  preference_order INTEGER NOT NULL,
  PRIMARY KEY (guild_id, weekday)
);
CREATE INDEX team_match_nights_pref ON team_match_nights (guild_id, preference_order);

CREATE TABLE scrims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  proposed_by TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  message_id TEXT,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX scrims_guild_status ON scrims (guild_id, status);

CREATE TABLE rsvps (
  scrim_id INTEGER NOT NULL,
  discord_id TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (scrim_id, discord_id)
);

CREATE TABLE match_night_polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  preference_order INTEGER NOT NULL,
  match_start_at INTEGER NOT NULL,
  match_end_at INTEGER NOT NULL,
  map_name TEXT,
  message_id TEXT,
  status TEXT NOT NULL,
  closes_at INTEGER NOT NULL,
  yes_count INTEGER NOT NULL DEFAULT 0,
  ladder_done INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX match_night_polls_guild_status ON match_night_polls (guild_id, status);

CREATE TABLE poll_rsvps (
  poll_id INTEGER NOT NULL,
  discord_id TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (poll_id, discord_id)
);
