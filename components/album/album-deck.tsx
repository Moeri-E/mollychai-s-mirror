'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  formatTime,
  usePlayerActions,
  usePlayerState,
} from '@/components/player/player-provider';
import { withBasePath } from '@/lib/base-path';
import type { AlbumWithTracks } from '@/lib/catalog';

type Props = {
  album: AlbumWithTracks;
  /** 在唱机非唱片区域明显左滑时收起专辑（保留"翻盖后向左划走"） */
  onSwipeAway?: () => void;
};

/** 黑胶飞出 / 飞入的方向，用类名驱动，避免和拖拽的 transform 打架 */
type Anim = 'idle' | 'out-left' | 'out-right' | 'in-left' | 'in-right';

/**
 * 打开专辑后，封面套里那台黑胶唱机。
 *
 * 结构对应关系：
 *   .sleeve-platter  转盘盘面（比唱片大一圈、亮一档，唱片边缘才看得清）
 *   .sleeve-arm      唱臂，抬起 / 落下只切 data-playing
 *   .sleeve-deck     机身面板：曲序、状态、曲名、进度
 *
 * 交互（整个内胆只有一套手势源，cover flow 不参与）：
 *   唱片圆内    点 → 播放/暂停；横拖 >46px → 同专辑内换曲
 *   圆外区域    左滑 >70px → 收起专辑；其余不响应
 *   点唱臂      → 播放/暂停
 *   点进度条    → 定位
 */
