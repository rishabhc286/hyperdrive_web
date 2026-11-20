import { isDatabaseConfigured, query } from "@/lib/db";
import {
  isCloudProviderId,
  type CloudProviderId,
  type WaitlistRequest,
} from "@/lib/waitlist";

/**
 * Waitlist storage. Uses PostgreSQL when DATABASE_URL is set; otherwise falls
 * back to an in-memory store (handy for local development, but entries are
 * lost on restart and not shared between server instances).
 *
 * Positions are 1-based (the first signup is #1). They are derived by
 * counting rows rather than from the serial id, because Postgres sequences can
 * skip numbers (e.g. when a duplicate insert is rejected).
 */

export interface StoredEntry {
  email: string;
  providers: CloudProviderId[];
  position: number;
  joinedAt: string;
  alreadyJoined: boolean;
}

export function storageBackend(): "postgres" | "memory" {
  return isDatabaseConfigured() ? "postgres" : "memory";
}

export async function getWaitlistTotal(): Promise<number> {
  if (!isDatabaseConfigured()) return memory.entries.size;
  const [row] = await query<{ n: number }>("SELECT count(*)::int AS n FROM waitlist_entries");
  return row?.n ?? 0;
}

export async function addToWaitlist(request: WaitlistRequest): Promise<StoredEntry> {
  return isDatabaseConfigured() ? addToPostgres(request) : addToMemory(request);
}

/* ── PostgreSQL ──────────────────────────────────────────────────────────── */

interface EntryRow extends Record<string, unknown> {
  id: string; // BIGSERIAL comes back as a string
  email: string;
  providers: string[];
  created_at: Date;
  already_joined: boolean;
}

async function addToPostgres(request: WaitlistRequest): Promise<StoredEntry> {
  // Insert, or return the existing row if the email is already on the list.
  let [row] = await query<EntryRow>(
    `WITH inserted AS (
       INSERT INTO waitlist_entries (email, providers)
       VALUES ($1, $2::text[])
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, providers, created_at
     )
     SELECT id, email, providers, created_at, FALSE AS already_joined FROM inserted
     UNION ALL
     SELECT id, email, providers, created_at, TRUE FROM waitlist_entries WHERE email = $1
     LIMIT 1`,
    [request.email, request.providers],
  );

  // A concurrent request may have inserted the same email after this statement's
  // snapshot was taken; a fresh read will see it.
  if (!row) {
    [row] = await query<EntryRow>(
      "SELECT id, email, providers, created_at, TRUE AS already_joined FROM waitlist_entries WHERE email = $1",
      [request.email],
    );
  }
  if (!row) throw new Error("Waitlist insert returned no row");

  const [rank] = await query<{ n: number }>("SELECT count(*)::int AS n FROM waitlist_entries WHERE id <= $1", [row.id]);

  return {
    email: row.email,
    providers: row.providers.filter(isCloudProviderId),
    position: rank?.n ?? 0,
    joinedAt: row.created_at.toISOString(),
    alreadyJoined: row.already_joined,
  };
}

/* ── In-memory fallback ──────────────────────────────────────────────────── */

const globalForWaitlist = globalThis as typeof globalThis & {
  __hyperdriveWaitlist?: { entries: Map<string, Omit<StoredEntry, "alreadyJoined">> };
};
const memory = (globalForWaitlist.__hyperdriveWaitlist ??= { entries: new Map() });

function addToMemory(request: WaitlistRequest): StoredEntry {
  const existing = memory.entries.get(request.email);
  if (existing) return { ...existing, alreadyJoined: true };

  const entry = {
    email: request.email,
    providers: request.providers,
    position: memory.entries.size + 1,
    joinedAt: new Date().toISOString(),
  };
  memory.entries.set(entry.email, entry);
  return { ...entry, alreadyJoined: false };
}
