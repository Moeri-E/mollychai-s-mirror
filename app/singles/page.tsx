import { TrackList } from '@/components/song/track-list';
import { listPublicSongs, toTrack } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Singles' };

export default function SinglesPage() {
  const songs = listPublicSongs(500);
  const tracks = songs.map(toTrack);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <header className="pt-14 pb-8 sm:pt-20">
        <p className="text-[11px] tracking-[0.22em] text-ink-mute">单曲</p>
        <h1 className="font-display mt-3 text-4xl text-ink sm:text-5xl">每一首歌。</h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-soft">
          全部曲目，按上传时间倒序。想听整张专辑，回首页翻开封面。
        </p>
      </header>

      <section className="border-t border-line/70 py-8">
        <TrackList tracks={tracks} showAlbum />
      </section>
    </div>
  );
}
