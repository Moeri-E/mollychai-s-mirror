import { randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

import { ADMIN_COOKIE_NAME, ADMIN_SESSION_TTL_MS, AGENT_TOKEN_PREFIX } from '@/lib/constants';
import { hashPassword, safeEqualHex, sha256, verifyPassword } from '@/lib/crypto';
import { getDb } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

export type AdminSession = {
  tokenHash: string;
  csrfToken: string;
  expiresAt: string;
};

export type AgentPrincipal = {
  tokenId: string;
  uploaderId: string;
  uploaderName: string;
};

export type AdminUploadToken = {
  id: string;
  name: string;
  tokenPrefix: string;
  tokenSecret: string | null;
  enabled: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  songCount: number;
};

export type AdminUploader = {
  id: string;
  displayName: string;
  enabled: number;
  updatedAt: string;
  tokens: AdminUploadToken[];
  songCount: number;
};

const TOKEN_PATTERN = new RegExp(
  `^${AGENT_TOKEN_PREFIX}([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\.([A-Za-z0-9_-]{43})$`,
);

/* ------------------------------------------------------------------ */
/* 请求上下文辅助                                                       */
/* ------------------------------------------------------------------ */

export function getRequestIp(request: Request): string {
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export function getSetting(key: string): string | null {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings(key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, value, new Date().toISOString());
}

/* ------------------------------------------------------------------ */
/* 智能体令牌                                                           */
/* ------------------------------------------------------------------ */

export function generateAgentToken() {
  const id = randomUUID();
  const secret = randomBytes(32).toString('base64url');
  return {
    id,
    token: `${AGENT_TOKEN_PREFIX}${id}.${secret}`,
    tokenHash: sha256(`${AGENT_TOKEN_PREFIX}${id}.${secret}`),
    tokenPrefix: `${AGENT_TOKEN_PREFIX}${id.slice(0, 8)}`,
    tokenSecret: secret,
  };
}

export function parseAgentToken(token: string) {
  const match = TOKEN_PATTERN.exec(token);
  return match ? { id: match[1] } : null;
}

export function issueUploadToken(input: {
  uploaderId: string;
  displayName: string;
  tokenName: string;
  expiresAt?: string | null;
}) {
  if (input.expiresAt && new Date(input.expiresAt).getTime() <= Date.now()) {
    throw new Error('TOKEN_EXPIRY_MUST_BE_FUTURE');
  }
  const db = getDb();
  const generated = generateAgentToken();
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO uploaders(id, display_name, enabled, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name,
         enabled = 1, updated_at = excluded.updated_at`,
    ).run(input.uploaderId, input.displayName, now, now);

    db.prepare(
      `INSERT INTO upload_tokens(
         id, uploader_id, name, token_hash, token_prefix, token_secret,
         enabled, expires_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).run(
      generated.id,
      input.uploaderId,
      input.tokenName,
      generated.tokenHash,
      generated.tokenPrefix,
      generated.tokenSecret,
      input.expiresAt ?? null,
      now,
      now,
    );
  })();

  return {
    id: generated.id,
    token: generated.token,
    tokenPrefix: generated.tokenPrefix,
  };
}

type TokenRow = {
  id: string;
  uploaderId: string;
  tokenHash: string;
  enabled: number;
  expiresAt: string | null;
  uploaderEnabled: number;
  uploaderName: string;
};

function verifyAgentToken(token: string): AgentPrincipal | null {
  const parsed = parseAgentToken(token);
  if (!parsed) return null;

  const row = getDb()
    .prepare(
      `SELECT t.id, t.uploader_id AS uploaderId, t.token_hash AS tokenHash,
              t.enabled, t.expires_at AS expiresAt,
              u.enabled AS uploaderEnabled, u.display_name AS uploaderName
       FROM upload_tokens t
       JOIN uploaders u ON u.id = t.uploader_id
       WHERE t.id = ?`,
    )
    .get(parsed.id) as TokenRow | undefined;

  if (
    !row ||
    row.enabled !== 1 ||
    row.uploaderEnabled !== 1 ||
    (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) ||
    !safeEqualHex(sha256(token), row.tokenHash)
  ) {
    return null;
  }

  getDb()
    .prepare('UPDATE upload_tokens SET last_used_at = ? WHERE id = ?')
    .run(new Date().toISOString(), row.id);

  return {
    tokenId: row.id,
    uploaderId: row.uploaderId,
    uploaderName: row.uploaderName,
  };
}

export type AgentAuthResult =
  | { ok: true; principal: AgentPrincipal }
  | { ok: false; status: number; code: string; retryAfterSeconds?: number; message: string };

export function requireAgentRequest(request: Request): AgentAuthResult {
  const ip = getRequestIp(request);
  const ipLimit = checkRateLimit(`agent-ip:${ip}`, 60, 60_000);
  if (!ipLimit.allowed) {
    return {
      ok: false,
      status: 429,
      code: 'RATE_LIMITED',
      retryAfterSeconds: ipLimit.retryAfterSeconds,
      message: '请求过于频繁，请稍后再试',
    };
  }

  const authorization = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  const credential = match?.[1] ?? '';

  if (!credential || credential.length > 512) {
    return { ok: false, status: 401, code: 'INVALID_CREDENTIALS', message: '缺少或格式错误的 Authorization' };
  }

  const principal = verifyAgentToken(credential);
  if (!principal) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: '令牌无效、已停用或已过期',
    };
  }

  const tokenLimit = checkRateLimit(`agent-token:${principal.tokenId}`, 30, 60_000);
  if (!tokenLimit.allowed) {
    return {
      ok: false,
      status: 429,
      code: 'RATE_LIMITED',
      retryAfterSeconds: tokenLimit.retryAfterSeconds,
      message: '该令牌请求过于频繁，请稍后再试',
    };
  }

  return { ok: true, principal };
}

