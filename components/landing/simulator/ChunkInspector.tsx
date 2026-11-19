"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CHUNK_SIZE, chunkCount, formatBytes, formatChunk, formatHex, type DriveFile } from "@/lib/drive-sim/catalog";
import {
  GRID_SIZE,
  LRU_CAPACITY_CHUNKS,
  SEEK_FRACTION,
  cachedBytesForFile,
  type CacheIndex,
  type LogEntry,
  type LogKind,
  type SessionMode,
  type StreamSession,
} from "@/lib/drive-sim/engine";

type BlockState = "remote" | "fetching" | "cached" | "eof";

/* One accent, used only for live activity; cached data is plain ink. */
const BLOCK_CLASS: Record<BlockState, string> = {
  remote: "bg-white/[0.06]",
  fetching: "animate-pulse bg-accent",
  cached: "bg-ink/80",
  eof: "border border-dashed border-line",
};

const BLOCK_LABEL: Record<BlockState, string> = {
  remote: "Remote (not downloaded)",
  fetching: "Fetching (HTTP 206)",
  cached: "Cached",
  eof: "Past end of file",
};

const LOG_CLASS: Record<LogKind, string> = {
  sys: "text-ink-subtle",
  irp: "text-ink-subtle",
  range: "text-ink-muted",
  ok: "text-ink",
  hit: "text-accent",
  evict: "text-ink-muted",
  done: "text-ink",
};

interface ChunkInspectorProps {
  file: DriveFile;
  /** Session for this file (running or finished), if any. */
  session: StreamSession | null;
  cacheIndex: CacheIndex;
  cacheUsed: number;
  lruChunks: number;
  evictions: number;
  total206: number;
  log: readonly LogEntry[];
  onStart: (fileId: string, mode: SessionMode) => void;
  onPurge: () => void;
}

