import type { ReactNode } from "react";
import { Section } from "@/components/landing/Section";

interface Feature {
  title: string;
  body: ReactNode;
}

const Code = ({ children }: { children: ReactNode }) => <code className="font-mono text-[0.92em] text-ink">{children}</code>;

const FEATURES: Feature[] = [
  {
    title: "One drive for every cloud",
    body: (
      <>
        Google Drive, Dropbox, and OneDrive under a single <Code>H:\</Code> — no duplicated files, no juggling three sync
        agents.
      </>
    ),
  },
  {
    title: "Range streaming",
    body: "Only the byte ranges an app actually reads are fetched, so VLC, Premiere, or a Python script can start before the file “downloads”.",
  },
  {
    title: "Sparse files, capped cache",
    body: "Chunks live in NTFS sparse files under a disk budget you set. Cold chunks are evicted automatically, so a 150 GB pool fits on a 20 GB laptop.",
  },
  {
    title: "Native to Windows",
    body: "Built on WinFsp, so Explorer behaves as it does with a local disk: thumbnails, file locking, and safe copy-on-write saves.",
  },
  {
    title: "Credentials stay local",
    body: "OAuth tokens are encrypted on your machine and refreshed automatically. Your files are never stored on HyperDrive servers.",
  },
  {
    title: "Delta sync",
    body: (
      <>
        Remote changes arrive through cursor-based change feeds (<Code>changes.list</Code>, <Code>delta</Code>) instead of
        rescanning whole folder trees.
      </>
    ),
  },
];

/** Core capabilities — plain text in a hairline grid. */
export function FeaturesBento() {
  return (
    <Section
      id="features"
      label="Features"
      title="Engineered like an OS subsystem, not another sync client."
      description="HyperDrive sits below File Explorer, inside the Windows I/O path, so every app gets cloud files through ordinary file calls."
    >
      <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="bg-obsidian p-6 sm:p-7">
            <h3 className="text-[15px] font-medium text-ink">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{feature.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
