import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { HeroWaitlist } from "@/components/landing/HeroWaitlist";
import { VirtualDriveSimulator } from "@/components/landing/VirtualDriveSimulator";
import { ArchitecturePipeline } from "@/components/landing/ArchitecturePipeline";
import { FeaturesBento } from "@/components/landing/FeaturesBento";
import { Roadmap } from "@/components/landing/Roadmap";
import { FaqSection } from "@/components/landing/FaqSection";
import { Footer } from "@/components/landing/Footer";
import { ScrollRail } from "@/components/landing/ScrollRail";

const title = "HyperDrive — Mount All Your Cloud Storage as a Local Drive";
const description =
  "HyperDrive merges Google Drive, Dropbox, and OneDrive into one native H:\\ drive in Windows File Explorer. Stream multi-gigabyte files on demand with HTTP Range Requests and local LRU chunk caching — zero upfront downloads. Join the early-access waitlist.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  keywords: [
    "HyperDrive",
    "virtual drive",
    "cloud storage",
    "Windows File Explorer",
    "WinFsp",
    "Google Drive",
    "Dropbox",
    "OneDrive",
    "mount cloud storage",
    "HTTP range requests",
    "virtual filesystem",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "HyperDrive",
    title,
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return (
    // On wide screens the right side is reserved for the scroll rail (see .rail-gutter in globals.css).
    <div className="rail-gutter">
      <ScrollRail />
      <Navbar />

      <main className="relative">
        {/* ── Step 1: Hero + Early Access Waitlist ─────────────────────────── */}
        <HeroWaitlist />

        {/* ── Step 2: Interactive H:\ File Explorer + Range Streaming Telemetry ── */}
        <VirtualDriveSimulator />

        {/* ── Step 3: Core Capabilities Bento Grid (#features) ──────────────── */}
        <FeaturesBento />

        {/* ── Step 3: Interactive System Architecture Pipeline (#architecture) ── */}
        <ArchitecturePipeline />

        {/* ── Step 4: Development Roadmap (#roadmap) ─────────────────────────── */}
        <Roadmap />

        {/* ── Step 4: Technical FAQ (#faq) ───────────────────────────────────── */}
        <FaqSection />
      </main>

      {/* ── Step 4: Bottom Early-Access CTA + Footer ──────────────────────── */}
      <Footer />
    </div>
  );
}
