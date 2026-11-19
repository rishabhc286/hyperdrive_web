import {
  WAITLIST_BASE_COUNT,
  type CloudProviderId,
  type WaitlistRequest,
} from "@/lib/waitlist";

/**
 * In-memory waitlist store.
 *
 * This is a deliberate placeholder for Step 1: entries live for the lifetime of the
 * server process (and survive dev hot-reloads via `globalThis`). Swap the three
 * functions below for a real database / email provider before launch — the route
 * handler only depends on this interface.
 */

interface WaitlistEntry {
  email: string;
  providers: CloudProviderId[];
  position: number;
  joinedAt: string;
}

interface WaitlistDb {
  entries: Map<string, WaitlistEntry>;
}

const globalForWaitlist = globalThis as typeof globalThis & {
  __hyperdriveWaitlist?: WaitlistDb;
};

const db: WaitlistDb = (globalForWaitlist.__hyperdriveWaitlist ??= {
  entries: new Map(),
});

export function getWaitlistTotal(): number {
  return WAITLIST_BASE_COUNT + db.entries.size;
}

export function addToWaitlist(
  request: WaitlistRequest,
): WaitlistEntry & { alreadyJoined: boolean } {
  const existing = db.entries.get(request.email);
  if (existing) {
    return { ...existing, alreadyJoined: true };
  }

  const entry: WaitlistEntry = {
    email: request.email,
    providers: request.providers,
    position: getWaitlistTotal() + 1,
    joinedAt: new Date().toISOString(),
  };
  db.entries.set(entry.email, entry);
  return { ...entry, alreadyJoined: false };
}
