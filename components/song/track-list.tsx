'use client';

import { Pause, Play } from 'lucide-react';

import { formatTime, usePlayerActions, usePlayerState } from '@/components/player/player-provider';
import { withBasePath } from '@/lib/base-path';
import type { Track } from '@/lib/track';

type Props = {
  tracks: Track[];
  fallbackCover?: string | null;
  showAlbum?: boolean;
  compact?: boolean;
};

export function TrackList({ tracks, fallbackCover, showAlbum = false, compact = false }: Props) {
  const state = usePlayerState();
  const actions = usePlayerActions();

  if (tracks.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-mute">暂无曲目</p>;
  }

  return (
    <ol className="divide-y divide-line/70">
      {tracks.map((track, index) => {
        const isCurrent = state.current?.id === track.id;
        const isPlaying = isCurrent && state.playing;
        const cover = track.coverUrl ?? fallbackCover ?? null;

        return (
          <li key={track.id}>
            <button
              type="button"
              onClick={() => actions.playTrack(track, tracks)}
              className={`group flex w-full items-center gap-4 py-3 text-left transition ${
                isCurrent ? 'text-accent' : 'text-ink hover:text-ink'
              }`}
            >
              <span className="w-6 shrink-0 text-[11px] tabular-nums text-ink-mute">
                {String(index + 1).padStart(2, '0')}
              </span>

              {!compact && (
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-paper-deep">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={withBasePath(cover)} alt="" className="h-full w-full object-cover" />
                  ) : null}
                  <span
                    className={`absolute inset-0 flex items-center justify-center bg-ink/55 text-paper transition ${
                      isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isPlaying ? <Pause size={13} /> : <Play size={13} className="ml-[1px]" />}
                  </span>
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{track.title}</span>
                <span className="block truncate text-[11px] text-ink-mute">
                  {showAlbum && track.albumTitle ? track.albumTitle : track.artist}
                </span>
              </span>

              <span className="shrink-0 text-[11px] tabular-nums text-ink-mute">
                {formatTime(track.duration)}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
