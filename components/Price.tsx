import { Suspense } from 'react';
import { getCatalog, priceText } from '@/lib/catalog';

async function PriceValue({ tier, pkg }: { tier: string; pkg: string }) {
  return <>{priceText(await getCatalog(), tier, pkg)}</>;
}

/* A ticket price from Alfred for server components, a shimmering bar until Alfred has answered. */
export default function Price({ tier, pkg }: { tier: string; pkg: string }) {
  return (
    <Suspense fallback={<i className="sk-line" role="img" aria-label="Loading price"></i>}>
      <PriceValue tier={tier} pkg={pkg} />
    </Suspense>
  );
}
