"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Database,
  FileText,
  Film,
  HardDrive,
  Minus,
  Music,
  Package,
  Search,
  Sheet,
  Square,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  CLOUD_POOL_BYTES,
  PROVIDERS,
  PROVIDER_ORDER,
  formatBytes,
  type DriveFile,
  type FileKind,
  type ViewId,
} from "@/lib/drive-sim/catalog";
import { cachedBytesForFile, type CacheIndex, type SessionMode } from "@/lib/drive-sim/engine";

const KIND_ICON: Record<FileKind, LucideIcon> = {
  video: Film,
  dataset: Sheet,
  archive: Archive,
  package: Package,
  document: FileText,
  database: Database,
  audio: Music,
};

const VIEW_LABEL: Record<ViewId, string> = {
  unified: "All files",
  "google-drive": PROVIDERS["google-drive"].label,
  dropbox: PROVIDERS.dropbox.label,
  onedrive: PROVIDERS.onedrive.label,
};

interface ExplorerWindowProps {
  files: readonly DriveFile[];
  cacheIndex: CacheIndex;
  cacheUsed: number;
  selectedId: string;
  /** File whose stream session is currently running, if any. */
  streamingId: string | null;
  onSelect: (fileId: string) => void;
  onStart: (fileId: string, mode: SessionMode) => void;
}

