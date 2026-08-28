import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

/**
 * Gates the whole /admin subtree, so no individual page repeats the check and
 * none can be added later that forgets it.
 *
 * proxy.ts already requires a session for /admin; this is the role check, which
 * needs the database and so belongs here rather than in routing.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/admin/disputes");
  if (user.role !== "ADMIN" && user.role !== "MAIN_MIDDLEMAN") redirect("/");

  return <>{children}</>;
}
