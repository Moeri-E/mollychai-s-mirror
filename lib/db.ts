import fs from 'node:fs';

import Database from 'better-sqlite3';

import { AUDIO_DIR, COVER_DIR, DATA_DIR, DB_PATH } from '@/lib/constants';
import { SCHEMA_SQL } from '@/lib/schema';

declare global {
  // eslint-disable-next-line no-var
  var __mollyDb: Database.Database | undefined;
}

function ensureDirs() {
  for (const dir of [DATA_DIR, AUDIO_DIR, COVER_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createDb() {
  ensureDirs();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}

export function getDb(): Database.Database {
  if (!globalThis.__mollyDb) {
    globalThis.__mollyDb = createDb();
  }
  return globalThis.__mollyDb;
}

export type Album = {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  description: string | null;
  release_date: string | null;
  theme_color: string | null;
  is_public: number;
  sort_order: number;
  external_id: string | null;
  uploader_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Song = {
  id: string;
  album_id: string | null;
  title: string;
  artist: string;
  audio_url: string;
  cover_url: string | null;
  duration: number;
  track_number: number;
  audio_format: string | null;
  genre: string | null;
  lyrics: string | null;
  is_public: number;
  sort_order: number;
  external_id: string | null;
  uploader_id: string | null;
  created_at: string;
  updated_at: string;
};
