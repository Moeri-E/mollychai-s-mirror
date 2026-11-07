'use client';

import { useState } from 'react';

import { withBasePath } from '@/lib/base-path';
import { adminFetch, readError, uploadMedia } from '@/lib/client-api';

export type AlbumRow = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  description: string | null;
  releaseDate: string | null;
  themeColor: string | null;
  isPublic: number;
  sortOrder: number;
  trackCount: number;
};

type Draft = {
  title: string;
  artist: string;
  description: string;
  releaseDate: string;
  themeColor: string;
  isPublic: boolean;
  coverUrl: string;
};

const EMPTY: Draft = {
  title: '',
  artist: "mollychai",
  description: '',
  releaseDate: '',
  themeColor: '',
  isPublic: true,
  coverUrl: '',
};

export function AlbumManager({ initial }: { initial: AlbumRow[] }) {
  const [albums, setAlbums] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    const response = await adminFetch('/api/admin/albums');
    const payload = await response.json();
    setAlbums(payload.data ?? []);
  }

  function startCreate() {
    setEditingId(null);
    setDraft(EMPTY);
    setOpen(true);
    setMessage(null);
  }

  function startEdit(album: AlbumRow) {
    setEditingId(album.id);
    setDraft({
      title: album.title,
      artist: album.artist,
      description: album.description ?? '',
      releaseDate: album.releaseDate ?? '',
      themeColor: album.themeColor ?? '',
      isPublic: album.isPublic === 1,
      coverUrl: album.coverUrl ?? '',
    });
    setOpen(true);
    setMessage(null);
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
        artist: draft.artist.trim() || 'mollychai',
        description: draft.description.trim() || null,
        releaseDate: draft.releaseDate.trim() || null,
        themeColor: draft.themeColor.trim() || null,
        isPublic: draft.isPublic,
        coverUrl: draft.coverUrl || null,
      };
      const response = await adminFetch(
        editingId ? `/api/admin/albums/${editingId}` : '/api/admin/albums',
        { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(body) },
      );
      if (!response.ok) {
        setMessage(await readError(response));
        return;
      }
      await reload();
      setOpen(false);
      setMessage(editingId ? '专辑已更新' : '专辑已创建');
    } finally {
      setBusy(false);
    }
  }

  async function remove(album: AlbumRow) {
    if (!window.confirm(`删除专辑「${album.title}」？专辑内歌曲会保留为单曲。`)) return;
    setBusy(true);
    try {
      const response = await adminFetch(`/api/admin/albums/${album.id}`, { method: 'DELETE' });
      if (!response.ok) {
        setMessage(await readError(response));
        return;
      }
      await reload();
      setMessage('专辑已删除');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Albums</h1>
          <p className="mt-2 text-sm text-ink-soft">创建专辑、更换封面、控制是否公开。</p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="border border-ink bg-ink px-4 py-2 text-[11px] tracking-[0.16em] text-paper uppercase transition hover:bg-transparent hover:text-ink"
        >
          new album
        </button>
      </header>

      {message && <p className="mt-4 text-xs text-ink-soft">{message}</p>}

      {open && (
        <section className="mt-6 border border-line px-5 py-5">
          <h2 className="text-[11px] tracking-[0.2em] text-ink-mute uppercase">
            {editingId ? 'edit album' : 'new album'}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="标题">
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                className="input-line"
              />
            </Field>
            <Field label="艺术家">
              <input
                value={draft.artist}
                onChange={(event) => setDraft({ ...draft, artist: event.target.value })}
                className="input-line"
              />
            </Field>
            <Field label="发行日期 (YYYY-MM-DD)">
              <input
                value={draft.releaseDate}
                onChange={(event) => setDraft({ ...draft, releaseDate: event.target.value })}
                placeholder="2026-01-01"
                className="input-line"
              />
            </Field>
            <Field label="主题色 (可选, #RRGGBB)">
              <input
                value={draft.themeColor}
                onChange={(event) => setDraft({ ...draft, themeColor: event.target.value })}
                placeholder="#2f5fd0"
                className="input-line"
              />
            </Field>
            <Field label="简介" full>
              <textarea
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                rows={3}
                className="input-line resize-y"
              />
            </Field>
            <Field label="封面" full>
              <div className="flex items-center gap-4">
                {draft.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={withBasePath(draft.coverUrl)} alt="" className="h-16 w-16 object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center border border-dashed border-line text-[10px] text-ink-mute">
                    无
                  </div>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={(event) => onCoverChange(event.target.files?.[0] ?? null)}
                  className="text-xs"
                />
              </div>
            </Field>
            <Field label="公开" full>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={draft.isPublic}
                  onChange={(event) => setDraft({ ...draft, isPublic: event.target.checked })}
                />
                在站点中显示
              </label>
            </Field>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={save}
              disabled={busy || !draft.title.trim()}
              className="border border-ink bg-ink px-4 py-2 text-[11px] tracking-[0.16em] text-paper uppercase transition hover:bg-transparent hover:text-ink disabled:opacity-40"
            >
              {busy ? 'saving…' : 'save'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border border-line px-4 py-2 text-[11px] tracking-[0.16em] text-ink-soft uppercase transition hover:border-ink hover:text-ink"
            >
              cancel
            </button>
          </div>
        </section>
      )}

      <section className="mt-8">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[10px] tracking-[0.18em] text-ink-mute uppercase">
              <th className="py-2 font-normal">Album</th>
              <th className="py-2 font-normal">Tracks</th>
              <th className="py-2 font-normal">Status</th>
              <th className="py-2 font-normal text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {albums.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-ink-mute">
                  还没有专辑
                </td>
              </tr>
            )}
            {albums.map((album) => (
              <tr key={album.id} className="border-b border-line/60">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden bg-paper-deep">
                      {album.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={withBasePath(album.coverUrl)} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-ink">{album.title}</p>
                      <p className="truncate text-[11px] text-ink-mute">
                        {album.artist}
                        {album.releaseDate ? ` · ${album.releaseDate.slice(0, 4)}` : ''}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-3 text-[12px] tabular-nums text-ink-soft">{album.trackCount}</td>
                <td className="py-3 text-[12px]">
                  {album.isPublic === 1 ? (
                    <span className="text-ink-soft">公开</span>
                  ) : (
                    <span className="text-ink-mute">隐藏</span>
                  )}
                </td>
                <td className="py-3 text-right">
                  <button
                    type="button"
                    onClick={() => startEdit(album)}
                    className="mr-3 text-[11px] tracking-[0.1em] text-ink-soft uppercase transition hover:text-ink"
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(album)}
                    className="text-[11px] tracking-[0.1em] text-ink-mute uppercase transition hover:text-ember"
                  >
                    delete
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

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={full ? 'sm:col-span-2 block' : 'block'}>
      <span className="text-[10px] tracking-[0.16em] text-ink-mute uppercase">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
