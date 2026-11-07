import Link from 'next/link';

import { CoverFlow } from '@/components/album/cover-flow';
import { listPublicAlbums } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const albums = listPublicAlbums();

  if (albums.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-28 text-center sm:px-6">
        <h1 className="font-display text-2xl text-ink">还没有专辑</h1>
        <p className="mt-3 text-sm text-ink-soft">通过管理后台上传第一张专辑。</p>
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
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <h1 className="sr-only">mollychai&rsquo;s mirror — 唱片档案</h1>

      <section className="pt-8 sm:pt-10">
        <CoverFlow albums={albums} />
      </section>
    </div>
  );
}
