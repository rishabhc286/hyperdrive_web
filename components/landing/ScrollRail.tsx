"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll-linked section rail fixed to the right edge (screens ≥ 1024px).
 *
 *  • Upcoming section names wait in a stack at the bottom right.
 *  • As a section scrolls in, its name peels off the stack letter by letter,
 *    bends around a corner and climbs the right edge sideways — position is
 *    tied directly to scroll, not to a timer.
 *  • When the section reaches the top, the name becomes the large current
 *    title; earlier sections collapse into a small list above it.
 *  • A ruler spans the whole document; the % marker always sits on its own tick.
 *
 * Everything is driven imperatively from one rAF-throttled scroll handler, so
 * scrolling never re-renders React. Decorative only (the navbar is the real
 * navigation), hence aria-hidden.
 */

const ITEMS = [
  { id: "top", label: "HyperDrive" },
  { id: "how-it-works", label: "How it works" },
  { id: "features", label: "Features" },
  { id: "architecture", label: "Architecture" },
  { id: "roadmap", label: "Roadmap" },
  { id: "faq", label: "FAQ" },
  { id: "get-started", label: "Get started" },
] as const;

const N = ITEMS.length;
const NAV_H = 56;
const BOTTOM_PAD = 28;

/** Sizes per screen width. Page padding in app/page.tsx (lg:pr-60 xl:pr-80) must leave room for `big`. */
interface Tier {
  small: number; // stacked / past label font size
  line: number; // stacked label line height
  big: number; // current title font size
  travel: number; // flying letters font size
  rulerW: number;
  labelRight: number; // viewport right edge → label column right edge
  corner: number; // radius of the bend the letters follow
}
const TIER_XL: Tier = { small: 13, line: 21, big: 30, travel: 22, rulerW: 36, labelRight: 76, corner: 28 };
const TIER_LG: Tier = { small: 12, line: 18, big: 22, travel: 17, rulerW: 30, labelRight: 62, corner: 22 };
const tierFor = (vw: number) => (vw >= 1280 ? TIER_XL : TIER_LG);
const MIN_WIDTH_QUERY = "(min-width: 1024px)";

