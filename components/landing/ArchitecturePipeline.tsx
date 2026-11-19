"use client";

import { Fragment, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Section } from "@/components/landing/Section";

interface ArchitectureLayer {
  id: string;
  name: string;
  tech: string;
  mode: string;
  role: string;
  protocols: string[];
  latency: { value: string; note: string };
  bottleneck: string;
  /** What a single read looks like at this layer. */
  trace: string;
}

const LAYERS: ArchitectureLayer[] = [
  {
    id: "apps",
    name: "Windows File Explorer / Apps",
    tech: "Win32 File I/O",
    mode: "User mode",
    role: "Explorer, VLC, Premiere, Python, or any Win32 program opens files on H:\\ with ordinary CreateFile / ReadFile / memory-mapped I/O. No plugins, SDKs, or app changes.",
    protocols: ["CreateFileW", "ReadFile", "Overlapped I/O", "Memory-mapped files"],
    latency: { value: "< 1 ms", note: "perceived ReadFile() latency on a warm chunk" },
    bottleneck:
      "Apps assume local-disk semantics: random seeks, tiny reads, and synchronous calls. HyperDrive keeps that contract instead of forcing a download-then-open workflow.",
    trace: "ReadFile(hFile, buf, 1048576, &read, &ov)",
  },
  {
    id: "vfs",
    name: "HyperDrive VFS Driver",
    tech: "WinFsp · C++ / Rust · L1 metadata cache",
    mode: "Kernel → user mode",
    role: "The WinFsp kernel driver receives I/O requests and dispatches them to HyperDrive's user-mode filesystem. An in-memory L1 cache answers metadata calls without leaving the process.",
    protocols: ["IRP_MJ_READ", "FspFileSystemOpRead", "IRP_MJ_DIRECTORY_CONTROL", "Oplocks / byte-range locks"],
    latency: { value: "< 50 µs", note: "L1 metadata hit (GetFileInfo, ReadDirectory)" },
    bottleneck:
      "Explorer fires hundreds of attribute and directory queries per folder view. Serving them from L1 means browsing H:\\ never turns into a storm of cloud API calls.",
    trace: "IRP_MJ_READ → FspFileSystemOpRead(off=0x023800000, len=1 MiB)",
  },
  {
    id: "core",
    name: "Core Orchestration Engine",
    tech: "Java + Spring Boot · gRPC / Named Pipes",
    mode: "User mode service",
    role: "Owns scheduling: prioritizes foreground reads over prefetch, de-duplicates concurrent requests for the same chunk, and coordinates auth, sync cursors, and cache policy.",
    protocols: ["gRPC over Named Pipes", "Request de-duplication", "Priority queues", "Backpressure"],
    latency: { value: "< 2 ms", note: "VFS ⇄ core IPC round-trip" },
    bottleneck:
      "Without central scheduling, ten threads reading the same region cause ten downloads. The orchestrator collapses them into one in-flight fetch and fans out the result.",
    trace: 'rpc ReadChunk { file: "1aF9xQm7Lr2", offset: 595591168, len: 1048576 }',
  },
  {
    id: "streaming",
    name: "Streaming & Chunking Engine",
    tech: "HTTP Range Requests · 4 MB block coalescing",
    mode: "User mode, network I/O",
    role: "Aligns reads to 4 MB blocks, coalesces adjacent cache misses into a single ranged GET, and runs adaptive read-ahead for sequential access like video playback.",
    protocols: ["Range: bytes=a-b", "206 Partial Content", "HTTP/2 multiplexing", "Adaptive read-ahead"],
    latency: { value: "+ < 5 ms", note: "overhead on top of provider round-trip" },
    bottleneck:
      "Thousands of small OS reads would mean thousands of HTTP requests. Block alignment plus coalescing turns them into a few large ranged fetches.",
    trace: "coalesce [#0142, #0143] → Range: bytes=595591168-603979775",
  },
  {
    id: "cache",
    name: "Local Sparse & LRU Cache",
    tech: "SQLite index + NTFS sparse files · PostgreSQL state",
    mode: "Local disk",
    role: "Chunks land in NTFS sparse files at their real offsets, so un-fetched regions take no disk space. A SQLite index tracks residency and LRU order; durable sync and job state lives in PostgreSQL.",
    protocols: ["FSCTL_SET_SPARSE", "SQLite WAL index", "LRU eviction", "PostgreSQL state store"],
    latency: { value: "< 1 ms", note: "4 MB chunk served from local NVMe" },
    bottleneck:
      "A 150 GB cloud pool can't be mirrored onto a 20 GB laptop SSD. A capped, self-evicting cache keeps hot data local and lets cold data fall back to the cloud.",
    trace: "SELECT slot FROM chunks WHERE file_id = ? AND idx = 142  -- miss",
  },
  {
    id: "cloud",
    name: "Cloud Integration Layer",
    tech: "Google Drive API · Dropbox API · OneDrive Graph API",
    mode: "Network",
    role: "Provider adapters normalize auth, ranged downloads, uploads, and change feeds behind one interface, handling each API's quirks, quotas, and token refresh.",
    protocols: ["files.get?alt=media", "/2/files/download", "/items/{id}/content", "OAuth 2.0 refresh"],
    latency: { value: "40–150 ms", note: "provider time-to-first-byte; backoff on 429 / 5xx" },
    bottleneck:
      "Three providers, three APIs, three rate-limit models. The adapter layer absorbs throttling and retries so upper layers only ever see “bytes for offset X”.",
    trace: "GET /drive/v3/files/1aF9xQm7Lr2?alt=media  →  206 Partial Content",
  },
];

