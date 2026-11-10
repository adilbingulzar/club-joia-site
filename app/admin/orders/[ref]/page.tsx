// One order of the sales dashboard: buyer, tickets bought and issued, payment and member.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { asAdmin, requireAdmin } from '@/lib/admin/auth';
import { adminGet, type OrderDetail } from '@/lib/admin/backend';
import { count, dateTime, money } from '@/lib/admin/format';
import { StatusBadge, TopBar } from '@/components/admin/Shell';

type Props = { params: Promise<{ ref: string }> };

// Telr's order.status.code
const TELR: Record<number, string> = { 1: 'Pending', 2: 'Authorised (on hold)', 3: 'Paid', 4: 'Payment requested', [-1]: 'Expired', [-2]: 'Cancelled', [-3]: 'Declined', [-4]: 'Replaced' };

export default async function AdminOrderPage({ params }: Props) {
  const user = await requireAdmin();
  const ref = (await params).ref;
  const data = await asAdmin(function () { return adminGet<{ order: OrderDetail }>('orders/' + encodeURIComponent(ref), user); });
  if (!data) notFound();
  const o = data.order;
  const b = o.buyer;

  return (
    <>
      <TopBar user={user} />
      <main className="adm-wrap" style={{ paddingBottom: 40 }}>
        <Link className="adm-back" href="/admin">← All orders</Link>
        <div className="adm-head">
          <div>
            <h1>Order {o.ref}</h1>
            <p>{dateTime(o.createdAt)} (Dubai time)</p>
          </div>
          <StatusBadge status={o.status} />
        </div>

        {o.error && <p className="adm-note">⚠ Needs a look: {o.error}</p>}

        <div className="adm-grid">
          <div className="adm-card">
            <div className="ch"><h2>Buyer</h2></div>
            <dl className="adm-dl">
              <dt>Name</dt><dd>{b.name}</dd>
              <dt>Email</dt><dd><a href={'mailto:' + b.email}>{b.email}</a></dd>
              <dt>Phone</dt><dd>{b.mobile || '—'}</dd>
              <dt>Address</dt><dd>{[b.address, b.zipcode, b.city].filter(Boolean).join(', ') || '—'}</dd>
              <dt>Country</dt><dd style={{ textTransform: 'capitalize' }}>{b.country || '—'}</dd>
              {b.birthday ? <><dt>Birthday</dt><dd>{b.birthday}</dd></> : null}
              {b.gender ? <><dt>Gender</dt><dd style={{ textTransform: 'capitalize' }}>{b.gender === 'nogender' ? 'Not given' : b.gender}</dd></> : null}
            </dl>
          </div>

          <div className="adm-card">
            <div className="ch"><h2>Payment</h2></div>
            <dl className="adm-dl">
              <dt>Amount</dt><dd className="adm-num">{money(o.amount, o.currency)}</dd>
              <dt>Status</dt><dd><StatusBadge status={o.status} /></dd>
              <dt>Telr</dt><dd>{o.telr.ref ? o.telr.ref + (o.telr.status !== null ? ' · ' + (TELR[o.telr.status] || 'status ' + o.telr.status) : '') : 'Not sent to Telr'}</dd>
              <dt>Ordered</dt><dd>{dateTime(o.createdAt)}</dd>
              <dt>Paid</dt><dd>{o.paidAt ? dateTime(o.paidAt) : '—'}</dd>
              <dt>Tickets issued</dt><dd>{o.fulfilledAt ? dateTime(o.fulfilledAt) : '—'}</dd>
            </dl>
          </div>

          <div className="adm-card wide">
            <div className="ch"><h2>Tickets bought</h2></div>
            <div className="adm-scroll">
              <table className="adm-table">
                <thead><tr><th>Ticket</th><th className="r">Price</th><th className="r">Quantity</th><th className="r">Total</th></tr></thead>
                <tbody>
                  {o.items.map(function (i) {
                    return (
                      <tr key={i.productId}>
                        <td>{i.name}</td>
                        <td className="r num">{money(i.price, o.currency)}</td>
                        <td className="r num">{i.quantity}</td>
                        <td className="r num">{money(i.price * i.quantity, o.currency)}</td>
                      </tr>
                    );
                  })}
                  <tr><td colSpan={3}><strong>Total</strong></td><td className="r num"><strong>{money(o.amount, o.currency)}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="adm-card">
            <div className="ch"><h2>Member</h2></div>
            {o.member ? (
              <dl className="adm-dl">
                <dt>Membership no.</dt><dd>{o.member.number}</dd>
                <dt>Tier</dt><dd>{o.member.tier || '—'}</dd>
                <dt>Membership</dt><dd style={{ textTransform: 'capitalize' }}>{(o.member.membership || '—').toLowerCase()}</dd>
                <dt>Account</dt><dd>{o.member.account === 'PENDING_ACTIVATION' ? 'Not activated yet' : o.member.account === 'ACTIVE' ? 'Active' : 'Disabled'}</dd>
              </dl>
            ) : <p className="adm-empty">{o.status === 'paid' ? 'Not made yet.' : 'Made once the order is paid.'}</p>}
          </div>

          <div className="adm-card">
            <div className="ch"><h2>Tickets issued</h2><p>{count(o.ticketList.length)}</p></div>
            {o.ticketList.length ? (
              <div className="adm-scroll">
                <table className="adm-table">
                  <thead><tr><th>Ticket number</th><th>Admission</th><th>Status</th></tr></thead>
                  <tbody>
                    {o.ticketList.map(function (t) {
                      return <tr key={t.number}><td className="num">{t.number}</td><td>{t.name}</td><td style={{ textTransform: 'capitalize' }}>{t.status.toLowerCase()}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="adm-empty">{o.status === 'paid' ? 'None issued yet.' : 'Issued once the order is paid.'}</p>}
          </div>
        </div>
      </main>
    </>
  );
}
