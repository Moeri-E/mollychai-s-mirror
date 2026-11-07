import { getDb } from '@/lib/db';
import type { Track } from '@/lib/track';

export type AlbumCard = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  description: string | null;
  releaseDate: string | null;
  themeColor: string | null;
  trackCount: number;
  totalDuration: number;
};

export type AlbumTrack = {
  id: string;
  title: string;
  artist: string;
  duration: number;
  trackNumber: number;
  coverUrl: string | null;
};

export function listPublicAlbums(): AlbumCard[] {
  return getDb()
    .prepare(
      `SELECT a.id, a.title, a.artist, a.cover_url AS coverUrl, a.description,
              a.release_date AS releaseDate, a.theme_color AS themeColor,
              (SELECT COUNT(*) FROM songs s WHERE s.album_id = a.id AND s.is_public = 1) AS trackCount,
              (SELECT COALESCE(SUM(s.duration), 0) FROM songs s WHERE s.album_id = a.id AND s.is_public = 1) AS totalDuration
       FROM albums a
       WHERE a.is_public = 1
       ORDER BY a.sort_order ASC, a.created_at DESC`,
    )
    .all() as AlbumCard[];
}

export function getPublicAlbum(id: string): (AlbumCard & { tracks: AlbumTrack[] }) | null {
  const db = getDb();
  const album = db
    .prepare(
      `SELECT a.id, a.title, a.artist, a.cover_url AS coverUrl, a.description,
              a.release_date AS releaseDate, a.theme_color AS themeColor,
              (SELECT COUNT(*) FROM songs s WHERE s.album_id = a.id AND s.is_public = 1) AS trackCount,
              (SELECT COALESCE(SUM(s.duration), 0) FROM songs s WHERE s.album_id = a.id AND s.is_public = 1) AS totalDuration
       FROM albums a
       WHERE a.id = ? AND a.is_public = 1`,
    )
    .get(id) as AlbumCard | undefined;

  if (!album) return null;

  const tracks = db
    .prepare(
      `SELECT s.id, s.title, s.artist, s.duration, s.track_number AS trackNumber,
              s.cover_url AS coverUrl
       FROM songs s
       WHERE s.album_id = ? AND s.is_public = 1
       ORDER BY s.track_number ASC, s.created_at ASC`,
    )
    .all(id) as AlbumTrack[];

  return { ...album, tracks };
}

export type SongCard = AlbumTrack & {
  albumId: string | null;
  albumTitle: string | null;
  albumCoverUrl: string | null;
  genre: string | null;
  createdAt: string;
};

export function listPublicSongs(limit = 60): SongCard[] {
  return getDb()
    .prepare(
      `SELECT s.id, s.title, s.artist, s.duration, s.track_number AS trackNumber,
              s.cover_url AS coverUrl, s.album_id AS albumId, s.genre, s.created_at AS createdAt,
              a.title AS albumTitle, a.cover_url AS albumCoverUrl
       FROM songs s
       LEFT JOIN albums a ON a.id = s.album_id
       WHERE s.is_public = 1
       ORDER BY s.created_at DESC
       LIMIT ?`,
    )
    .all(limit) as SongCard[];
}

export function toTrack(song: {
  id: string;
  title: string;
  artist: string;
  duration: number;
  coverUrl?: string | null;
  albumTitle?: string | null;
  albumId?: string | null;
}): Track {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    duration: song.duration,
    coverUrl: song.coverUrl ?? null,
    albumTitle: song.albumTitle ?? null,
    albumId: song.albumId ?? null,
  };
}

export function getSiteStats() {
  const db = getDb();
  const albums = db.prepare('SELECT COUNT(*) AS c FROM albums WHERE is_public = 1').get() as {
    c: number;
  };
  const songs = db.prepare('SELECT COUNT(*) AS c FROM songs WHERE is_public = 1').get() as {
    c: number;
  };
  const uploaders = db.prepare('SELECT COUNT(*) AS c FROM uploaders').get() as { c: number };
  const tokens = db
    .prepare('SELECT COUNT(*) AS c FROM upload_tokens WHERE enabled = 1')
    .get() as { c: number };
  return {
    albums: albums.c,
    songs: songs.c,
    uploaders: uploaders.c,
    activeTokens: tokens.c,
  };
}

export function formatTotalDuration(totalSeconds: number): string {
  if (!totalSeconds) return '0 min';
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
