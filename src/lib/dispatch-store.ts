import crypto from 'crypto';
import { getDatabase, closeDatabase } from './db';

export interface DispatchRecord {
  id: string;
  formula: string;
  requested_by: string;
  email?: string | null;
  created_at: number;
  status: string;
}

export function initDatabase(dbPath?: string) {
  closeDatabase();
  return getDatabase(dbPath);
}

export function recordDispatch(formula: string, username: string, email?: string): DispatchRecord {
  const db = getDatabase();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const status = 'dispatched';

  const stmt = db.prepare(`
    INSERT INTO dispatches (id, formula, requested_by, email, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, formula, username, email || null, createdAt, status);

  return {
    id,
    formula,
    requested_by: username,
    email: email || null,
    created_at: createdAt,
    status,
  };
}

export function getRecentDispatches(limit = 50): DispatchRecord[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, formula, requested_by, email, created_at, status
    FROM dispatches
    ORDER BY created_at DESC
    LIMIT ?
  `);

  return stmt.all(limit) as DispatchRecord[];
}

export function findDispatchForFormula(formula: string): DispatchRecord | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, formula, requested_by, email, created_at, status
    FROM dispatches
    WHERE formula = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const row = stmt.get(formula);
  return (row as DispatchRecord) || null;
}
