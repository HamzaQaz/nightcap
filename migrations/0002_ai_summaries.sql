CREATE TABLE ai_summaries (
  guild_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  player_puuid TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  output TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, match_id, player_puuid)
);
CREATE INDEX ai_summaries_match ON ai_summaries (guild_id, match_id);