export function ChunkInspector({
  file,
  session,
  cacheIndex,
  cacheUsed,
  lruChunks,
  evictions,
  total206,
  log,
  onStart,
  onPurge,
}: ChunkInspectorProps) {
  const totalChunks = chunkCount(file);
  const cachedChunks = cacheIndex.get(file.id) ?? new Set<number>();
  const inFlight = new Set(session?.status === "running" ? session.inFlight.map((r) => r.chunk) : []);
  const gridStart = session?.gridStart ?? 0;

  const cachedBytes = cachedBytesForFile(file.id, cacheIndex);
  const savedPct = Math.floor((1 - cachedBytes / file.sizeBytes) * 1000) / 10;

  const activeMs = session ? (session.finishedAt ?? session.lastResponseAt ?? session.startedAt) - session.startedAt : 0;
  const throughput = session && session.bytesFetched > 0 && activeMs > 0 ? session.bytesFetched / (activeMs / 1000) : null;
  const avgLatency = session && session.responses > 0 ? Math.round(session.latencyTotalMs / session.responses) : null;
  const hitRatio = session && session.reads > 0 ? Math.round((session.hits / session.reads) * 100) : null;

  const running = session?.status === "running";
  const status = !session ? "Idle" : running ? (session.mode === "stream" ? "Streaming" : "Seeking") : "Buffered";

  const blocks = Array.from({ length: GRID_SIZE }, (_, i) => {
    const chunk = gridStart + i;
    const state: BlockState =
      chunk >= totalChunks ? "eof" : inFlight.has(chunk) ? "fetching" : cachedChunks.has(chunk) ? "cached" : "remote";
    return { chunk, state, isHead: running && session?.lastReadChunk === chunk };
  });
  const visibleChunks = Math.min(GRID_SIZE, totalChunks - gridStart);

  return (
    <div className="overflow-hidden rounded-lg border border-line-strong">
      {/* Header / controls */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-3 text-sm">
          <span className="truncate text-ink">{file.name}</span>
          <span role="status" className={`inline-flex shrink-0 items-center gap-1.5 text-xs ${running ? "text-accent" : "text-ink-subtle"}`}>
            <span className={`size-1.5 rounded-full ${running ? "animate-pulse bg-accent" : "bg-ink-subtle"}`} aria-hidden />
            {status}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => onStart(file.id, "stream")}
            className="rounded-md bg-ink px-3 py-1 font-medium text-obsidian hover:bg-white"
          >
            Stream file
          </button>
          <TextButton onClick={() => onStart(file.id, "seek")}>Seek to {Math.round(SEEK_FRACTION * 100)}%</TextButton>
          <TextButton onClick={onPurge} title="Evict every cached chunk">
            Purge cache
          </TextButton>
        </div>
      </div>

      <div className="grid divide-y divide-line lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.3fr)] lg:divide-x lg:divide-y-0">
        {/* Telemetry */}
        <div className="p-4 sm:p-5">
          <PanelLabel>Downloaded</PanelLabel>
          <p className="mt-2 text-2xl font-medium tracking-tight text-ink tabular-nums">
            {formatBytes(cachedBytes)} <span className="text-ink-subtle">/ {formatBytes(file.sizeBytes)}</span>
          </p>
          <p className="mt-1 text-sm text-ink-muted tabular-nums">{savedPct.toFixed(1)}% of disk space saved</p>
          <FileMinimap file={file} cachedChunks={cachedChunks} inFlight={inFlight} session={session} />

          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
            <Metric label="Throughput" value={throughput ? `${(throughput / (1024 * 1024)).toFixed(1)} MB/s` : "—"} />
            <Metric label="Avg. latency" value={avgLatency ? `${avgLatency} ms` : "—"} />
            <Metric label="Cache hits" value={hitRatio !== null ? `${hitRatio}%` : "—"} />
            <Metric label="206 responses" value={String(total206)} />
          </dl>

          <div className="mt-6 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-ink-subtle">Local cache</span>
              <span className="text-xs text-ink-subtle tabular-nums">{evictions} evicted</span>
            </div>
            <p className="mt-0.5 text-ink tabular-nums">
              {formatBytes(cacheUsed)} <span className="text-ink-subtle">of {formatBytes(LRU_CAPACITY_CHUNKS * CHUNK_SIZE)}</span>
            </p>
            <div className="mt-2 h-px bg-white/[0.08]" aria-hidden="true">
              <div
                className="h-px bg-ink/70 transition-[width] duration-300"
                style={{ width: `${Math.min(100, (lruChunks / LRU_CAPACITY_CHUNKS) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Chunk map */}
        <div className="p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <PanelLabel>4 MB chunks</PanelLabel>
            <span className="text-xs text-ink-subtle tabular-nums">
              {formatChunk(gridStart)}–{formatChunk(gridStart + Math.max(visibleChunks, 1) - 1)}
            </span>
          </div>
          <div
            className="mt-3 grid grid-cols-8 gap-1"
            role="img"
            aria-label={`Chunks ${gridStart} to ${gridStart + visibleChunks - 1}: ${
              blocks.filter((b) => b.state === "cached").length
            } cached, ${blocks.filter((b) => b.state === "fetching").length} fetching, ${
              blocks.filter((b) => b.state === "remote").length
            } remote`}
          >
            {blocks.map(({ chunk, state, isHead }) => (
              <span
                key={chunk}
                title={state === "eof" ? BLOCK_LABEL.eof : `Chunk ${formatChunk(chunk)} · ${formatHex(chunk * CHUNK_SIZE)} · ${BLOCK_LABEL[state]}`}
                className={`aspect-square rounded-[2px] transition-colors duration-300 ${BLOCK_CLASS[state]} ${
                  isHead ? "outline outline-1 outline-offset-1 outline-accent" : ""
                }`}
              />
            ))}
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-muted">
            <Legend className={BLOCK_CLASS.remote}>Remote</Legend>
            <Legend className="bg-accent">Fetching</Legend>
            <Legend className={BLOCK_CLASS.cached}>Cached</Legend>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-ink-subtle">
            Showing {formatBytes(visibleChunks * CHUNK_SIZE)} of {totalChunks.toLocaleString("en-US")} chunks, starting at{" "}
            <span className="font-mono">{formatHex(gridStart * CHUNK_SIZE)}</span>.
          </p>
        </div>

        {/* Request log */}
        <div className="flex min-w-0 flex-col p-4 sm:p-5">
          <PanelLabel>Request log</PanelLabel>
          <RequestLog entries={log} />
        </div>
      </div>
    </div>
  );
}

function RequestLog({ entries }: { entries: readonly LogEntry[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const lastId = entries.at(-1)?.id;

  // Keep the log pinned to the newest line (scrolls the container, never the page).
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  return (
    <ol
      ref={ref}
      aria-label="Request log"
      className="mt-3 h-64 overflow-y-auto font-mono text-[11px] leading-[1.7] [scrollbar-color:rgba(255,255,255,0.12)_transparent] [scrollbar-width:thin] lg:h-[300px]"
    >
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-2">
          <span className="shrink-0 text-ink-subtle/60 tabular-nums">{entry.time}</span>
          <span className={`min-w-0 break-words ${LOG_CLASS[entry.kind]}`}>{entry.text}</span>
        </li>
      ))}
    </ol>
  );
}

function FileMinimap({
  file,
  cachedChunks,
  inFlight,
  session,
}: {
  file: DriveFile;
  cachedChunks: ReadonlySet<number>;
  inFlight: ReadonlySet<number>;
  session: StreamSession | null;
}) {
  const total = chunkCount(file);
  const pos = (chunk: number) => `${(chunk / total) * 100}%`;
  const width = `max(2px, ${100 / total}%)`;

  return (
    <div className="mt-5" aria-hidden="true">
      <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        {[...cachedChunks].map((c) => (
          <span key={`c${c}`} className="absolute inset-y-0 bg-ink/80" style={{ left: pos(c), width }} />
        ))}
        {[...inFlight].map((c) => (
          <span key={`f${c}`} className="absolute inset-y-0 bg-accent" style={{ left: pos(c), width }} />
        ))}
        {session && <span className="absolute inset-y-0 w-px bg-accent" style={{ left: pos(session.cursor) }} />}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-ink-subtle">
        <span>Start</span>
        <span>{formatBytes(file.sizeBytes)}</span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function PanelLabel({ children }: { children: ReactNode }) {
  return <h3 className="text-xs text-ink-subtle">{children}</h3>;
}

function Legend({ className, children }: { className: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`size-2.5 shrink-0 rounded-[2px] ${className}`} aria-hidden />
      {children}
    </li>
  );
}

function TextButton({ onClick, title, children }: { onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
    >
      {children}
    </button>
  );
}
