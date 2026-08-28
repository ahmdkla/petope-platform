import Link from "next/link";
import { DemoBanner } from "@/components/demo-banner";
import { Logo } from "@/components/logo";

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
        <div className="w-full max-w-md">
          <Link href="/" className="mb-7 flex items-center justify-center gap-2.5">
            <Logo size={32} />
            <span className="font-mono text-section font-semibold tracking-tight text-ink">
              EXSAVERSE
            </span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
