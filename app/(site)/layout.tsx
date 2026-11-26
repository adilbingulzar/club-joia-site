import './globals.css';
import { getCatalog } from '@/lib/catalog';
import { CatalogProvider } from '@/lib/prices';
import Tracking from '@/components/Tracking';

// The site's pages (the members' pages have their own layout and styles: app/(member)).
// Prices come from the ticket shop (lib/catalog); the catalogue is handed over unresolved, the page doesn't wait for it.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const catalog = getCatalog();
  return <><CatalogProvider catalog={catalog}>{children}</CatalogProvider><Tracking /></>;
}
