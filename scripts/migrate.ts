#!/usr/bin/env tsx
/**
 * 初始化 / 升级数据库结构。
 * 幂等：重复执行安全。
 */
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { SCHEMA_SQL } from '../lib/schema';

const dataDir = process.env.MOLLY_DATA_DIR
  ? path.resolve(process.env.MOLLY_DATA_DIR)
  : path.join(process.cwd(), 'data');

for (const dir of [dataDir, path.join(dataDir, 'media'), path.join(dataDir, 'media', 'audio'), path.join(dataDir, 'media', 'covers')]) {
  fs.mkdirSync(dir, { recursive: true });
}

const dbPath = path.join(dataDir, 'mollychai.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(SCHEMA_SQL);

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
  .all() as { name: string }[];

console.log(`数据库已就绪：${dbPath}`);
console.log(`表：${tables.map((item) => item.name).join(', ')}`);
db.close();
