'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AlbumCard } from '@/lib/catalog';

type Props = {
  albums: AlbumCard[];
  initialIndex?: number;
};

const CARD_OFFSET = 0.62; // 相邻卡片的水平位移占卡宽比例

export function CoverFlow({ albums, initialIndex = 0 }: Props) {
  const router = useRouter();
  const [active, setActive] = useState(Math.min(initialIndex, Math.max(albums.length - 1, 0)));
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const pointerStart = useRef<number | null>(null);
  const dragDistance = useRef(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wheelLock = useRef(0);

  const clamp = useCallback(
    (index: number) => Math.max(0, Math.min(index, albums.length - 1)),
    [albums.length],
  );

  const go = useCallback((delta: number) => setActive((prev) => clamp(prev + delta)), [clamp]);

  // 键盘左右切换
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const onPointerDown = (event: React.PointerEvent) => {
    pointerStart.current = event.clientX;
    dragDistance.current = 0;
    setDragging(true);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (pointerStart.current === null) return;
    const delta = event.clientX - pointerStart.current;
    dragDistance.current = Math.abs(delta);
    setDragX(delta);
  };

  const finishDrag = () => {
    if (pointerStart.current === null) return;
    const threshold = 70;
    const distance = dragX;
    pointerStart.current = null;
    setDragX(0);
    setDragging(false);

    if (distance <= -threshold) go(1);
    else if (distance >= threshold) go(-1);
  };

  const onWheel = (event: React.WheelEvent) => {
    const now = Date.now();
    if (now - wheelLock.current < 320) return;
    if (Math.abs(event.deltaX) < 12 && Math.abs(event.deltaY) < 12) return;
    wheelLock.current = now;
    const direction = (event.deltaX || event.deltaY) > 0 ? 1 : -1;
    go(direction);
  };

  if (albums.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center border border-dashed border-line text-sm text-ink-mute">
        还没有公开的专辑
      </div>
    );
  }

  return (
    <div className="select-none">
      <div
        ref={containerRef}
        className="coverflow-viewport relative mx-auto h-[300px] overflow-hidden sm:h-[340px]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onPointerLeave={() => pointerStart.current !== null && finishDrag()}
        onWheel={onWheel}
        role="group"
        aria-roledescription="carousel"
        aria-label="专辑滑动展示"
      >
        {albums.map((album, index) => {
          const offset = index - active;
          const distance = Math.abs(offset);
          const isActive = offset === 0;

          const translateX = offset * 168 + dragX * 0.55;
          const rotateY = offset === 0 ? 0 : offset > 0 ? -38 : 38;
          const translateZ = -Math.min(distance, 4) * 130;
          const scale = isActive ? 1 : Math.max(0.74, 1 - distance * 0.07);
          const opacity = isActive ? 1 : Math.max(0.28, 1 - distance * 0.26);

          return (
            <button
              type="button"
              key={album.id}
              onClick={() => {
                if (dragDistance.current > 8) return;
                if (isActive) {
                  router.push(`/albums/${album.id}`);
                } else {
                  setActive(index);
                }
              }}
              className="cover-card absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 sm:h-[280px] sm:w-[280px]"
              style={{
                transform: `translate(-50%, -50%) translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                opacity,
                zIndex: 100 - distance,
                filter: isActive ? 'none' : 'brightness(0.92)',
                cursor: dragging ? 'grabbing' : 'pointer',
              }}
              aria-label={`${album.title} — ${album.artist}`}
              aria-current={isActive ? 'true' : undefined}
            >
              <span className="block h-full w-full overflow-hidden bg-paper-deep shadow-[0_18px_50px_-18px_rgba(20,17,15,0.45)]">
                {album.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={album.coverUrl}
                    alt={album.title}
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-mute">
                    <span className="font-display text-3xl">{album.title.slice(0, 1)}</span>
                    <span className="text-[10px] tracking-[0.3em] uppercase">no cover</span>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* 当前专辑信息 */}
      <div className="mx-auto mt-6 max-w-xl text-center">
        <p className="text-[10px] tracking-[0.3em] text-ink-mute uppercase">
          {String(active + 1).padStart(2, '0')} — {albums[active].releaseDate?.slice(0, 4) ?? 'undated'}
        </p>
        <h2 className="font-display mt-2 text-2xl text-ink sm:text-3xl">{albums[active].title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{albums[active].artist}</p>
        <p className="mt-3 text-xs tracking-[0.12em] text-ink-mute uppercase">
          {albums[active].trackCount} tracks
          {albums[active].totalDuration > 0
            ? ` · ${Math.round(albums[active].totalDuration / 60)} min`
            : ''}
        </p>
        {albums[active].description && (
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">{albums[active].description}</p>
        )}

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={active === 0}
            className="border border-line px-4 py-1.5 text-[11px] tracking-[0.14em] text-ink-soft transition hover:border-ink hover:text-ink disabled:opacity-30"
          >
            PREV
          </button>
          <button
            type="button"
            onClick={() => router.push(`/albums/${albums[active].id}`)}
            className="border border-ink bg-ink px-5 py-1.5 text-[11px] tracking-[0.14em] text-paper transition hover:bg-transparent hover:text-ink"
          >
            OPEN ALBUM
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={active === albums.length - 1}
            className="border border-line px-4 py-1.5 text-[11px] tracking-[0.14em] text-ink-soft transition hover:border-ink hover:text-ink disabled:opacity-30"
          >
            NEXT
          </button>
        </div>
      </div>
    </div>
  );
}
