import { ok, serverError } from '@/lib/api';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const albumId = url.searchParams.get('albumId');
    const limitRaw = Number(url.searchParams.get('limit') ?? '200');
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;

    const baseSelect = `SELECT s.id, s.title, s.artist, s.album_id AS albumId, s.duration,
                               s.track_number AS trackNumber, s.cover_url AS coverUrl,
                               s.audio_url AS audioUrl, s.audio_format AS audioFormat,
                               s.genre, s.created_at AS createdAt,
                               a.title AS albumTitle, a.cover_url AS albumCoverUrl
                        FROM songs s
                        LEFT JOIN albums a ON a.id = s.album_id
                        WHERE s.is_public = 1`;

    const rows = albumId
      ? getDb()
          .prepare(`${baseSelect} AND s.album_id = ? ORDER BY s.track_number ASC, s.created_at ASC LIMIT ?`)
          .all(albumId, limit)
      : getDb()
          .prepare(`${baseSelect} ORDER BY s.created_at DESC LIMIT ?`)
          .all(limit);

    return ok(rows);
  } catch {
    return serverError('读取歌曲列表失败');
  }
}
