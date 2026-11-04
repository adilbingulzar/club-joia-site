/*
 * Server side calls to Alfred.
 * Alfred has no CORS headers, so the browser can't call it directly.
 */
export const ALFRED_URL = (process.env.ALFRED_URL || '').replace(/\/+$/, '');
export const EVENT_ID = process.env.ALFRED_EVENT_ID || '';
export const VENDOR_ID = process.env.ALFRED_VENDOR_ID || '';

export async function alfred(path: string, data: Record<string, string>, timeoutMs = 20000) {
  const r = await fetch(ALFRED_URL + '/' + path, {
    method: 'POST',
    body: new URLSearchParams(data),
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!r.ok) throw new Error('Alfred ' + path + ': HTTP ' + r.status);
  return r.json();
}
