import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SEED_TEXTS } from "./seed";

export const DATA_DIR = process.env.KAN_DATA_DIR || path.join(process.cwd(), "data");
export const AUDIO_DIR = path.join(DATA_DIR, "audio");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  langs TEXT NOT NULL,
  dialect TEXT,
  region TEXT,
  age_range TEXT,
  gender TEXT,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS texts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  content TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS recordings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text_id INTEGER NOT NULL REFERENCES texts(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  language TEXT NOT NULL,
  file TEXT NOT NULL,
  mime TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  pos INTEGER NOT NULL DEFAULT 0,
  neg INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text_id INTEGER NOT NULL REFERENCES texts(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  language TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  pos INTEGER NOT NULL DEFAULT 0,
  neg INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS validations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  verdict INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(kind, item_id, user_id)
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  task TEXT NOT NULL,
  ref_kind TEXT NOT NULL,
  ref_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recordings_text ON recordings(text_id, language);
CREATE INDEX IF NOT EXISTS idx_translations_text ON translations(text_id, language);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id, status);
`;

type G = typeof globalThis & { __kanDb?: DatabaseSync };

function open(): DatabaseSync {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  const db = new DatabaseSync(path.join(DATA_DIR, "kan.sqlite"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM texts").get() as { n: number };
  if (n === 0) {
    const ins = db.prepare("INSERT OR IGNORE INTO texts (category, content) VALUES (?, ?)");
    for (const t of SEED_TEXTS) ins.run(t.category, t.content);
  }
  return db;
}

export function db(): DatabaseSync {
  const g = globalThis as G;
  if (!g.__kanDb) g.__kanDb = open();
  return g.__kanDb;
}

// Helpers typés pour éviter les casts partout.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Param = any;

export function one<T>(sql: string, ...params: Param[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined;
}
export function all<T>(sql: string, ...params: Param[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}
export function run(sql: string, ...params: Param[]) {
  const r = db().prepare(sql).run(...params);
  return { changes: Number(r.changes), id: Number(r.lastInsertRowid) };
}
