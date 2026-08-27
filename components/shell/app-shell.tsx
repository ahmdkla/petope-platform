import Link from "next/link";
import { Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { DemoBanner } from "@/components/demo-banner";
import { getCurrentUser, isMiddleman } from "@/lib/session";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar
        showQueue={user ? isMiddleman(user.role) : false}
        showAdmin={user?.role === "ADMIN" || user?.role === "MAIN_MIDDLEMAN"}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-end gap-3 border-b border-line bg-card px-6">
          <ThemeToggle />
          {user ? (
            <UserMenu user={user} />
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/sign-in"
                className="flex h-9 items-center rounded-md px-3 text-body text-ink-muted transition-colors duration-200 hover:bg-raised hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="flex h-9 items-center rounded-md bg-accent px-3 text-body font-medium text-accent-ink transition-all duration-200 hover:brightness-110"
              >
                Create account
              </Link>
            </div>
          )}
        </header>

        <DemoBanner />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Page heading. Titles are 28px and may be bold. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-8 py-7">
      <div className="min-w-0">
        <h1 className="text-title font-bold tracking-tight text-ink">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-body text-ink-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className="px-8 py-8">{children}</div>;
}
