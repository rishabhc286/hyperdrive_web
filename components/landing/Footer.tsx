import { LogoMark } from "@/components/landing/Logo";
import { WRAP } from "@/components/landing/Section";
import { WaitlistForm } from "@/components/landing/WaitlistForm";
import { GITHUB_URL, SECTION_LINKS } from "@/lib/site";

/** Closing call-to-action + site footer. Server component; only the form hydrates. */
export function Footer() {
  return (
    <footer>
      <section id="get-started" aria-labelledby="cta-title" className="scroll-mt-16">
        <div className={WRAP}>
          <div className="border-t border-line py-20 sm:py-28">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16">
            <div>
              <h2 id="cta-title" className="text-2xl font-medium tracking-[-0.02em] text-balance text-ink sm:text-[2rem] sm:leading-tight">
                Ready to turn your cloud storage into a local drive?
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-muted">
                Join the waitlist for the Windows alpha. We&apos;ll send an installer when your invite is ready.
              </p>
              <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <a href="#roadmap" className="rounded-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
                  Follow development →
                </a>
                {GITHUB_URL && (
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                  >
                    Star on GitHub ↗
                  </a>
                )}
              </p>
            </div>
            <WaitlistForm inputId="cta-waitlist-email" />
          </div>
          </div>
        </div>
      </section>

      <div className={WRAP}>
      <div className="border-t border-line py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <a href="#top" aria-label="HyperDrive — back to top" className="flex items-center gap-2 self-start rounded-sm text-ink">
            <LogoMark className="size-4" />
            <span className="text-sm font-medium">HyperDrive</span>
          </a>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {SECTION_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="rounded-sm text-ink-muted hover:text-ink">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 text-xs text-ink-subtle sm:flex-row sm:justify-between">
          <p>© 2026 HyperDrive</p>
          <p>Built with WinFsp, Java Spring Boot &amp; Next.js</p>
        </div>
      </div>
      </div>
    </footer>
  );
}