export function getAdminUploaders(): AdminUploader[] {
  const db = getDb();
  const uploaders = db
    .prepare(
      `SELECT id, display_name AS displayName, enabled, updated_at AS updatedAt
       FROM uploaders ORDER BY updated_at DESC, id`,
    )
    .all() as { id: string; displayName: string; enabled: number; updatedAt: string }[];

  const tokens = db
    .prepare(
      `SELECT id, uploader_id AS uploaderId, name, token_prefix AS tokenPrefix,
              token_secret AS tokenSecret, enabled, expires_at AS expiresAt,
              last_used_at AS lastUsedAt, created_at AS createdAt
       FROM upload_tokens ORDER BY created_at DESC`,
    )
    .all() as { uploaderId: string }[] & AdminUploadToken[];

  const counts = db
    .prepare('SELECT uploader_id AS uploaderId, COUNT(*) AS c FROM songs GROUP BY uploader_id')
    .all() as { uploaderId: string; c: number }[];
  const countMap = new Map(counts.map((row) => [row.uploaderId, row.c]));

  const byUploader = new Map<string, AdminUploadToken[]>();
  for (const token of tokens as unknown as (AdminUploadToken & { uploaderId: string })[]) {
    const { uploaderId, ...rest } = token;
    const list = byUploader.get(uploaderId) ?? [];
    list.push({ ...rest, songCount: 0 });
    byUploader.set(uploaderId, list);
  }

  return uploaders.map((uploader) => ({
    ...uploader,
    tokens: byUploader.get(uploader.id) ?? [],
    songCount: countMap.get(uploader.id) ?? 0,
  }));
}

export function setUploadTokenEnabled(tokenId: string, enabled: boolean): boolean {
  const result = getDb()
    .prepare('UPDATE upload_tokens SET enabled = ?, updated_at = ? WHERE id = ?')
    .run(enabled ? 1 : 0, new Date().toISOString(), tokenId);
  return result.changes > 0;
}

export type RevokeResult = {
  revoked: boolean;
  uploaderId: string | null;
  /** 该上传者的最后一个令牌被吊销，上传者记录一并删除 */
  uploaderRemoved: boolean;
};

/**
 * 吊销令牌。若这是该上传者的最后一个令牌，连上传者记录一起删掉——
 * 没有令牌的 uploader 只是空壳，留在列表里没有意义。
 *
 * 删除前先把 songs / agent_submissions 里的 uploader_id 置空：
 * 这两张表存的是裸 TEXT，没有外键级联；若留着悬挂 id，将来有人用同一个
 * uploaderId 重新签发时，历史歌曲会被错误地归到新人名下。
 */
