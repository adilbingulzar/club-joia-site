/*
 * The event's programme without personal or restricted items (the members app's /api/events/<slug>/programme),
 * which the service worker (public/member-sw.js) keeps for reading offline (app/(member)/offline).
 */
import { call } from '@/member/server/api';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const r = await call('public-programme', { slug: slug.slice(0, 200) });
  if (!r.ok) return Response.json({ error: r.error.message }, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
  return Response.json(r.data, { headers: { 'Cache-Control': 'private, no-cache' } });
}
