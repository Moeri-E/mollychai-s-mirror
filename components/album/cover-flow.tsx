'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { withBasePath } from '@/lib/base-path';
import type { AlbumCard } from '@/lib/catalog';

type Props = {
  albums: AlbumCard[];
  initialIndex?: number;
  /** 沉浸模式：不渲染下方文字与按钮，只留卡片 */
  minimal?: boolean;
};

/** 旋转方向：-1 = 苹果方向（左侧卡 rotateY 为正，右侧为负）；改这一个数即可整体翻转 */
const TURN = -1;
/** 拖动超过该比例（相对卡宽）就翻页 */
const SNAP_RATIO = 0.24;
/** 导航栏高度，用于沉浸模式的三维空间计算 */
const NAV_HEIGHT = 68;

export function CoverFlow({ albums, initialIndex, minimal = false }: Props) {
  const router = useRouter();
  const lastIndex = Math.max(albums.length - 1, 0);
  const startIndex = Math.min(initialIndex ?? Math.floor(lastIndex / 2), lastIndex);

  const [active, setActive] = useState(startIndex);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [cardSize, setCardSize] = useState(320);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const pointerStart = useRef<number | null>(null);
  const dragXRef = useRef(0);
  const suppressClick = useRef(false);
  const wheelLock = useRef(0);

  const clamp = useCallback(
    (index: number) => Math.max(0, Math.min(index, lastIndex)),
    [lastIndex],
  );
  const go = useCallback((delta: number) => setActive((prev) => clamp(prev + delta)), [clamp]);

  // 卡片尺寸自适应。
  // 沉浸模式要求卡片本身垂直居中，倒影是向下溢出的，
  // 所以卡宽要足够小，保证 (可用高度 - 卡宽)/2 能放下倒影（约 0.45 倍卡宽）
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // 窄屏（手机）用更大的宽度占比，否则卡片只有屏宽的一半不到
      const widthRatio = vw < 640 ? 0.62 : 0.34;
      const byWidth = Math.min(vw * widthRatio, minimal ? 520 : 400);
      const byHeight = minimal ? (vh - NAV_HEIGHT) / 1.8 : (vh - 300) / 1.45;
      setCardSize(Math.max(180, Math.min(byWidth, byHeight)));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [minimal]);

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

  // 滚轮：必须用非 passive 监听才能 preventDefault，
  // 否则浏览器会同时滚动页面（React 的 onWheel 是 passive 的，拦不住）
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      const now = Date.now();
      if (now - wheelLock.current < 340) return;
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(delta) < 8) return;
      wheelLock.current = now;
      go(delta > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [go]);

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerStart.current = event.clientX;
    suppressClick.current = false;
    dragXRef.current = 0;
    setDragging(true);
    // 不做 setPointerCapture：它会把后续 pointerup 重定向到舞台，
    // 导致 click 不落在卡片上，点击忽灵忽不灵。改用 window 级监听。
  };

  // 拖拽在 window 上监听，指针移出舞台也不会丢
  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => {
      if (pointerStart.current === null) return;
      const delta = event.clientX - pointerStart.current;
      if (Math.abs(delta) > 6) suppressClick.current = true;
      dragXRef.current = delta;
      setDragX(delta);
    };

    const onUp = () => {
      const distance = dragXRef.current;
      pointerStart.current = null;
      dragXRef.current = 0;
      setDragging(false);
      setDragX(0);
      if (distance <= -cardSize * SNAP_RATIO) go(1);
      else if (distance >= cardSize * SNAP_RATIO) go(-1);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, cardSize, go]);

  const handleCardClick = (index: number) => {
    // 拖拽结束时浏览器仍会补发一次 click，这里吞掉
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    // 点当前卡片 → 进入专辑详情；点其他卡片 → 该卡片成为当前展示
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

  const perspective = cardSize * 2.4;
  // 沉浸模式：舞台高度就是卡片高度，卡片在舞台内垂直居中，倒影向下溢出
  // （父容器居中后上下各有多少余量，已在尺寸计算里保证）
  // 普通模式：舞台额外留 45% 给倒影，卡片相应上移到光学位
  const stageHeight = minimal ? cardSize : cardSize * 1.45;
  const topPercent = (cardSize / 2 / stageHeight) * 100;

  return (
    // 注意：不要在这里用 overflow-x-clip / overflow-hidden，
    // 那会把卡片下方的倒影一起裁掉（垂直方向也会被限制）
    <div className="relative">
      <div
        ref={stageRef}
        className="coverflow-stage"
        style={{ height: stageHeight }}
        onPointerDown={onPointerDown}
        role="group"
        aria-roledescription="carousel"
        aria-label="专辑滑动展示"
      >
        <div className="coverflow-floor" aria-hidden />

        {albums.map((album, index) => {
          const offset = index - active;
          const distance = Math.abs(offset);
          const dir = offset > 0 ? 1 : offset < 0 ? -1 : 0;

          const shift =
            cardSize * (0.58 * Math.min(distance, 1) + 0.24 * Math.max(0, distance - 1));
          const depth = -distance * cardSize * 0.57;
          const rotate = distance === 0 ? 0 : 56 + Math.max(0, distance - 1) * 8;
          const opacity = Math.max(0, Math.min(1, 0.98 - distance * 0.09));

          // translate3d 必须在 perspective() 左侧：先投影再整体横移，
          // 否则卡片两端 z 不同，横向位移被不同缩放因子放大，整张卡会被"剪"窄
          const transform =
            `translate3d(${dir * shift + dragX}px, 0, 0) ` +
            `perspective(${perspective}px) ` +
            `translateZ(${depth}px) ` +
            `rotateY(${dir * TURN * rotate}deg)`;

          return (
            <button
              type="button"
              key={album.id}
              onClick={() => handleCardClick(index)}
              className="cover-card"
              style={{
                width: cardSize,
                height: cardSize,
                top: `${topPercent}%`,
                marginLeft: -cardSize / 2,
                marginTop: -cardSize / 2,
                transform,
                opacity,
                zIndex: 100 - Math.round(distance * 10),
                transition: dragging
                  ? 'none'
                  : 'transform 620ms cubic-bezier(0.22, 0.82, 0.24, 1), opacity 420ms ease',
              }}
              aria-label={`${album.title} — ${album.artist}`}
              aria-current={distance === 0 ? 'true' : undefined}
              tabIndex={distance === 0 ? 0 : -1}
            >
              <span className="cover-frame">
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
              {album.coverUrl && (
                // 倒影用真实镜像副本，各浏览器一致（不依赖 -webkit-box-reflect）
                <span className="cover-reflection" aria-hidden="true">
                  <img
                    src={withBasePath(album.coverUrl)}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!minimal && (
        <div className="mx-auto mt-2 max-w-xl text-center">
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
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              {albums[active].description}
            </p>
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
      )}
    </div>
  );
}
