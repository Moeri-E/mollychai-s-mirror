'use client';

import { usePathname } from 'next/navigation';

import { SiteNav } from '@/components/layout/site-nav';
import { GlobalPlayer } from '@/components/player/global-player';

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // 首页是沉浸式一屏布局：不放播放栏、不允许滚动
  const isImmersive = pathname === '/';
  const isAdmin = pathname.startsWith('/admin');

  const mainClass = isImmersive
    ? 'flex-1 overflow-hidden'
    : isAdmin
      ? 'flex-1'
      : 'flex-1 pb-28';

  return (
    <>
      <SiteNav />
      <main className={mainClass}>{children}</main>
      {!isImmersive && !isAdmin && <GlobalPlayer />}
    </>
  );
}
