CREATE TABLE IF NOT EXISTS servers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  mc_version    TEXT NOT NULL,
  port          INTEGER NOT NULL DEFAULT 25565,
  jvm_flags     TEXT NOT NULL DEFAULT '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
  memory_mb     INTEGER NOT NULL DEFAULT 2048,
  java_version  TEXT NOT NULL DEFAULT '21',
  rcon_password TEXT NOT NULL,
  host_directory TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS backups (
  id          TEXT PRIMARY KEY,
  server_id   TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_backups_server_id ON backups(server_id);

CREATE TABLE IF NOT EXISTS server_messages (
  id               TEXT PRIMARY KEY,
  server_id        TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  type             TEXT NOT NULL DEFAULT 'join',
  content          TEXT NOT NULL,
  interval_minutes INTEGER,
  enabled          INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_server_messages_server_id ON server_messages(server_id);
