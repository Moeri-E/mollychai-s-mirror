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

export type AlbumWithTracks = AlbumCard & { tracks: Track[] };

/**
 * 首页用：一次把专辑和它的曲目都取出来。
 * 打开专辑时要立刻能播，不能等一次网络请求——那个瞬间正好是翻盖动画，
 * 晚到一步就会出现「盖子开了但没声音」。
 */
export function listPublicAlbumsWithTracks(): AlbumWithTracks[] {
  const albums = listPublicAlbums();
  const stmt = getDb().prepare(
    `SELECT s.id, s.title, s.artist, s.duration, s.cover_url AS coverUrl, s.album_id AS albumId
     FROM songs s
     WHERE s.album_id = ? AND s.is_public = 1
     ORDER BY s.track_number ASC, s.created_at ASC`,
  );

  const withTracks: AlbumWithTracks[] = albums.map((album) => ({
    ...album,
    tracks: (stmt.all(album.id) as {
      id: string;
      title: string;
      artist: string;
      duration: number;
      coverUrl: string | null;
      albumId: string;
    }[]).map((song) => toTrack({ ...song, albumTitle: album.title })),
  }));

  // 没有专辑归属的公开单曲也要进首页：智能体只提交一首歌（没给 albumTitle、
  // 音频里也没有 ALBUM tag）时，若只查 albums 表，主页面会看不到任何新内容。
  // 用歌名当卡片标题、歌曲封面当卡片封面，虚拟成一张「单曲」卡片。
  const singles = getDb()
    .prepare(
      `SELECT s.id, s.title, s.artist, s.duration, s.cover_url AS coverUrl
       FROM songs s
       WHERE s.album_id IS NULL AND s.is_public = 1
       ORDER BY s.created_at DESC`,
    )
    .all() as {
    id: string;
    title: string;
    artist: string;
    duration: number;
    coverUrl: string | null;
  }[];

  const singleCards: AlbumWithTracks[] = singles.map((song) => ({
    id: `single:${song.id}`,
    title: song.title,
    artist: song.artist,
    coverUrl: song.coverUrl,
    description: null,
    releaseDate: null,
    themeColor: null,
    trackCount: 1,
    totalDuration: song.duration,
    tracks: [toTrack({ ...song, albumTitle: '单曲' })],
  }));

  return [...withTracks, ...singleCards];
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
