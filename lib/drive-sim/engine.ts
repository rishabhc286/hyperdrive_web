/**
 * Deterministic, pure simulation of HyperDrive's read path:
 *
 *   ReadFile() → WinFsp IRP_MJ_READ → offset→4 MiB chunk → LRU lookup
 *     hit  → served from local cache
 *     miss → HTTP `Range: bytes=a-b` → `206 Partial Content` → insert into LRU (evicting cold chunks)
 *
 * All randomness (network latency) and time are passed in through actions, so the
 * reducer stays pure and the initial state is identical on server and client.
 */

import {
  CHUNK_SIZE,
  DRIVE_FILES,
  INITIAL_CACHE,
  PROVIDERS,
  cacheKey,
  chunkBytes,
  chunkCount,
  chunkRange,
  formatBytes,
  formatChunk,
  formatHex,
  getFile,
  parseCacheKey,
  windowsPath,
  type CacheKey,
} from "@/lib/drive-sim/catalog";

export const LRU_CAPACITY_CHUNKS = 48; // 192 MiB local cache budget — small enough to show eviction
export const GRID_SIZE = 32; // chunk-map window: 32 × 4 MiB = 128 MiB
export const STREAM_READ_AHEAD = 24; // chunks buffered on "Stream"
export const SEEK_READ_AHEAD = 12; // chunks buffered after a seek
export const SEEK_FRACTION = 0.65;
export const MAX_IN_FLIGHT = 2; // parallel range requests per file
export const TICK_MS = 80;

const MAX_LOG_ENTRIES = 140;
const MAX_HITS_PER_TICK = 1; // keeps cache hits visible instead of instant
const LATENCY_MIN_MS = 170;
const LATENCY_SPREAD_MS = 380;

export type SessionMode = "stream" | "seek";
export type SessionStatus = "running" | "done";
export type LogKind = "sys" | "irp" | "range" | "ok" | "hit" | "evict" | "done";

export interface InFlightRequest {
  chunk: number;
  issuedAt: number;
  dueAt: number;
}

export interface StreamSession {
  id: number;
  fileId: string;
  mode: SessionMode;
  status: SessionStatus;
  /** First chunk shown in the chunk-map window. */
  gridStart: number;
  /** Chunk range this session reads: [start, end). */
  start: number;
  end: number;
  /** Next chunk the "application" will read. */
  cursor: number;
  lastReadChunk: number | null;
  inFlight: InFlightRequest[];
  startedAt: number;
  finishedAt: number | null;
  lastResponseAt: number | null;
  reads: number;
  hits: number;
  responses: number;
  bytesFetched: number;
  latencyTotalMs: number;
}

export interface LogEntry {
  id: number;
  time: string;
  kind: LogKind;
  text: string;
}

export interface SimulatorState {
  /** LRU order, least-recently-used first. */
  lru: CacheKey[];
  evictions: number;
  total206: number;
  session: StreamSession | null;
  log: LogEntry[];
  nextLogId: number;
  nextSessionId: number;
}

export type SimulatorAction =
  | { type: "start"; fileId: string; mode: SessionMode; now: number }
  | { type: "tick"; now: number; random: readonly number[] }
  | { type: "purge"; now: number };

/* ── Initial state ───────────────────────────────────────────────────────── */

export function createInitialState(): SimulatorState {
  const boot: Array<[LogKind, string]> = [
    ["sys", "WinFsp FspFileSystemStartDispatcher → OK"],
    ["sys", `Mounted H:\\ — HyperDrive · 3 providers · ${DRIVE_FILES.length} files`],
    [
      "sys",
      `LRU chunk cache · ${formatBytes(CHUNK_SIZE)} chunks · ${formatBytes(
        LRU_CAPACITY_CHUNKS * CHUNK_SIZE,
      )} budget · ${formatBytes(cacheUsedBytes(INITIAL_CACHE))} warm`,
    ],
    ["sys", "Ready. Pick a file and press Stream or Seek."],
  ];

  return {
    lru: [...INITIAL_CACHE],
    evictions: 0,
    total206: 0,
    session: null,
    log: boot.map(([kind, text], id) => ({ id, time: "  boot ", kind, text })),
    nextLogId: boot.length,
    nextSessionId: 1,
  };
}

/* ── Selectors ───────────────────────────────────────────────────────────── */

export type CacheIndex = Map<string, Set<number>>;

