'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { AlbumDeck } from '@/components/album/album-deck';
import { usePlayerActions } from '@/components/player/player-provider';
import { withBasePath } from '@/lib/base-path';
import type { AlbumWithTracks } from '@/lib/catalog';

type Props = {
  albums: AlbumWithTracks[];
  initialIndex?: number;
  /** 显示在卡片正上方的主标题 */
  title?: ReactNode;
};

/** 旋转方向：-1 = 苹果方向（左侧卡 rotateY 为正，右侧为负）；改这一个数即可整体翻转 */
const TURN = -1;
/** 拖动超过该比例（相对卡宽）就翻页 */
const SNAP_RATIO = 0.24;
/** 导航栏高度，用于三维空间计算 */
const NAV_HEIGHT = 68;

/**
 * 三种状态：
 *   idle    正常浏览
 *   open    专辑已翻开，其余卡片散开
 *   closing 收起 = 打开的逆放：封皮合上、卡片从放大位缩回 cover flow 原位，
 *           其余卡片同时飞回。唱机被合上的封皮自然遮住，完成后回到 idle 卸载
 */
type Phase = 'idle' | 'open' | 'closing';

export function CoverFlow({ albums, initialIndex, title }: Props) {
  const lastIndex = Math.max(albums.length - 1, 0);
  const startIndex = Math.min(initialIndex ?? Math.floor(lastIndex / 2), lastIndex);

  // 只取动作，不取状态：订阅 state 会跟着 timeupdate 每秒重渲染四次整个 Cover Flow
  const { cueTrack, pause } = usePlayerActions();

  const [active, setActive] = useState(startIndex);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [cardSize, setCardSize] = useState(320);
  /** 容器实测高度，用于算台面渐变该在哪收尾 */
  const [boxH, setBoxH] = useState(0);
  /** 主标题实测高度，用来在上方留出等距的空白 */
  const [titleH, setTitleH] = useState(0);
  const [viewportW, setViewportW] = useState(1200);

  const [phase, setPhase] = useState<Phase>('idle');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  /** 左滑收起时整页跟手的位移 */
  const [pageDx, setPageDx] = useState(0);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const pointerStart = useRef<number | null>(null);
  const dragXRef = useRef(0);
  const suppressClick = useRef(false);
  const wheelLock = useRef(0);
  const pageDrag = useRef<{ x: number; moved: number } | null>(null);
  const suppressStageClick = useRef(false);
  const timers = useRef<number[]>([]);

  const opened = phase !== 'idle';
  const isOpen = phase === 'open';

  const clamp = useCallback(
    (index: number) => Math.max(0, Math.min(index, lastIndex)),
    [lastIndex],
  );
  const go = useCallback((delta: number) => setActive((prev) => clamp(prev + delta)), [clamp]);

  // 卡片尺寸自适应。
  // 把容器高度切成三段：标题带（上下留等距空白）+ 卡片 + 台面，
  // 卡片 = (容器高 − 标题带) / 1.54，其中 0.54 是卡片下方留给倒影的比例
  // （倒影遮罩在 0.42 倍卡宽处结束，留一点余量）。
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const box = boxRef.current;
      const availH =
        box && box.clientHeight > 8 ? box.clientHeight : window.innerHeight - NAV_HEIGHT;
      if (box) setBoxH(box.clientHeight);
      setViewportW(vw);

      // 标题高度实测（字体加载完成后会变），没测到之前先用估算值
      const node = titleRef.current;
      const measured = node ? Math.round(node.offsetHeight) : 0;
      if (measured > 0) setTitleH((prev) => (prev === measured ? prev : measured));

      const gap = Math.round(Math.min(36, Math.max(14, availH * 0.035)));
      const reserve = (measured || 96) + gap * 2;

      // 窄屏（手机）用更大的宽度占比，否则卡片只有屏宽的一半不到
      const widthRatio = vw < 640 ? 0.62 : 0.34;
      const byWidth = Math.min(vw * widthRatio, 520);
      const byHeight = (availH - reserve) / 1.54;
      setCardSize(Math.max(180, Math.min(byWidth, byHeight)));
    };
    calc();
    window.addEventListener('resize', calc);
    const box = boxRef.current;
    const observer = box && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(calc) : null;
    if (box && observer) observer.observe(box);
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(calc).catch(() => {});
    }
    return () => {
      window.removeEventListener('resize', calc);
      observer?.disconnect();
    };
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  /* ---------- 打开 / 收起 ---------- */
  const openAlbum = useCallback(
    (index: number) => {
      const album = albums[index];
      if (!album) return;
      setOpenIndex(index);
      setPhase('open');
      // 翻开只是把唱片放上去，唱机静止待命；点唱片或唱臂才开始出声
      if (album.tracks.length) cueTrack(album.tracks[0], album.tracks);
    },
    [albums, cueTrack],
  );

  const closeAlbum = useCallback(() => {
    if (phase !== 'open') return;
    pause();
    setPageDx(0);
    setPhase('closing');
    // 封皮合上 + 中心卡缩回 + 其余卡片飞回，三者同步（~600ms）；
    // 完成后回到 idle，唱机此时已被封皮遮住，卸载不可见
    timers.current.push(
      window.setTimeout(() => {
        setPhase('idle');
        setOpenIndex(null);
      }, 660),
    );
  }, [phase, pause]);

  /* ---------- 左滑收起 ---------- */
  useEffect(() => {
    if (phase !== 'open') return;

    const onMove = (event: PointerEvent) => {
      const state = pageDrag.current;
      if (!state) return;
      const dx = event.clientX - state.x;
      state.moved = Math.max(state.moved, Math.abs(dx));
      setPageDx(dx < 0 ? dx * 0.55 : 0);
    };

    const onUp = (event: PointerEvent) => {
      const state = pageDrag.current;
      if (!state) return;
      const dx = event.clientX - state.x;
      const moved = state.moved;
      pageDrag.current = null;
      setPageDx(0);
      if (moved > 12) {
        suppressStageClick.current = true;
        window.setTimeout(() => (suppressStageClick.current = false), 80);
      }
      if (moved > 12 && dx < -70) closeAlbum();
    };

    // 点空白处收起。挂在 document 上而不是容器上：容器只有内容宽度，
    // 页面两侧的留白点不到，用户会觉得"点了没反应"。
    const mountedAt = Date.now();
    const onClick = (event: MouseEvent) => {
      // 打开专辑的那一次 click 还在冒泡，别把它当成"点空白"
      if (Date.now() - mountedAt < 200) return;
      if (suppressStageClick.current) {
        suppressStageClick.current = false;
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target || target.closest('.cover-card')) return;
      closeAlbum();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.removeEventListener('click', onClick);
    };
  }, [phase, closeAlbum]);

  /* ---------- 键盘 ---------- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.key === 'Escape') {
        closeAlbum();
        return;
      }
      if (opened) return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, opened, closeAlbum]);

  // 滚轮：必须用非 passive 监听才能 preventDefault，
  // 否则浏览器会同时滚动页面（React 的 onWheel 是 passive 的，拦不住）
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      if (opened) return;
      const now = Date.now();
      if (now - wheelLock.current < 340) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(delta) < 8) return;
      wheelLock.current = now;
      go(delta > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [go, opened]);

  /* ---------- 指针按下 ---------- */
  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    if (opened) {
      const target = event.target as HTMLElement;
      // 唱片、唱臂、进度条自己处理手势，不参与"翻页收起"
      if (target.closest('[data-no-dismiss]')) return;
      pageDrag.current = { x: event.clientX, moved: 0 };
      return;
    }

    pointerStart.current = event.clientX;
    suppressClick.current = false;
    dragXRef.current = 0;
    setDragging(true);
    // 不做 setPointerCapture：它会把后续 pointerup 重定向到舞台，
    // 导致 click 不落在卡片上，点击忽灵忽不灵。改用 window 级监听。
  };

  /* ---------- 浏览态拖拽 ---------- */
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
    if (opened) return;
    // 点当前卡片 → 打开这张专辑；点其他卡片 → 该卡片成为当前展示
    if (index === active) openAlbum(index);
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
  const stageHeight = cardSize;
  const topPercent = (cardSize / 2 / stageHeight) * 100;

  // 标题带：容器顶部到卡片顶部这一块，标题在其中垂直居中（上下留白相等）。
  // 卡片被宽度限制时（大屏、手机）还剩富余高度，一半并入标题带（标题仍居中、
  // 但离卡片更远一点），一半留在下方，避免整体悬在上半页。
  const baseGap = Math.round(Math.min(36, Math.max(14, boxH * 0.035)));
  const baseReserve = (titleH || 96) + baseGap * 2;
  const slack = Math.max(0, boxH - baseReserve - cardSize * 1.54);
  const titleBand = Math.round(baseReserve + slack * 0.4);
  // 台面渐变要在视口底收尾，长度按实测剩余空间算
  const floorHeight = Math.max(140, Math.round(boxH - titleBand - cardSize));

  // 打开后卡片略微前推并放大：桌面几乎不变（卡片本身已经够大），
  // 手机则补足屏宽——否则唱机只占屏幕中间一小块
  const openScale = cardSize < 320 ? Math.min(1.48, (viewportW * 0.9) / cardSize) : 1.03;

  // 翻开后是一张左右两页的"对开"：卡片是右页，封皮翻到左边。
  // 如果只居中卡片，整组会偏左——1280 屏上封皮甚至会被切掉，
  // 所以要右移半个卡宽，让整组落在画面中间。手机上封皮是淡出的，不用移。
  const openShift = viewportW <= 720 ? 0 : (cardSize * openScale) / 2;

  return (
    // 注意：不要在这里用 overflow-x-clip / overflow-hidden，
    // 那会把卡片下方的倒影一起裁掉（垂直方向也会被限制）
    <div ref={boxRef} className="absolute inset-0" onPointerDown={onPointerDown}>
      {title && (
        <div
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-center px-4"
          style={{ height: titleBand }}
        >
          <div ref={titleRef}>{title}</div>
        </div>
      )}

      <div
        ref={stageRef}
        className="coverflow-stage w-full"
        style={{ height: stageHeight, marginTop: titleBand }}
        data-open={isOpen ? '1' : '0'}
        role="group"
        aria-roledescription="carousel"
        aria-label="专辑滑动展示"
      >
        {/* 地平线 + 墙 + 台面：卡片的底边正好落在地平线上，
            看起来像立在台面上，倒影投在同一张台面上 */}
        <div
          className="coverflow-ground"
          style={{ top: `${topPercent * 2}%`, ['--floor-h' as string]: `${floorHeight}px` }}
          aria-hidden
        >
          <span className="coverflow-floor" />
        </div>

        {albums.map((album, index) => {
          const offset = index - active;
          const distance = Math.abs(offset);
          const dirSign = offset > 0 ? 1 : offset < 0 ? -1 : 0;

          const shift =
            cardSize * (0.58 * Math.min(distance, 1) + 0.24 * Math.max(0, distance - 1));
          const depth = -distance * cardSize * 0.57;
          const rotate = distance === 0 ? 0 : 56 + Math.max(0, distance - 1) * 8;

          // translate3d 必须在 perspective() 左侧：先投影再整体横移，
          // 否则卡片两端 z 不同，横向位移被不同缩放因子放大，整张卡会被"剪"窄
          const baseTransform =
            `translate3d(${dirSign * shift + (opened ? 0 : dragX)}px, 0, 0) ` +
            `perspective(${perspective}px) ` +
            `translateZ(${depth}px) ` +
            `rotateY(${dirSign * TURN * rotate}deg)`;

          const isOpenedCard = opened && index === openIndex;
          const othersOut = phase === 'open' && opened && index !== openIndex;

          let transform = baseTransform;
          let opacity = Math.max(0, Math.min(1, 0.98 - distance * 0.09));
          let transition =
            'transform 620ms cubic-bezier(0.22, 0.82, 0.24, 1), opacity 420ms ease';
          let zIndex = 100 - Math.round(distance * 10);

          if (othersOut) {
            const out = index < (openIndex ?? 0) ? -1 : 1;
            transform =
              `translate3d(${out * viewportW * 0.92}px, 0, -420px) ` +
              `perspective(${perspective}px) ` +
              `rotateY(${out * 42}deg) scale(0.86)`;
            opacity = 0;
            zIndex = 10;
          } else if (isOpenedCard) {
            zIndex = 200;
            if (phase === 'closing') {
              // 收起 = 打开的逆放：从放大居中位缩回 cover flow 原位，
              // 封皮同步合上（由 data-flap 驱动），唱机被遮住后于 idle 卸载
              transform = baseTransform;
              opacity = 1;
              transition = 'transform 660ms cubic-bezier(0.22, 0.82, 0.24, 1)';
            } else {
              transform =
                `translate3d(${pageDx + openShift}px, -8px, 120px) ` +
                `perspective(${perspective}px) ` +
                `rotateY(0deg) scale(${openScale})`;
              opacity = 1;
              transition = 'transform 640ms cubic-bezier(0.22, 0.82, 0.24, 1)';
            }
          }

          const showDeck = opened && index === openIndex;

          return (
            <div
              key={album.id}
              className="cover-card"
              data-opened={showDeck ? '1' : '0'}
              data-flap={isOpen ? 'open' : 'closed'}
              onClick={() => handleCardClick(index)}
              style={{
                ['--card' as string]: `${cardSize}px`,
                width: cardSize,
                height: cardSize,
                top: `${topPercent}%`,
                marginLeft: -cardSize / 2,
                marginTop: -cardSize / 2,
                transform,
                opacity,
                zIndex,
                transition,
              }}
              role="button"
              tabIndex={distance === 0 && !opened ? 0 : -1}
              aria-label={`${album.title} — ${album.artist}`}
              aria-current={distance === 0 ? 'true' : undefined}
              aria-expanded={isOpenedCard ? true : undefined}
            >
              <span className="sleeve">
                {showDeck && <AlbumDeck album={album} />}

                <span
                  className="sleeve-flap"
                  style={
                    isOpen
                      ? {
                          // -180° 完全翻平 + 与内胆同深度：封皮投影宽与唱机面板严格一致。
                          // 之前用 -174° + translateZ(-26px)，封皮比内胆浅、透视放得更大，
                          // 摊开后封面左端比书脊对称位多出一截，看起来像轴偏了
                          transform: 'rotateY(-180deg) translateZ(-2px)',
                          // 翻转延迟 480ms：先等卡片滑到打开位（640ms 移动动画的后段），
                          // 再绕左轴翻——否则卡片边右移边翻，轴跟着跑，
                          // 看起来像是绕"封面左侧靠右"的一条轴在转，很突兀
                          transition: 'transform 1.05s cubic-bezier(0.3, 0.85, 0.2, 1) 480ms',
                        }
                      : {
                          transform: 'rotateY(0deg)',
                          transition: 'transform 600ms cubic-bezier(0.4, 0, 0.2, 1)',
                        }
                  }
                >
                  <span className="sleeve-face sleeve-face--front">
                    {album.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={withBasePath(album.coverUrl)}
                        alt={album.title}
                        draggable={false}
                      />
                    ) : (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-mute">
                        <span className="font-display text-3xl">{album.title.slice(0, 1)}</span>
                        <span className="text-[11px] tracking-[0.2em]">无封面</span>
                      </span>
                    )}
                  </span>
                  {album.coverUrl && (
                    <span className="sleeve-face sleeve-face--back" aria-hidden>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={withBasePath(album.coverUrl)} alt="" draggable={false} />
                    </span>
                  )}
                </span>
              </span>

              {album.coverUrl && (
                <>
                  {/* 倒影用真实镜像副本，各浏览器一致（不依赖 -webkit-box-reflect） */}
                  <span className="cover-reflection" aria-hidden="true">
                    <img
                      src={withBasePath(album.coverUrl)}
                      alt=""
                      draggable={false}
                      className="h-full w-full object-cover"
                      style={{ transform: 'scaleY(-1)' }}
                    />
                  </span>
                  {/* 接触阴影放卡片内部：跟着这张卡一起动，压在倒影之上 */}
                  <span className="cover-contact" aria-hidden="true" />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
