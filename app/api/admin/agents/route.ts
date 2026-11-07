import type { NextRequest } from 'next/server';

import { fail, ok, serverError, zodFail } from '@/lib/api';
import {
  auditAdmin,
  getAdminUploaders,
  issueUploadToken,
  requireAdminRequest,
  revokeUploadToken,
  setUploadTokenEnabled,
  setUploaderEnabled,
} from '@/lib/auth';
import { issueTokenSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const guard = requireAdminRequest(request);
  if (!guard.ok) return fail(guard.status, guard.code, '未登录或会话已过期');
  return ok(getAdminUploaders());
}

/** 签发新令牌。明文 token 只在这次响应里出现一次。 */
export async function POST(request: NextRequest) {
  const guard = requireAdminRequest(request, true);
  if (!guard.ok) return fail(guard.status, guard.code, '无权执行该操作');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'INVALID_JSON', '请求体必须是 JSON');
  }

  const parsed = issueTokenSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  try {
    const issued = issueUploadToken({
      uploaderId: parsed.data.uploaderId,
      displayName: parsed.data.displayName,
      tokenName: parsed.data.tokenName,
      expiresAt: parsed.data.expiresAt || null,
    });
    auditAdmin('agent.token.issue', 'upload_token', issued.id, {
      uploaderId: parsed.data.uploaderId,
      name: parsed.data.tokenName,
    });
    return ok(issued, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'TOKEN_EXPIRY_MUST_BE_FUTURE') {
      return fail(422, message, '过期时间必须晚于当前时间');
    }
    return serverError('签发令牌失败');
  }
}

export async function PATCH(request: NextRequest) {
  const guard = requireAdminRequest(request, true);
  if (!guard.ok) return fail(guard.status, guard.code, '无权执行该操作');

  let body: { tokenId?: string; uploaderId?: string; enabled?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, 'INVALID_JSON', '请求体必须是 JSON');
  }

  const enabled = body.enabled !== false;

  if (body.tokenId) {
    const changed = setUploadTokenEnabled(body.tokenId, enabled);
    if (!changed) return fail(404, 'NOT_FOUND', '令牌不存在');
    auditAdmin('agent.token.toggle', 'upload_token', body.tokenId, { enabled });
    return ok({ tokenId: body.tokenId, enabled });
  }

  if (body.uploaderId) {
    const changed = setUploaderEnabled(body.uploaderId, enabled);
    if (!changed) return fail(404, 'NOT_FOUND', '上传者不存在');
    auditAdmin('agent.uploader.toggle', 'uploader', body.uploaderId, { enabled });
    return ok({ uploaderId: body.uploaderId, enabled });
  }

  return fail(422, 'MISSING_TARGET', '需要提供 tokenId 或 uploaderId');
}

export async function DELETE(request: NextRequest) {
  const guard = requireAdminRequest(request, true);
  if (!guard.ok) return fail(guard.status, guard.code, '无权执行该操作');

  const tokenId = new URL(request.url).searchParams.get('tokenId');
  if (!tokenId) return fail(422, 'MISSING_TOKEN_ID', '缺少 tokenId 参数');

  const removed = revokeUploadToken(tokenId);
  if (!removed) return fail(404, 'NOT_FOUND', '令牌不存在');
  auditAdmin('agent.token.revoke', 'upload_token', tokenId, {});
  return ok({ tokenId, revoked: true });
}
