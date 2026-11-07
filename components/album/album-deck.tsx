'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  formatTime,
  usePlayerActions,
  usePlayerState,
} from '@/components/player/player-provider';
import type { AlbumWithTracks } from '@/lib/catalog';

type Props = {
  album: AlbumWithTracks;
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
 * 交互：
 *   拖唱片  → 换曲（超过 46px）；位移小于 8px 且落点在唱片圆内 → 播放/暂停
 *   点唱臂  → 播放/暂停
 *   点进度条 → 定位
 */
export function AlbumDeck({ album }: Props) {
  const { current, playing, currentTime, duration } = usePlayerState();
  const { toggle, next, prev, seek } = usePlayerActions();

  const [anim, setAnim] = useState<Anim>('idle');
  const switching = useRef(false);
  const pointer = useRef<{ x: number; y: number; t: number; moved: number } | null>(null);
  const dragDx = useRef(0);
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

  /* ---------- 唱片：拖 = 换曲，点 = 暂停 ---------- */
  const onPlatterDown = (event: React.PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.stopPropagation();
    pointer.current = { x: event.clientX, y: event.clientY, t: Date.now(), moved: 0 };
    dragDx.current = 0;
  };

  const onPlatterMove = (event: React.PointerEvent) => {
    const state = pointer.current;
    if (!state) return;
    dragDx.current = event.clientX - state.x;
    state.moved = Math.max(state.moved, Math.abs(dragDx.current));
    const wrap = vinylRef.current;
    if (wrap && state.moved > 6) {
      wrap.style.transform = `translateX(${dragDx.current * 0.32}px) rotate(${dragDx.current * 0.012}deg)`;
    }
  };

  const onPlatterUp = (event: React.PointerEvent) => {
    const state = pointer.current;
    if (!state) return;
    const wrap = vinylRef.current;
    const dx = dragDx.current;
    const moved = state.moved;
    const held = Date.now() - state.t;
    const rect = wrap?.getBoundingClientRect();
    pointer.current = null;
    dragDx.current = 0;
    if (wrap) wrap.style.transform = '';

    // ① 明显横拖 → 换曲
    if (Math.abs(dx) > 46) {
      switchTrack(dx < 0 ? 1 : -1);
      return;
    }

    // ② 位移极小 → 算点击；只有落在唱片圆内才切播放状态
    if (!(moved < 8 && held < 600) || !rect || !track) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const inside =
      Math.hypot(event.clientX - centerX, event.clientY - centerY) <= rect.width / 2 + 2;
    if (inside) toggle();
  };

  const onPlatterCancel = () => {
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

  const meta = track
    ? `${tracks.length} 首 · ${playing ? '播放中' : current && current.id === track.id ? '已暂停' : '待播放'}`
    : '暂无曲目';

  return (
    <span
      className="sleeve-interior"
      data-playing={playing && track ? '1' : '0'}
      style={{ ['--accent' as string]: accent }}
    >
      <span
        className="sleeve-platter"
        data-no-dismiss
        onPointerDown={onPlatterDown}
        onPointerMove={onPlatterMove}
        onPointerUp={onPlatterUp}
        onPointerCancel={onPlatterCancel}
        role="presentation"
      >
        <span className={`sleeve-vinyl-wrap is-${anim}`} ref={vinylRef}>
          <span className="sleeve-vinyl" />
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