export function revokeUploadToken(tokenId: string): RevokeResult {
  const db = getDb();
  const row = db
    .prepare('SELECT uploader_id AS uploaderId FROM upload_tokens WHERE id = ?')
    .get(tokenId) as { uploaderId: string } | undefined;

  if (!row) return { revoked: false, uploaderId: null, uploaderRemoved: false };

  const run = db.transaction(() => {
    db.prepare('DELETE FROM upload_tokens WHERE id = ?').run(tokenId);

    const left = db
      .prepare('SELECT COUNT(*) AS c FROM upload_tokens WHERE uploader_id = ?')
      .get(row.uploaderId) as { c: number };
    if (left.c > 0) return false;

    db.prepare('UPDATE songs SET uploader_id = NULL, updated_at = ? WHERE uploader_id = ?').run(
      new Date().toISOString(),
      row.uploaderId,
    );
    db.prepare('UPDATE agent_submissions SET uploader_id = NULL WHERE uploader_id = ?').run(
      row.uploaderId,
    );
    db.prepare('DELETE FROM uploaders WHERE id = ?').run(row.uploaderId);
    return true;
  });

  const uploaderRemoved = run();
  return { revoked: true, uploaderId: row.uploaderId, uploaderRemoved };
}

export function setUploaderEnabled(uploaderId: string, enabled: boolean): boolean {
  const result = getDb()
    .prepare('UPDATE uploaders SET enabled = ?, updated_at = ? WHERE id = ?')
    .run(enabled ? 1 : 0, new Date().toISOString(), uploaderId);
  return result.changes > 0;
}

/* ------------------------------------------------------------------ */
/* 管理员                                                              */
/* ------------------------------------------------------------------ */

export function isAdminPasswordConfigured(): boolean {
  return Boolean(getSetting('admin_password_hash'));
}

export function verifyAdminPassword(password: string): boolean {
  return verifyPassword(password, getSetting('admin_password_hash'));
}

export function updateAdminPassword(password: string): void {
  setSetting('admin_password_hash', hashPassword(password));
  getDb().prepare('DELETE FROM admin_sessions').run();
}

export function createAdminSession() {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);
  const csrfToken = randomBytes(24).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ADMIN_SESSION_TTL_MS);

  getDb()
    .prepare(
      `INSERT INTO admin_sessions(token_hash, csrf_token, expires_at, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(tokenHash, csrfToken, expiresAt.toISOString(), now.toISOString(), now.toISOString());

  return { token, csrfToken, expiresAt };
}

function getSessionByToken(token: string | undefined): AdminSession | null {
  if (!token || token.length > 512) return null;
  const tokenHash = sha256(token);
  const row = getDb()
    .prepare(
      `SELECT token_hash AS tokenHash, csrf_token AS csrfToken, expires_at AS expiresAt
       FROM admin_sessions WHERE token_hash = ?`,
    )
    .get(tokenHash) as AdminSession | undefined;

  if (!row || new Date(row.expiresAt).getTime() <= Date.now()) {
    if (row) {
      getDb().prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
    }
    return null;
  }

  getDb()
    .prepare('UPDATE admin_sessions SET last_seen_at = ? WHERE token_hash = ?')
    .run(new Date().toISOString(), tokenHash);
  return row;
}

export async function getCurrentAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return getSessionByToken(store.get(ADMIN_COOKIE_NAME)?.value);
}

export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getCurrentAdminSession();
  if (!session) redirect('/admin/login');
  return session;
}

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const allowed = new Set([
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'http://127.0.0.1:5020',
    'http://localhost:5020',
  ]);
  // PUBLIC_BASE_URL 支持逗号分隔多个来源（局域网 IP、公网域名等）
  const configured = process.env.PUBLIC_BASE_URL ?? '';
  for (const item of configured.split(',')) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    try {
      allowed.add(new URL(trimmed).origin);
    } catch {
      /* 忽略格式错误的配置项 */
    }
  }
  return allowed.has(origin);
}

export type AdminGuard =
  | { ok: true; session: AdminSession }
  | { ok: false; status: number; code: string };

export function requireAdminRequest(request: NextRequest, mutation = false): AdminGuard {
  const session = getSessionByToken(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
  if (!session) return { ok: false, status: 401, code: 'UNAUTHORIZED' };

  if (
    mutation &&
    (!isAllowedOrigin(request) || request.headers.get('x-csrf-token') !== session.csrfToken)
  ) {
    return { ok: false, status: 403, code: 'INVALID_CSRF' };
  }
  return { ok: true, session };
}

export function deleteAdminSession(token: string | undefined): void {
  if (!token) return;
  getDb().prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(sha256(token));
}

export function auditAdmin(
  action: string,
  targetType: string,
  targetId: string | null,
  detail: Record<string, unknown> = {},
): void {
  getDb()
    .prepare(
      `INSERT INTO admin_audits(id, action, target_type, target_id, detail_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      action,
      targetType,
      targetId,
      JSON.stringify(detail),
      new Date().toISOString(),
    );
}
