'use server';
/*
 * Sign-in, activation and password reset (club-joia-300-backend src/app/(auth)/actions.ts, the same
 * names and results), done by the members app (lib/members.ts); the session goes in this site's cookie.
 */
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { MEMBER_COOKIE, cookieOptions, memberApi, sessionToken } from '@/lib/members';
import type { ActionError } from '@/member/lib/errors';

export type AuthFormState = { error?: ActionError; success?: string; values?: Record<string, string> } | undefined;

const str = (f: FormData, k: string) => (typeof f.get(k) === 'string' ? (f.get(k) as string) : '');

function asError(e: { code: string; message: string; fieldErrors?: Record<string, string[]> }): ActionError {
  return { code: (e.code === 'UNAVAILABLE' ? 'UNEXPECTED' : e.code) as ActionError['code'], message: e.message, fieldErrors: e.fieldErrors };
}

async function signIn(session: string, expiresAt: string) {
  (await cookies()).set(MEMBER_COOKIE, session, cookieOptions(new Date(expiresAt)));
}

// only this site's member pages after sign-in
function safeNext(next: string): string {
  return /^\/account(\/|$|\?)/.test(next) && !next.startsWith('//') ? next : '/account';
}

export async function loginAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const r = await memberApi<{ session: string; expiresAt: string }>('login', { email: str(form, 'email'), password: str(form, 'password') }, { headers: await headers() });
  if (!r.ok) return { error: asError(r.error), values: { email: str(form, 'email') } };
  await signIn(r.data.session, r.data.expiresAt);
  redirect(safeNext(str(form, 'next')));
}

export async function logoutAction() {
  const session = await sessionToken();
  if (session) await memberApi('logout', { session: session }, { headers: await headers() });
  (await cookies()).set(MEMBER_COOKIE, '', Object.assign(cookieOptions(new Date(0)), { maxAge: 0 }));
  redirect('/login');
}

export async function requestResetAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const r = await memberApi('forgot', { email: str(form, 'email') }, { headers: await headers() });
  if (!r.ok) return { error: asError(r.error) };
  return { success: 'If an account exists for that email, a reset link is on its way. It expires in 60 minutes.' };
}

export async function resetPasswordAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const r = await memberApi('reset', { token: str(form, 'token'), password: str(form, 'password'), confirm: str(form, 'confirm') }, { headers: await headers() });
  if (!r.ok) return { error: asError(r.error) };
  redirect('/login?reset=1');
}

export async function activateAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const r = await memberApi<{ session: string; expiresAt: string }>('activate', {
    token: str(form, 'token'), password: str(form, 'password'), confirm: str(form, 'confirm'), acceptTerms: str(form, 'acceptTerms')
  }, { headers: await headers() });
  if (!r.ok) return { error: asError(r.error) };
  await signIn(r.data.session, r.data.expiresAt);
  redirect('/account?welcome=1');
}
