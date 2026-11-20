"use client";

import { useEffect, useState } from "react";
import { WRAP } from "@/components/landing/Section";
import { WaitlistForm } from "@/components/landing/WaitlistForm";
import { WAITLIST_EMAIL_INPUT_ID, WAITLIST_SECTION_ID, type WaitlistStats } from "@/lib/waitlist";

const COUNT_POLL_MS = 20_000;
const numberFormat = new Intl.NumberFormat("en-US");

/** Live signup count, worded for 0 / 1 / many. */
function WaitlistCount({ total }: { total: number }) {
  if (total === 0) return <>Be the first to join the waitlist.</>;
  return (
    <>
      <span className="text-ink-muted tabular-nums">{numberFormat.format(total)}</span>{" "}
      {total === 1 ? "person is" : "developers and power users are"} on the waitlist
    </>
  );
}

export function HeroWaitlist() {
  // null until the real count has loaded, so no placeholder number ever flashes.
  const [total, setTotal] = useState<number | null>(null);

  // Live counter: fetch on mount, then poll while the tab is visible.
  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/waitlist", { cache: "no-store", signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as WaitlistStats;
        setTotal(data.total);
      } catch {
        // Network hiccups shouldn't disturb the hero; keep the last known count.
      }
    };

    void load();
    const interval = window.setInterval(load, COUNT_POLL_MS);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  return (
    <section id="top" aria-labelledby="hero-title">
      <div className={`${WRAP} pt-24 pb-24 sm:pt-36 sm:pb-32`}>
        <p className="text-sm text-ink-muted">
          Coming soon <span className="text-ink-subtle">·</span> Windows virtual filesystem
        </p>

        <h1
          id="hero-title"
          className="mt-6 max-w-3xl text-[2.5rem] leading-[1.08] font-medium tracking-[-0.035em] text-balance text-ink sm:text-6xl"
        >
          Mount all your cloud storage as a local drive.
        </h1>

        <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-pretty text-ink-muted">
          HyperDrive merges Google Drive, Dropbox, and OneDrive into a single{" "}
          <code className="font-mono text-[0.92em] text-ink">H:\</code> drive in File Explorer. Files stream in as you read
          them, so nothing downloads upfront.
        </p>

        <div className="mt-12 max-w-xl">
          <WaitlistForm inputId={WAITLIST_EMAIL_INPUT_ID} anchorId={WAITLIST_SECTION_ID} onTotalChange={setTotal} />
          {/* Fixed line height so the text appearing after load doesn't shift the layout. */}
          <p className="mt-6 min-h-5 text-sm text-ink-subtle" aria-live="polite">
            {total !== null && <WaitlistCount total={total} />}
          </p>
        </div>
      </div>
    </section>
  );
}
