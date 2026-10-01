import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'nilam.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL,
  title TEXT NOT NULL, district TEXT NOT NULL, village TEXT NOT NULL, survey_no TEXT NOT NULL,
  lat REAL, lng REAL, geo TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL, original_name TEXT NOT NULL, stored_name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',       -- processing | extracted | needs_ocr | failed
  error TEXT, ocr_confidence REAL, text TEXT, fields TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  key TEXT NOT NULL, code TEXT NOT NULL, category TEXT NOT NULL, severity TEXT NOT NULL,
  title TEXT NOT NULL, detail TEXT NOT NULL, evidence TEXT NOT NULL DEFAULT '[]', action TEXT,
  status TEXT NOT NULL DEFAULT 'open', note TEXT,   -- open | reviewed | dismissed
  UNIQUE(case_id, key)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, action TEXT NOT NULL, target TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_docs_case ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_find_case ON findings(case_id);
`);

export const audit = (user, action, target) =>
  db.prepare('INSERT INTO audit_log(user_id,action,target) VALUES (?,?,?)').run(user.id, action, target ?? null);
