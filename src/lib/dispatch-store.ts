import crypto from 'crypto';
import { getDb, closeDatabase } from './db';

export interface DispatchRecord {
  id: string;
  formula: string;
  requested_by: string;
  email?: string | null;
  created_at: number;
  status: string;
}

export async function initDatabase(dbPath?: string): Promise<void> {
  await closeDatabase();
  await getDb({ dbPath });
}

export async function recordDispatch(formula: string, username: string, email?: string): Promise<DispatchRecord> {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const status = 'dispatched';

  const db = await getDb();
  await db
    .insertInto('dispatches')
    .values({
      id,
      formula,
      requested_by: username,
      email: email || null,
      created_at: createdAt,
      status,
    })
    .execute();

  return {
    id,
    formula,
    requested_by: username,
    email: email || null,
    created_at: createdAt,
    status,
  };
}

export async function getRecentDispatches(limit = 50): Promise<DispatchRecord[]> {
  const db = await getDb();
  const rows = await db
    .selectFrom('dispatches')
    .selectAll()
    .orderBy('created_at', 'desc')
    .limit(limit)
    .execute();

  return rows.map((r) => ({
    id: r.id,
    formula: r.formula,
    requested_by: r.requested_by,
    email: r.email,
    created_at: Number(r.created_at),
    status: r.status,
  }));
}

export async function findDispatchForFormula(formula: string): Promise<DispatchRecord | null> {
  const db = await getDb();
  const row = await db
    .selectFrom('dispatches')
    .selectAll()
    .where('formula', '=', formula)
    .orderBy('created_at', 'desc')
    .executeTakeFirst();

  if (!row) return null;

  return {
    id: row.id,
    formula: row.formula,
    requested_by: row.requested_by,
    email: row.email,
    created_at: Number(row.created_at),
    status: row.status,
  };
}
