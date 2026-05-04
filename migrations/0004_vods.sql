CREATE TABLE vods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  match_id TEXT,
  url TEXT NOT NULL,
  thread_id TEXT,
  added_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX vods_guild_match ON vods (guild_id, match_id);

CREATE TABLE vod_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vod_id INTEGER NOT NULL,
  timestamp_seconds INTEGER NOT NULL,
  target_discord_id TEXT,
  author_discord_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX vod_notes_vod ON vod_notes (vod_id, timestamp_seconds);
