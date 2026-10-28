'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { Cart, useCart, useHydrated } from '@/lib/cart';
import { CJ_CONFIG as cfg, money } from '@/lib/config';

function domId(id: string) { return id.replace('/', '--'); }

/*
 * Like the original site, the ticket blocks and order bar are drawn in the browser once the stored
 * cart is known, so a returning visitor never sees zero quantities first or the bar sliding in on load.
 */

export function TierBlocks() {
  const cart = useCart();
  const hydrated = useHydrated();
  const n = cart.count;

  // Blocks are rendered after hydration, so jump to #tier once they exist.
  useEffect(function () {
    const el = hydrated && location.hash && document.getElementById(location.hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'instant' });
  }, [hydrated]);

  function step(id: string, by: number) {
    Cart.set(id, Cart.get(id) + by);
  }

  if (!hydrated) return <div className="tier-blocks" id="tiers"></div>;

  return (
    <div className="tier-blocks" id="tiers">
      {cfg.tiers.map(function (tier) {
        const tickets = cfg.tickets.filter(function (t) { return t.tier === tier; });
        const selected = tickets.some(function (t) { return !t.soldOut && cart.get(t.id) > 0; });
        return (
          <section className={'tier-block' + (selected ? ' selected' : '')} id={tier.id} aria-labelledby={'h-' + tier.id} key={tier.id}>
            <div className="tier-block-head"><Link href={tier.page}><img src={tier.card} alt={tier.name + ' membership card'} width="2000" height="1262" loading="lazy" /></Link>
              <div><h2 id={'h-' + tier.id}><i className={'sw ' + tier.swatch}></i>{tier.name}</h2>
                <p>{tier.intro}</p>
                <Link className="link" href={tier.page}>{'See all ' + tier.perks.length + ' benefits \u2192'}</Link>
                {/* "Order now" buttons only work once something is selected. */}
                <Link className="btn order-now" href="/summary" aria-disabled={n > 0 ? 'false' : 'true'} tabIndex={n > 0 ? undefined : -1}>Order now</Link></div></div>
            <ul className="opts">
              {tickets.map(function (t) {
                const label = tier.name + ', ' + t.pkg.name;
                const q = cart.get(t.id);
                return (
                  <li className={'opt' + (!t.soldOut && q > 0 ? ' has-qty' : '')} id={'o-' + domId(t.id)} key={t.id}><div><b>{t.pkg.name}</b><small>{t.pkg.dates}</small></div>
                    <span className="price">{money(t.price)}</span>
                    {t.soldOut
                      ? <span className="soldout">Sold out</span>
                      : <div className="stepper" role="group" aria-label={'Number of ' + label + ' tickets'}>
                          <button type="button" data-id={t.id} data-step="-1" aria-label={'Remove one ' + label + ' ticket'} disabled={q <= 0} onClick={function () { step(t.id, -1); }}>&minus;</button>
                          <output id={'q-' + domId(t.id)} aria-live="polite">{q}</output>
                          <button type="button" data-id={t.id} data-step="1" aria-label={'Add one ' + label + ' ticket'} disabled={q >= cfg.maxPerTicket} onClick={function () { step(t.id, 1); }}>+</button>
                        </div>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function OrderBar() {
  const cart = useCart();
  const hydrated = useHydrated();
  const n = cart.count;
  if (!hydrated) return null;

  return (
    <div className={'order-bar' + (n > 0 ? ' show' : '')} id="order-bar" role="region" aria-label="Your order">
      <div className="wrap">
        <div>
          <small id="bar-count">{n + (n === 1 ? ' ticket' : ' tickets')}</small>
          <strong id="bar-total">{money(cart.total)}</strong>
        </div>
        <Link className="btn" href="/summary">Review order</Link>
      </div>
    </div>
  );
}
