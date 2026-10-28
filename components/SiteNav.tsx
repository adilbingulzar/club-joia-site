import Link from 'next/link';
import CartCount from './CartCount';

export type Cta = { href: string; label: string; badge?: boolean };

/* Logo plus access-level links. `cta` is the pill button on the right; omit it for a logo-only nav. */
export default function SiteNav({ cta, current }: { cta?: Cta; current?: string }) {
  return (
    <nav>
      <Link className="logo" href="/" aria-label="Club JOIA 300 home"><img src="/assets/img/logo.png" alt="Club JOIA 300" /></Link>
      {cta && (
        <div className="nav-links">
          <Link className="hide-sm" href="/ruby-red" aria-current={current === 'ruby-red' ? 'page' : undefined}>Ruby Red</Link>
          <Link className="hide-sm" href="/pearly-white" aria-current={current === 'pearly-white' ? 'page' : undefined}>Pearly White</Link>
          <Link className="hide-sm" href="/ultra-black" aria-current={current === 'ultra-black' ? 'page' : undefined}>Ultra Black</Link>
          <Link className="nav-cta" href={cta.href}>{cta.label}{cta.badge && <CartCount />}</Link>
        </div>
      )}
    </nav>
  );
}

/* Header bar used on every page except home. */
export function PageHeader(props: { cta?: Cta; current?: string }) {
  return (
    <header className="page-head">
      <div className="wrap">
        <SiteNav {...props} />
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="wrap"><span>Club JOIA 300 | Abu Dhabi Grand Prix, December 4, 5 &amp; 6</span><span>An Elixium Events production</span></div>
    </footer>
  );
}
