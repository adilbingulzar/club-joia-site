/*
 * Members' sign-in (/login, /activate, /forgot-password, /reset-password; member/server/auth-actions.ts)
 * and their pages (/account; member/server/api.ts).
 *
 * The accounts live in the members app (club-joia-300-backend: admin > Members makes them and
 * emails the activation link to this site). That app is behind its IP allowlist, so this site's
 * server calls its API: MEMBER_API_URL + /api/member-app/<action>, Authorization: Bearer
 * MEMBER_API_KEY (the same key in both .env files). The member's session token stays in an
 * httpOnly cookie on this site and goes with every call.
 */
import { cookies } from 'next/headers';
import { clientIp } from '@/lib/ip-allowlist';

export { MEMBER_COOKIE } from './members-cookie';
import { MEMBER_COOKIE } from './members-cookie';
export const PASSWORD_MIN = 12;

export type MemberApiError = { code: string; message: string; fieldErrors?: Record<string, string[]> };
export type MemberApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: MemberApiError };

const UNAVAILABLE: MemberApiError = { code: 'UNAVAILABLE', message: 'Sign-in isn’t available right now. Please try again in a moment.' };

export function membersConfigured(): boolean {
  return Boolean(process.env.MEMBER_API_URL && process.env.MEMBER_API_KEY);
}

/** One call to the members app; the member's address and browser go with it (its rate limits, audit log). */
export async function memberApi<T>(action: string, body: Record<string, unknown>, from?: { headers: Headers }): Promise<MemberApiResult<T>> {
  if (!membersConfigured()) {
    console.error('members: MEMBER_API_URL and MEMBER_API_KEY must be set');
    return { ok: false, status: 503, error: UNAVAILABLE };
  }
  const meta = from ? { ip: clientIp(from.headers), userAgent: from.headers.get('user-agent') || '' } : {};
  try {
    const res = await fetch(String(process.env.MEMBER_API_URL).replace(/\/+$/, '') + '/api/member-app/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.MEMBER_API_KEY },
      body: JSON.stringify(Object.assign({}, body, meta)),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000)
    });
    const json = await res.json().catch(function () { return null; });
    if (res.ok) return { ok: true, data: json as T };
    const error = json && json.error && typeof json.error.message === 'string' ? json.error as MemberApiError : UNAVAILABLE;
    // a wrong key or an unknown action is a setup problem, not the member's
    if (res.status >= 500 || (res.status === 401 && error.message.indexOf('API key') >= 0)) {
      console.error('members: ' + action + ' answered ' + res.status + ': ' + error.message);
      return { ok: false, status: res.status, error: UNAVAILABLE };
    }
    return { ok: false, status: res.status, error };
  } catch (e) {
    console.error('members: ' + action + ' failed:', (e as Error).message);
    return { ok: false, status: 502, error: UNAVAILABLE };
  }
}

export async function sessionToken(): Promise<string> {
  return (await cookies()).get(MEMBER_COOKIE)?.value || '';
}

export const cookieOptions = function (expires: Date) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', expires: expires };
};

/** Requests that change something come from this site's own pages (no posting from other sites). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch (e) { return false; }
}
