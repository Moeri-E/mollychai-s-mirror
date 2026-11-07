'use client';

import { ChevronDown, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';

import { formatTime, usePlayerActions, usePlayerState } from '@/components/player/player-provider';
import { withBasePath } from '@/lib/base-path';

export function GlobalPlayer() {
  const state = usePlayerState();
  const actions = usePlayerActions();
  const [queueOpen, setQueueOpen] = useState(false);

  const hasTrack = Boolean(state.current);
  const duration = state.duration || state.current?.duration || 0;
  const progressPercent = duration > 0 ? (state.currentTime / duration) * 100 : 0;

  return (
    <>
      {queueOpen && (
        <div className="fixed bottom-[76px] right-0 z-40 w-full max-w-sm border-t border-l border-line bg-paper/95 backdrop-blur-md sm:right-4 sm:rounded-t-lg">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[12px] tracking-[0.1em] text-ink-mute">
              播放队列 · {state.queue.length}
            </span>
            <button
              type="button"
              onClick={() => setQueueOpen(false)}
              className="text-ink-mute transition hover:text-ink"
              aria-label="收起队列"
            >
              <ChevronDown size={16} />
            </button>
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {state.queue.length === 0 && (
              <li className="px-4 py-6 text-center text-xs text-ink-mute">队列是空的</li>
            )}
            {state.queue.map((track, index) => {
              const active = track.id === state.current?.id;
              return (
                <li key={track.id}>
                  <button
                    type="button"
                    onClick={() => actions.playTrack(track)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-paper-deep ${
                      active ? 'text-accent' : 'text-ink-soft'
                    }`}
                  >
                    <span className="w-5 shrink-0 text-[11px] tabular-nums text-ink-mute">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{track.title}</span>
                      <span className="block truncate text-[11px] text-ink-mute">{track.artist}</span>
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-ink-mute">
                      {formatTime(track.duration)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper/92 backdrop-blur-md">
        {/* 顶部细进度条，方便一眼看到播放位置 */}
        <div className="h-[2px] w-full bg-line/60">
          <div
            className="h-full bg-ink transition-[width] duration-150"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>

        <div className="mx-auto flex h-[74px] max-w-6xl items-center gap-4 px-4 sm:px-6">
          {/* 当前曲目 */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-sm bg-paper-deep">
              {state.current?.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={withBasePath(state.current.coverUrl)}
                  alt=""
                  className={`h-full w-full object-cover ${state.playing ? 'disc-spin' : 'disc-spin is-paused'}`}
                  style={{ borderRadius: '2px' }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] tracking-widest text-ink-mute">
                  MIRROR
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">
                {state.current?.title ?? '选择一首歌开始'}
              </p>
              <p className="truncate text-[11px] text-ink-mute">
                {state.error ?? state.current?.artist ?? 'mollychai’s mirror'}
              </p>
            </div>
          </div>

          {/* 控制区 */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={actions.prev}
              disabled={!hasTrack}
              className="p-2 text-ink-soft transition hover:text-ink disabled:opacity-30"
              aria-label="上一首"
            >
              <SkipBack size={17} />
            </button>
            <button
              type="button"
              onClick={actions.toggle}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ink text-ink transition hover:bg-ink hover:text-paper disabled:opacity-30"
              aria-label={state.playing ? '暂停' : '播放'}
            >
              {state.playing ? <Pause size={15} /> : <Play size={15} className="ml-[1px]" />}
            </button>
            <button
              type="button"
              onClick={actions.next}
              disabled={!hasTrack}
              className="p-2 text-ink-soft transition hover:text-ink disabled:opacity-30"
              aria-label="下一首"
            >
              <SkipForward size={17} />
            </button>
          </div>

          {/* 进度 */}
          <div className="hidden flex-1 items-center gap-2 md:flex">
            <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-ink-mute">
              {formatTime(state.currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.5}
              value={Math.min(state.currentTime, duration || 0)}
              onChange={(event) => actions.seek(Number(event.target.value))}
              className="range-thin w-full"
              aria-label="播放进度"
            />
            <span className="w-9 shrink-0 text-[11px] tabular-nums text-ink-mute">
              {formatTime(duration)}
            </span>
          </div>

          {/* 右侧工具 */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={actions.toggleShuffle}
              className={`hidden p-2 transition sm:block ${
                state.shuffle ? 'text-accent' : 'text-ink-mute hover:text-ink'
              }`}
              aria-label="随机播放"
              aria-pressed={state.shuffle}
            >
              <Shuffle size={15} />
            </button>
            <button
              type="button"
              onClick={() =>
                actions.setRepeat(
                  state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off',
                )
              }
              className={`hidden p-2 transition sm:block ${
                state.repeat === 'off' ? 'text-ink-mute hover:text-ink' : 'text-accent'
              }`}
              aria-label="循环模式"
              aria-pressed={state.repeat !== 'off'}
            >
              {state.repeat === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
            </button>
            <button
              type="button"
              onClick={() => setQueueOpen((value) => !value)}
              className={`p-2 transition ${
                queueOpen ? 'text-accent' : 'text-ink-mute hover:text-ink'
              }`}
              aria-label="播放队列"
              aria-pressed={queueOpen}
            >
              <ListMusic size={16} />
            </button>
            <div className="hidden items-center gap-2 lg:flex">
              <button
                type="button"
                onClick={actions.toggleMute}
                className="p-1 text-ink-mute transition hover:text-ink"
                aria-label={state.muted ? '取消静音' : '静音'}
              >
                {state.muted || state.volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={state.muted ? 0 : state.volume}
                onChange={(event) => actions.setVolume(Number(event.target.value))}
                className="range-thin w-16"
                aria-label="音量"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
