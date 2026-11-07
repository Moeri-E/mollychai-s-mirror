'use client';

import { useState } from 'react';

import { withBasePath } from '@/lib/base-path';
import { adminFetch, readError, uploadMedia } from '@/lib/client-api';

export type SongRow = {
  id: string;
  title: string;
  artist: string;
  albumId: string | null;
  albumTitle: string | null;
  audioUrl: string;
  coverUrl: string | null;
  duration: number;
  trackNumber: number;
  audioFormat: string | null;
  genre: string | null;
  isPublic: number;
  uploaderName: string | null;
  externalId: string | null;
  createdAt: string;
};

type AlbumOption = { id: string; title: string };

type Draft = {
  title: string;
  artist: string;
  albumId: string;
  audioUrl: string;
  coverUrl: string;
  duration: number;
  trackNumber: number;
  genre: string;
  lyrics: string;
  audioFormat: string;
  isPublic: boolean;
};

const EMPTY: Draft = {
  title: '',
  artist: 'mollychai',
  albumId: '',
  audioUrl: '',
  coverUrl: '',
  duration: 0,
  trackNumber: 0,
  genre: '',
  lyrics: '',
  audioFormat: '',
  isPublic: true,
};

function formatDuration(seconds: number): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function SongManager({
  initial,
  albums,
}: {
  initial: SongRow[];
  albums: AlbumOption[];
}) {
  const [songs, setSongs] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    const response = await adminFetch('/api/admin/songs');
    const payload = await response.json();
    setSongs(payload.data ?? []);
  }

  function startCreate() {
    setEditingId(null);
    setDraft(EMPTY);
    setOpen(true);
    setMessage(null);
  }

  function startEdit(song: SongRow) {
    setEditingId(song.id);
    setDraft({
      title: song.title,
      artist: song.artist,
      albumId: song.albumId ?? '',
      audioUrl: song.audioUrl,
      coverUrl: song.coverUrl ?? '',
      duration: song.duration,
      trackNumber: song.trackNumber,
      genre: song.genre ?? '',
      lyrics: '',
      audioFormat: song.audioFormat ?? '',
      isPublic: song.isPublic === 1,
    });
    setOpen(true);
    setMessage(null);
  }

  async function onAudioChange(file: File | null) {
    if (!file) return;
    setBusy(true);
    setMessage('音频上传中…');
    try {
      const result = await uploadMedia(file, 'audio');
      setDraft((prev) => ({
        ...prev,
        audioUrl: result.url,
        duration: result.duration ?? prev.duration,
        audioFormat: result.format ?? prev.audioFormat,
        title: prev.title || file.name.replace(/\.[^.]+$/, ''),
      }));
      setMessage('音频已上传');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '音频上传失败');
    } finally {
      setBusy(false);
    }
  }

  async function onCoverChange(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const result = await uploadMedia(file, 'cover');
      setDraft((prev) => ({ ...prev, coverUrl: result.url }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '封面上传失败');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const body = {
        title: draft.title.trim(),
        artist: draft.artist.trim(),
        albumId: draft.albumId || null,
        audioUrl: draft.audioUrl,
        coverUrl: draft.coverUrl || null,
        duration: draft.duration,
        trackNumber: draft.trackNumber,
        genre: draft.genre.trim() || null,
        lyrics: draft.lyrics.trim() || null,
        audioFormat: draft.audioFormat || null,
        isPublic: draft.isPublic,
      };
      const response = await adminFetch(
        editingId ? `/api/admin/songs/${editingId}` : '/api/admin/songs',
        { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(body) },
      );
      if (!response.ok) {
        setMessage(await readError(response));
        return;
      }
      await reload();
      setOpen(false);
      setMessage(editingId ? '歌曲已更新' : '歌曲已创建');
    } finally {
      setBusy(false);
    }
  }

  async function remove(song: SongRow) {
    if (!window.confirm(`删除歌曲「${song.title}」？音频文件会一并删除。`)) return;
    setBusy(true);
    try {
      const response = await adminFetch(`/api/admin/songs/${song.id}`, { method: 'DELETE' });
      if (!response.ok) {
        setMessage(await readError(response));
        return;
      }
      await reload();
      setMessage('歌曲已删除');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">歌曲</h1>
          <p className="mt-2 text-sm text-ink-soft">上传音频、编辑元数据、关联专辑。</p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="border border-ink bg-ink px-4 py-2 text-[11px] tracking-[0.16em] text-paper uppercase transition hover:bg-transparent hover:text-ink"
        >
          新建歌曲
        </button>
      </header>

      {message && <p className="mt-4 text-xs text-ink-soft">{message}</p>}

      {open && (
        <section className="mt-6 border border-line px-5 py-5">
          <h2 className="text-[11px] tracking-[0.2em] text-ink-mute uppercase">
            {editingId ? '编辑歌曲' : '新建歌曲'}
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-[10px] tracking-[0.16em] text-ink-mute uppercase">音频文件</span>
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/flac,audio/ogg,audio/mp4"
                  onChange={(event) => onAudioChange(event.target.files?.[0] ?? null)}
                  className="text-xs"
                />
                {draft.audioUrl && (
                  <span className="text-[11px] text-ink-mute">
                    已上传 · {formatDuration(draft.duration)}
                  </span>
                )}
              </div>
            </label>

            <label className="block">
              <span className="text-[10px] tracking-[0.16em] text-ink-mute uppercase">标题</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                className="input-line"
              />
            </label>

            <label className="block">
              <span className="text-[10px] tracking-[0.16em] text-ink-mute uppercase">艺术家</span>
              <input
                value={draft.artist}
                onChange={(event) => setDraft({ ...draft, artist: event.target.value })}
                className="input-line"
              />
            </label>

            <label className="block">
              <span className="text-[10px] tracking-[0.16em] text-ink-mute uppercase">所属专辑</span>
              <select
                value={draft.albumId}
                onChange={(event) => setDraft({ ...draft, albumId: event.target.value })}
                className="input-line"
              >
                <option value="">（单曲，不归入专辑）</option>
                {albums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[10px] tracking-[0.16em] text-ink-mute uppercase">
                曲目序号
              </span>
              <input
                type="number"
                min={0}
                value={draft.trackNumber}
                onChange={(event) =>
                  setDraft({ ...draft, trackNumber: Number(event.target.value) || 0 })
                }
                className="input-line"
              />
            </label>

            <label className="block">
              <span className="text-[10px] tracking-[0.16em] text-ink-mute uppercase">风格</span>
              <input
                value={draft.genre}
                onChange={(event) => setDraft({ ...draft, genre: event.target.value })}
                className="input-line"
              />
            </label>

            <label className="block">
              <span className="text-[10px] tracking-[0.16em] text-ink-mute uppercase">封面</span>
              <div className="mt-1.5 flex items-center gap-3">
                {draft.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={withBasePath(draft.coverUrl)} alt="" className="h-10 w-10 object-cover" />
                ) : null}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={(event) => onCoverChange(event.target.files?.[0] ?? null)}
                  className="text-xs"
                />
              </div>
            </label>

            <label className="block sm:col-span-2">
              <span className="text-[10px] tracking-[0.16em] text-ink-mute uppercase">
                歌词（可选）
              </span>
              <textarea
                value={draft.lyrics}
                onChange={(event) => setDraft({ ...draft, lyrics: event.target.value })}
                rows={4}
                className="input-line resize-y"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-ink-soft sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.isPublic}
                onChange={(event) => setDraft({ ...draft, isPublic: event.target.checked })}
              />
              在站点中显示
            </label>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={save}
              disabled={busy || !draft.title.trim() || !draft.audioUrl}
              className="border border-ink bg-ink px-4 py-2 text-[11px] tracking-[0.16em] text-paper uppercase transition hover:bg-transparent hover:text-ink disabled:opacity-40"
            >
              {busy ? '保存中…' : '保存'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border border-line px-4 py-2 text-[11px] tracking-[0.16em] text-ink-soft uppercase transition hover:border-ink hover:text-ink"
            >
              取消
            </button>
          </div>
        </section>
      )}

      <section className="mt-8">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[10px] tracking-[0.18em] text-ink-mute uppercase">
              <th className="py-2 font-normal">歌曲</th>
              <th className="py-2 font-normal">专辑</th>
              <th className="py-2 font-normal">时长</th>
              <th className="py-2 font-normal">来源</th>
              <th className="py-2 font-normal text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {songs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-ink-mute">
                  还没有歌曲
                </td>
              </tr>
            )}
            {songs.map((song) => (
              <tr key={song.id} className="border-b border-line/60">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 overflow-hidden bg-paper-deep">
                      {song.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={withBasePath(song.coverUrl)} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-ink">
                        {song.title}
                        {song.isPublic === 0 && (
                          <span className="ml-2 text-[11px] text-ink-mute">隐藏</span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-ink-mute">{song.artist}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 text-[12px] text-ink-soft">{song.albumTitle ?? '—'}</td>
                <td className="py-3 text-[12px] tabular-nums text-ink-soft">
                  {formatDuration(song.duration)}
                </td>
                <td className="py-3 text-[11px] text-ink-mute">
                  {song.uploaderName ?? (song.externalId ? '智能体' : '后台')}
                </td>
                <td className="py-3 text-right">
                  <button
                    type="button"
                    onClick={() => startEdit(song)}
                    className="mr-3 text-[12px] text-ink-soft transition hover:text-ink"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(song)}
                    className="text-[12px] text-ink-mute transition hover:text-ember"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
