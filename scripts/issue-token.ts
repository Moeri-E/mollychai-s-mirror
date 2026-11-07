#!/usr/bin/env tsx
/**
 * 命令行签发智能体上传令牌（也可在管理后台 Agents 页面操作）。
 *
 *   npm run agent:token -- --uploader suno-agent --name "Suno 1" --token-name default
 *
 * 明文令牌只输出一次，请立即保存。
 */
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { sha256 } from '../lib/crypto';
import { SCHEMA_SQL } from '../lib/schema';

function arg(flag: string, fallback = ''): string {
  const index = process.argv.indexOf(flag);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const uploaderId = arg('--uploader', process.env.UPLOADER_ID ?? '');
const displayName = arg('--name', uploaderId);
const tokenName = arg('--token-name', 'default');
const expiresAt = arg('--expires', '');

if (!uploaderId) {
  console.error('缺少 --uploader <id>');
  process.exit(1);
}

const dataDir = process.env.MOLLY_DATA_DIR
  ? path.resolve(process.env.MOLLY_DATA_DIR)
  : path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'mollychai.db'));
db.pragma('journal_mode = WAL');
db.exec(SCHEMA_SQL);

const id = randomUUID();
const secret = randomBytes(32).toString('base64url');
const token = `mk_live_${id}.${secret}`;
const now = new Date().toISOString();

db.prepare(
  `INSERT INTO uploaders(id, display_name, enabled, created_at, updated_at)
   VALUES (?, ?, 1, ?, ?)
   ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, enabled = 1, updated_at = excluded.updated_at`,
).run(uploaderId, displayName || uploaderId, now, now);

db.prepare(
  `INSERT INTO upload_tokens(
     id, uploader_id, name, token_hash, token_prefix, token_secret,
     enabled, expires_at, created_at, updated_at
   ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
).run(
  id,
  uploaderId,
  tokenName,
  sha256(token),
  `mk_live_${id.slice(0, 8)}`,
  secret,
  expiresAt || null,
  now,
  now,
);

db.close();

console.log('');
console.log('令牌签发成功（只显示这一次，请立即保存）：');
console.log('');
console.log(`  ${token}`);
console.log('');
console.log(`uploader: ${uploaderId} (${displayName || uploaderId})`);
console.log(`token:    ${tokenName}${expiresAt ? ` · 到期 ${expiresAt}` : ''}`);
