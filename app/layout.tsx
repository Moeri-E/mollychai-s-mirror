import type { Metadata } from 'next';

// 主标题字体：自托管，不走 Google Fonts（国内访问不通）
import '@fontsource/great-vibes/400.css';

import { PlayerProvider } from '@/components/player/player-provider';
import { SiteShell } from '@/components/site-shell';
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
      <body className="paper-grain flex min-h-screen flex-col bg-paper text-ink antialiased">
        {/* 首屏之前确定主题，避免深色用户看到白屏闪烁 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('mm_theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();",
          }}
        />
        <PlayerProvider>
          <SiteShell>{children}</SiteShell>
        </PlayerProvider>
      </body>
    </html>
  );
}
