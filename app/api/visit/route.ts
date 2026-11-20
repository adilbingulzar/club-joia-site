// A page view, sent by the site's own pages (lib/visits.ts has what is saved). Always answers 204:
// a visitor's page never waits on or shows anything from this.
import { recordVisit } from '@/lib/visits';
import { clientIp } from '@/lib/ip-allowlist';

function done(): Response {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  // only from this site's own pages
  const origin = request.headers.get('origin');
  if (origin) {
    let same = false;
    try { same = new URL(origin).host === host; } catch { same = false; }
    if (!same) return done();
  }
  let body: Record<string, unknown> = {};
  try {
    // sent with navigator.sendBeacon as text, so no preflight
    const text = await request.text();
    if (text.length <= 5000) body = JSON.parse(text) || {};
  } catch { body = {}; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return done();

  try {
    await recordVisit({
      path: body.path, query: body.query, referrer: body.referrer, internal: body.internal,
      // the address nginx added (the last X-Forwarded-For entry), not one the visitor wrote
      ip: clientIp(request.headers),
      userAgent: (request.headers.get('user-agent') || '').slice(0, 500),
      host
    });
  } catch (e) {
    console.error('[visits]', (e as Error).message);
  }
  return done();
}
