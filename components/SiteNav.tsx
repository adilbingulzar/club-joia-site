import Link from 'next/link';
import CartCount from './CartCount';
import { CJ_CONFIG } from '@/lib/config';

export type Cta = { href: string; label: string; badge?: boolean };

/* Logo plus access-level links. `cta` is the pill button on the right; omit it for a logo-only nav. */
export default function SiteNav({ cta, current }: { cta?: Cta; current?: string }) {
  return (
    <nav>
      <Link className="logo" href="/" aria-label="Club JOIA 300 home"><Lockup /></Link>
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

/* The logo with its tagline underneath, spanning the logo's width. */
export function Lockup({ className }: { className?: string }) {
  return (
    <span className={'lockup' + (className ? ' ' + className : '')}>
      <img src="/assets/img/logo.png" alt="Club JOIA 300" />
      <span className="lockup-tag">The ultimate Grand Prix mega yacht experience</span>
    </span>
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

/* footer; `whatsapp` adds the floating WhatsApp button (icon and number) at the bottom right */
export function Footer({ whatsapp }: { whatsapp?: boolean } = {}) {
  return (
    <footer>
      {whatsapp && <WhatsAppButton />}
      <div className="wrap"><span>Club JOIA 300 | Abu Dhabi Grand Prix, December 4, 5 &amp; 6</span><span>WhatsApp <a href={CJ_CONFIG.whatsapp.link} target="_blank" rel="noopener">{CJ_CONFIG.whatsapp.number}</a></span><span>An Elixium Events production</span><small className="processed-by">Arrangement processed by tiqs.com/pleazz.nl/tiqs-me</small></div>
    </footer>
  );
}

/* The team's WhatsApp, always in view at the bottom right (above the tickets page's order bar). */
export function WhatsAppButton() {
  return (
    <a className="wa-float" href={CJ_CONFIG.whatsapp.link} target="_blank" rel="noopener" aria-label={'WhatsApp us on ' + CJ_CONFIG.whatsapp.number}>
      <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3C9 3 3.27 8.72 3.27 15.76c0 2.25.59 4.45 1.71 6.39L3.17 29l7.03-1.84a12.7 12.7 0 0 0 5.84 1.42h.01c7.03 0 12.76-5.72 12.76-12.76C28.81 8.72 23.08 3 16.04 3Zm0 23.42h-.01c-1.9 0-3.77-.51-5.4-1.48l-.39-.23-4.17 1.09 1.11-4.06-.25-.42a10.6 10.6 0 0 1-1.62-5.56c0-5.85 4.76-10.61 10.62-10.61 2.84 0 5.5 1.1 7.51 3.11a10.55 10.55 0 0 1 3.1 7.51c0 5.85-4.76 10.65-10.5 10.65Zm5.83-7.95c-.32-.16-1.88-.93-2.17-1.03-.29-.11-.5-.16-.71.16-.21.32-.82 1.03-1 1.24-.18.21-.37.24-.69.08-.32-.16-1.34-.49-2.56-1.57-.95-.84-1.59-1.88-1.77-2.2-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.98-2.34-.26-.62-.52-.53-.71-.54h-.61c-.21 0-.56.08-.85.4-.29.32-1.11 1.09-1.11 2.65s1.14 3.08 1.3 3.29c.16.21 2.24 3.42 5.43 4.8.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.88-.77 2.14-1.51.27-.74.27-1.38.19-1.51-.08-.13-.29-.21-.61-.37Z"/></svg>
      <span><small>WhatsApp us</small>{CJ_CONFIG.whatsapp.number}</span>
    </a>
  );
}
