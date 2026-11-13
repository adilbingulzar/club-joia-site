// The pre-registration form (public/preregister/index.html, assets/app.js): POST, JSON reply.
// lib/preregister.ts has the checks, saving and emails.
import { preregister } from '@/lib/preregister';
import { readBody } from '@/lib/shop/http';
import { clientIp } from '@/lib/ip-allowlist';

function reply(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  // Only from this site's own page.
  const origin = request.headers.get('origin');
  if (origin) {
    let same = false;
    try { same = new URL(origin).host === (request.headers.get('x-forwarded-host') || request.headers.get('host')); } catch { same = false; }
    if (!same) return reply(403, { ok: false, error: 'Please submit the form from the CLUB JOIA 300 website.' });
  }
  const r = await preregister({
    form: await readBody(request),
    // the address nginx added (the last X-Forwarded-For entry), not one the visitor wrote
    ip: clientIp(request.headers),
    userAgent: request.headers.get('user-agent') || ''
  });
  return reply(r.status, r.body);
}
