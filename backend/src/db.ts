import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_FILE = path.join(__dirname, '..', 'database.sqlite');

// Ensure database file directory exists
const dbDir = path.dirname(DB_FILE);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Enable verbose mode for debugging
const sqlite = sqlite3.verbose();
const db = new sqlite.Database(DB_FILE);

// Promisify database operations
export const run = (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const get = <T>(sql: string, params: any[] = []): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
};

export const all = <T>(sql: string, params: any[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
};

// Initialize schema
export const initDb = async () => {
  // Enable Foreign Keys
  await run('PRAGMA foreign_keys = ON;');

  // Projects table
  await run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      languages TEXT NOT NULL, -- JSON string array
      system_prompt TEXT,
      config TEXT, -- JSON string config
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Sources table
  await run(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- pdf, website, file
      content TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // Chunks table
  await run(`
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      content TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // Samples table
  await run(`
    CREATE TABLE IF NOT EXISTS samples (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_id TEXT,
      chunk_id TEXT,
      category TEXT NOT NULL,
      instruction TEXT NOT NULL,
      response TEXT NOT NULL,
      reasoning TEXT,
      preference_chosen TEXT,
      preference_rejected TEXT,
      language TEXT NOT NULL,
      quality_score INTEGER DEFAULT 0,
      quality_metrics TEXT, -- JSON string config (grammar, toxicity, hallucination, etc.)
      duplicate_status TEXT DEFAULT 'clean', -- clean, duplicate
      duplicate_of TEXT,
      contamination_status TEXT DEFAULT 'clean', -- clean, contaminated
      contamination_details TEXT,
      review_status TEXT DEFAULT 'generated', -- generated, pending_review, approved, rejected, edited, archived
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE SET NULL,
      FOREIGN KEY(chunk_id) REFERENCES chunks(id) ON DELETE SET NULL
    );
  `);

  // Versions table
  await run(`
    CREATE TABLE IF NOT EXISTS versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      version_string TEXT NOT NULL,
      sample_count INTEGER DEFAULT 0,
      change_log TEXT,
      metrics TEXT, -- JSON string config
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  console.log('Database initialized successfully.');
};
export default db;
