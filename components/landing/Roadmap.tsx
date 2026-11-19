import { Section } from "@/components/landing/Section";

type PhaseStatus = "In progress" | "Up next" | "Planned";

interface Phase {
  title: string;
  status: PhaseStatus;
  deliverables: string[];
}

const PHASES: Phase[] = [
  {
    title: "Foundation",
    status: "In progress",
    deliverables: [
      "Spring Boot backend",
      "React control dashboard",
      "PostgreSQL metadata schema",
      "OAuth 2.0 integration",
      "Google Drive API connector",
    ],
  },
  {
    title: "Virtual filesystem",
    status: "Up next",
    deliverables: [
      "WinFsp native driver integration",
      "Mounting H:\\ in Windows File Explorer",
      "Directory enumeration",
      "gRPC / Named Pipe IPC bridge",
    ],
  },
  {
    title: "HTTP Range streaming engine",
    status: "Planned",
    deliverables: [
      "206 Partial Content byte-range fetching",
      "4 MB block coalescing",
      "NTFS sparse file allocation",
      "LRU local cache eviction",
    ],
  },
  {
    title: "Multi-cloud & delta sync",
    status: "Planned",
    deliverables: [
      "Dropbox & OneDrive Graph API adapters",
      "Cursor-based background metadata sync (changes.list / delta)",
      "Copy-on-write safe file edits",
    ],
  },
  {
    title: "Hardening & public alpha",
    status: "Planned",
    deliverables: [
      "Windows Shell / Explorer stress testing",
      "Rate-limit token buckets",
      "Encrypted local token vault (DPAPI)",
      "Public alpha installer release",
    ],
  },
];

const STATUS_STYLE: Record<PhaseStatus, { text: string; dot: string }> = {
  "In progress": { text: "text-accent", dot: "bg-accent" },
  "Up next": { text: "text-ink-muted", dot: "bg-ink-muted" },
  Planned: { text: "text-ink-subtle", dot: "border border-ink-subtle" },
};

/** Five-phase build roadmap as a plain, fully visible list. */
export function Roadmap() {
  return (
    <Section
      id="roadmap"
      label="Roadmap"
      title="Transparent build roadmap: from VFS core to multi-cloud."
      description="HyperDrive ships in five incremental phases, each one ending with something you can run."
    >
      <ol className="border-t border-line">
        {PHASES.map((phase, i) => {
          const status = STATUS_STYLE[phase.status];
          return (
            <li
              key={phase.title}
              className="grid gap-4 border-b border-line py-8 md:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1.3fr)] md:gap-8"
            >
              <p className="text-sm text-ink-subtle">Phase {i + 1}</p>
              <div>
                <h3 className="text-[15px] font-medium text-ink">{phase.title}</h3>
                <p className={`mt-2 inline-flex items-center gap-2 text-sm ${status.text}`}>
                  <span className={`size-1.5 rounded-full ${status.dot}`} aria-hidden />
                  {phase.status}
                </p>
              </div>
              <ul className="flex flex-col gap-1.5 text-sm leading-relaxed text-ink-muted">
                {phase.deliverables.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
