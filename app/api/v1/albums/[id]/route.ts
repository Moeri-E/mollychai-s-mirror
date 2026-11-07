import { notFound, ok, serverError } from '@/lib/api';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const db = getDb();

    const album = db
      .prepare(
        `SELECT a.id, a.title, a.artist, a.cover_url AS coverUrl, a.description,
                a.release_date AS releaseDate, a.theme_color AS themeColor,
                a.sort_order AS sortOrder, a.created_at AS createdAt
         FROM albums a
         WHERE a.id = ? AND a.is_public = 1`,
      )
      .get(id) as Record<string, unknown> | undefined;

    if (!album) return notFound('专辑不存在或未公开');

    const tracks = db
      .prepare(
        `SELECT s.id, s.title, s.artist, s.duration, s.track_number AS trackNumber,
                s.cover_url AS coverUrl, s.audio_format AS audioFormat, s.genre
         FROM songs s
         WHERE s.album_id = ? AND s.is_public = 1
         ORDER BY s.track_number ASC, s.created_at ASC`,
      )
      .all(id);

    return ok({ ...album, tracks });
  } catch {
    return serverError('读取专辑详情失败');
  }
}
