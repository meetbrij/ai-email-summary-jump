import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';

/**
 * Get the current user session on the server
 * @returns Session object or null if not authenticated
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Require authentication - redirects to login if not authenticated
 * Use in server components and server actions
 * @returns Session object (guaranteed to exist)
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session || !session.user) {
    redirect('/login');
  }

  return session;
}

/**
 * Get the current user ID
 * @returns User ID or null if not authenticated
 */
export async function getUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id || null;
}

/**
 * Require user ID - redirects to login if not authenticated
 * @returns User ID (guaranteed to exist)
 */
export async function requireUserId(): Promise<string> {
  const session = await requireAuth();
  return session.user!.id;
}
