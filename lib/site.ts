/** Single source of truth for in-page sections, shared by the navbar and footer. */
export const SECTION_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#architecture", label: "Architecture" },
  { href: "#roadmap", label: "Roadmap" },
  { href: "#faq", label: "FAQ" },
] as const;

/**
 * Public repository / dev-log URL. Set NEXT_PUBLIC_GITHUB_URL to show a
 * "Star on GitHub" link; without it the footer links to the roadmap instead.
 */
export const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL || null;
