'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { withBasePath } from '@/lib/base-path';
import type { AlbumCard } from '@/lib/catalog';

type Props = {
  albums: AlbumCard[];
  initialIndex?: number;
};

/** 相邻卡片的水平步进（px），配合卡片宽度形成适度的露出与重叠 */
const STEP = 148;
/** 松手吸附的位移阈值 */
const SNAP_THRESHOLD = 64;

export function CoverFlow({ albums, initialIndex = 0 }: Props) {
  const router = useRouter();
  const lastIndex = Math.max(albums.length - 1, 0);
  const [active, setActive] = useState(Math.min(initialIndex, lastIndex));
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const pointerStart = useRef<number | null>(null);
  const dragDistance = useRef(0);
  const suppressClick = useRef(false);
  const wheelLock = useRef(0);

  const clamp = useCallback(
    (index: number) => Math.max(0, Math.min(index, lastIndex)),
    [lastIndex],
  );

  const go = useCallback((delta: number) => setActive((prev) => clamp(prev + delta)), [clamp]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    pointerStart.current = event.clientX;
    dragDistance.current = 0;
    suppressClick.current = false;
    setDragging(true);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (pointerStart.current === null) return;
    const delta = event.clientX - pointerStart.current;
    dragDistance.current = Math.abs(delta);
    if (dragDistance.current > 8) suppressClick.current = true;
    setDragX(delta);
  };

  const finishDrag = () => {
    if (pointerStart.current === null) return;
    const distance = dragX;
    pointerStart.current = null;
    setDragging(false);
    setDragX(0);

    if (distance <= -SNAP_THRESHOLD) go(1);
    else if (distance >= SNAP_THRESHOLD) go(-1);
  };

  const onWheel = (event: React.WheelEvent) => {
    const now = Date.now();
    if (now - wheelLock.current < 320) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(delta) < 12) return;
    wheelLock.current = now;
    go(delta > 0 ? 1 : -1);
  };

  const handleCardClick = (index: number) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (index === active) router.push(`/albums/${albums[index].id}`);
    else setActive(index);
  };

  if (albums.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center border border-dashed border-line text-sm text-ink-mute">
        还没有公开的专辑
      </div>
    );
  }

  // 拖拽过程中，把像素位移换算成"虚拟帧"，让旋转缩放同步跟随，避免松手时突变
  const dragFrames = dragging ? dragX / STEP : 0;

  return (
    <div className="select-none">
      <div
        className="coverflow-viewport relative mx-auto h-[320px] overflow-hidden sm:h-[380px]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onWheel={onWheel}
        role="group"
        aria-roledescription="carousel"
        aria-label="专辑滑动展示"
      >
        {albums.map((album, index) => {
          const pos = index - active - dragFrames;
          const distance = Math.abs(pos);
          const isActive = distance < 0.5;

          const translateX = pos * STEP;
          const rotateY = Math.max(-52, Math.min(52, pos * -34));
          const translateZ = -Math.min(distance, 3.2) * 110;
          const scale = Math.max(0.7, 1 - distance * 0.075);
          const opacity = Math.max(0.22, 1 - distance * 0.24);
          const zIndex = Math.round(200 - distance * 20);

          return (
            <button
              type="button"
              key={album.id}
              onClick={() => handleCardClick(index)}
              className="cover-card absolute left-1/2 top-1/2 h-[248px] w-[248px] -translate-x-1/2 -translate-y-1/2 sm:h-[292px] sm:w-[292px]"
              style={{
                transform: `translate(-50%, -50%) translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                opacity,
                zIndex,
                cursor: dragging ? 'grabbing' : 'pointer',
                transition: dragging
                  ? 'none'
                  : 'transform 560ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 560ms ease',
              }}
              aria-label={`${album.title} — ${album.artist}`}
              aria-current={isActive ? 'true' : undefined}
              tabIndex={index === active ? 0 : -1}
            >
              <span
                className={`block h-full w-full overflow-hidden bg-paper-deep ${
                  isActive
                    ? 'shadow-[0_28px_64px_-24px_rgba(20,17,15,0.55)]'
                    : 'shadow-[0_12px_28px_-16px_rgba(20,17,15,0.45)]'
                }`}
              >
                {album.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={withBasePath(album.coverUrl)}
                    alt={album.title}
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-mute">
                    <span className="font-display text-3xl">{album.title.slice(0, 1)}</span>
                    <span className="text-[11px] tracking-[0.2em]">无封面</span>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* 当前专辑信息 */}
      <div className="mx-auto mt-7 max-w-xl text-center">
        <p className="text-[11px] tracking-[0.18em] text-ink-mute">
          {String(active + 1).padStart(2, '0')} —{' '}
          {albums[active].releaseDate?.slice(0, 4) ?? '未标注年份'}
        </p>
        <h2 className="font-display mt-2 text-2xl text-ink sm:text-3xl">{albums[active].title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{albums[active].artist}</p>
        <p className="mt-3 text-[12px] text-ink-mute">
          {albums[active].trackCount} 首
          {albums[active].totalDuration > 0
            ? ` · ${Math.round(albums[active].totalDuration / 60)} 分钟`
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
            className="border border-line px-4 py-1.5 text-[12px] text-ink-soft transition hover:border-ink hover:text-ink disabled:opacity-30"
          >
            上一张
          </button>
          <button
            type="button"
            onClick={() => router.push(`/albums/${albums[active].id}`)}
            className="border border-ink bg-ink px-5 py-1.5 text-[12px] text-paper transition hover:bg-transparent hover:text-ink"
          >
            打开专辑
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={active === lastIndex}
            className="border border-line px-4 py-1.5 text-[12px] text-ink-soft transition hover:border-ink hover:text-ink disabled:opacity-30"
          >
            下一张
          </button>
        </div>
      </div>
    </div>
  );
}
