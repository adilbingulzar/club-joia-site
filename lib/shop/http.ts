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
