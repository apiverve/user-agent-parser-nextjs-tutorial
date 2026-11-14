import type { Metadata, Viewport } from 'next';
import { Outfit, Source_Code_Pro } from 'next/font/google';
import './globals.css';

const sans = Outfit({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-sans' });
const mono = Source_Code_Pro({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'User Agent Parser | APIVerve Template',
  description: 'See the browser, OS and device behind any user agent string, or your own. An APIVerve template.'
};

export const viewport: Viewport = {
  themeColor: '#f3f0ff'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
