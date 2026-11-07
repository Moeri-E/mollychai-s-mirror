import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

export type ApiError = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  headers?: Record<string, string>,
): NextResponse {
  const body: ApiError = { ok: false, error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return NextResponse.json(body, { status, headers });
}

export function zodFail(error: ZodError): NextResponse {
  return fail(
    422,
    'VALIDATION_FAILED',
    '提交内容未通过校验',
    error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  );
}

export function serverError(message = '服务器内部错误'): NextResponse {
  return fail(500, 'INTERNAL_ERROR', message);
}

export function notFound(message = '资源不存在'): NextResponse {
  return fail(404, 'NOT_FOUND', message);
}
