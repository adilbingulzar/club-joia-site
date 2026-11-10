/*
 * Sales dashboard: the website's ticket orders from the backend (club-joia-300-white, shop/admin.cjs).
 * One filter row scopes every figure, chart and the order list below it. Read only.
 */
import Link from 'next/link';
import { asAdmin, requireAdmin } from '@/lib/admin/auth';
import { adminGet, type OrderList, type Stats } from '@/lib/admin/backend';
import { backendQuery, isFiltered, pageQuery, PER_PAGE, previousPeriod, RANGES, readFilters, type Filters } from '@/lib/admin/filters';
import { change, count, dateTime, dayLabel, itemsText, money, percent, statusOf } from '@/lib/admin/format';
import { revenueSeries } from '@/lib/admin/series';
import { BarList, ColumnChart, SegmentedBar } from '@/components/admin/Charts';
import { StatusBadge, TableView, TopBar } from '@/components/admin/Shell';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// tier colors: the first three data colors, in tier order, the same whatever is filtered
const TIER_COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)'];
const COUNTRIES_SHOWN = 8;

function Delta({ now, before }: { now: number; before: number | undefined }) {
  if (before === undefined) return null;
  const c = change(now, before);
  if (!c) return <span className="adm-delta">no sales the period before</span>;
  return (
    <span className="adm-delta">
      <span className={'arrow ' + (c.up ? 'up' : 'down')} aria-hidden="true">{c.up ? '▲' : '▼'}</span>
      {c.text} vs the period before
    </span>
  );
}

function rangeText(f: Filters): string {
  const r = RANGES.find(function (x) { return x.id === f.range; })!;
  if (f.range === 'all') return 'All time';
  const dates = f.from && f.to ? (f.from === f.to ? dayLabel(f.from, true) : dayLabel(f.from) + ' – ' + dayLabel(f.to, true))
    : f.from ? 'from ' + dayLabel(f.from, true) : 'until ' + dayLabel(f.to, true);
  return f.range === 'custom' ? dates : r.label + ' (' + dates + ')';
}

function FilterRow({ f, stats }: { f: Filters; stats: Stats }) {
  const o = stats.options;
  return (
    <form className="adm-filters" method="get" action="/admin" aria-label="Filters">
      <label>Period
        <select name="range" defaultValue={f.range}>
          {RANGES.map(function (r) { return <option key={r.id} value={r.id}>{r.label}</option>; })}
        </select>
      </label>
      <label>From<input type="date" name="from" defaultValue={f.range === 'custom' ? f.from : ''} /></label>
      <label>To<input type="date" name="to" defaultValue={f.range === 'custom' ? f.to : ''} /></label>
      <label>Status
        <select name="status" defaultValue={f.status}>
          <option value="">All statuses</option>
          {o.statuses.map(function (s) { return <option key={s} value={s}>{statusOf(s).label}</option>; })}
        </select>
      </label>
      <label>Tier
        <select name="tier" defaultValue={f.tier}>
          <option value="">All tiers</option>
          {o.tiers.map(function (t) { return <option key={t.id} value={t.id}>{t.name}</option>; })}
        </select>
      </label>
      <label>Ticket
        <select name="product" defaultValue={f.product}>
          <option value="">All tickets</option>
          {o.products.map(function (p) { return <option key={p.id} value={p.id}>{p.name}</option>; })}
        </select>
      </label>
      <label>Country
        <select name="country" defaultValue={f.country}>
          <option value="">All countries</option>
          {o.countries.map(function (c) { return <option key={c} value={c}>{c}</option>; })}
        </select>
      </label>
      <label className="grow">Search<input type="search" name="q" defaultValue={f.q} placeholder="Order, name, email or phone" /></label>
      <div className="acts">
        <button className="adm-btn primary" type="submit">Apply</button>
        {isFiltered(f) && <Link className="adm-btn" href="/admin">Reset</Link>}
      </div>
    </form>
  );
}

