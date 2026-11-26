import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter_Tight } from 'next/font/google';
import './member.tw.css';

// The members' pages (sign-in and /account): the members app's look and fonts (club-joia-300-backend src/app/layout.tsx).
const display = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--font-display-family', display: 'swap' });
const sans = Inter_Tight({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-sans-family', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'CLUB JOIA 300', template: '%s · CLUB JOIA 300' },
  robots: { index: false, follow: false },
  formatDetection: { telephone: false }
};

export default function MemberRootLayout({ children }: { children: React.ReactNode }) {
  return <div className={display.variable + ' ' + sans.variable + ' member-root'}>{children}</div>;
}
