import type { ReactNode } from "react";

/** Shared page width + gutter. */
export const WRAP = "mx-auto w-full max-w-5xl px-5 sm:px-8";

interface SectionProps {
  id: string;
  /** Small label in the left column, e.g. "How it works". */
  label: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}

/**
 * Editorial section shell: hairline rule, label on the left, heading on the
 * right. Every content section uses it so the page reads as one system.
 */
export function Section({ id, label, title, description, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16">
      <div className={WRAP}>
        <div className="border-t border-line py-20 sm:py-28">
        <header className="grid gap-3 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-8">
          <p className="pt-1.5 text-sm text-ink-subtle">{label}</p>
          <div className="max-w-2xl">
            <h2 id={`${id}-title`} className="text-2xl font-medium tracking-[-0.02em] text-balance text-ink sm:text-[2rem] sm:leading-tight">
              {title}
            </h2>
            {description && <p className="mt-4 text-[15px] leading-relaxed text-pretty text-ink-muted">{description}</p>}
          </div>
        </header>
        {children && <div className="mt-12 sm:mt-16">{children}</div>}
        </div>
      </div>
    </section>
  );
}
