import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allPromptSeeds } from './content.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
export const AUDIO_DIR = path.join(DATA_DIR, 'audio');
fs.mkdirSync(AUDIO_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'kan.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  langs TEXT NOT NULL DEFAULT '[]',
  quartier TEXT,
  avatar TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  listen_total INTEGER NOT NULL DEFAULT 0,
  listen_correct INTEGER NOT NULL DEFAULT 0,
  referred_by INTEGER,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT
);
CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  zone TEXT NOT NULL,
  mission_id TEXT,
  text_fr TEXT NOT NULL,
  sensitive INTEGER NOT NULL DEFAULT 0,
  verify INTEGER NOT NULL DEFAULT 0,
  news INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt_id INTEGER NOT NULL REFERENCES prompts(id),
  user_id INTEGER REFERENCES users(id),
  lang TEXT NOT NULL,
  text TEXT NOT NULL,
  audio_file TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  yes INTEGER NOT NULL DEFAULT 0,
  no INTEGER NOT NULL DEFAULT 0,
  admin_status TEXT,
  admin_note TEXT,
  reviewed_at TEXT,
  source TEXT NOT NULL DEFAULT 'game',
  paid INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(prompt_id, user_id, lang)
);
CREATE INDEX IF NOT EXISTS idx_tr_lang_status ON translations(lang, status);
CREATE INDEX IF NOT EXISTS idx_tr_prompt ON translations(prompt_id);
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  translation_id INTEGER NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  verdict INTEGER NOT NULL,
  flagged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(translation_id, user_id)
);
CREATE TABLE IF NOT EXISTS mission_progress (
  user_id INTEGER NOT NULL REFERENCES users(id),
  mission_id TEXT NOT NULL,
  done_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, mission_id)
);
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  calls INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used TEXT
);
`);

export function seedPrompts() {
  const ins = db.prepare(`INSERT INTO prompts (key, zone, mission_id, text_fr, sensitive, verify, level)
    VALUES (?,?,?,?,?,?,?) ON CONFLICT(key) DO NOTHING`);
  for (const p of allPromptSeeds()) ins.run(p.key, p.zone, p.mission_id, p.text_fr, p.sensitive, p.verify, p.level);
}
seedPrompts();

export function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

// ---- Règles de validation (ajustables par variables d'environnement) ----
export const MIN_VOTES = Number(process.env.MIN_VOTES || 3);
export const YES_RATIO = Number(process.env.YES_RATIO || 0.67);

/** Recalcule le statut d'une traduction à partir des votes (sauf décision admin). */
export function recompute(translationId) {
  const t = db.prepare('SELECT * FROM translations WHERE id=?').get(translationId);
  if (!t) return null;
  const v = db.prepare('SELECT SUM(verdict=1) AS yes, SUM(verdict=0) AS no FROM votes WHERE translation_id=?').get(translationId);
  const yes = v.yes || 0, no = v.no || 0;
  let status = 'pending';
  if (t.admin_status === 'approved') status = 'validated';
  else if (t.admin_status === 'rejected') status = 'rejected';
  else if (yes + no >= MIN_VOTES) {
    const r = yes / (yes + no);
    if (r >= YES_RATIO) status = 'validated';
    else if (r <= 1 - YES_RATIO) status = 'rejected';
  }
  db.prepare("UPDATE translations SET yes=?, no=?, status=?, updated_at=datetime('now') WHERE id=?").run(yes, no, status, translationId);
  // bonus au traducteur la première fois que sa traduction est validée
  if (status === 'validated' && !t.paid && t.user_id) {
    db.prepare('UPDATE translations SET paid=1 WHERE id=?').run(translationId);
    db.prepare('UPDATE users SET points = points + 15 WHERE id=?').run(t.user_id);
  }
  return { yes, no, status };
}

// Une traduction est « exportable » si validée ET (phrase non sensible OU approuvée par un admin).
export const ELIGIBLE_SQL = `t.status='validated' AND (p.sensitive=0 OR t.admin_status='approved') AND p.active=1 AND (t.text != '' OR t.audio_file IS NOT NULL)`;
