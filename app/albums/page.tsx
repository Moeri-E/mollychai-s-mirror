import Link from 'next/link';

import { CoverFlow } from '@/components/album/cover-flow';
import { formatTotalDuration, listPublicAlbums } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Albums' };

export default function AlbumsPage() {
  const albums = listPublicAlbums();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <header className="pt-14 pb-8 sm:pt-20">
        <p className="text-[11px] tracking-[0.22em] text-ink-mute">收藏</p>
        <h1 className="font-display mt-3 text-4xl text-ink sm:text-5xl">唱片档案。</h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-soft">
          拖动、滚轮或方向键翻阅唱片。点击当前封面进入专辑。
        </p>
      </header>

      <section className="border-t border-line/70 pt-10">
        <CoverFlow albums={albums} />
      </section>

      {albums.length > 0 && (
        <section className="border-t border-line/70 py-12">
          <h2 className="mb-6 text-[11px] tracking-[0.22em] text-ink-mute">全部专辑</h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
            {albums.map((album) => (
              <Link key={album.id} href={`/albums/${album.id}`} className="group block">
                <div className="aspect-square overflow-hidden bg-paper-deep">
                  {album.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={album.coverUrl}
                      alt={album.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="font-display text-3xl text-ink-mute">
                        {album.title.slice(0, 1)}
                      </span>
                    </div>
                  )}
                </div>
                <h3 className="mt-3 text-sm text-ink transition group-hover:text-accent">
                  {album.title}
                </h3>
                <p className="mt-0.5 text-[11px] text-ink-mute">
                  {album.artist}
                  {album.releaseDate ? ` · ${album.releaseDate.slice(0, 4)}` : ''}
                </p>
                <p className="mt-1 text-[11px] text-ink-mute">
                  {album.trackCount} 首 · {formatTotalDuration(album.totalDuration)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
