import Link from "next/link";
import { DemoBanner } from "@/components/demo-banner";

/**
 * Auth shell. Conventionally centered: the Design Direction's ban on centered
 * layouts targets marketing pages inside the application, which a sign-in form
 * is not. Flat card, no hero, no illustration, no gradient.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <DemoBanner />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-6 block font-mono text-lg tracking-tight text-ink"
          >
            EXSAVERSE
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