export function AlbumDeck({ album, onSwipeAway }: Props) {
  const { current, playing, currentTime, duration } = usePlayerState();
  const { toggle, next, prev, seek } = usePlayerActions();

  const [anim, setAnim] = useState<Anim>('idle');
  const switching = useRef(false);
  const pointer = useRef<{ x: number; y: number; t: number; moved: number } | null>(null);
  const dragDx = useRef(0);
  /** 按下时是否落在唱片圆内：决定这次手势是换曲/播放还是收起 */
  const startInVinyl = useRef(false);
  const vinylRef = useRef<HTMLSpanElement | null>(null);
  const barRef = useRef<HTMLSpanElement | null>(null);

  const tracks = album.tracks;
  const found = tracks.findIndex((item) => item.id === current?.id);
  const index = found >= 0 ? found : 0;
  const track = tracks[index] ?? null;
  const total = duration > 0 ? duration : (track?.duration ?? 0);
  const progress = total > 0 ? Math.min(1, currentTime / total) : 0;
  const accent = album.themeColor || '#c4653a';

  /** 拖拽换曲：先让唱片飞出去，换完再从另一侧飞回来 */
  const switchTrack = useCallback(
    (dir: 1 | -1) => {
      if (switching.current || tracks.length < 2) return;
      switching.current = true;
      setAnim(dir > 0 ? 'out-left' : 'out-right');

      window.setTimeout(() => {
        if (dir > 0) next();
        else prev();

        const wrap = vinylRef.current;
        setAnim(dir > 0 ? 'in-right' : 'in-left');
        // 强制回流：让"从另一侧就位"这一帧先落下去，下一帧再撤类才产生过渡
        if (wrap) void wrap.offsetWidth;
        requestAnimationFrame(() => setAnim('idle'));

        window.setTimeout(() => {
          switching.current = false;
        }, 420);
      }, 250);
    },
    [next, prev, tracks.length],
  );

  useEffect(() => {
    return () => {
      switching.current = false;
    };
  }, []);

  /* ---------- 内胆手势：点/拖唱片、左滑收起 ----------
   * 手势挂在 .sleeve-interior 上而不是 .sleeve-platter：移动端 platter 与
   * 机身面板的矩形有重叠，落在重叠区/面板上的触摸若不被本组件接管，
   * 就会冒泡到 cover flow 的翻页/收起逻辑，出现"滑黑胶却切了卡片"。
   * setPointerCapture 锁定指针，拖出内胆也不丢 move/up；stopPropagation
   * 保证 cover flow 的 pageDrag 不被置位。 */
  const inVinylAt = (x: number, y: number) => {
    const rect = vinylRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.hypot(x - cx, y - cy) <= rect.width / 2 + 2;
  };

  const onInteriorDown = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    pointer.current = { x: event.clientX, y: event.clientY, t: Date.now(), moved: 0 };
    startInVinyl.current = inVinylAt(event.clientX, event.clientY);
    dragDx.current = 0;
  };

  const onInteriorMove = (event: React.PointerEvent) => {
    const state = pointer.current;
    if (!state) return;
    dragDx.current = event.clientX - state.x;
    state.moved = Math.max(state.moved, Math.abs(dragDx.current));
    const wrap = vinylRef.current;
    if (wrap && startInVinyl.current && state.moved > 6) {
      wrap.style.transform = `translateX(${dragDx.current * 0.32}px) rotate(${dragDx.current * 0.012}deg)`;
    }
  };

  const onInteriorUp = () => {
    const state = pointer.current;
    if (!state) return;
    const wrap = vinylRef.current;
    const dx = dragDx.current;
    const moved = state.moved;
    const held = Date.now() - state.t;
    const inVinyl = startInVinyl.current;
    pointer.current = null;
    dragDx.current = 0;
    if (wrap) wrap.style.transform = '';

    // ① 明显横拖：唱片圆内 → 同专辑换曲；圆外左滑 → 收起专辑
    if (Math.abs(dx) > 46) {
      if (inVinyl && tracks.length > 1) switchTrack(dx < 0 ? 1 : -1);
      else if (dx < -70) onSwipeAway?.();
      return;
    }

    // ② 位移极小 → 算点击；只有起点落在唱片圆内才切播放状态
    if (!(moved < 8 && held < 600) || !inVinyl || !track) return;
    toggle();
  };

  const onInteriorCancel = () => {
    pointer.current = null;
    dragDx.current = 0;
    if (vinylRef.current) vinylRef.current.style.transform = '';
  };

  const onSeek = (event: React.PointerEvent) => {
    event.stopPropagation();
    const bar = barRef.current;
    if (!bar || total <= 0) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    seek(ratio * total);
  };

  const isCurrent = !!track && current?.id === track.id;
  // 刚翻开、一秒都没播过时是"待播放"，播过再停下才叫"已暂停"
  const stateText = !track
    ? ''
    : playing
      ? '播放中'
      : isCurrent && currentTime > 0
        ? '已暂停'
        : '待播放';
  const meta = track ? `${tracks.length} 首 · ${stateText}` : '暂无曲目';

  return (
    <span
      className="sleeve-interior"
      data-playing={playing && track ? '1' : '0'}
      data-no-dismiss
      style={{ ['--accent' as string]: accent }}
      onPointerDown={onInteriorDown}
      onPointerMove={onInteriorMove}
      onPointerUp={onInteriorUp}
      onPointerCancel={onInteriorCancel}
    >
      <span className="sleeve-platter" data-no-dismiss role="presentation">
          <span className={`sleeve-vinyl-wrap is-${anim}`} ref={vinylRef}>
            <span className="sleeve-vinyl">
              {album.coverUrl && (
                <span
                  className="sleeve-label"
                  style={{ backgroundImage: `url(${withBasePath(album.coverUrl)})` }}
                />
              )}
            </span>
          </span>
      </span>

      <span className="sleeve-armrest" aria-hidden />

      <button
        type="button"
        className="sleeve-arm"
        data-no-dismiss
        onClick={(event) => {
          event.stopPropagation();
          if (track) toggle();
        }}
        aria-label={playing ? '暂停' : '播放'}
        title={playing ? '暂停' : '播放'}
      >
        <span className="sleeve-arm-rod" />
        <span className="sleeve-arm-pivot" />
        <span className="sleeve-arm-head" />
      </button>

      <span className="sleeve-deck">
        <span className="sleeve-readout">
          <span className="sleeve-meta">
            <span className="sleeve-idx">
              {String(index + 1).padStart(2, '0')} / {String(tracks.length).padStart(2, '0')}
            </span>
            <span className="sleeve-state">
              <i />
              {meta}
            </span>
          </span>
          <span className="sleeve-title">{track?.title ?? album.title}</span>
          <span className="sleeve-sub">{album.artist} · {album.title}</span>
        </span>

        <span className="sleeve-bar-row">
          <span
            className="sleeve-bar"
            data-no-dismiss
            onPointerDown={onSeek}
            ref={barRef}
            role="presentation"
          >
            <span className="sleeve-bar-track">
              <span className="sleeve-bar-fill" style={{ transform: `scaleX(${progress})` }} />
            </span>
          </span>
          <span className="sleeve-times">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(total)}</span>
          </span>
        </span>
      </span>
    </span>
  );
}
