import { randomUUID } from 'node:crypto';

import type { NextRequest } from 'next/server';

import { fail, ok, serverError, zodFail } from '@/lib/api';
import { auditAdmin, requireAdminRequest } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { songInputSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const guard = requireAdminRequest(request);
  if (!guard.ok) return fail(guard.status, guard.code, '未登录或会话已过期');

  const rows = getDb()
    .prepare(
      `SELECT s.id, s.title, s.artist, s.album_id AS albumId, s.audio_url AS audioUrl,
              s.cover_url AS coverUrl, s.duration, s.track_number AS trackNumber,
              s.audio_format AS audioFormat, s.genre, s.is_public AS isPublic,
              s.sort_order AS sortOrder, s.external_id AS externalId,
              s.created_at AS createdAt, a.title AS albumTitle,
              u.display_name AS uploaderName
       FROM songs s
       LEFT JOIN albums a ON a.id = s.album_id
       LEFT JOIN uploaders u ON u.id = s.uploader_id
       ORDER BY s.created_at DESC`,
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

  const parsed = songInputSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  try {
    const db = getDb();
    const now = new Date().toISOString();
    const id = randomUUID();

    db.prepare(
      `INSERT INTO songs(
         id, album_id, title, artist, audio_url, cover_url, duration, track_number,
         audio_format, genre, lyrics, is_public, sort_order, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
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
      now,
      now,
    );

    auditAdmin('song.create', 'song', id, { title: input.title });
    return ok({ id }, { status: 201 });
  } catch {
    return serverError('创建歌曲失败');
  }
}
