import Link from "next/link";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/search/global-search";
import { DemoBanner } from "@/components/demo-banner";
import { DealReference } from "@/components/deal-reference";
import { getCurrentUser, isMiddleman } from "@/lib/session";
import { FloatingChat } from "@/components/chat/floating-chat";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-full flex-1">
      {/* Fixed rail from md up; the same nav rides in a drawer below that. */}
      <div className="hidden md:flex">
        <Sidebar
          showQueue={user ? isMiddleman(user.role) : false}
          showAdmin={user?.role === "ADMIN" || user?.role === "MAIN_MIDDLEMAN"}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-card px-4 sm:px-6">
          <MobileNav
            showQueue={user ? isMiddleman(user.role) : false}
            showAdmin={user?.role === "ADMIN" || user?.role === "MAIN_MIDDLEMAN"}
          />
          <GlobalSearch />
          <div className="flex-1" />
          <ThemeToggle />
          {user ? (
            <UserMenu user={user} />
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/sign-in"
                className="flex h-11 items-center rounded-md px-3 text-body text-ink-muted transition-colors duration-200 hover:bg-raised hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="flex h-11 items-center whitespace-nowrap rounded-md bg-accent px-3 text-body font-medium text-accent-ink transition-all duration-200 hover:brightness-110"
              >
                <span className="sm:hidden">Sign up</span>
                <span className="hidden sm:inline">Create account</span>
              </Link>
            </div>
          )}
        </header>

        <DemoBanner />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      {/* Sits above every page so a conversation survives navigation. */}
      {user ? <FloatingChat currentUserId={user.id} /> : null}
    </div>
  );
}

/** Page heading. Titles are 28px and may be bold. */
export function PageHeader({
  title,
  description,
  reference,
  actions,
}: {
  title: string;
  description?: string;
  /** A deal or ticket reference, shown shortened with a copy control. */
  reference?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
      <div className="min-w-0">
        <h1 className="text-section-lg font-bold tracking-tight text-ink sm:text-title">
          {title}
        </h1>
        {description || reference ? (
          <p className="mt-1.5 flex max-w-2xl flex-wrap items-center gap-x-2 text-body text-ink-muted">
            {description}
            {reference ? <DealReference reference={reference} /> : null}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>;
}
