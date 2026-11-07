import { NextResponse } from 'next/server';

import { fail, ok } from '@/lib/api';
import {
  auditAdmin,
  createAdminSession,
  isAdminPasswordConfigured,
  verifyAdminPassword,
} from '@/lib/auth';
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_TTL_MS } from '@/lib/constants';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/auth';
import { loginSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isAdminPasswordConfigured()) {
    return fail(409, 'ADMIN_NOT_INITIALIZED', '管理员密码尚未初始化，请先运行 npm run admin:password');
  }

  const ip = getRequestIp(request);
  const limit = checkRateLimit(`admin-login:${ip}`, 10, 5 * 60_000);
  if (!limit.allowed) {
    return fail(429, 'RATE_LIMITED', '尝试过于频繁，请稍后再试', undefined, {
      'Retry-After': String(limit.retryAfterSeconds),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'INVALID_JSON', '请求体必须是 JSON');
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return fail(422, 'VALIDATION_FAILED', '密码格式不正确');

  if (!verifyAdminPassword(parsed.data.password)) {
    auditAdmin('admin.login.failed', 'admin', null, { ip });
    return fail(401, 'INVALID_PASSWORD', '密码错误');
  }

  const session = createAdminSession();
  auditAdmin('admin.login.success', 'admin', null, { ip });

  const secure = Boolean(process.env.PUBLIC_BASE_URL?.startsWith('https://'));
  const response = ok({ csrfToken: session.csrfToken, expiresAt: session.expiresAt.toISOString() });
  response.cookies.set(ADMIN_COOKIE_NAME, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
  });
  return response as NextResponse;
}
