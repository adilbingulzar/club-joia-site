// HTTP helpers of the shop's route handlers (app/Api/Eventsnew, app/shop).

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } });
}

export function notFound(text = 'Not found'): Response {
  return new Response(text, { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

// a form (urlencoded or multipart) or JSON body as text fields; {} when it can't be read
export async function readBody(request: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const type = request.headers.get('content-type') || '';
    if (/application\/json/.test(type)) {
      const body = await request.json();
      if (body && typeof body === 'object') {
        Object.keys(body).forEach(function (k) { if (typeof body[k] === 'string' || typeof body[k] === 'number') out[k] = String(body[k]); });
      }
      return out;
    }
    const text = await request.text();
    if (text.length > 100000) return out;
    if (/multipart\/form-data/.test(type)) {
      const form = await new Response(text, { headers: { 'Content-Type': type } }).formData();
      form.forEach(function (v, k) { if (typeof v === 'string') out[k] = v; });
      return out;
    }
    new URLSearchParams(text).forEach(function (v, k) { out[k] = v; });
  } catch {
    // an unreadable body counts as empty
  }
  return out;
}

// runs a handler, logging what goes wrong; fallback answers then
export async function guarded(what: string, run: () => Promise<Response>, fallback: () => Response): Promise<Response> {
  try {
    return await run();
  } catch (e) {
    console.error('[shop] ' + what + ':', e);
    return fallback();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; });
}

// the script tag of these pages: the Content-Security-Policy (proxy.ts) runs only inline scripts
// with this request's nonce (the x-nonce request header)
function scriptTag(nonce: string | null | undefined): string {
  return nonce ? '<script nonce="' + escapeHtml(nonce) + '">' : '<script>';
}

// a small page that takes the whole window (out of the frame) to the site's page
export function breakOut(url: string, nonce?: string | null): Response {
  const js = JSON.stringify(url).replace(/</g, '\\u003c');
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">' +
    '<title>Club JOIA 300</title></head><body style="background:#050505;color:#f5f3ee;font-family:sans-serif;text-align:center;padding:40px 16px">' +
    '<p>Checking your payment…</p><p><a style="color:inherit" target="_top" href="' + escapeHtml(url) + '">Continue</a></p>' +
    scriptTag(nonce) + '(function(){var u=' + js + ';try{window.top.location.replace(u);}catch(e){location.replace(u);}})();</script>' +
    '</body></html>';
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Next-Page': url } });
}

/*
 * The return page inside the bank check's frame (IFZA's guide, "Your return page"): tells the payment
 * page (/pay/<ref>, components/CardPayment.tsx, the top window, also when the gateway's page nests
 * frames) with postMessage, only to this site's own origin; that page asks the server for the status. A JSON text, which Telr's SDK on that page ignores.
 * Without a parent (a bank that left the frame) it goes on as the whole page: next = the same
 * address, which then checks the status itself.
 */
export const RETURN_MESSAGE = 'cj300-payment-return';

export function tellParent(ref: string, paymentId: string, wholePage: string, nonce?: string | null): Response {
  const msg = JSON.stringify(JSON.stringify({ type: RETURN_MESSAGE, ref, paymentId })).replace(/</g, '\\u003c');
  const next = JSON.stringify(wholePage).replace(/</g, '\\u003c');
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">' +
    '<title>Club JOIA 300</title></head><body style="background:#fff;color:#111;font-family:sans-serif;text-align:center;padding:40px 16px">' +
    '<p>Checking your payment…</p>' +
    scriptTag(nonce) + '(function(){if(window.top&&window.top!==window){window.top.postMessage(' + msg + ',location.origin);}' +
    'else{location.replace(' + next + ');}})();</script>' +
    '</body></html>';
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Return': 'frame' } });
}
