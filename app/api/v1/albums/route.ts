import { ok, serverError } from '@/lib/api';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = getDb()
      .prepare(
        `SELECT a.id, a.title, a.artist, a.cover_url AS coverUrl, a.description,
                a.release_date AS releaseDate, a.theme_color AS themeColor,
                a.sort_order AS sortOrder, a.created_at AS createdAt,
                (SELECT COUNT(*) FROM songs s WHERE s.album_id = a.id AND s.is_public = 1) AS trackCount,
                (SELECT COALESCE(SUM(s.duration), 0) FROM songs s WHERE s.album_id = a.id AND s.is_public = 1) AS totalDuration
         FROM albums a
         WHERE a.is_public = 1
         ORDER BY a.sort_order ASC, a.created_at DESC`,
      )
      .all();

    return ok(rows);
  } catch {
    return serverError('读取专辑列表失败');
  }
}
