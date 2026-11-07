/**
 * 数据库结构（唯一来源）。
 * 内联为字符串，避免 next build 后读取 .sql 文件的路径问题。
 * 结构变更时同步更新 lib/schema.sql（人类可读副本）。
 */
export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS albums (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  artist        TEXT NOT NULL,
  cover_url     TEXT,
  description   TEXT,
  release_date  TEXT,
  theme_color   TEXT,
  is_public     INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  external_id   TEXT UNIQUE,
  uploader_id   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_albums_public ON albums(is_public, sort_order, release_date);

CREATE TABLE IF NOT EXISTS songs (
  id            TEXT PRIMARY KEY,
  album_id      TEXT REFERENCES albums(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  artist        TEXT NOT NULL,
  audio_url     TEXT NOT NULL,
  cover_url     TEXT,
  duration      INTEGER NOT NULL DEFAULT 0,
  track_number  INTEGER NOT NULL DEFAULT 0,
  audio_format  TEXT,
  genre         TEXT,
  lyrics        TEXT,
  is_public     INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  external_id   TEXT UNIQUE,
  uploader_id   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album_id, track_number);
CREATE INDEX IF NOT EXISTS idx_songs_public ON songs(is_public, created_at);

CREATE TABLE IF NOT EXISTS playlists (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  cover_url     TEXT,
  is_public     INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_songs (
  playlist_id   TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  song_id       TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (playlist_id, song_id)
);

CREATE TABLE IF NOT EXISTS uploaders (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS upload_tokens (
  id            TEXT PRIMARY KEY,
  uploader_id   TEXT NOT NULL REFERENCES uploaders(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  token_hash    TEXT NOT NULL,
  token_prefix  TEXT NOT NULL,
  token_secret  TEXT,
  enabled       INTEGER NOT NULL DEFAULT 1,
  expires_at    TEXT,
  last_used_at  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tokens_uploader ON upload_tokens(uploader_id);

CREATE TABLE IF NOT EXISTS agent_submissions (
  id            TEXT PRIMARY KEY,
  token_id      TEXT,
  uploader_id   TEXT,
  external_id   TEXT,
  song_id       TEXT,
  status        TEXT NOT NULL,
  detail_json   TEXT,
  ip            TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_created ON agent_submissions(created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash    TEXT PRIMARY KEY,
  csrf_token    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audits (
  id            TEXT PRIMARY KEY,
  action        TEXT NOT NULL,
  target_type   TEXT NOT NULL,
  target_id     TEXT,
  detail_json   TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audits_created ON admin_audits(created_at DESC);
`;
