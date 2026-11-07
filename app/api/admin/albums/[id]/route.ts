import type { NextRequest } from 'next/server';

import { fail, ok, notFound, serverError, zodFail } from '@/lib/api';
import { auditAdmin, requireAdminRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { deleteMediaByUrl } from '@/lib/media';
import { albumInputSchema } from '@/lib/validation';

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

  const parsed = albumInputSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  const db = getDb();
  const existing = db
    .prepare('SELECT id, cover_url AS coverUrl FROM albums WHERE id = ?')
    .get(id) as { id: string; coverUrl: string | null } | undefined;
  if (!existing) return notFound('专辑不存在');

  try {
    db.prepare(
      `UPDATE albums SET
         title = ?, artist = ?, cover_url = ?, description = ?, release_date = ?,
         theme_color = ?, is_public = ?, sort_order = ?, external_id = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      input.title,
      input.artist,
      input.coverUrl ?? null,
      input.description ?? null,
      input.releaseDate ?? null,
      input.themeColor ?? null,
      input.isPublic === false ? 0 : 1,
      input.sortOrder ?? 0,
      input.externalId ?? null,
      new Date().toISOString(),
      id,
    );

    if (existing.coverUrl && input.coverUrl !== existing.coverUrl) {
      deleteMediaByUrl(existing.coverUrl);
    }

    auditAdmin('album.update', 'album', id, { title: input.title });
    return ok({ id });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE')) {
      return fail(409, 'DUPLICATE_EXTERNAL_ID', 'externalId 已被占用');
    }
    return serverError('更新专辑失败');
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = requireAdminRequest(request, true);
  if (!guard.ok) return fail(guard.status, guard.code, '无权执行该操作');

  const { id } = await context.params;
  const db = getDb();
  const existing = db
    .prepare('SELECT id, cover_url AS coverUrl FROM albums WHERE id = ?')
    .get(id) as { id: string; coverUrl: string | null } | undefined;
  if (!existing) return notFound('专辑不存在');

  try {
    // 专辑内歌曲保留，album_id 置空（外键 ON DELETE SET NULL）
    db.prepare('DELETE FROM albums WHERE id = ?').run(id);
    deleteMediaByUrl(existing.coverUrl);
    auditAdmin('album.delete', 'album', id, {});
    return ok({ id, deleted: true });
  } catch {
    return serverError('删除专辑失败');
  }
}
