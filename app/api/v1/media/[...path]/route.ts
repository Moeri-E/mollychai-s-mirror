import path from 'node:path';

import { notFound } from '@/lib/api';
import { MEDIA_DIR } from '@/lib/constants';
import { fileResponse, resolveMediaPath } from '@/lib/media';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params;
  if (!segments?.length) return notFound('资源不存在');

  const relative = segments.join('/');
  const url = `/api/v1/media/${relative}`;
  const filePath = resolveMediaPath(url);
  if (!filePath) return notFound('资源不存在');

  // 双重保险：解析结果必须落在 MEDIA_DIR 内
  const base = path.resolve(MEDIA_DIR);
  if (!path.resolve(filePath).startsWith(base + path.sep)) return notFound('资源不存在');

  return fileResponse(filePath, { rangeHeader: request.headers.get('range') });
}

export async function HEAD(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const response = await GET(request, context);
  return new Response(null, { status: response.status, headers: response.headers });
}
