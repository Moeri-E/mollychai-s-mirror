import type { NextRequest } from 'next/server';

import { fail, ok, notFound, serverError, zodFail } from '@/lib/api';
import { auditAdmin, requireAdminRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { deleteMediaByUrl } from '@/lib/media';
import { songInputSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = requireAdminRequest(request, true);
  if (!guard.ok) return fail(guard.status, guard.code, '无权执行该操作');

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'INVALID_JSON', '请求体必须是 JSON');
  }

  const parsed = songInputSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  const db = getDb();
  const existing = db
    .prepare('SELECT id, audio_url AS audioUrl, cover_url AS coverUrl FROM songs WHERE id = ?')
    .get(id) as { id: string; audioUrl: string; coverUrl: string | null } | undefined;
  if (!existing) return notFound('歌曲不存在');

  try {
    db.prepare(
      `UPDATE songs SET
         album_id = ?, title = ?, artist = ?, audio_url = ?, cover_url = ?, duration = ?,
         track_number = ?, audio_format = ?, genre = ?, lyrics = ?, is_public = ?,
         sort_order = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      input.albumId ?? null,
      input.title,
      input.artist ?? '',
      input.audioUrl,
      input.coverUrl ?? null,
      input.duration ?? 0,
      input.trackNumber ?? 0,
      input.audioFormat ?? null,
      input.genre ?? null,
      input.lyrics ?? null,
      input.isPublic === false ? 0 : 1,
      input.sortOrder ?? 0,
      new Date().toISOString(),
      id,
    );

    if (existing.audioUrl !== input.audioUrl) deleteMediaByUrl(existing.audioUrl);
    if (existing.coverUrl && existing.coverUrl !== input.coverUrl) deleteMediaByUrl(existing.coverUrl);

    auditAdmin('song.update', 'song', id, { title: input.title });
    return ok({ id });
  } catch {
    return serverError('更新歌曲失败');
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = requireAdminRequest(request, true);
  if (!guard.ok) return fail(guard.status, guard.code, '无权执行该操作');

  const { id } = await context.params;
  const db = getDb();
  const existing = db
    .prepare('SELECT id, audio_url AS audioUrl, cover_url AS coverUrl FROM songs WHERE id = ?')
    .get(id) as { id: string; audioUrl: string; coverUrl: string | null } | undefined;
  if (!existing) return notFound('歌曲不存在');

  try {
    db.prepare('DELETE FROM songs WHERE id = ?').run(id);
    deleteMediaByUrl(existing.audioUrl);
    deleteMediaByUrl(existing.coverUrl);
    auditAdmin('song.delete', 'song', id, {});
    return ok({ id, deleted: true });
  } catch {
    return serverError('删除歌曲失败');
  }
}
