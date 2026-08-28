import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { THEME_SCRIPT } from "@/components/theme-toggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The canonical origin. Relative OpenGraph paths have to be absolutised against
 * something, and a link preview scraper cannot resolve "/opengraph-image".
 * Reuses BETTER_AUTH_URL rather than adding a second variable that says the same
 * thing and can drift out of step with it.
 */
const siteUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const DESCRIPTION =
  "Whitelist marketplace with middleman escrow. A verified middleman holds funds and collateral until delivery is confirmed.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    // Pages set only their own name; this appends the brand once, in one place.
    template: "%s — EXSAVERSE",
    default: "EXSAVERSE — Whitelist marketplace with middleman escrow",
  },
  description: DESCRIPTION,
  applicationName: "EXSAVERSE",
  openGraph: {
    type: "website",
    siteName: "EXSAVERSE",
    title: "EXSAVERSE",
    description: DESCRIPTION,
    url: siteUrl,
    locale: "en_GB",
    // The image itself comes from app/opengraph-image.png — Next generates the
    // og:image tags from that file, so listing it here would duplicate them.
  },
  twitter: {
    card: "summary_large_image",
    title: "EXSAVERSE",
    description: DESCRIPTION,
  },
  // A demo build has no business being indexed as a live escrow service.
  robots:
    process.env.DEMO_MODE === "true"
      ? { index: false, follow: false }
      : { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the stored theme before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        {children}
      </body>
    </html>
  );
}
