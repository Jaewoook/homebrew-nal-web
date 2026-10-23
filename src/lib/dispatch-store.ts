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

let cachedDb: any = null;
let insertStmt: any = null;
let recentStmt: any = null;
let findStmt: any = null;

function getStatements() {
  const db = getDatabase();
  if (db !== cachedDb) {
    cachedDb = db;
    insertStmt = db.prepare(`
      INSERT INTO dispatches (id, formula, requested_by, email, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    recentStmt = db.prepare(`
      SELECT id, formula, requested_by, email, created_at, status
      FROM dispatches
      ORDER BY created_at DESC
      LIMIT ?
    `);
    findStmt = db.prepare(`
      SELECT id, formula, requested_by, email, created_at, status
      FROM dispatches
      WHERE formula = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
  }
  return { insertStmt, recentStmt, findStmt };
}

export function initDatabase(dbPath?: string) {
  cachedDb = null;
  insertStmt = null;
  recentStmt = null;
  findStmt = null;
  closeDatabase();
  return getDatabase(dbPath);
}

export function recordDispatch(formula: string, username: string, email?: string): DispatchRecord {
  const { insertStmt } = getStatements();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const status = 'dispatched';

  insertStmt.run(id, formula, username, email || null, createdAt, status);

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
  const { recentStmt } = getStatements();
  return recentStmt.all(limit) as DispatchRecord[];
}

export function findDispatchForFormula(formula: string): DispatchRecord | null {
  const { findStmt } = getStatements();
  const row = findStmt.get(formula);
  return (row as DispatchRecord) || null;
}
