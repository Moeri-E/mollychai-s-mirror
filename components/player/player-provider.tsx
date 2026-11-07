'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { streamUrlFor, type Track } from '@/lib/track';

export type RepeatMode = 'off' | 'all' | 'one';

type PlayerState = {
  current: Track | null;
  queue: Track[];
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  error: string | null;
};

type PlayerActions = {
  playTrack: (track: Track, queue?: Track[]) => void;
  /** 只载入、不出声：翻开专辑时唱机停在待播放状态 */
  cueTrack: (track: Track, queue?: Track[]) => void;
  toggle: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  setRepeat: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  enqueue: (tracks: Track[]) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
};

const PlayerStateContext = createContext<PlayerState | null>(null);
const PlayerActionsContext = createContext<PlayerActions | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<Track[]>([]);
  const currentRef = useRef<Track | null>(null);
  const repeatRef = useRef<RepeatMode>('off');
  const shuffleRef = useRef(false);
  const autoNextRef = useRef(false);

  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeatState] = useState<RepeatMode>('off');
  const [shuffle, setShuffle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 保持 ref 与 state 同步，供事件回调读取最新值
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);
  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);

  /** 找到队列里下一首（考虑随机与循环） */
  const pickNext = useCallback((step: 1 | -1, allowWrap = true): Track | null => {
    const list = queueRef.current;
    const cur = currentRef.current;
    if (!list.length) return null;
    if (!cur) return list[0];

    if (shuffleRef.current && list.length > 1) {
      const candidates = list.filter((item) => item.id !== cur.id);
      return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
    }

    const index = list.findIndex((item) => item.id === cur.id);
    if (index === -1) return list[0];

    let nextIndex = index + step;
    if (nextIndex >= list.length) {
      if (!allowWrap && repeatRef.current === 'off') return null;
      nextIndex = 0;
    }
    if (nextIndex < 0) {
      if (!allowWrap && repeatRef.current === 'off') return null;
      nextIndex = list.length - 1;
    }
    return list[nextIndex] ?? null;
  }, []);

  const startTrack = useCallback((track: Track, autoplay = true) => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrent(track);
    currentRef.current = track;
    setError(null);
    setCurrentTime(0);
    audio.src = streamUrlFor(track.id);
    audio.load();
    if (!autoplay) {
      audio.pause();
      setDuration(track.duration ?? 0);
      return;
    }
    const promise = audio.play();
    if (promise) {
      promise.catch(() => {
        setPlaying(false);
        setError('播放失败，可能是浏览器自动播放限制或音频文件缺失');
      });
    }
  }, []);

  // 音频实例只在挂载时创建一次，路由切换不会销毁
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = 1;
    audioRef.current = audio;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => {
      setPlaying(true);
      setError(null);
    };
    const onPause = () => setPlaying(false);
    const onError = () => {
      setPlaying(false);
      setError('音频加载失败，请尝试重新播放');
    };
    const onEnded = () => {
      autoNextRef.current = true;
      const mode = repeatRef.current;
      if (mode === 'one') {
        audio.currentTime = 0;
        void audio.play();
        return;
      }
      const nextTrack = pickNext(1, mode === 'all');
      if (nextTrack) startTrack(nextTrack);
      else setPlaying(false);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);

    // 恢复音量偏好
    try {
      const saved = window.localStorage.getItem('mm_volume');
      if (saved !== null) {
        const value = Number(saved);
        if (Number.isFinite(value) && value >= 0 && value <= 1) {
          audio.volume = value;
          setVolumeState(value);
        }
      }
    } catch {
      /* ignore */
    }

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [pickNext, startTrack]);

  const playTrack = useCallback(
    (track: Track, nextQueue?: Track[]) => {
      if (nextQueue) {
        setQueue(nextQueue);
        queueRef.current = nextQueue;
      } else if (!queueRef.current.some((item) => item.id === track.id)) {
        const merged = [...queueRef.current, track];
        setQueue(merged);
        queueRef.current = merged;
      }
      startTrack(track);
    },
    [startTrack],
  );

  /**
   * 载入但不播放。翻开封套时用它：唱机出现的那一刻是静止的，
   * 用户点唱片或唱臂才开始出声。
   *
   * 如果当前曲目本来就在这张专辑里（收起后再翻开），保留曲目和进度，
   * 只把声音停掉——否则每次翻开都会跳回第一首。
   */
  const cueTrack = useCallback(
    (track: Track, nextQueue?: Track[]) => {
      if (nextQueue) {
        setQueue(nextQueue);
        queueRef.current = nextQueue;
      }
      const cur = currentRef.current;
      if (cur && nextQueue?.some((item) => item.id === cur.id)) {
        const audio = audioRef.current;
        if (audio && !audio.paused) audio.pause();
        return;
      }
      startTrack(track, false);
    },
    [startTrack],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentRef.current) {
      const first = queueRef.current[0];
      if (first) startTrack(first);
      return;
    }
    if (audio.paused) {
      const promise = audio.play();
      if (promise) promise.catch(() => setError('无法继续播放'));
    } else {
      audio.pause();
    }
  }, [startTrack]);

  // 单独的暂停：首页收起专辑时要用，但那边不想订阅 state
  // （订阅了就会跟着 timeupdate 每秒重渲染四次整个 Cover Flow）
  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    audio.pause();
  }, []);

  // 换曲跟随当前的播放/暂停状态：暂停时换曲依然不出声
  const next = useCallback(() => {
    const audio = audioRef.current;
    const track = pickNext(1, true);
    if (track) startTrack(track, audio ? !audio.paused : true);
  }, [pickNext, startTrack]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    // 播放超过 3 秒时，先回到开头
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const track = pickNext(-1, true);
    if (track) startTrack(track, audio ? !audio.paused : true);
  }, [pickNext, startTrack]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = Math.min(Math.max(seconds, 0), audio.duration);
      setCurrentTime(audio.currentTime);
    }
  }, []);

  const setVolume = useCallback((value: number) => {
    const audio = audioRef.current;
    const clamped = Math.min(Math.max(value, 0), 1);
    setVolumeState(clamped);
    setMuted(clamped === 0);
    if (audio) {
      audio.volume = clamped;
      audio.muted = clamped === 0;
    }
    try {
      window.localStorage.setItem('mm_volume', String(clamped));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextMuted = !audio.muted;
    audio.muted = nextMuted;
    setMuted(nextMuted);
  }, []);

  const setRepeat = useCallback((mode: RepeatMode) => {
    setRepeatState(mode);
    repeatRef.current = mode;
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((prevValue) => {
      shuffleRef.current = !prevValue;
      return !prevValue;
    });
  }, []);

  const enqueue = useCallback((tracks: Track[]) => {
    const merged = [...queueRef.current];
    for (const track of tracks) {
      if (!merged.some((item) => item.id === track.id)) merged.push(track);
    }
    setQueue(merged);
    queueRef.current = merged;
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    const filtered = queueRef.current.filter((item) => item.id !== id);
    setQueue(filtered);
    queueRef.current = filtered;
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    queueRef.current = [];
  }, []);

  const state = useMemo<PlayerState>(
    () => ({
      current,
      queue,
      playing,
      currentTime,
      duration,
      volume,
      muted,
      repeat,
      shuffle,
      error,
    }),
    [current, queue, playing, currentTime, duration, volume, muted, repeat, shuffle, error],
  );

  const actions = useMemo<PlayerActions>(
    () => ({
      playTrack,
      cueTrack,
      toggle,
      pause,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      setRepeat,
      toggleShuffle,
      enqueue,
      removeFromQueue,
      clearQueue,
    }),
    [
      playTrack,
      cueTrack,
      toggle,
      pause,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      setRepeat,
      toggleShuffle,
      enqueue,
      removeFromQueue,
      clearQueue,
    ],
  );

  return (
    <PlayerStateContext.Provider value={state}>
      <PlayerActionsContext.Provider value={actions}>
        {children}
      </PlayerActionsContext.Provider>
    </PlayerStateContext.Provider>
  );
}

export function usePlayerState(): PlayerState {
  const value = useContext(PlayerStateContext);
  if (!value) throw new Error('usePlayerState 必须在 PlayerProvider 内使用');
  return value;
}

export function usePlayerActions(): PlayerActions {
  const value = useContext(PlayerActionsContext);
  if (!value) throw new Error('usePlayerActions 必须在 PlayerProvider 内使用');
  return value;
}

export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';
  const seconds = Math.floor(totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
