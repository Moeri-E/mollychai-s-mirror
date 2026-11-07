import { fail, notFound } from '@/lib/api';
import { getDb } from '@/lib/db';
import { fileResponse, resolveMediaPath } from '@/lib/media';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const song = getDb()
    .prepare('SELECT audio_url AS audioUrl, is_public AS isPublic FROM songs WHERE id = ?')
    .get(id) as { audioUrl: string; isPublic: number } | undefined;

  if (!song || song.isPublic !== 1) return notFound('歌曲不存在或未公开');

  const filePath = resolveMediaPath(song.audioUrl);
  if (!filePath) return fail(404, 'AUDIO_MISSING', '音频文件缺失');

  return fileResponse(filePath, { rangeHeader: request.headers.get('range') });
}

export async function HEAD(request: Request, context: { params: Promise<{ id: string }> }) {
  const response = await GET(request, context);
  return new Response(null, { status: response.status, headers: response.headers });
}
