"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { Section } from "@/components/landing/Section";
import { renderInlineCode } from "@/components/landing/renderInlineCode";

interface Faq {
  question: string;
  /** Paragraphs; `backticks` render as inline code (and are stripped for JSON-LD). */
  answer: string[];
}

const FAQS: Faq[] = [
  {
    question: "Does HyperDrive store my cloud files on its own servers?",
    answer: [
      "No. There is no HyperDrive file relay. Bytes stream directly from Google Drive, Dropbox, or OneDrive to your PC over TLS, using each provider's own API — HyperDrive's infrastructure is never in the data path.",
      "Your OAuth tokens are encrypted on your machine with Windows DPAPI, and file metadata, the chunk-cache index, and sync cursors all live locally. Nothing about your files is uploaded to us.",
    ],
  },
  {
    question: "How does it handle huge files (e.g., 20 GB videos or datasets) on a laptop with low disk space?",
    answer: [
      "Three mechanisms work together. HTTP Range Requests fetch only the 4 MB chunks around the offsets an app actually reads — seek to the last minute of a 20 GB video and only that region is downloaded.",
      "Those chunks are written into NTFS sparse files at their real offsets, so un-fetched regions occupy zero bytes on disk (`FSCTL_SET_SPARSE`).",
      "Finally, the local cache has a hard cap you choose. When it fills, the least-recently-used chunks are evicted automatically, so a large cloud library never outgrows a small SSD.",
    ],
  },
  {
    question: "Can I edit and save files directly inside H:\\?",
    answer: [
      "Yes. When a file is opened for writing, HyperDrive stages a Copy-on-Write working copy locally; your edits land there while the cloud version stays untouched.",
      "When the last handle closes (`CloseHandle`), the new version is uploaded asynchronously through each provider's resumable upload sessions, so interrupted uploads continue instead of restarting. If the remote file changed in the meantime, HyperDrive keeps both versions rather than silently overwriting either.",
    ],
  },
  {
    question: "Which operating systems are supported at launch?",
    answer: [
      "Windows 10 and Windows 11 (x64) first, built on WinFsp.",
      "macOS and Linux support via FUSE is planned after the public alpha. Only the VFS layer is OS-specific — the streaming engine, cache, and provider adapters are designed to be shared across platforms.",
    ],
  },
  {
    question: "How is this different from Google Drive for Desktop or OneDrive?",
    answer: [
      "Those clients do a good job for their own cloud, but each mounts only its own provider. HyperDrive gives you one drive letter across Google Drive, Dropbox, and OneDrive at the same time.",
      "It also enforces a strict, global disk-cache cap with automatic eviction, and exposes developer-grade telemetry and control: per-request range logs, cache hit ratios, and tunable read-ahead.",
    ],
  },
];

const toPlainText = (paragraphs: string[]) => paragraphs.join(" ").replaceAll("`", "");

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: toPlainText(f.answer) },
  })),
};

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  const baseId = useId();

  return (
    <Section
      id="faq"
      label="FAQ"
      title="Questions developers ask first."
      description="Privacy, disk usage, editing, and platform support."
    >
      <script
        type="application/ld+json"
        // Static, author-controlled content; `<` escaped so it can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD).replace(/</g, "\u003c") }}
      />

      <div className="border-t border-line md:ml-[13rem]">
        {FAQS.map((faq, i) => {
          const isOpen = open === i;
          const buttonId = `${baseId}-q${i}`;
          const panelId = `${baseId}-a${i}`;
          return (
            <div key={faq.question} className="border-b border-line">
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center gap-6 py-5 text-left text-[15px] text-ink"
                >
                  <span className="flex-1">{faq.question}</span>
                  <Plus
                    className={`size-4 shrink-0 text-ink-subtle transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}
                    aria-hidden
                  />
                </button>
              </h3>
              {/* grid-rows 0fr → 1fr animates height without measuring */}
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                inert={!isOpen}
                className={`grid transition-[grid-template-rows] duration-200 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="overflow-hidden">
                  <div className="flex max-w-2xl flex-col gap-3 pb-6 text-sm leading-relaxed text-ink-muted">
                    {faq.answer.map((paragraph) => (
                      <p key={paragraph}>{renderInlineCode(paragraph)}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
