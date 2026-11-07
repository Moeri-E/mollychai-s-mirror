import { randomUUID } from 'node:crypto';

import type { NextRequest } from 'next/server';

import { fail, ok, serverError, zodFail } from '@/lib/api';
import { auditAdmin, requireAdminRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { albumInputSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const guard = requireAdminRequest(request);
  if (!guard.ok) return fail(guard.status, guard.code, '未登录或会话已过期');

  const rows = getDb()
    .prepare(
      `SELECT a.id, a.title, a.artist, a.cover_url AS coverUrl, a.description,
              a.release_date AS releaseDate, a.theme_color AS themeColor,
              a.is_public AS isPublic, a.sort_order AS sortOrder, a.external_id AS externalId,
              a.created_at AS createdAt,
              (SELECT COUNT(*) FROM songs s WHERE s.album_id = a.id) AS trackCount
       FROM albums a
       ORDER BY a.sort_order ASC, a.created_at DESC`,
    )
    .all();

  return ok(rows);
}

export async function POST(request: NextRequest) {
  const guard = requireAdminRequest(request, true);
  if (!guard.ok) return fail(guard.status, guard.code, '无权执行该操作');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'INVALID_JSON', '请求体必须是 JSON');
  }

  const parsed = albumInputSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  try {
    const db = getDb();
    const now = new Date().toISOString();
    const id = randomUUID();

    db.prepare(
      `INSERT INTO albums(
         id, title, artist, cover_url, description, release_date, theme_color,
         is_public, sort_order, external_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.title,
      input.artist,
      input.coverUrl ?? null,
      input.description ?? null,
      input.releaseDate ?? null,
      input.themeColor ?? null,
      input.isPublic === false ? 0 : 1,
      input.sortOrder ?? 0,
      input.externalId ?? null,
      now,
      now,
    );

    auditAdmin('album.create', 'album', id, { title: input.title });
    return ok({ id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE')) {
      return fail(409, 'DUPLICATE_EXTERNAL_ID', 'externalId 已被占用');
    }
    return serverError('创建专辑失败');
  }
}
