'use client';

import { usePathname } from 'next/navigation';

import { SiteNav } from '@/components/layout/site-nav';
import { GlobalPlayer } from '@/components/player/global-player';

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // 首页是沉浸式一屏布局：不放播放栏、不允许滚动
  const isImmersive = pathname === '/';
  const isAdmin = pathname.startsWith('/admin');

  // 首页直接让 main 成为 flex 纵向容器：
  // 子元素上的 h-full（height: 100%）在 flex item 里不一定能解析出高度，
  // 会导致内容贴顶、看起来"太靠上"。
  // 纵向排列是为了让主标题与 Cover Flow 各自占据确定的高度：
  // 标题 shrink-0，Cover Flow 用 flex-1 吃掉剩余空间，卡片再按这块空间反算尺寸。
  const mainClass = isImmersive
    ? 'flex flex-1 flex-col overflow-hidden'
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
