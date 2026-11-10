'use server';
/*
 * Sign-in and sign-out of the sales dashboard. The backend checks the email and password against
 * its staff accounts (admins only), the site keeps the signed cookie (lib/admin/session).
 */
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminLogin } from '@/lib/admin/backend';
import { SESSION_COOKIE, SESSION_SECONDS, signSession } from '@/lib/admin/session';

export type LoginState = { error?: string; email?: string } | undefined;

export async function login(_state: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') || '').trim().slice(0, 150);
  const password = String(form.get('password') || '').slice(0, 200);
  if (!email || !password) return { error: 'Enter your email and password.', email };

  const h = await headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
  const result = await adminLogin(email, password, ip);
  if (!result.user) return { error: result.error, email };

  const proto = (h.get('x-forwarded-proto') || '').split(',')[0].trim();
  (await cookies()).set(SESSION_COOKIE, signSession(result.user), {
    httpOnly: true,
    sameSite: 'lax',
    // Secure only over https: browsers drop a Secure cookie on plain http (local development)
    secure: proto === 'https' || (process.env.NODE_ENV === 'production' && proto !== 'http'),
    path: '/admin',
    maxAge: SESSION_SECONDS
  });
  redirect('/admin');
}

export async function logout(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, '', { path: '/admin', maxAge: 0 });
  redirect('/admin/login');
}
