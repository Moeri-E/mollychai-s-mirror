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
    '一个个人音乐档案馆。专辑、单曲与记忆，像唱片架一样被妥善收好。',
  openGraph: {
    title: SITE_NAME,
    description: SITE_TAGLINE,
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="paper-grain min-h-screen bg-paper text-ink antialiased">
        {/* 首屏之前确定主题，避免深色用户看到白屏闪烁 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('mm_theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();",
          }}
        />
        <PlayerProvider>
          <SiteNav />
          <main className="relative z-10 pb-28">{children}</main>
          <GlobalPlayer />
        </PlayerProvider>
      </body>
    </html>
  );
}
