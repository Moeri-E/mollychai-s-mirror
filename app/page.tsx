import Link from 'next/link';

import { CoverFlow } from '@/components/album/cover-flow';
import { TrackList } from '@/components/song/track-list';
import { getSetting } from '@/lib/auth';
import { listPublicAlbums, listPublicSongs, toTrack } from '@/lib/catalog';
import { SITE_TAGLINE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const albums = listPublicAlbums();
  const recent = listPublicSongs(6);
  const heroTitle = getSetting('hero_title') ?? 'The album archive.';
  const heroSubtitle = getSetting('hero_subtitle') ?? SITE_TAGLINE;

  const tracks = recent.map(toTrack);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section className="pt-14 pb-10 sm:pt-20">
        <p className="rise-in text-[10px] tracking-[0.34em] text-ink-mute uppercase">
          personal sound archive
        </p>
        <h1 className="rise-in rise-in-1 font-display mt-4 max-w-3xl text-[2.6rem] leading-[1.05] text-ink sm:text-6xl">
          {heroTitle}
        </h1>
        <p className="rise-in rise-in-2 mt-5 max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">
          {heroSubtitle}
        </p>
        <div className="rise-in rise-in-3 mt-7 flex items-center gap-4 text-[11px] tracking-[0.16em] uppercase">
          <Link
            href="/albums"
            className="border border-ink bg-ink px-5 py-2 text-paper transition hover:bg-transparent hover:text-ink"
          >
            Browse albums
          </Link>
          <Link href="/singles" className="nav-link text-ink-soft hover:text-ink">
            Latest singles
          </Link>
        </div>
      </section>

      {/* Cover Flow */}
      {albums.length > 0 ? (
        <section className="border-t border-line/70 py-12">
          <div className="mb-8 flex items-baseline justify-between">
            <h2 className="text-[10px] tracking-[0.3em] text-ink-mute uppercase">the archive</h2>
            <Link href="/albums" className="nav-link text-[11px] tracking-[0.14em] text-ink-soft">
              ALL {albums.length} ALBUMS
            </Link>
          </div>
          <CoverFlow albums={albums} />
        </section>
      ) : (
        <section className="border-t border-line/70 py-16 text-center">
          <p className="font-display text-2xl text-ink">还没有专辑</p>
          <p className="mt-3 text-sm text-ink-soft">
            通过管理后台上传，或用智能体令牌调用上传接口。
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-block border border-ink px-5 py-2 text-[11px] tracking-[0.16em] uppercase transition hover:bg-ink hover:text-paper"
          >
            进入管理后台
          </Link>
        </section>
      )}

      {/* 最新单曲 */}
      {tracks.length > 0 && (
        <section className="border-t border-line/70 py-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[10px] tracking-[0.3em] text-ink-mute uppercase">recently added</h2>
            <Link href="/singles" className="nav-link text-[11px] tracking-[0.14em] text-ink-soft">
              ALL SINGLES
            </Link>
          </div>
          <TrackList tracks={tracks} showAlbum compact={false} />
        </section>
      )}
    </div>
  );
}
