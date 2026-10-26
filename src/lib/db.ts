import { Kysely, SqliteDialect, PostgresDialect, MysqlDialect, sql } from 'kysely';
import Database from 'better-sqlite3';
import pg from 'pg';
import mysql from 'mysql2';
import path from 'path';
import fs from 'fs';

// Parse Postgres INT8 (bigint) as JavaScript number
pg.types.setTypeParser(20, (val: string) => parseInt(val, 10));

export interface DispatchesTable {
  id: string;
  formula: string;
  requested_by: string;
  email: string | null;
  created_at: number;
  status: string;
}

export interface CatalogCacheTable {
  id: string;
  data: string;
  updated_at: number;
}

export interface UpstreamCacheTable {
  formula: string;
  version: string | null;
  updated_at: number;
}

export interface DatabaseSchema {
  dispatches: DispatchesTable;
  catalog_cache: CatalogCacheTable;
  upstream_cache: UpstreamCacheTable;
}

export type DbDialect = 'sqlite' | 'postgres' | 'mysql';

let dbInstance: Kysely<DatabaseSchema> | null = null;
let dbInitPromise: Promise<Kysely<DatabaseSchema>> | null = null;
let currentDialect: DbDialect = 'sqlite';

export function getDbDialect(): DbDialect {
  const url = process.env.DATABASE_URL;
  if (url) {
    if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'postgres';
    if (url.startsWith('mysql://') || url.startsWith('mariadb://')) return 'mysql';
    if (url.startsWith('sqlite://') || url.startsWith('file:')) return 'sqlite';
  }

  const explicitType = (process.env.DB_TYPE || process.env.DB_DIALECT || '').toLowerCase();
  if (explicitType === 'postgres' || explicitType === 'postgresql') return 'postgres';
  if (explicitType === 'mysql' || explicitType === 'mariadb') return 'mysql';
  if (explicitType === 'sqlite') return 'sqlite';

  if (process.env.PG_HOST || process.env.POSTGRES_HOST || process.env.PGHOST) return 'postgres';
  if (process.env.MYSQL_HOST || process.env.MARIADB_HOST) return 'mysql';

  return 'sqlite';
}

function createSqliteDialect(dbPath?: string): SqliteDialect {
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

  const database = new Database(resolvedPath);
  database.pragma('journal_mode = WAL');
  return new SqliteDialect({ database });
}

function createPostgresDialect(): PostgresDialect {
  let poolConfig: pg.PoolConfig;

  if (process.env.DATABASE_URL) {
    poolConfig = { connectionString: process.env.DATABASE_URL };
  } else {
    poolConfig = {
      host: process.env.PG_HOST || process.env.POSTGRES_HOST || process.env.PGHOST || 'localhost',
      port: Number(process.env.PG_PORT || process.env.POSTGRES_PORT || process.env.PGPORT || '5432'),
      user: process.env.PG_USER || process.env.POSTGRES_USER || process.env.PGUSER || 'homebrew_nal',
      password: process.env.PG_PASS || process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || '',
      database: process.env.PG_DB || process.env.POSTGRES_DB || process.env.PGDATABASE || 'homebrew_nal',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  }

  const pool = new pg.Pool(poolConfig);
  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
  });
  return new PostgresDialect({ pool });
}

function createMysqlDialect(): MysqlDialect {
  const url = process.env.DATABASE_URL;
  let pool: mysql.Pool;

  if (url && (url.startsWith('mysql://') || url.startsWith('mariadb://'))) {
    pool = mysql.createPool(url);
  } else {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || process.env.MARIADB_HOST || 'localhost',
      port: Number(process.env.MYSQL_PORT || process.env.MARIADB_PORT || '3306'),
      user: process.env.MYSQL_USER || process.env.MARIADB_USER || 'root',
      password: process.env.MYSQL_PASSWORD || process.env.MARIADB_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || process.env.MARIADB_DATABASE || 'homebrew_nal',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      supportBigNumbers: true,
      bigNumberStrings: false,
    });
  }

  return new MysqlDialect({ pool });
}

