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

const LOCAL_ORIGIN = "http://localhost:3000";

/**
 * The canonical origin. Relative OpenGraph paths have to be absolutised against
 * something, and a link preview scraper cannot resolve "/opengraph-image".
 * Reuses BETTER_AUTH_URL rather than adding a second variable that says the same
 * thing and can drift out of step with it.
 *
 * Truthiness, never `??`. A variable that is *declared but empty* is the normal
 * shape of this misconfiguration — an unset row in the Vercel dashboard, or a
 * copied `.env.example` — and `??` only catches null/undefined, so `""` goes
 * straight into `new URL("")`, which throws ERR_INVALID_URL at module scope and
 * takes the whole build down. A malformed value is caught for the same reason:
 * a typo in a dashboard field should not be a failed deploy.
 */
function resolveSiteUrl(): string {
  const candidates = [
    process.env.BETTER_AUTH_URL?.trim(),
    // Vercel supplies this on every deployment. It is a weaker answer than the
    // real setting — it is not the custom domain — but it beats emitting
    // localhost URLs into a link preview.
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL!.trim()}`
      : undefined,
  ];

  for (const c of candidates) {
    if (!c) continue;
    try {
      return new URL(c).toString();
    } catch {
      console.warn(
        `[metadata] Ignoring unparseable site URL ${JSON.stringify(c)}.`,
      );
    }
  }

  if (process.env.NODE_ENV === "production") {
    // Loud in the build log rather than a silently wrong og:url. Auth is the
    // bigger casualty: Better Auth checks the request Origin against this same
    // variable, so without it sign-in fails with MISSING_OR_NULL_ORIGIN.
    console.warn(
      "[metadata] BETTER_AUTH_URL is not set. Falling back to " +
        `${LOCAL_ORIGIN} — link previews will be wrong and sign-in will fail. ` +
        "Set it in the Vercel project's environment variables.",
    );
  }
  return LOCAL_ORIGIN;
}

const siteUrl = resolveSiteUrl();

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
