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
        <p className="text-[10px] tracking-[0.34em] text-ink-mute uppercase">singles</p>
        <h1 className="font-display mt-3 text-4xl text-ink sm:text-5xl">Every single thing.</h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-soft">
          不属于任何专辑，也值得被记住的碎片。
        </p>
      </header>

      <section className="border-t border-line/70 py-8">
        <TrackList tracks={tracks} showAlbum />
      </section>
    </div>
  );
}
