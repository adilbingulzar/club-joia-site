import { Suspense } from 'react';
import { getCatalog, priceText } from '@/lib/catalog';

// the dirham is pegged to the dollar
const AED_PER_USD = 3.6725;

async function PriceValue({ tier, pkg, aed }: { tier: string; pkg: string; aed?: boolean }) {
  const catalog = await getCatalog();
  const t = catalog.tickets[tier + '/' + pkg];
  const inAed = aed && catalog.live && catalog.currency === 'USD' && t && t.price !== null
    ? 'AED ' + Math.round(t.price * AED_PER_USD).toLocaleString('en-US') : null;
  return <>{priceText(catalog, tier, pkg)}{inAed && <small className="aed">{inAed}</small>}</>;
}

/* A ticket price from the shop for server components, a shimmering bar until it has answered.
   `aed` adds the price in dirhams underneath when the shop sells in dollars. */
export default function Price({ tier, pkg, aed }: { tier: string; pkg: string; aed?: boolean }) {
  return (
    <Suspense fallback={<i className="sk-line" role="img" aria-label="Loading price"></i>}>
      <PriceValue tier={tier} pkg={pkg} aed={aed} />
    </Suspense>
  );
}
