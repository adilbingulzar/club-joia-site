// The dashboard's top bar and small shared pieces (server components).
import Link from 'next/link';
import { logout } from '@/app/admin/actions';
import type { AdminUser } from '@/lib/admin/session';
import { statusOf } from '@/lib/admin/format';

export function TopBar({ user }: { user: AdminUser }) {
  return (
    <header className="adm-top">
      <div className="adm-wrap">
        <Link href="/admin" aria-label="Sales dashboard"><img src="/assets/img/logo.png" alt="Club JOIA 300" /></Link>
        <strong>Sales</strong>
        <div className="who">
          <span>{user.name} · {user.email}</span>
          <form action={logout}><button className="adm-btn" type="submit">Sign out</button></form>
        </div>
      </div>
    </header>
  );
}

// a status always shows its icon and label with its color
export function StatusBadge({ status }: { status: string }) {
  const s = statusOf(status);
  return (
    <span className="adm-status">
      <span className={'ic tone-' + s.tone} aria-hidden="true">{s.icon}</span>
      {s.label}
    </span>
  );
}

// the table view of a chart
export function TableView({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="adm-tv">
      <summary>Show as table</summary>
      <div className="adm-scroll">
        <table className="adm-table">
          <thead><tr>{head.map(function (h, i) { return <th key={h} className={i ? 'r' : ''}>{h}</th>; })}</tr></thead>
          <tbody>
            {rows.map(function (r, i) {
              return <tr key={i}>{r.map(function (c, j) { return <td key={j} className={j ? 'r num' : ''}>{c}</td>; })}</tr>;
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
