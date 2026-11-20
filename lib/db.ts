import { Pool } from "pg";

/**
 * PostgreSQL connection pool, created lazily from DATABASE_URL. Server-only.
 *
 * Serverless platforms run many short-lived instances, so the pool is kept
 * small; prefer your provider's *pooled* connection string in production
 * (e.g. Neon's "-pooler" host). Cached on globalThis so dev hot-reloads don't
 * open new pools.
 */

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS waitlist_entries (
    id          BIGSERIAL PRIMARY KEY,
    email       TEXT        NOT NULL UNIQUE,
    providers   TEXT[]      NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

const globalForDb = globalThis as typeof globalThis & {
  __hyperdrivePool?: Pool;
  __hyperdriveSchema?: Promise<void>;
};

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  if (!globalForDb.__hyperdrivePool) {
    const pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX) || 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
    // An idle client can error (e.g. the server restarts); log instead of crashing the process.
    pool.on("error", (err) => console.error("[db] Idle client error:", err.message));
    globalForDb.__hyperdrivePool = pool;
  }
  return globalForDb.__hyperdrivePool;
}

/** Creates the table once per process (idempotent); retried on the next call if it fails. */
async function ensureSchema(pool: Pool): Promise<void> {
  globalForDb.__hyperdriveSchema ??= pool
    .query(SCHEMA_SQL)
    .then(() => undefined)
    .catch((err: unknown) => {
      globalForDb.__hyperdriveSchema = undefined;
      throw err;
    });
  return globalForDb.__hyperdriveSchema;
}

/** Runs a parameterized query after making sure the schema exists. */
export async function query<Row extends Record<string, unknown>>(text: string, params: unknown[] = []): Promise<Row[]> {
  const pool = getPool();
  await ensureSchema(pool);
  const result = await pool.query<Row>(text, params);
  return result.rows;
}