type LabelState = "past" | "current" | "upcoming";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function ScrollRail() {
  const labelRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const letterRefs = useRef<Array<Array<HTMLSpanElement | null>>>(ITEMS.map(() => []));
  const rulerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const markerTextRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wide = window.matchMedia(MIN_WIDTH_QUERY);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const prevState: LabelState[] = ITEMS.map(() => "upcoming");
    let widths: number[][] = ITEMS.map(() => []);
    let tier: Tier | null = null;
    let frame = 0;

    /** Apply a tier's font sizes, then measure each flying letter at full size. */
    const applyTier = (next: Tier) => {
      tier = next;
      for (const label of labelRefs.current) {
        if (!label) continue;
        label.style.fontSize = `${next.small}px`;
        label.style.lineHeight = `${next.line}px`;
        label.style.right = `${next.labelRight}px`;
      }
      for (const letters of letterRefs.current) for (const el of letters) if (el) el.style.fontSize = `${next.travel}px`;
      if (rulerRef.current) rulerRef.current.style.width = `${next.rulerW}px`;
      if (markerRef.current) markerRef.current.style.width = `${next.rulerW + 28}px`;
      widths = letterRefs.current.map((letters) => letters.map((el) => el?.offsetWidth ?? 0));
    };

    const update = () => {
      frame = 0;
      if (!wide.matches) return;

      const doc = document.documentElement;
      const vw = doc.clientWidth;
      const vh = window.innerHeight;
      const docH = doc.scrollHeight;
      const sy = window.scrollY;
      const maxScroll = Math.max(1, docH - vh);
      const reduce = reducedMotion.matches;

      const T = tierFor(vw);
      if (T !== tier) applyTier(T);
      const bigScale = T.big / T.small;
      const topBase = NAV_H + 20;

      // ── Ruler + marker ──
      const progress = clamp01(sy / maxScroll);
      if (stripRef.current) {
        stripRef.current.style.height = `${docH}px`;
        stripRef.current.style.transform = `translate3d(0, ${-sy}px, 0)`;
      }
      if (markerRef.current) markerRef.current.style.transform = `translate3d(0, ${Math.min(vh - 1, progress * vh)}px, 0)`;
      if (markerTextRef.current) markerTextRef.current.textContent = `${String(Math.round(progress * 100)).padStart(3, "0")}%`;

      // ── Per-section progress: 0 when its top enters at the bottom, 1 when it reaches the top ──
      const t = ITEMS.map((item, k) => {
        if (k === 0) return 1;
        const el = document.getElementById(item.id);
        if (!el) return 0;
        const top = el.getBoundingClientRect().top;
        // Sections near the end may never reach the top; finish them at max scroll instead.
        const endTop = Math.max(NAV_H + 16, top + sy - maxScroll);
        return clamp01((vh - top) / Math.max(1, vh - endTop));
      });
      let current = 0;
      t.forEach((v, k) => {
        if (v >= 1) current = k;
      });

      const R = vw - T.labelRight; // right edge of the label column
      const Rc = R + T.corner; // x of the vertical climb
      const arcLen = (Math.PI * T.corner) / 2;

      ITEMS.forEach((_, k) => {
        const label = labelRefs.current[k];
        if (!label) return;

        const state: LabelState = k < current ? "past" : k === current ? "current" : "upcoming";
        const stackTop = vh - BOTTOM_PAD - (N - k) * T.line;
        let y: number;
        let scale = 1;
        let opacity: number;
        let color: string;

        if (state === "past") {
          y = topBase + k * T.line;
          opacity = 1;
          color = "var(--color-ink-subtle)";
        } else if (state === "current") {
          y = topBase + k * T.line + 6;
          scale = bigScale;
          opacity = k === 0 && sy < 24 ? 0 : 1; // hero: don't echo the logo until you scroll
          color = "var(--color-ink)";
        } else {
          y = stackTop;
          opacity = t[k] > 0 && !reduce ? 0 : 1; // hidden while its letters are flying
          color = "var(--color-ink-muted)";
        }

        // Jump (no transform transition) when entering/leaving the bottom stack, so the
        // label never visibly slides across the screen; animate moves between top slots.
        const crossesStack = prevState[k] !== state && (prevState[k] === "upcoming" || state === "upcoming");
        label.style.transition = crossesStack
          ? "opacity 220ms ease"
          : "transform 360ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 220ms ease, color 220ms ease";
        label.style.transform = `translate3d(0, ${y}px, 0) scale(${scale})`;
        label.style.opacity = String(opacity);
        label.style.color = color;
        label.style.fontWeight = state === "current" ? "600" : "500";
        label.style.pointerEvents = opacity > 0 ? "auto" : "none";
        prevState[k] = state;

        // ── Flying letters ──
        const letters = letterRefs.current[k];
        const tk = t[k];
        const flying = state === "upcoming" && tk > 0 && tk < 1 && !reduce;
        if (!flying) {
          for (const el of letters) if (el) el.style.opacity = "0";
          return;
        }

        const ys = stackTop + T.line / 2; // centre line of this label's stack slot
        const yEnd = topBase + k * T.line + 6 + T.big / 2;
        const S1 = arcLen + (ys - T.corner - yEnd);
        const lead = easeInOut(tk) * S1; // arc length reached by the word's last letter
        const size = lerp(T.small / T.travel, 1, clamp01(tk / 0.2));
        // Start as bright as the stacked label it replaces, then fade out as the title takes over.
        const fade = lerp(0.6, 1, clamp01(tk / 0.15)) * (1 - clamp01((tk - 0.9) / 0.1));

        const w = widths[k];
        const total = w.reduce((a, b) => a + b, 0) * size;
        let cursor = 0;
        letters.forEach((el, i) => {
          if (!el) return;
          const wi = (w[i] ?? 0) * size;
          const s = lead - (total - (cursor + wi / 2));
          cursor += wi;

          let x: number;
          let yy: number;
          let rot: number;
          if (s < 0) {
            x = Rc - T.corner + s; // still on the horizontal run
            yy = ys;
            rot = 0;
          } else if (s <= arcLen) {
            const theta = s / T.corner; // bending around the corner
            const phi = Math.PI / 2 - theta;
            x = Rc - T.corner + T.corner * Math.cos(phi);
            yy = ys - T.corner + T.corner * Math.sin(phi);
            rot = (-theta * 180) / Math.PI;
          } else {
            x = Rc; // climbing the right edge, reading bottom-to-top
            yy = ys - T.corner - (s - arcLen);
            rot = -90;
          }
          el.style.opacity = String(fade);
          el.style.transform = `translate3d(${x}px, ${yy}px, 0) translate(-50%, -50%) rotate(${rot}deg) scale(${size})`;
        });
      });
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    void document.fonts?.ready.then(() => {
      tier = null; // re-measure with the real web font
      schedule();
    });

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    wide.addEventListener("change", schedule);
    // Document height changes (FAQ accordion, fonts, images) move every section.
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(document.body);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      wide.removeEventListener("change", schedule);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div aria-hidden="true" className="scroll-rail pointer-events-none fixed inset-0 z-40 overflow-hidden select-none">
      {/* Ruler: one strip as tall as the document; tick q sits at q% of it. */}
      <div ref={rulerRef} className="absolute top-0 right-0 bottom-0 border-l border-line" style={{ width: TIER_XL.rulerW }}>
        <div ref={stripRef} className="absolute inset-x-0 top-0 will-change-transform">
          {Array.from({ length: 101 }, (_, q) => {
            const major = q % 5 === 0;
            return (
              <div key={q} className="absolute right-0 flex items-center gap-1.5" style={{ top: `${q}%` }}>
                {major && <span className="font-mono text-[9px] text-ink-subtle tabular-nums">{q}</span>}
                <span className={`block h-px ${major ? "w-3 bg-white/30" : "w-1.5 bg-white/15"}`} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress marker */}
      <div
        ref={markerRef}
        className="absolute top-0 right-0 flex items-start justify-end will-change-transform"
        style={{ width: TIER_XL.rulerW + 28 }}
      >
        <span className="block h-px w-full bg-accent" />
        <span ref={markerTextRef} className="absolute top-1 right-1 font-mono text-[9px] text-accent tabular-nums">
          000%
        </span>
      </div>

      {/* Section labels */}
      {ITEMS.map((item, k) => (
        <a
          key={item.id}
          ref={(el) => {
            labelRefs.current[k] = el;
          }}
          href={`#${item.id}`}
          tabIndex={-1}
          className="absolute top-0 tracking-[0.06em] whitespace-nowrap uppercase opacity-0 hover:!text-ink"
          style={{ right: TIER_XL.labelRight, fontSize: TIER_XL.small, lineHeight: `${TIER_XL.line}px`, transformOrigin: "right top" }}
        >
          {item.label}
        </a>
      ))}

      {/* Flying letters (one set per label, positioned along the bend each frame) */}
      {ITEMS.map((item, k) => (
        <div key={item.id} className="absolute top-0 left-0">
          {item.label
            .toUpperCase()
            .split("")
            .map((ch, i) => (
              <span
                key={i}
                ref={(el) => {
                  letterRefs.current[k][i] = el;
                }}
                className="absolute top-0 left-0 inline-block font-semibold tracking-[0.06em] whitespace-pre text-ink opacity-0 will-change-transform"
                style={{ fontSize: TIER_XL.travel, lineHeight: 1 }}
              >
                {ch}
              </span>
            ))}
        </div>
      ))}
    </div>
  );
}
