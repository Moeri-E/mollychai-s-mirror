import Link from 'next/link';

import { CoverFlow } from '@/components/album/cover-flow';
import { listPublicAlbumsWithTracks } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const albums = listPublicAlbumsWithTracks();

  if (albums.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="wordmark">mollychai&rsquo;s mirror</h1>
        <p className="mt-4 text-sm text-ink-soft">还没有专辑，通过管理后台上传第一张。</p>
        <Link
          href="/admin"
          className="mt-6 inline-block border border-ink px-5 py-2 text-[13px] transition hover:bg-ink hover:text-paper"
        >
          进入管理后台
        </Link>
      </div>
    );
  }

  return (
    // main 是纵向 flex 容器（见 SiteShell），这里让它占满剩余高度。
    // 标题交给 CoverFlow 渲染：它要按标题高度与卡片高度统一分配垂直空间，
    // 这样标题才能精确居中在「页面顶部 → 卡片顶部」之间。
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
      <div className="relative min-h-0 flex-1">
        <CoverFlow
          albums={albums}
          title={<h1 className="wordmark">mollychai&rsquo;s mirror</h1>}
        />
      </div>
    </div>
  );
}
