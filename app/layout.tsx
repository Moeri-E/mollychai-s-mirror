import type { Metadata } from 'next';

import { GlobalPlayer } from '@/components/player/global-player';
import { PlayerProvider } from '@/components/player/player-provider';
import { SiteNav } from '@/components/layout/site-nav';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/constants';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    'A personal music archive. Albums, singles and memories, kept like a shelf of records.',
  openGraph: {
    title: SITE_NAME,
    description: SITE_TAGLINE,
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="paper-grain min-h-screen bg-paper text-ink antialiased">
        <PlayerProvider>
          <SiteNav />
          <main className="relative z-10 pb-28">{children}</main>
          <GlobalPlayer />
        </PlayerProvider>
      </body>
    </html>
  );
}