export function buildCacheIndex(lru: readonly CacheKey[]): CacheIndex {
  const index: CacheIndex = new Map();
  for (const key of lru) {
    const { fileId, chunk } = parseCacheKey(key);
    let set = index.get(fileId);
    if (!set) index.set(fileId, (set = new Set()));
    set.add(chunk);
  }
  return index;
}

export function cacheUsedBytes(lru: readonly CacheKey[]): number {
  return lru.reduce((sum, key) => {
    const { fileId, chunk } = parseCacheKey(key);
    return sum + chunkBytes(getFile(fileId), chunk);
  }, 0);
}

export function cachedBytesForFile(fileId: string, index: CacheIndex): number {
  const chunks = index.get(fileId);
  if (!chunks) return 0;
  const file = getFile(fileId);
  let total = 0;
  for (const c of chunks) total += chunkBytes(file, c);
  return total;
}

/* ── Reducer ─────────────────────────────────────────────────────────────── */

interface Draft {
  lru: CacheKey[];
  evictions: number;
  total206: number;
  entries: LogEntry[];
  nextLogId: number;
}

function draftFrom(state: SimulatorState): Draft {
  return {
    lru: [...state.lru],
    evictions: state.evictions,
    total206: state.total206,
    entries: [],
    nextLogId: state.nextLogId,
  };
}

function log(draft: Draft, kind: LogKind, time: string, text: string) {
  draft.entries.push({ id: draft.nextLogId++, time, kind, text });
}

function elapsed(session: { startedAt: number }, now: number): string {
  return `+${((now - session.startedAt) / 1000).toFixed(3)}s`;
}

/** Marks a chunk most-recently-used, evicting from the cold end when over budget. */
function touch(draft: Draft, key: CacheKey, time: string) {
  const existing = draft.lru.indexOf(key);
  if (existing !== -1) draft.lru.splice(existing, 1);
  draft.lru.push(key);

  while (draft.lru.length > LRU_CAPACITY_CHUNKS) {
    const evicted = draft.lru.shift()!;
    const { fileId, chunk } = parseCacheKey(evicted);
    const file = getFile(fileId);
    draft.evictions++;
    log(draft, "evict", time, `EVICT ${formatChunk(chunk)} ${file.name} · LRU cold · −${formatBytes(chunkBytes(file, chunk))}`);
  }
}

function commit(state: SimulatorState, draft: Draft, session: StreamSession | null): SimulatorState {
  return {
    ...state,
    lru: draft.lru,
    evictions: draft.evictions,
    total206: draft.total206,
    session,
    log: draft.entries.length ? [...state.log, ...draft.entries].slice(-MAX_LOG_ENTRIES) : state.log,
    nextLogId: draft.nextLogId,
  };
}

export function simulatorReducer(state: SimulatorState, action: SimulatorAction): SimulatorState {
  switch (action.type) {
    case "start":
      return startSession(state, action.fileId, action.mode, action.now);
    case "tick":
      return tick(state, action.now, action.random);
    case "purge": {
      const draft = draftFrom(state);
      const freed = cacheUsedBytes(state.lru);
      if (state.session?.status === "running") {
        log(draft, "sys", elapsed(state.session, action.now), `^C cancelled ${state.session.inFlight.length} in-flight request(s)`);
      }
      draft.lru = [];
      log(draft, "evict", "  purge", `Cache purged · ${formatBytes(freed)} released · every file is now cloud-only`);
      const session = state.session ? { ...state.session, status: "done" as const, inFlight: [], finishedAt: action.now } : null;
      return commit(state, draft, session);
    }
  }
}

