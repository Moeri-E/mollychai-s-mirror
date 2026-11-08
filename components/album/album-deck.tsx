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
   * 真机（尤其 iOS Safari）在 preserve-3d + translateZ 的元素上，pointer
   * 事件不保证派发，setPointerCapture 对 touch 更不可靠。这里不依赖元素命中：
   *   - 起点：React onPointerDown 优先，window touchstart 兜底
   *   - 过程/结束：一律挂 window 原生监听，拖出唱机也不丢
   *   - 全部按坐标判定（起点是否落在唱片圆内），与 target 元素无关
   * interior 带 data-no-dismiss + touch-action:none，cover flow 不参与。
   */
  const inVinylAt = (x: number, y: number) => {
    const rect = vinylRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.hypot(x - cx, y - cy) <= rect.width / 2 + 2;
  };

  const beginGesture = (x: number, y: number) => {
    pointer.current = { x, y, t: Date.now(), moved: 0 };
    startInVinyl.current = inVinylAt(x, y);
    dragDx.current = 0;
  };

  // window 监听只挂载一次，用 ref 读最新的回调与曲目数据
  const gestureCtx = useRef({
    toggle,
    switchTrack,
    onSwipeAway,
    hasTrack: !!track,
    trackCount: tracks.length,
  });
  gestureCtx.current = {
    toggle,
    switchTrack,
    onSwipeAway,
    hasTrack: !!track,
    trackCount: tracks.length,
  };

  useEffect(() => {
    const moveGesture = (x: number) => {
      const state = pointer.current;
      if (!state) return;
      dragDx.current = x - state.x;
      state.moved = Math.max(state.moved, Math.abs(dragDx.current));
      const wrap = vinylRef.current;
      if (wrap && startInVinyl.current && state.moved > 6) {
        wrap.style.transform = `translateX(${dragDx.current * 0.32}px) rotate(${dragDx.current * 0.012}deg)`;
      }
    };

    const clearGesture = () => {
      pointer.current = null;
      dragDx.current = 0;
      if (vinylRef.current) vinylRef.current.style.transform = '';
    };

    const endGesture = () => {
      const state = pointer.current;
      if (!state) return;
      const dx = dragDx.current;
      const moved = state.moved;
      const held = Date.now() - state.t;
      const inVinyl = startInVinyl.current;
      clearGesture();
      const ctx = gestureCtx.current;

      // ① 明显横拖：唱片圆内 → 同专辑换曲；圆外左滑 → 收起专辑
      if (Math.abs(dx) > 46) {
        if (inVinyl && ctx.trackCount > 1) ctx.switchTrack(dx < 0 ? 1 : -1);
        else if (dx < -70) ctx.onSwipeAway?.();
        return;
      }

      // ② 位移极小 → 算点击；只有起点落在唱片圆内才切播放状态
      if (!(moved < 8 && held < 600) || !inVinyl || !ctx.hasTrack) return;
      ctx.toggle();
    };

    const onPointerMove = (e: PointerEvent) => moveGesture(e.clientX);
    const onTouchStart = (e: TouchEvent) => {
      // pointerdown 已经接过就别重复起手势
      if (pointer.current) return;
      const t = e.touches[0];
      if (t) beginGesture(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pointer.current) return;
      const t = e.touches[0];
      if (t) moveGesture(t.clientX);
      // 只有真的滑动起来才拦浏览器手势；纯点击（手指微抖）不能拦，
      // 否则 iOS 不会补发 click，唱臂按钮和进度条就点不动了
      if (e.cancelable && pointer.current && pointer.current.moved > 6) e.preventDefault();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endGesture);
    window.addEventListener('pointercancel', clearGesture);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', endGesture);
    window.addEventListener('touchcancel', clearGesture);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endGesture);
      window.removeEventListener('pointercancel', clearGesture);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', endGesture);
      window.removeEventListener('touchcancel', clearGesture);
    };
  }, []);

  /** 只负责起手势 + 拦住冒泡；后续 move/up 走 window 原生监听 */
  const onInteriorDown = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.stopPropagation();
    beginGesture(event.clientX, event.clientY);
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
