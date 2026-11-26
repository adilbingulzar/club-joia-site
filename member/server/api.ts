/*
 * The member's pages and forms (app/(member)/account): one call to the members app for each
 * (club-joia-300-backend src/services/member-app.service.ts), with the session cookie's token.
 * Its answers come back as the members app's own pages get them: dates are Date again, and its
 * file links (/api/files/...) point at this site's /account/files/... (app/(member)/account/files).
 */
import 'server-only';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { clientIp } from '@/lib/ip-allowlist';
import { membersConfigured, sessionToken } from '@/lib/members';
import type { ActionError, ActionResult } from '@/member/lib/errors';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function revive(_key: string, value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (ISO.test(value)) return new Date(value);
  if (value.startsWith('/api/files/')) return '/account/files/' + value.slice('/api/files/'.length);
  return value;
}

type Answer = { ok: true; data: unknown } | { ok: false; status: number; error: ActionError };

const UNAVAILABLE: ActionError = { code: 'UNEXPECTED', message: 'Club JOIA can’t be reached right now. Please try again in a moment.' };

/** One call; fields are the form's or the page's input, file a form's attachment. */
export async function call(action: string, fields: Record<string, unknown> = {}, file?: File | null): Promise<Answer> {
  if (!membersConfigured()) return { ok: false, status: 503, error: UNAVAILABLE };
  const h = await headers();
  const session = await sessionToken();
  if (!session) return { ok: false, status: 401, error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } };
  const meta = { ip: clientIp(h), userAgent: h.get('user-agent') || '' };
  let body: BodyInit;
  const head: Record<string, string> = { Authorization: 'Bearer ' + process.env.MEMBER_API_KEY };
  if (file) {
    const form = new FormData();
    form.set('session', session); form.set('ip', meta.ip); form.set('userAgent', meta.userAgent);
    for (const [k, v] of Object.entries(fields)) if (typeof v === 'string') form.set(k, v);
    form.set('attachment', file);
    body = form;
  } else {
    head['Content-Type'] = 'application/json';
    body = JSON.stringify(Object.assign({ session: session, fields: fields }, meta));
  }
  try {
    const res = await fetch(String(process.env.MEMBER_API_URL).replace(/\/+$/, '') + '/api/member-app/' + action, {
      method: 'POST', headers: head, body: body, cache: 'no-store', signal: AbortSignal.timeout(20000)
    });
    const text = await res.text();
    const json = text ? JSON.parse(text, revive) : null;
    if (res.ok) return { ok: true, data: json ? json.data : null };
    const error = json && json.error && typeof json.error.message === 'string' ? json.error as ActionError : UNAVAILABLE;
    if (res.status >= 500 || (res.status === 401 && error.message.indexOf('API key') >= 0)) {
      console.error('member api: ' + action + ' answered ' + res.status + ': ' + error.message);
      return { ok: false, status: res.status, error: UNAVAILABLE };
    }
    return { ok: false, status: res.status, error: error };
  } catch (e) {
    console.error('member api: ' + action + ' failed:', (e as Error).message);
    return { ok: false, status: 502, error: UNAVAILABLE };
  }
}

/** A page's data: signed out goes to /login, not found to the 404 page, anything else is an error page. */
export async function page<T>(action: string, fields: Record<string, unknown> = {}): Promise<T> {
  const r = await call(action, fields);
  if (r.ok) return r.data as T;
  if (r.status === 401) redirect('/login');
  if (r.status === 404) notFound();
  throw new Error(r.error.message);
}

/** A form's result, as the members app's actions give it (ActionResult). */
export async function form<T>(action: string, fields: Record<string, unknown> = {}, file?: File | null): Promise<ActionResult<T>> {
  const r = await call(action, fields, file);
  if (r.ok) return { ok: true, data: r.data as T };
  if (r.status === 401) redirect('/login');
  return { ok: false, error: r.error };
}

/** A FormData's text fields (a file is sent apart). */
export function fieldsOf(data: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of data.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

/** The stored file for /account/files/<key>, or null. */
export async function file(key: string): Promise<{ type: string; body: ArrayBuffer } | null> {
  if (!membersConfigured()) return null;
  const h = await headers();
  const session = await sessionToken();
  if (!session) return null;
  try {
    const res = await fetch(String(process.env.MEMBER_API_URL).replace(/\/+$/, '') + '/api/member-app/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.MEMBER_API_KEY },
      body: JSON.stringify({ session: session, key: key, ip: clientIp(h), userAgent: h.get('user-agent') || '' }),
      cache: 'no-store', signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) return null;
    return { type: res.headers.get('content-type') || 'application/octet-stream', body: await res.arrayBuffer() };
  } catch (e) {
    console.error('member api: file failed:', (e as Error).message);
    return null;
  }
}
