import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PlayAlbumButton } from '@/components/album/play-album-button';
import { TrackList } from '@/components/song/track-list';
import { withBasePath } from '@/lib/base-path';
import { formatTotalDuration, getPublicAlbum, toTrack } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const album = getPublicAlbum(id);
  if (!album) return { title: 'Album not found' };
  return { title: album.title, description: album.description ?? undefined };
}

export default async function AlbumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const album = getPublicAlbum(id);
  if (!album) notFound();

  const tracks = album.tracks.map((track) =>
    toTrack({ ...track, albumTitle: album.title, albumId: album.id }),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="pt-8">
        <Link
          href="/albums"
          className="nav-link text-[12px] text-ink-mute hover:text-ink"
        >
          ← 返回专辑列表
        </Link>
      </div>

      {/* 专辑头部 */}
      <section className="grid gap-8 py-10 sm:grid-cols-[280px_1fr] sm:gap-12 lg:grid-cols-[340px_1fr]">
        <div className="mx-auto w-full max-w-[340px]">
          <div className="aspect-square overflow-hidden bg-paper-deep shadow-[0_24px_60px_-24px_rgba(20,17,15,0.5)]">
            {album.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={withBasePath(album.coverUrl)}
                alt={album.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-display text-5xl text-ink-mute">
                  {album.title.slice(0, 1)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-end">
          <p className="text-[11px] tracking-[0.22em] text-ink-mute">专辑</p>
          <h1 className="font-display mt-3 text-3xl leading-tight text-ink sm:text-5xl">
            {album.title}
          </h1>
          <p className="mt-3 text-sm text-ink-soft">{album.artist}</p>

          <p className="mt-4 text-[12px] text-ink-mute">
            {album.releaseDate ? `${album.releaseDate.slice(0, 4)} · ` : ''}
            {String(album.trackCount).padStart(2, '0')} 首 ·{' '}
            {formatTotalDuration(album.totalDuration)}
          </p>

          {album.description && (
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-ink-soft">
              {album.description}
            </p>
          )}

          <div className="mt-7">
            <PlayAlbumButton tracks={tracks} />
          </div>
        </div>
      </section>

      {/* 曲目 */}
      <section className="border-t border-line/70 py-10">
        <h2 className="mb-4 text-[11px] tracking-[0.22em] text-ink-mute">曲目</h2>
        <TrackList tracks={tracks} fallbackCover={album.coverUrl} />
      </section>
    </div>
  );
}
