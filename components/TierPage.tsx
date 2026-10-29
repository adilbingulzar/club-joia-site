import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader, Footer } from './SiteNav';
import { CJ_CONFIG as cfg } from '@/lib/config';
import Price from './Price';

function find(id: string) {
  const idx = cfg.tiers.findIndex(function (t) { return t.id === id; });
  return { idx: idx, tier: cfg.tiers[idx] };
}

export function tierMetadata(id: string): Metadata {
  const tier = find(id).tier;
  return { title: tier.name + ' Access | Club JOIA 300', description: tier.intro };
}

function Perks({ items, cls }: { items: string[]; cls?: string }) {
  return <ul className={'perks' + (cls ? ' ' + cls : '')}>{items.map(function (p) { return <li key={p}>{p}</li>; })}</ul>;
}

/* An access-level page, rendered from config. */
export default function TierPage({ id }: { id: string }) {
  const { idx, tier } = find(id);
  const prev = cfg.tiers[idx - 1];

  return (
    <>
      <PageHeader cta={{ href: '/tickets', label: 'Get your access', badge: true }} current={tier.id} />

      <main>
        <section className="wrap tier-hero">
          <img className="card-img" src={tier.card} alt={tier.name + ' membership card'} width="2000" height="1262" />
          <div>
            <p className="eyebrow">Access level &nbsp;|&nbsp; December 4, 5 &amp; 6</p>
            <h1><i className={'sw ' + tier.swatch}></i>{tier.name}</h1>
            <p className="lead">{tier.intro}</p>
            <p className="from" id="from">3-day access<strong><Price tier={tier.id} pkg="3-days" /></strong></p>
            <div className="btns">
              <Link className="btn" href={'/tickets#' + tier.id}>{'Book ' + tier.name}</Link>
              <span className="ltd">Limited access available</span>
            </div>
          </div>
        </section>

        <section className="band">
          <div className="wrap split">
            <div>
              <h2>Prices</h2>
              <ul className="price-list" id="price-list">
                {cfg.packages.map(function (p) {
                  return <li key={p.id}><div><b>{p.name}</b><small>{p.dates}</small></div><span><Price tier={tier.id} pkg={p.id} /></span></li>;
                })}
              </ul>
              <p className="note">Prices per guest. Choose your days and number of guests on the next page.</p>
            </div>
            <div>
              <h2>Benefits</h2>
              <div id="perks">
                {/* Benefits new to this tier, then the ones carried over from the tier below. */}
                {tier.newFrom ? (
                  <>
                    <div className="perk-group"><h3>{'Exclusive to ' + tier.name}</h3><Perks items={tier.perks.slice(tier.newFrom)} cls="new" /></div>
                    <div className="perk-group"><h3>{'Plus everything in ' + prev.name}</h3><Perks items={tier.perks.slice(0, tier.newFrom)} /></div>
                  </>
                ) : (
                  <div className="perk-group"><h3>Included</h3><Perks items={tier.perks} /></div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <h2>Compare other access levels</h2>
            <div className="others" id="others">
              {cfg.tiers.filter(function (t) { return t !== tier; }).map(function (t) {
                return <Link className="tier-link" href={t.page} key={t.id}><img src={t.card} alt="" width="2000" height="1262" loading="lazy" />
                  <div><b>{t.name}</b><small>{t.perks.length + ' benefits, 3 days '}<Price tier={t.id} pkg="3-days" /></small></div></Link>;
              })}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
