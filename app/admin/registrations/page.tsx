// The pre-registration page's sign-ups (public/preregister), read only, with search and CSV.
import Link from 'next/link';
import { asAdmin, requireAdmin } from '@/lib/admin/auth';
import { adminGet, type Registrations } from '@/lib/admin/backend';
import { count, dateTime } from '@/lib/admin/format';
import { TopBar } from '@/components/admin/Shell';

const TIERS = ['Ruby Red', 'Pearly White', 'Ultra Black', 'Not sure yet'];

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export default async function AdminRegistrationsPage({ searchParams }: Props) {
  const user = await requireAdmin();
  const q = String((await searchParams).q || '').slice(0, 100);
  const data = (await asAdmin(function () {
    return adminGet<Registrations>('registrations' + (q ? '?q=' + encodeURIComponent(q) : ''), user);
  })) || { total: 0, byTier: {}, registrations: [] };

  return (
    <>
      <TopBar user={user} active="registrations" />
      <main className="adm-wrap" style={{ paddingBottom: 40 }}>
        <div className="adm-head">
          <div>
            <h1>Pre-registrations</h1>
            <p>{count(data.total)} in total{TIERS.filter(function (t) { return data.byTier[t]; }).map(function (t) { return ' · ' + t + ': ' + count(data.byTier[t]); }).join('')}</p>
          </div>
          <a className="adm-btn" href={'/admin/registrations/export' + (q ? '?q=' + encodeURIComponent(q) : '')} download>Download CSV</a>
        </div>

        <form className="adm-filters" method="get" action="/admin/registrations" aria-label="Search">
          <label className="grow">Search<input type="search" name="q" defaultValue={q} placeholder="Name, email, phone or country" /></label>
          <div className="acts">
            <button className="adm-btn primary" type="submit">Search</button>
            {q && <Link className="adm-btn" href="/admin/registrations">Reset</Link>}
          </div>
        </form>

        <div className="adm-card wide">
          {data.registrations.length ? (
            <div className="adm-scroll">
              <table className="adm-table">
                <thead>
                  <tr><th>Registered</th><th>Name</th><th>Mobile</th><th>Country</th><th>Interest</th><th>Heard about us</th><th>Message</th><th>Marketing</th></tr>
                </thead>
                <tbody>
                  {data.registrations.map(function (r) {
                    return (
                      <tr key={r.email}>
                        <td className="num">{dateTime(r.createdAt)}{r.updatedAt !== r.createdAt && <div className="sm">updated {dateTime(r.updatedAt)}</div>}</td>
                        <td>{r.firstName} {r.lastName}<div className="sm"><a href={'mailto:' + r.email}>{r.email}</a></div></td>
                        <td className="num">{r.phone}</td>
                        <td>{r.country}</td>
                        <td>{r.tier}</td>
                        <td>{r.source || '—'}</td>
                        <td style={{ whiteSpace: 'pre-wrap', maxWidth: 280 }}>{r.message || '—'}</td>
                        <td>{r.marketing ? 'Yes' : 'No'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="adm-empty">{q ? 'No pre-registrations match this search.' : 'No pre-registrations yet.'}</p>}
        </div>
      </main>
    </>
  );
}
