'use client';

import { Play } from 'lucide-react';

import { usePlayerActions } from '@/components/player/player-provider';
import type { Track } from '@/lib/track';

export function PlayAlbumButton({ tracks }: { tracks: Track[] }) {
  const actions = usePlayerActions();

  if (tracks.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => actions.playTrack(tracks[0], tracks)}
      className="inline-flex items-center gap-2 border border-ink bg-ink px-5 py-2 text-[11px] tracking-[0.16em] text-paper uppercase transition hover:bg-transparent hover:text-ink"
    >
      <Play size={12} />
      play album
    </button>
  );
}
