import type { NextRequest } from 'next/server';

import { fail, ok, serverError } from '@/lib/api';
import { parseAudioMetadata } from '@/lib/audio-metadata';
import { auditAdmin, requireAdminRequest } from '@/lib/auth';
import { LIMITS } from '@/lib/constants';
import { saveAudio, saveCover } from '@/lib/media';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 管理后台媒体上传。
 * multipart 字段：file（必填）、kind=audio|cover（必填）
 */
export async function POST(request: NextRequest) {
  const guard = requireAdminRequest(request, true);
  if (!guard.ok) return fail(guard.status, guard.code, '无权执行该操作');

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, 'INVALID_FORM', '请求必须是 multipart/form-data');
  }

  const kind = String(form.get('kind') ?? '');
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return fail(422, 'MISSING_FILE', '缺少 file 字段');
  }

  const mime = (file.type || '').toLowerCase();

  try {
    if (kind === 'audio') {
      if (!LIMITS.audioMimeTypes.includes(mime)) {
        return fail(415, 'UNSUPPORTED_AUDIO_TYPE', `不支持的音频类型：${mime}`, {
          supported: LIMITS.audioMimeTypes,
        });
      }
      if (file.size > LIMITS.audioMaxBytes) {
        return fail(413, 'AUDIO_TOO_LARGE', '音频文件过大');
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const saved = saveAudio(buffer, mime);
      auditAdmin('media.upload', 'audio', saved.fileName, { bytes: file.size });
      // FLAC 用 STREAMINFO 精确解析；MP3/WAV 沿用估算器。附带返回内嵌 tag 供前端预填
      const meta = parseAudioMetadata(buffer, mime);
      return ok({
        url: saved.url,
        kind: 'audio',
        format: mime,
        duration: meta.duration,
        bytes: file.size,
        embedded: {
          title: meta.title ?? null,
          artist: meta.artist ?? null,
          album: meta.album ?? null,
          genre: meta.genre ?? null,
          releaseDate: meta.releaseDate ?? null,
          trackNumber: meta.trackNumber ?? null,
          hasLyrics: Boolean(meta.lyrics),
          hasCover: Boolean(meta.cover),
        },
      });
    }

    if (kind === 'cover') {
      if (!LIMITS.coverMimeTypes.includes(mime)) {
        return fail(415, 'UNSUPPORTED_COVER_TYPE', `不支持的图片类型：${mime}`, {
          supported: LIMITS.coverMimeTypes,
        });
      }
      if (file.size > LIMITS.coverMaxBytes) {
        return fail(413, 'COVER_TOO_LARGE', '封面文件过大');
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const saved = saveCover(buffer, mime);
      auditAdmin('media.upload', 'cover', saved.fileName, { bytes: file.size });
      return ok({ url: saved.url, kind: 'cover', bytes: file.size });
    }

    return fail(422, 'INVALID_KIND', 'kind 必须是 audio 或 cover');
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNSUPPORTED_AUDIO_TYPE' || message === 'UNSUPPORTED_COVER_TYPE') {
      return fail(415, message, '不支持的文件类型');
    }
    return serverError('上传失败');
  }
}