export function ExplorerWindow({
  files,
  cacheIndex,
  cacheUsed,
  selectedId,
  streamingId,
  onSelect,
  onStart,
}: ExplorerWindowProps) {
  const [history, setHistory] = useState<{ stack: ViewId[]; index: number }>({ stack: ["unified"], index: 0 });
  const [query, setQuery] = useState("");
  const view = history.stack[history.index];

  const navigate = (next: ViewId) => {
    if (next === view) return;
    setHistory((h) => ({ stack: [...h.stack.slice(0, h.index + 1), next], index: h.index + 1 }));
    setQuery("");
  };
  const go = (delta: -1 | 1) =>
    setHistory((h) => ({ ...h, index: Math.min(h.stack.length - 1, Math.max(0, h.index + delta)) }));

  const visibleFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files.filter((f) => (view === "unified" || f.provider === view) && (!q || f.name.toLowerCase().includes(q)));
  }, [files, view, query]);

  const selected = files.find((f) => f.id === selectedId);

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line-strong bg-panel">
      {/* Title bar */}
      <div className="flex h-9 items-center border-b border-line pl-3 select-none" aria-hidden="true">
        <HardDrive className="size-3.5 text-ink-subtle" />
        <span className="ml-2 truncate text-xs text-ink-muted">HyperDrive (H:)</span>
        <div className="ml-auto flex h-full text-ink-subtle">
          <span className="flex w-10 items-center justify-center">
            <Minus className="size-3.5" />
          </span>
          <span className="flex w-10 items-center justify-center">
            <Square className="size-3" />
          </span>
          <span className="flex w-10 items-center justify-center">
            <X className="size-3.5" />
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        <ToolbarButton label="Back" disabled={history.index === 0} onClick={() => go(-1)}>
          <ArrowLeft className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Forward" disabled={history.index >= history.stack.length - 1} onClick={() => go(1)}>
          <ArrowRight className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Up to HyperDrive (H:)" disabled={view === "unified"} onClick={() => navigate("unified")}>
          <ArrowUp className="size-4" />
        </ToolbarButton>

        <nav aria-label="Address bar" className="ml-1 flex h-7 min-w-0 flex-1 items-center rounded border border-line px-2.5 text-xs">
          <ol className="flex min-w-0 items-center gap-1 text-ink-muted">
            <li className="hidden shrink-0 sm:block">This PC</li>
            <li aria-hidden className="hidden sm:block">
              <ChevronRight className="size-3 text-ink-subtle" />
            </li>
            <li className="shrink-0">
              <button type="button" onClick={() => navigate("unified")} className="rounded-sm hover:text-ink">
                HyperDrive (H:)
              </button>
            </li>
            <li aria-hidden>
              <ChevronRight className="size-3 text-ink-subtle" />
            </li>
            <li className="truncate text-ink" aria-current="page">
              {VIEW_LABEL[view]}
            </li>
          </ol>
        </nav>

        <label className="hidden h-7 w-44 items-center gap-2 rounded border border-line px-2.5 text-xs focus-within:border-line-strong lg:flex">
          <Search className="size-3.5 shrink-0 text-ink-subtle" aria-hidden />
          <span className="sr-only">Search files</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-ink-subtle focus-visible:outline-none"
          />
        </label>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <nav aria-label="Drive sources" className="hidden w-44 shrink-0 border-r border-line p-2 md:block">
          <SidebarItem active={view === "unified"} onClick={() => navigate("unified")}>
            <span className="truncate">All files</span>
            <span className="ml-auto text-xs text-ink-subtle tabular-nums">{files.length}</span>
          </SidebarItem>
          <p className="mt-4 mb-1 px-2 text-xs text-ink-subtle">Sources</p>
          {PROVIDER_ORDER.map((p) => (
            <SidebarItem key={p} active={view === p} onClick={() => navigate(p)}>
              <ProviderDot id={p} />
              <span className="truncate">{PROVIDERS[p].label}</span>
            </SidebarItem>
          ))}

          <dl className="mt-6 flex flex-col gap-2 border-t border-line px-2 pt-3 text-xs">
            <div>
              <dt className="text-ink-subtle">Cloud pool</dt>
              <dd className="text-ink-muted tabular-nums">{formatBytes(CLOUD_POOL_BYTES)}</dd>
            </div>
            <div>
              <dt className="text-ink-subtle">Local cache</dt>
              <dd className="text-ink-muted tabular-nums">{formatBytes(cacheUsed)}</dd>
            </div>
          </dl>
        </nav>

        {/* Main pane */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile source switcher (sidebar is hidden below md) */}
          <div className="flex gap-1 overflow-x-auto border-b border-line px-2 py-1.5 md:hidden" role="tablist" aria-label="Drive sources">
            {(["unified", ...PROVIDER_ORDER] as ViewId[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => navigate(v)}
                className={`shrink-0 rounded px-2.5 py-1 text-xs ${view === v ? "bg-white/[0.06] text-ink" : "text-ink-muted"}`}
              >
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>

          <div className="relative min-h-[320px] flex-1 overflow-x-auto">
            <table className="w-full min-w-[340px] table-fixed border-collapse text-left text-[13px] sm:min-w-[640px]">
              <colgroup>
                <col />
                <col className="hidden w-[118px] sm:table-column" />
                <col className="w-[70px]" />
                <col className="hidden w-[150px] sm:table-column" />
                <col className="w-[72px] sm:w-[112px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-line text-xs text-ink-subtle">
                  <th scope="col" className="px-3 py-2 font-normal">Name</th>
                  <th scope="col" className="hidden px-2 py-2 font-normal sm:table-cell">Provider</th>
                  <th scope="col" className="px-2 py-2 text-right font-normal">Size</th>
                  <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell">On disk</th>
                  <th scope="col" className="px-3 py-2 font-normal">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleFiles.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    selected={file.id === selectedId}
                    streaming={file.id === streamingId}
                    cachedBytes={cachedBytesForFile(file.id, cacheIndex)}
                    onSelect={onSelect}
                    onStart={onStart}
                  />
                ))}
                {visibleFiles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-12 text-center text-xs text-ink-subtle">
                      No items match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-3 border-t border-line px-3 py-1.5 text-xs text-ink-subtle">
            <span>{visibleFiles.length} items</span>
            {selected && <span className="truncate">1 selected · {formatBytes(selected.sizeBytes)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

interface FileRowProps {
  file: DriveFile;
  selected: boolean;
  streaming: boolean;
  cachedBytes: number;
  onSelect: (fileId: string) => void;
  onStart: (fileId: string, mode: SessionMode) => void;
}

function FileRow({ file, selected, streaming, cachedBytes, onSelect, onStart }: FileRowProps) {
  const Icon = KIND_ICON[file.kind];
  const provider = PROVIDERS[file.provider];

  return (
    <tr
      onClick={() => onSelect(file.id)}
      onDoubleClick={() => onStart(file.id, "stream")}
      className={`cursor-default border-b border-line/60 ${selected ? "bg-white/[0.05]" : "hover:bg-white/[0.025]"}`}
    >
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(file.id);
          }}
          aria-pressed={selected}
          title={`${file.name} — double-click to stream`}
          className="flex w-full min-w-0 items-center gap-2.5 rounded-sm text-left"
        >
          <Icon className="size-4 shrink-0 text-ink-subtle" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate text-ink">{file.name}</span>
            <span className="block truncate text-xs text-ink-subtle">
              <span className="sm:hidden">{provider.label} · </span>
              {file.folder}
            </span>
          </span>
        </button>
      </td>
      <td className="hidden px-2 py-2 text-ink-muted sm:table-cell">
        <span className="inline-flex items-center gap-2">
          <ProviderDot id={file.provider} />
          {provider.label}
        </span>
      </td>
      <td className="px-2 py-2 text-right text-ink-muted tabular-nums">{formatBytes(file.sizeBytes)}</td>
      <td className="hidden px-3 py-2 whitespace-nowrap tabular-nums sm:table-cell">
        {streaming ? (
          <span className="text-accent">{formatBytes(cachedBytes)} · streaming</span>
        ) : cachedBytes === 0 ? (
          <span className="text-ink-subtle">Cloud only</span>
        ) : (
          <span className="text-ink-muted">
            {formatBytes(cachedBytes)} {cachedBytes >= file.sizeBytes ? "· full" : "cached"}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-3 text-xs">
          <RowAction label={`Stream ${file.name}`} onClick={() => onStart(file.id, "stream")}>
            Stream
          </RowAction>
          <span className="hidden sm:contents">
            <RowAction label={`Seek to 65% of ${file.name}`} onClick={() => onStart(file.id, "seek")}>
              Seek
            </RowAction>
          </span>
        </div>
      </td>
    </tr>
  );
}

function ProviderDot({ id }: { id: DriveFile["provider"] }) {
  return <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: PROVIDERS[id].color }} aria-hidden />;
}

function RowAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="rounded-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
    >
      {children}
    </button>
  );
}

function ToolbarButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-white/[0.05] hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SidebarItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] ${
        active ? "bg-white/[0.06] text-ink" : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
