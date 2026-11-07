import { notFound, ok, serverError } from '@/lib/api';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const song = getDb()
      .prepare(
        `SELECT s.id, s.title, s.artist, s.album_id AS albumId, s.duration,
                s.track_number AS trackNumber, s.cover_url AS coverUrl,
                s.audio_url AS audioUrl, s.audio_format AS audioFormat,
                s.genre, s.lyrics, s.created_at AS createdAt,
                a.title AS albumTitle, a.cover_url AS albumCoverUrl, a.theme_color AS themeColor
         FROM songs s
         LEFT JOIN albums a ON a.id = s.album_id
         WHERE s.id = ? AND s.is_public = 1`,
      )
      .get(id) as Record<string, unknown> | undefined;

    if (!song) return notFound('歌曲不存在或未公开');
    return ok({ ...song, streamUrl: `/api/v1/songs/${id}/stream` });
  } catch {
    return serverError('读取歌曲详情失败');
  }
}
