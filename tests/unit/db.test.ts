import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getDbDialect,
  getDb,
  saveCatalogCache,
  getCatalogCache,
  saveUpstreamCache,
  getUpstreamCache,
  closeDatabase,
} from '@/lib/db';

describe('Kysely Database Layer', () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
    delete process.env.DB_TYPE;
    delete process.env.DB_DIALECT;
    delete process.env.PG_HOST;
    delete process.env.POSTGRES_HOST;
    delete process.env.MYSQL_HOST;
    delete process.env.MARIADB_HOST;
    await closeDatabase();
  });

  afterEach(async () => {
    await closeDatabase();
    process.env = originalEnv;
  });

  describe('Dialect Detection', () => {
    it('defaults to sqlite when no configuration is present', () => {
      expect(getDbDialect()).toBe('sqlite');
    });

    it('detects postgres from DATABASE_URL protocol', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/dbname';
      expect(getDbDialect()).toBe('postgres');

      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/dbname';
      expect(getDbDialect()).toBe('postgres');
    });

    it('detects mysql and mariadb from DATABASE_URL protocol', () => {
      process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/dbname';
      expect(getDbDialect()).toBe('mysql');

      process.env.DATABASE_URL = 'mariadb://user:pass@localhost:3306/dbname';
      expect(getDbDialect()).toBe('mysql');
    });

    it('detects dialect from DB_TYPE / DB_DIALECT env var', () => {
      process.env.DB_TYPE = 'postgres';
      expect(getDbDialect()).toBe('postgres');

      process.env.DB_TYPE = 'mysql';
      expect(getDbDialect()).toBe('mysql');

      process.env.DB_DIALECT = 'mariadb';
      expect(getDbDialect()).toBe('mysql');

      process.env.DB_TYPE = 'sqlite';
      expect(getDbDialect()).toBe('sqlite');
    });

    it('detects postgres from PG_HOST or POSTGRES_HOST', () => {
      process.env.PG_HOST = 'db.internal';
      expect(getDbDialect()).toBe('postgres');
    });

    it('detects mysql from MYSQL_HOST or MARIADB_HOST', () => {
      process.env.MYSQL_HOST = 'mysql.internal';
      expect(getDbDialect()).toBe('mysql');
    });
  });

  describe('CRUD and Upsert Operations (SQLite :memory:)', () => {
    it('initializes schema and allows dispatch insertion & query', async () => {
      const db = await getDb({ dbPath: ':memory:' });
      expect(db).toBeDefined();

      const id = 'test-disp-1';
      const now = Date.now();
      await db
        .insertInto('dispatches')
        .values({
          id,
          formula: 'ffmpeg',
          requested_by: 'jaewook',
          email: 'user@example.com',
          created_at: now,
          status: 'dispatched',
        })
        .execute();

      const row = await db
        .selectFrom('dispatches')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();

      expect(row).toBeDefined();
      expect(row?.formula).toBe('ffmpeg');
      expect(row?.requested_by).toBe('jaewook');
      expect(Number(row?.created_at)).toBe(now);
    });

    it('upserts and retrieves catalog cache', async () => {
      await getDb({ dbPath: ':memory:' });

      await saveCatalogCache('{"formulas":[{"name":"ffmpeg"}]}', 1000);
      let cached = await getCatalogCache();
      expect(cached).not.toBeNull();
      expect(cached?.data).toBe('{"formulas":[{"name":"ffmpeg"}]}');
      expect(cached?.updated_at).toBe(1000);

      // Overwrite / Upsert
      await saveCatalogCache('{"formulas":[{"name":"ffmpeg","updated":true}]}', 2000);
      cached = await getCatalogCache();
      expect(cached).not.toBeNull();
      expect(cached?.data).toBe('{"formulas":[{"name":"ffmpeg","updated":true}]}');
      expect(cached?.updated_at).toBe(2000);
    });

    it('upserts and retrieves upstream cache', async () => {
      await getDb({ dbPath: ':memory:' });

      await saveUpstreamCache('ffmpeg', '7.1', 5000);
      let upstream = await getUpstreamCache('ffmpeg');
      expect(upstream).not.toBeNull();
      expect(upstream?.version).toBe('7.1');
      expect(upstream?.updated_at).toBe(5000);

      // Overwrite / Upsert
      await saveUpstreamCache('ffmpeg', '7.2', 6000);
      upstream = await getUpstreamCache('ffmpeg');
      expect(upstream?.version).toBe('7.2');
      expect(upstream?.updated_at).toBe(6000);

      // Unknown formula returns null
      const missing = await getUpstreamCache('unknown-pkg');
      expect(missing).toBeNull();
    });
  });
});
