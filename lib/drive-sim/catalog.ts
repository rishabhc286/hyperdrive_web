import type { CloudProviderId } from "@/lib/waitlist";

/* Binary units — Windows Explorer labels KiB/MiB/GiB as KB/MB/GB. */
export const KiB = 1024;
export const MiB = KiB * 1024;
export const GiB = MiB * 1024;

/** HyperDrive fetches and caches remote files in fixed 4 MiB chunks. */
export const CHUNK_SIZE = 4 * MiB;

export type ViewId = "unified" | CloudProviderId;

export interface ProviderMeta {
  id: CloudProviderId;
  label: string;
  /** Short label for the provider pill. */
  badge: string;
  capacityBytes: number;
  color: string;
  badgeClass: string;
  /** How the real provider API serves byte ranges (used for the request log). */
  method: "GET" | "POST";
  host: string;
}

export const PROVIDERS: Record<CloudProviderId, ProviderMeta> = {
  "google-drive": {
    id: "google-drive",
    label: "Google Drive",
    badge: "GDrive",
    capacityBytes: 100 * GiB,
    color: "#34A853",
    badgeClass: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    method: "GET",
    host: "googleapis.com/drive/v3/files",
  },
  dropbox: {
    id: "dropbox",
    label: "Dropbox",
    badge: "Dropbox",
    capacityBytes: 50 * GiB,
    color: "#0061FF",
    badgeClass: "border-blue-400/25 bg-blue-500/10 text-blue-300",
    method: "POST",
    host: "content.dropboxapi.com/2/files/download",
  },
  onedrive: {
    id: "onedrive",
    label: "OneDrive",
    badge: "OneDrive",
    capacityBytes: 25 * GiB,
    color: "#0EA5E9",
    badgeClass: "border-sky-400/25 bg-sky-400/10 text-sky-300",
    method: "GET",
    host: "graph.microsoft.com/v1.0/me/drive",
  },
};

export const PROVIDER_ORDER: CloudProviderId[] = ["google-drive", "dropbox", "onedrive"];

export const CLOUD_POOL_BYTES = PROVIDER_ORDER.reduce((sum, id) => sum + PROVIDERS[id].capacityBytes, 0);

export type FileKind = "video" | "dataset" | "archive" | "package" | "document" | "database" | "audio";

export interface DriveFile {
  id: string;
  name: string;
  provider: CloudProviderId;
  /** Folder inside the provider, Windows-style separators. */
  folder: string;
  sizeBytes: number;
  kind: FileKind;
  remoteId: string;
}

export const DRIVE_FILES: DriveFile[] = [
  {
    id: "master-cut",
    name: "4K_Master_Cut.mp4",
    provider: "google-drive",
    folder: "Video\\Final",
    sizeBytes: Math.round(14.8 * GiB),
    kind: "video",
    remoteId: "1aF9xQm7Lr2",
  },
  {
    id: "ml-dataset",
    name: "ML_Training_Dataset.parquet",
    provider: "dropbox",
    folder: "Research\\Datasets",
    sizeBytes: Math.round(8.6 * GiB),
    kind: "dataset",
    remoteId: "id:7hT2kPq0",
  },
  {
    id: "project-backup",
    name: "Project_Backup_2026.tar.zst",
    provider: "onedrive",
    folder: "Backups",
    sizeBytes: Math.round(4.2 * GiB),
    kind: "archive",
    remoteId: "01BYE5RZ6QN3",
  },
  {
    id: "game-assets",
    name: "Game_Assets_Build.pak",
    provider: "google-drive",
    folder: "Builds",
    sizeBytes: Math.round(1.4 * GiB),
    kind: "package",
    remoteId: "1Zk8cVw3Hn0",
  },
  {
    id: "arch-specs",
    name: "Architecture_Specs.pdf",
    provider: "onedrive",
    folder: "Docs",
    sizeBytes: Math.round(10.4 * MiB),
    kind: "document",
    remoteId: "01BYE5RZ2LK8",
  },
  {
    id: "pg-snapshot",
    name: "Postgres_Prod_Snapshot.dump",
    provider: "google-drive",
    folder: "Backups\\DB",
    sizeBytes: Math.round(6.1 * GiB),
    kind: "database",
    remoteId: "1Pq4tYb9Xe6",
  },
  {
    id: "drone-raw",
    name: "Drone_Footage_RAW.braw",
    provider: "dropbox",
    folder: "Video\\Raw",
    sizeBytes: Math.round(11.7 * GiB),
    kind: "video",
    remoteId: "id:3mR8vLs5",
  },
  {
    id: "podcast-wav",
    name: "Podcast_Ep42_Multitrack.wav",
    provider: "dropbox",
    folder: "Audio",
    sizeBytes: Math.round(2.9 * GiB),
    kind: "audio",
    remoteId: "id:9cW1nDf4",
  },
];

const FILES_BY_ID = new Map(DRIVE_FILES.map((f) => [f.id, f]));

export function getFile(id: string): DriveFile {
  const file = FILES_BY_ID.get(id);
  if (!file) throw new Error(`Unknown file: ${id}`);
  return file;
}

export function chunkCount(file: DriveFile): number {
  return Math.ceil(file.sizeBytes / CHUNK_SIZE);
}

/** Size of a specific chunk — the final chunk of a file is usually partial. */
export function chunkBytes(file: DriveFile, chunk: number): number {
  return Math.max(0, Math.min(CHUNK_SIZE, file.sizeBytes - chunk * CHUNK_SIZE));
}

export function chunkRange(file: DriveFile, chunk: number): [start: number, end: number] {
  const start = chunk * CHUNK_SIZE;
  return [start, start + chunkBytes(file, chunk) - 1];
}

export type CacheKey = `${string}#${number}`;

export function cacheKey(fileId: string, chunk: number): CacheKey {
  return `${fileId}#${chunk}`;
}

export function parseCacheKey(key: CacheKey): { fileId: string; chunk: number } {
  const i = key.lastIndexOf("#");
  return { fileId: key.slice(0, i), chunk: Number(key.slice(i + 1)) };
}

export function windowsPath(file: DriveFile): string {
  return `H:\\${PROVIDERS[file.provider].label}\\${file.folder}\\${file.name}`;
}

/** Warm cache at "mount" time: 4.0 + 4.0 + 10.4 = 18.4 MB. */
export const INITIAL_CACHE: CacheKey[] = [
  cacheKey("arch-specs", 0),
  cacheKey("arch-specs", 1),
  cacheKey("arch-specs", 2),
  cacheKey("game-assets", 0),
  cacheKey("master-cut", 0),
];

/* ── Formatting ───────────────────────────────────────────────────────────── */

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  if (bytes >= GiB) return `${(bytes / GiB).toFixed(1)} GB`;
  if (bytes >= MiB) return `${(bytes / MiB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / KiB))} KB`;
}

export function formatHex(offset: number): string {
  return `0x${offset.toString(16).toUpperCase().padStart(9, "0")}`;
}

export function formatChunk(chunk: number): string {
  return `#${String(chunk).padStart(4, "0")}`;
}
