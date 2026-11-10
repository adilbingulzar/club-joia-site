// The signed-in staff member of a dashboard request (server only).
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSession, SESSION_COOKIE, type AdminUser } from './session';
import { SignedOut } from './backend';

export async function currentAdmin(): Promise<AdminUser | null> {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

// the staff member, or off to the sign-in page
export async function requireAdmin(): Promise<AdminUser> {
  const user = await currentAdmin();
  if (!user) redirect('/admin/login');
  return user;
}

// fn's answer; the sign-in page when the backend no longer accepts the staff member
// (signed out there, disabled, or no longer an admin)
export async function asAdmin<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof SignedOut) redirect('/admin/login?expired=1');
    throw e;
  }
}