export function ArchitecturePipeline() {
  const [active, setActive] = useState(0);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onListKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    const delta = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = Math.min(LAYERS.length - 1, Math.max(0, active + delta));
    setActive(next);
    buttonRefs.current[next]?.focus();
  };

  return (
    <Section
      id="architecture"
      label="Architecture"
      title={
        <>
          Under the hood: from <code className="font-mono text-[0.85em]">IRP_MJ_READ</code> to cloud API.
        </>
      }
      description="Six layers turn a plain Win32 read into a ranged cloud fetch. Select a layer to see what it does."
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        {/* Layer list */}
        <ol aria-label="Architecture layers" onKeyDown={onListKeyDown} className="border-t border-line">
          {LAYERS.map((layer, i) => {
            const isActive = i === active;
            return (
              <Fragment key={layer.id}>
                <li className="border-b border-line">
                  <button
                    ref={(el) => {
                      buttonRefs.current[i] = el;
                    }}
                    type="button"
                    aria-pressed={isActive}
                    aria-controls="architecture-inspector"
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    className="group flex w-full items-baseline gap-4 py-4 text-left"
                  >
                    <span className={`w-6 shrink-0 text-sm tabular-nums ${isActive ? "text-accent" : "text-ink-subtle"}`}>
                      0{i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[15px] transition-colors ${isActive ? "text-ink" : "text-ink-muted group-hover:text-ink"}`}>
                        {layer.name}
                      </span>
                      <span className="mt-0.5 block text-sm text-ink-subtle">{layer.tech}</span>
                    </span>
                  </button>
                </li>
                {i === 0 && (
                  <li aria-hidden="true" className="flex items-center gap-3 border-b border-dashed border-line py-2 pl-10 text-xs text-ink-subtle">
                    Kernel boundary — I/O Manager → WinFsp
                  </li>
                )}
              </Fragment>
            );
          })}
        </ol>

        {/* Inspector — all panels share one grid cell, so the column never changes height. */}
        <div id="architecture-inspector" aria-live="polite" className="grid lg:border-l lg:border-line lg:pl-12">
          {LAYERS.map((layer, i) => (
            <article
              key={layer.id}
              aria-hidden={i !== active}
              inert={i !== active}
              className={`[grid-area:1/1] ${i === active ? "" : "invisible"}`}
            >
              <p className="text-sm text-ink-subtle">
                Layer {i + 1} · {layer.mode}
              </p>
              <h3 className="mt-2 text-xl font-medium tracking-tight text-ink">{layer.name}</h3>

              <dl className="mt-8 flex flex-col gap-6 text-sm">
                <Row label="Role">{layer.role}</Row>
                <Row label="Key protocols">
                  <span className="font-mono text-[13px] text-ink">{layer.protocols.join(" · ")}</span>
                </Row>
                <Row label="Latency target">
                  <span className="text-ink">{layer.latency.value}</span>{" "}
                  <span className="text-ink-subtle">— {layer.latency.note}</span>
                </Row>
                <Row label="Why it matters">{layer.bottleneck}</Row>
              </dl>

              <p className="mt-8 border-t border-line pt-4 font-mono text-xs break-words text-ink-subtle">{layer.trace}</p>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="mt-1 leading-relaxed text-ink-muted">{children}</dd>
    </div>
  );
}
