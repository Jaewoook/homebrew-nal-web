import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let dbInstance: Database.Database | null = null;

export function getDatabase(dbPath?: string): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const resolvedPath =
    dbPath ||
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), 'data', 'app.db');

  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  dbInstance = new Database(resolvedPath);
  dbInstance.pragma('journal_mode = WAL');

  // Initialize schema
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS dispatches (
      id TEXT PRIMARY KEY,
      formula TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      email TEXT,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dispatches_formula ON dispatches(formula);
    CREATE INDEX IF NOT EXISTS idx_dispatches_created ON dispatches(created_at DESC);
  `);

  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