async function initSchema(db: Kysely<DatabaseSchema>, dialect: DbDialect): Promise<void> {
  // 1. dispatches table
  await db.schema
    .createTable('dispatches')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('formula', 'varchar(128)', (col) => col.notNull())
    .addColumn('requested_by', 'varchar(128)', (col) => col.notNull())
    .addColumn('email', 'varchar(255)')
    .addColumn('created_at', 'bigint', (col) => col.notNull())
    .addColumn('status', 'varchar(32)', (col) => col.notNull())
    .execute();

  // Indexes on dispatches
  try {
    await db.schema
      .createIndex('idx_dispatches_formula')
      .ifNotExists()
      .on('dispatches')
      .column('formula')
      .execute();
  } catch {
    // Non-fatal if already exists
  }

  try {
    await db.schema
      .createIndex('idx_dispatches_created')
      .ifNotExists()
      .on('dispatches')
      .column('created_at')
      .execute();
  } catch {
    // Non-fatal
  }

  // 2. catalog_cache table
  await db.schema
    .createTable('catalog_cache')
    .ifNotExists()
    .addColumn('id', 'varchar(32)', (col) => col.primaryKey())
    .addColumn('data', dialect === 'mysql' ? sql`longtext` : 'text', (col) => col.notNull())
    .addColumn('updated_at', 'bigint', (col) => col.notNull())
    .execute();

  // 3. upstream_cache table
  await db.schema
    .createTable('upstream_cache')
    .ifNotExists()
    .addColumn('formula', 'varchar(128)', (col) => col.primaryKey())
    .addColumn('version', 'varchar(64)')
    .addColumn('updated_at', 'bigint', (col) => col.notNull())
    .execute();
}

export async function getDb(options?: { dbPath?: string; forceDialect?: DbDialect }): Promise<Kysely<DatabaseSchema>> {
  if (dbInstance) return dbInstance;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    try {
      const dialectType = options?.forceDialect || (options?.dbPath ? 'sqlite' : getDbDialect());
      currentDialect = dialectType;

      let dialect;
      if (dialectType === 'postgres') {
        dialect = createPostgresDialect();
      } else if (dialectType === 'mysql') {
        dialect = createMysqlDialect();
      } else {
        dialect = createSqliteDialect(options?.dbPath);
      }

      const instance = new Kysely<DatabaseSchema>({ dialect });
      await initSchema(instance, dialectType);
      dbInstance = instance;
      return instance;
    } finally {
      dbInitPromise = null;
    }
  })();

  return dbInitPromise;
}

export async function saveCatalogCache(data: string, updatedAt: number): Promise<void> {
  const db = await getDb();
  if (currentDialect === 'mysql') {
    await db
      .insertInto('catalog_cache')
      .values({ id: 'current', data, updated_at: updatedAt })
      .onDuplicateKeyUpdate({ data, updated_at: updatedAt })
      .execute();
  } else {
    await db
      .insertInto('catalog_cache')
      .values({ id: 'current', data, updated_at: updatedAt })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({ data, updated_at: updatedAt })
      )
      .execute();
  }
}

export async function getCatalogCache(id = 'current'): Promise<{ data: string; updated_at: number } | null> {
  const db = await getDb();
  const row = await db
    .selectFrom('catalog_cache')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();

  if (row) {
    return { data: row.data, updated_at: Number(row.updated_at) };
  }
  return null;
}

export async function saveUpstreamCache(formula: string, version: string | null, updatedAt: number): Promise<void> {
  const db = await getDb();
  if (currentDialect === 'mysql') {
    await db
      .insertInto('upstream_cache')
      .values({ formula, version, updated_at: updatedAt })
      .onDuplicateKeyUpdate({ version, updated_at: updatedAt })
      .execute();
  } else {
    await db
      .insertInto('upstream_cache')
      .values({ formula, version, updated_at: updatedAt })
      .onConflict((oc) =>
        oc.column('formula').doUpdateSet({ version, updated_at: updatedAt })
      )
      .execute();
  }
}

export async function getUpstreamCache(formula: string): Promise<{ version: string | null; updated_at: number } | null> {
  const db = await getDb();
  const row = await db
    .selectFrom('upstream_cache')
    .selectAll()
    .where('formula', '=', formula)
    .executeTakeFirst();

  if (row) {
    return { version: row.version, updated_at: Number(row.updated_at) };
  }
  return null;
}

export async function closeDatabase(): Promise<void> {
  if (dbInitPromise) {
    try {
      const pendingInstance = await dbInitPromise;
      await pendingInstance.destroy().catch(() => {});
    } catch {
      // Ignore
    }
    dbInitPromise = null;
  }
  if (dbInstance) {
    const instance = dbInstance;
    dbInstance = null;
    await instance.destroy().catch(() => {});
  }
  currentDialect = 'sqlite';
}
