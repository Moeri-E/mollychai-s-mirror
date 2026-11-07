import path from 'node:path';

export const SITE_NAME = "mollychai's mirror";
export const SITE_TAGLINE = '声音、记忆与片刻的镜像。';

export const ADMIN_COOKIE_NAME = 'mm_admin_session';
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** 智能体令牌前缀，格式：mk_live_<uuid>.<secret> */
export const AGENT_TOKEN_PREFIX = 'mk_live_';

export const DATA_DIR = process.env.MOLLY_DATA_DIR
  ? path.resolve(process.env.MOLLY_DATA_DIR)
  : path.join(process.cwd(), 'data');

export const MEDIA_DIR = path.join(DATA_DIR, 'media');
export const AUDIO_DIR = path.join(MEDIA_DIR, 'audio');
export const COVER_DIR = path.join(MEDIA_DIR, 'covers');
export const DB_PATH = path.join(DATA_DIR, 'mollychai.db');

export const MEDIA_URL_BASE = '/api/v1/media';

/** 上传限制 */
export const LIMITS: {
  audioMaxBytes: number;
  coverMaxBytes: number;
  audioMimeTypes: string[];
  coverMimeTypes: string[];
  titleMax: number;
  artistMax: number;
  albumTitleMax: number;
  genreMax: number;
  lyricsMax: number;
  descriptionMax: number;
  externalIdMax: number;
} = {
  audioMaxBytes: 50 * 1024 * 1024,
  coverMaxBytes: 8 * 1024 * 1024,
  audioMimeTypes: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/flac',
    'audio/x-flac',
    'audio/ogg',
    'audio/mp4',
    'audio/aac',
    'audio/x-m4a',
  ],
  coverMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  titleMax: 120,
  artistMax: 120,
  albumTitleMax: 120,
  genreMax: 60,
  lyricsMax: 20000,
  descriptionMax: 4000,
  externalIdMax: 100,
};

export const AUDIO_EXT: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/x-m4a': 'm4a',
};

export const COVER_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
