import Link from 'next/link';

import { CoverFlow } from '@/components/album/cover-flow';
import { listPublicAlbums } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const albums = listPublicAlbums();

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
    // main 是纵向 flex 容器（见 SiteShell）：标题占固定高度，
    // Cover Flow 吃掉剩余空间，卡片尺寸由它按这块空间反算，保证一屏不滚动
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
      {/* z-10 必须加：墙面渐变是 z-index:0 的定位元素，按层叠顺序会盖在
          静态排版的标题之上，把文字整体压暗 */}
      <div className="relative z-10 shrink-0 pt-5 pb-1 text-center sm:pt-7">
        <h1 className="wordmark">mollychai&rsquo;s mirror</h1>
      </div>
      <div className="relative min-h-0 flex-1">
        <CoverFlow albums={albums} minimal />
      </div>
    </div>
  );
}
