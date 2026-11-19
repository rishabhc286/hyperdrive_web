import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

/** Set NEXT_PUBLIC_SITE_URL in production so OpenGraph URLs resolve absolutely. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Site-wide defaults; app/page.tsx refines these for the landing route.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "HyperDrive — Unified Cloud Storage as a Native Windows Drive",
    template: "%s · HyperDrive",
  },
  description:
    "HyperDrive mounts Google Drive, Dropbox, and OneDrive as a single native H:\\ drive in Windows File Explorer.",
  applicationName: "HyperDrive",
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#07090E",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body className="min-h-dvh bg-obsidian font-sans text-ink">{children}</body>
    </html>
  );
}
