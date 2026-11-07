#!/usr/bin/env tsx
/**
 * 设置（或重置）管理员密码。
 *
 *   npm run admin:password -- 'my-strong-password'
 *   ADMIN_PASSWORD='my-strong-password' npm run admin:password
 *
 * 不传参数时进入交互输入。
 */
import { createInterface } from 'node:readline/promises';
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { hashPassword } from '../lib/crypto';
import { SCHEMA_SQL } from '../lib/schema';

async function main() {
  let password = process.argv[2] ?? process.env.ADMIN_PASSWORD ?? '';

  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question('新的管理员密码：');
    const confirm = await rl.question('再输入一次确认：');
    rl.close();
    if (password !== confirm) {
      console.error('两次输入不一致，已取消。');
      process.exit(1);
    }
  }

  if (password.length < 8) {
    console.error('密码至少 8 位。');
    process.exit(1);
  }

  const dataDir = process.env.MOLLY_DATA_DIR
    ? path.resolve(process.env.MOLLY_DATA_DIR)
    : path.join(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(path.join(dataDir, 'mollychai.db'));
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO settings(key, value, updated_at) VALUES ('admin_password_hash', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(hashPassword(password), now);

  // 重置密码后作废所有会话
  db.prepare('DELETE FROM admin_sessions').run();
  db.close();

  console.log('管理员密码已更新，所有旧会话已失效。');
}

void main();
