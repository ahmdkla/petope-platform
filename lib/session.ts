import { headers } from 'next/headers';
import { auth } from './auth';

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
};

/** Reads the session server-side. Never trust a client-supplied user id. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const u = session.user as unknown as {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    role?: string;
    status?: string;
  };

  return {
    id: u.id,
    email: u.email,
    displayName: u.name,
    avatarUrl: u.image,
    role: u.role ?? 'USER',
    status: u.status ?? 'ACTIVE',
  };
}

export function isMiddleman(role: string): boolean {
  return role === 'MIDDLEMAN' || role === 'MAIN_MIDDLEMAN' || role === 'ADMIN';
}
