/* "Download my data": the member's data as JSON (the members app's /api/me/export). */
import { call } from '@/member/server/api';

export async function GET(request: Request) {
  const r = await call('export');
  if (!r.ok) return Response.redirect(new URL(r.status === 401 ? '/login' : '/account/profile', request.url), 303);
  return new Response(JSON.stringify(r.data, null, 2), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="club-joia-300-my-data-' + new Date().toISOString().slice(0, 10) + '.json"'
    }
  });
}
