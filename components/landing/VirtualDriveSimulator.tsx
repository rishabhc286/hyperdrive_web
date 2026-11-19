"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { DRIVE_FILES, getFile } from "@/lib/drive-sim/catalog";
import {
  TICK_MS,
  buildCacheIndex,
  cacheUsedBytes,
  createInitialState,
  simulatorReducer,
  type SessionMode,
} from "@/lib/drive-sim/engine";
import { Section } from "@/components/landing/Section";
import { ExplorerWindow } from "@/components/landing/simulator/ExplorerWindow";
import { ChunkInspector } from "@/components/landing/simulator/ChunkInspector";

const STEPS = [
  {
    title: "Windows asks for bytes",
    body: "An app calls ReadFile() on H:\\. WinFsp hands the offset and length to HyperDrive.",
  },
  {
    title: "Only that chunk is fetched",
    body: "The offset maps to a 4 MB chunk. A cache miss becomes an HTTP Range request to the provider.",
  },
  {
    title: "Hot chunks stay local",
    body: "Responses land in an LRU cache. Re-reads are instant; cold chunks are evicted when space runs low.",
  },
] as const;

/**
 * Interactive demo of HyperDrive's read path. Everything is simulated
 * client-side; no network requests are made.
 */
export function VirtualDriveSimulator() {
  const [state, dispatch] = useReducer(simulatorReducer, undefined, createInitialState);
  const [selectedId, setSelectedId] = useState(DRIVE_FILES[0].id);

  const running = state.session?.status === "running";

  // Drive the simulation clock only while a session is active.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      dispatch({
        type: "tick",
        now: performance.now(),
        random: [Math.random(), Math.random(), Math.random(), Math.random()],
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);

  const cacheIndex = useMemo(() => buildCacheIndex(state.lru), [state.lru]);
  const cacheUsed = useMemo(() => cacheUsedBytes(state.lru), [state.lru]);

  const start = useCallback((fileId: string, mode: SessionMode) => {
    setSelectedId(fileId);
    dispatch({ type: "start", fileId, mode, now: performance.now() });
  }, []);
  const purge = useCallback(() => dispatch({ type: "purge", now: performance.now() }), []);

  const selectedFile = getFile(selectedId);
  const sessionForSelected = state.session?.fileId === selectedId ? state.session : null;

  return (
    <Section
      id="how-it-works"
      label="How it works"
      title="Open a 14.8 GB file. Fetch only what you read."
      description={
        <>
          Press Stream or Seek on any file below and watch Windows reads turn into HTTP Range requests that fill a small
          local cache. The rest of the file never leaves the cloud.{" "}
          <span className="text-ink-subtle">(A simulation — no real network requests.)</span>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ExplorerWindow
          files={DRIVE_FILES}
          cacheIndex={cacheIndex}
          cacheUsed={cacheUsed}
          selectedId={selectedId}
          streamingId={running ? state.session!.fileId : null}
          onSelect={setSelectedId}
          onStart={start}
        />
        <ChunkInspector
          file={selectedFile}
          session={sessionForSelected}
          cacheIndex={cacheIndex}
          cacheUsed={cacheUsed}
          lruChunks={state.lru.length}
          evictions={state.evictions}
          total206={state.total206}
          log={state.log}
          onStart={start}
          onPurge={purge}
        />
      </div>

      <ol className="mt-16 grid gap-10 sm:grid-cols-3 sm:gap-8">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <p className="text-sm text-ink-subtle tabular-nums">0{i + 1}</p>
            <h3 className="mt-2 text-[15px] font-medium text-ink">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
