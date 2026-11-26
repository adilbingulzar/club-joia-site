/*
 * A stored file for the signed-in member: concierge attachments, event and programme images
 * (the members app's /api/files, through member/server/api.ts file()).
 *
 * The browser may keep a copy but asks again every time (no-cache): the member's session is checked
 * each time, so after signing out a shared phone shows nothing from its cache. A stored file never
 * changes (a new upload gets a new key), so the key is its ETag and a kept copy comes back as 304.
 */
import { file } from '@/member/server/api';

export async function GET(req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const key = (await ctx.params).key.join('/');
  if (!/^[A-Za-z0-9_\-./]{1,300}$/.test(key) || key.indexOf('..') >= 0) return new Response('Not found.', { status: 404 });
  const f = await file(key);
  if (!f) return new Response('Not found.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const etag = '"' + key + '"';
  const cache = { 'Cache-Control': 'private, no-cache', ETag: etag };
  if ((req.headers.get('if-none-match') || '').split(',').some(function (t) { return t.trim() === etag; })) {
    return new Response(null, { status: 304, headers: cache });
  }
  return new Response(f.body, {
    headers: Object.assign({}, cache, {
      'Content-Type': f.type,
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': f.type === 'application/pdf' ? 'attachment' : 'inline',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"
    })
  });
}
