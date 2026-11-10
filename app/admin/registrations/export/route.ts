// The pre-registrations, searched as on the page, as a CSV file.
import { cookies } from 'next/headers';
import { adminGet, SignedOut, type Registrations } from '@/lib/admin/backend';
import { registrationsCsv } from '@/lib/admin/csv';
import { today } from '@/lib/admin/filters';
import { readSession, SESSION_COOKIE } from '@/lib/admin/session';

export async function GET(request: Request) {
  const user = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) return Response.redirect(new URL('/admin/login', request.url), 303);

  const q = String(new URL(request.url).searchParams.get('q') || '').slice(0, 100);
  try {
    const data = await adminGet<Registrations>('registrations' + (q ? '?q=' + encodeURIComponent(q) : ''), user);
    return new Response(registrationsCsv(data ? data.registrations : []), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="clubjoia300-preregistrations-' + today() + '.csv"',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    if (e instanceof SignedOut) return Response.redirect(new URL('/admin/login?expired=1', request.url), 303);
    console.error('admin registrations export:', e);
    return new Response('The pre-registrations can’t be exported right now.', { status: 502 });
  }
}
