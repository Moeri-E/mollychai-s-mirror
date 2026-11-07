import { AlbumManager, type AlbumRow } from '@/components/admin/album-manager';
import { requireAdminPage } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminAlbumsPage() {
  await requireAdminPage();

  const albums = getDb()
    .prepare(
      `SELECT a.id, a.title, a.artist, a.cover_url AS coverUrl, a.description,
              a.release_date AS releaseDate, a.theme_color AS themeColor,
              a.is_public AS isPublic, a.sort_order AS sortOrder,
              (SELECT COUNT(*) FROM songs s WHERE s.album_id = a.id) AS trackCount
       FROM albums a
       ORDER BY a.sort_order ASC, a.created_at DESC`,
    )
    .all() as AlbumRow[];

  return <AlbumManager initial={albums} />;
}