export default async function AdminPage({ searchParams }: Props) {
  const user = await requireAdmin();
  const f = readFilters(await searchParams);
  const prev = previousPeriod(f);
  const [stats, before, list] = await asAdmin(function () {
    return Promise.all([
      adminGet<Stats>('stats?' + backendQuery(f), user),
      prev ? adminGet<Stats>('stats?' + backendQuery({ ...f, ...prev }), user) : Promise.resolve(null),
      adminGet<OrderList>('orders?' + backendQuery(f, { page: f.page, perPage: PER_PAGE }), user)
    ]);
  });
  if (!stats || !list) throw new Error('The backend has no sales data');

  const cur = stats.currency;
  const t = stats.totals;
  const b = before ? before.totals : undefined;
  const days = revenueSeries(stats.byDay, f.from, f.to);
  const products = stats.byProduct.filter(function (p) { return p.tickets > 0; }).sort(function (x, y) { return y.tickets - x.tickets || y.revenue - x.revenue; });
  const countries = stats.byCountry.slice(0, COUNTRIES_SHOWN);
  const otherCountries = stats.byCountry.slice(COUNTRIES_SHOWN);
  if (otherCountries.length) {
    countries.push({ country: 'Other (' + otherCountries.length + ')', orders: otherCountries.reduce(function (s, c) { return s + c.orders; }, 0), revenue: otherCountries.reduce(function (s, c) { return s + c.revenue; }, 0) });
  }
  const statuses = stats.byStatus;
  const pages = Math.max(1, Math.ceil(list.total / PER_PAGE));

  return (
    <>
      <TopBar user={user} />
      <main className="adm-wrap">
        <div className="adm-head">
          <div>
            <h1>Ticket sales</h1>
            <p>{rangeText(f)} · days and times in Dubai time (GST)</p>
          </div>
        </div>

        <FilterRow f={f} stats={stats} />

        <div className="adm-kpis">
          <div className="adm-tile lead">
            <div className="lbl">Revenue</div>
            <div className="val">{money(t.revenue, cur)}</div>
            <Delta now={t.revenue} before={b && b.revenue} />
            <div className="sub">paid orders only</div>
          </div>
          <div className="adm-tile">
            <div className="lbl">Paid orders</div>
            <div className="val">{count(t.paid)}</div>
            <Delta now={t.paid} before={b && b.paid} />
          </div>
          <div className="adm-tile">
            <div className="lbl">Tickets sold</div>
            <div className="val">{count(t.tickets)}</div>
            <Delta now={t.tickets} before={b && b.tickets} />
          </div>
          <div className="adm-tile">
            <div className="lbl">Average order</div>
            <div className="val">{money(t.average, cur)}</div>
            <Delta now={t.average} before={b && b.average} />
          </div>
          <div className="adm-tile">
            <div className="lbl">Paid of started</div>
            <div className="val">{percent(t.paid, t.orders)}</div>
            <div className="sub">{count(t.paid)} of {count(t.orders)} orders · {count(t.buyers)} buyers</div>
          </div>
        </div>

        <div className="adm-grid">
          <div className="adm-card wide">
            <div className="ch"><h2>Revenue by {days.length && days[0].from !== days[0].to ? 'week' : 'day'}</h2><p>{cur}, paid orders</p></div>
            {days.length && t.revenue > 0
              ? <ColumnChart label={'Revenue by day, ' + cur} as="money" currency={cur} points={days.map(function (d) {
                return { key: d.key, label: d.from === d.to ? d.label : d.label + ' – ' + dayLabel(d.to), value: d.revenue, detail: count(d.paid) + ' paid of ' + count(d.orders) + ' orders' };
              })} />
              : <p className="adm-empty">No paid orders in this period.</p>}
            <TableView head={['Day', 'Revenue (' + cur + ')', 'Paid orders', 'Orders']} rows={days.map(function (d) {
              return [d.from === d.to ? dayLabel(d.from, true) : dayLabel(d.from) + ' – ' + dayLabel(d.to, true), count(d.revenue), d.paid, d.orders];
            })} />
          </div>

          <div className="adm-card">
            <div className="ch"><h2>Tickets sold by ticket</h2><p>paid, with revenue</p></div>
            {products.length
              ? <BarList label="Tickets sold by ticket" as="count" currency={cur} rows={products.map(function (p) {
                return { key: p.id, label: p.name, value: p.tickets, detail: money(p.revenue, cur) };
              })} />
              : <p className="adm-empty">No tickets sold in this period.</p>}
            <TableView head={['Ticket', 'Price (' + cur + ')', 'Sold', 'Revenue (' + cur + ')']} rows={stats.byProduct.map(function (p) {
              return [p.name, count(p.price), p.tickets, count(p.revenue)];
            })} />
          </div>

          <div className="adm-card">
            <div className="ch"><h2>Revenue by membership tier</h2><p>share of paid revenue</p></div>
            <SegmentedBar label="Revenue by membership tier" as="money" currency={cur} parts={stats.byTier.map(function (x, i) {
              return { key: x.tier, label: x.name, value: x.revenue, detail: count(x.tickets) + ' tickets', color: TIER_COLORS[i % TIER_COLORS.length] };
            })} />
            <div className="adm-statuslist">
              {stats.byTier.map(function (x, i) {
                return (
                  <div key={x.tier}>
                    <span><span className="adm-key" style={{ background: TIER_COLORS[i % TIER_COLORS.length] }} />{x.name}</span>
                    <span className="adm-num adm-muted">{count(x.tickets)} tickets</span>
                    <span className="adm-num">{money(x.revenue, cur)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="adm-card">
            <div className="ch"><h2>Orders by status</h2><p>{count(t.orders)} orders</p></div>
            {t.orders > 0 && (
              <div className="adm-seg thin" aria-hidden="true">
                {statuses.filter(function (s) { return s.orders > 0; }).map(function (s) {
                  return <div key={s.status} className={'blk tone-' + statusOf(s.status).tone} style={{ flex: s.orders }} />;
                })}
              </div>
            )}
            <div className="adm-statuslist">
              {statuses.map(function (s) {
                return (
                  <div key={s.status}>
                    <Link href={'/admin' + pageQuery(f, { status: s.status, page: 1 })} style={{ textDecoration: 'none' }}><StatusBadge status={s.status} /></Link>
                    <span className="adm-num adm-muted">{money(s.amount, cur)}</span>
                    <span className="adm-num">{count(s.orders)} · {percent(s.orders, t.orders)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="adm-card">
            <div className="ch"><h2>Revenue by country</h2><p>paid orders, buyer’s country</p></div>
            {countries.length
              ? <BarList label="Revenue by country" as="money" currency={cur} rows={countries.map(function (c) {
                return { key: c.country, label: c.country, value: c.revenue, detail: count(c.orders) + (c.orders === 1 ? ' order' : ' orders') };
              })} />
              : <p className="adm-empty">No paid orders in this period.</p>}
            <TableView head={['Country', 'Paid orders', 'Revenue (' + cur + ')']} rows={stats.byCountry.map(function (c) { return [c.country, c.orders, count(c.revenue)]; })} />
          </div>

          <div className="adm-card wide">
            <div className="ch"><h2>Admissions sold</h2><p>tickets issued per day and extra, from paid orders</p></div>
            {stats.byTicketType.length
              ? <BarList label="Admissions sold" as="count" currency={cur} rows={stats.byTicketType.map(function (x) {
                return { key: x.code, label: x.name, value: x.tickets };
              })} />
              : <p className="adm-empty">No admissions sold in this period.</p>}
            <TableView head={['Admission', 'Code', 'Tickets']} rows={stats.byTicketType.map(function (x) { return [x.name, x.code, x.tickets]; })} />
          </div>

          <div className="adm-card wide">
            <div className="ch">
              <h2>Orders</h2>
              <a className="adm-btn" href={'/admin/export' + pageQuery(f, { page: 1 })} download>Export CSV</a>
            </div>
            {list.orders.length ? (
              <div className="adm-scroll">
                <table className="adm-table">
                  <thead>
                    <tr><th>Date</th><th>Order</th><th>Buyer</th><th>Country</th><th>Tickets</th><th className="r">Amount</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {list.orders.map(function (o) {
                      return (
                        <tr key={o.ref}>
                          <td className="num">{dateTime(o.createdAt)}</td>
                          <td><Link className="ref" href={'/admin/orders/' + encodeURIComponent(o.ref)}>{o.ref}</Link></td>
                          <td>{o.buyer.name}<div className="sm">{o.buyer.email}</div></td>
                          <td style={{ textTransform: 'capitalize' }}>{o.buyer.country}</td>
                          <td>{itemsText(o.items)}{o.error && <div className="sm">⚠ {o.error}</div>}</td>
                          <td className="r num">{money(o.amount, o.currency)}</td>
                          <td><StatusBadge status={o.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="adm-empty">No orders match these filters.</p>}
            <div className="adm-pager">
              <span>{list.total ? ((f.page - 1) * PER_PAGE + 1) + '–' + Math.min(f.page * PER_PAGE, list.total) + ' of ' + count(list.total) : '0 orders'}</span>
              <div className="acts">
                <Link className="adm-btn" aria-disabled={f.page <= 1} href={'/admin' + pageQuery(f, { page: f.page - 1 })}>Previous</Link>
                <Link className="adm-btn" aria-disabled={f.page >= pages} href={'/admin' + pageQuery(f, { page: f.page + 1 })}>Next</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
