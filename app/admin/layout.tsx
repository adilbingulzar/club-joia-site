import type { Metadata } from 'next';
import './admin.css';

// The sales dashboard: staff only, never in search results.
export const metadata: Metadata = {
  title: 'Sales | Club JOIA 300',
  robots: { index: false, follow: false }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="adm">{children}</div>;
}
