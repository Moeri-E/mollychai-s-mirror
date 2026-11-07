import { SongManager, type SongRow } from '@/components/admin/song-manager';
import { requireAdminPage } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminSongsPage() {
  await requireAdminPage();
  const db = getDb();

  const songs = db
    .prepare(
      `SELECT s.id, s.title, s.artist, s.album_id AS albumId, s.audio_url AS audioUrl,
              s.cover_url AS coverUrl, s.duration, s.track_number AS trackNumber,
              s.audio_format AS audioFormat, s.genre, s.is_public AS isPublic,
              s.external_id AS externalId, s.created_at AS createdAt,
              a.title AS albumTitle, u.display_name AS uploaderName
       FROM songs s
       LEFT JOIN albums a ON a.id = s.album_id
       LEFT JOIN uploaders u ON u.id = s.uploader_id
       ORDER BY s.created_at DESC`,
    )
    .all() as SongRow[];

  const albums = db
    .prepare('SELECT id, title FROM albums ORDER BY title ASC')
    .all() as { id: string; title: string }[];

  return <SongManager initial={songs} albums={albums} />;
}
