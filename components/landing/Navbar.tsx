"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/landing/Logo";
import { WRAP } from "@/components/landing/Section";
import { WAITLIST_EMAIL_INPUT_ID } from "@/lib/waitlist";
import { SECTION_LINKS as NAV_LINKS } from "@/lib/site";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Smooth-scrolls to an in-page anchor, updates the URL hash, and optionally focuses an element. */
function scrollToHash(event: MouseEvent<HTMLAnchorElement>, hash: string, focusId?: string) {
  const target = document.querySelector<HTMLElement>(hash);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", hash);
  if (focusId) {
    document.getElementById(focusId)?.focus({ preventScroll: true });
  }
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight the nav link whose section is currently in view.
  useEffect(() => {
    const sections = NAV_LINKS.map((l) => document.querySelector<HTMLElement>(l.href)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveHash(`#${visible.target.id}`);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const handleNav = (event: MouseEvent<HTMLAnchorElement>, hash: string, focusId?: string) => {
    setMenuOpen(false);
    scrollToHash(event, hash, focusId);
  };

  return (
    <header
      // .rail-bleed (globals.css): extend the bar across the scroll-rail gutter while the links stay put.
      className={`sticky top-0 z-50 border-b bg-obsidian/90 backdrop-blur-md transition-colors duration-200 rail-bleed ${
        scrolled || menuOpen ? "border-line" : "border-transparent"
      }`}
    >
      <nav aria-label="Primary" className={`${WRAP} flex h-14 items-center gap-8`}>
        <a href="#top" onClick={(e) => handleNav(e, "#top")} className="rounded-sm" aria-label="HyperDrive home">
          <Logo />
        </a>

        <ul className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => {
            const active = activeHash === link.href;
            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={(e) => handleNav(e, link.href)}
                  aria-current={active ? "location" : undefined}
                  className={`rounded-sm text-sm transition-colors ${active ? "text-ink" : "text-ink-muted hover:text-ink"}`}
                >
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>

        <a
          href="#waitlist"
          onClick={(e) => handleNav(e, "#waitlist", WAITLIST_EMAIL_INPUT_ID)}
          className="ml-auto hidden rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-obsidian transition-colors hover:bg-white sm:inline-block"
        >
          Join waitlist
        </a>

        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="-mr-2 ml-auto inline-flex size-9 items-center justify-center rounded-md text-ink-muted hover:text-ink sm:ml-0 lg:hidden"
        >
          {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
      </nav>

      {/* Overlay (out of document flow) so opening/closing never shifts page content
          mid-scroll; always rendered so `aria-controls` resolves. */}
      <div id="mobile-nav" hidden={!menuOpen} className="absolute inset-x-0 top-full border-b border-line bg-obsidian lg:hidden">
        <ul className={`${WRAP} flex flex-col py-2`}>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={(e) => handleNav(e, link.href)}
                className="block py-3 text-[15px] text-ink-muted hover:text-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li className="border-t border-line">
            <a
              href="#waitlist"
              onClick={(e) => handleNav(e, "#waitlist", WAITLIST_EMAIL_INPUT_ID)}
              className="block py-3 text-[15px] text-ink"
            >
              Join waitlist
            </a>
          </li>
        </ul>
      </div>
    </header>
  );
}