function startSession(state: SimulatorState, fileId: string, mode: SessionMode, now: number): SimulatorState {
  const file = getFile(fileId);
  const draft = draftFrom(state);
  const prev = state.session;

  if (prev?.status === "running") {
    log(
      draft,
      "sys",
      elapsed(prev, now),
      `^C cancelled ${prev.inFlight.length} in-flight request(s) for ${getFile(prev.fileId).name}`,
    );
  }

  const total = chunkCount(file);
  const seekChunk = Math.min(total - 1, Math.floor((file.sizeBytes * SEEK_FRACTION) / CHUNK_SIZE));
  const start = mode === "stream" ? 0 : seekChunk;
  const end = Math.min(total, start + (mode === "stream" ? STREAM_READ_AHEAD : SEEK_READ_AHEAD));
  const gridStart = mode === "stream" ? 0 : Math.max(0, Math.min(start - 4, total - GRID_SIZE));

  const session: StreamSession = {
    id: state.nextSessionId,
    fileId,
    mode,
    status: "running",
    gridStart,
    start,
    end,
    cursor: start,
    lastReadChunk: null,
    inFlight: [],
    startedAt: now,
    finishedAt: null,
    lastResponseAt: null,
    reads: 0,
    hits: 0,
    responses: 0,
    bytesFetched: 0,
    latencyTotalMs: 0,
  };

  const t = elapsed(session, now);
  log(draft, "sys", t, `CreateFile("${windowsPath(file)}") · ${formatBytes(file.sizeBytes)}`);
  log(
    draft,
    "sys",
    t,
    mode === "stream"
      ? `Sequential read from ${formatHex(0)} · read-ahead ${end - start} chunks`
      : `SetFilePointerEx → ${Math.round(SEEK_FRACTION * 100)}% (${formatHex(start * CHUNK_SIZE)}) · read-ahead ${end - start} chunks`,
  );

  return { ...commit(state, draft, session), nextSessionId: state.nextSessionId + 1 };
}

function tick(state: SimulatorState, now: number, random: readonly number[]): SimulatorState {
  const prev = state.session;
  if (!prev || prev.status !== "running") return state;

  const file = getFile(prev.fileId);
  const provider = PROVIDERS[file.provider];
  const draft = draftFrom(state);
  const t = elapsed(prev, now);
  const s: StreamSession = { ...prev, inFlight: [] };

  // 1. Complete range requests whose simulated latency has elapsed.
  for (const req of prev.inFlight) {
    if (req.dueAt > now) {
      s.inFlight.push(req);
      continue;
    }
    const bytes = chunkBytes(file, req.chunk);
    const latency = Math.round(req.dueAt - req.issuedAt);
    s.responses++;
    s.bytesFetched += bytes;
    s.latencyTotalMs += latency;
    s.lastResponseAt = now;
    draft.total206++;
    log(draft, "ok", t, `← 206 Partial Content · ${formatBytes(bytes)} · ${latency} ms → cached ${formatChunk(req.chunk)}`);
    touch(draft, cacheKey(file.id, req.chunk), t);
  }

  // 2. The application keeps reading: issue reads for the next chunks.
  let hitsThisTick = 0;
  let randomIndex = 0;
  while (s.inFlight.length < MAX_IN_FLIGHT && s.cursor < s.end && hitsThisTick < MAX_HITS_PER_TICK) {
    const chunk = s.cursor++;
    const [rangeStart, rangeEnd] = chunkRange(file, chunk);
    const key = cacheKey(file.id, chunk);
    s.reads++;
    s.lastReadChunk = chunk;
    log(draft, "irp", t, `IRP_MJ_READ ${formatChunk(chunk)} off=${formatHex(rangeStart)} len=${formatBytes(rangeEnd - rangeStart + 1)}`);

    if (draft.lru.includes(key)) {
      s.hits++;
      hitsThisTick++;
      log(draft, "hit", t, `LRU HIT ${formatChunk(chunk)} · served from local cache · 0 B over network`);
      touch(draft, key, t);
    } else {
      const r = random[randomIndex++ % random.length] ?? 0.5;
      const latency = LATENCY_MIN_MS + r * LATENCY_SPREAD_MS;
      s.inFlight.push({ chunk, issuedAt: now, dueAt: now + latency });
      log(
        draft,
        "range",
        t,
        `→ ${provider.method} ${provider.host} · Range: bytes=${rangeStart}-${rangeEnd}`,
      );
    }
  }

  // 3. Finished once every chunk in range has been read and all responses landed.
  if (s.cursor >= s.end && s.inFlight.length === 0) {
    s.status = "done";
    s.finishedAt = now;
    const index = buildCacheIndex(draft.lru);
    const saved = (1 - cachedBytesForFile(file.id, index) / file.sizeBytes) * 100;
    log(
      draft,
      "done",
      t,
      `✓ ${s.mode === "stream" ? "Playback buffered" : "Seek satisfied"} · ${formatBytes(s.bytesFetched)} fetched · ${s.hits} cache hit(s) · ${saved.toFixed(
        1,
      )}% of file never downloaded`,
    );
  }

  return commit(state, draft, s);
}
