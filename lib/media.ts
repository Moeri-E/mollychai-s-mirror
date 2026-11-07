import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';

import { AUDIO_DIR, AUDIO_EXT, COVER_DIR, COVER_EXT, MEDIA_DIR, MEDIA_URL_BASE } from '@/lib/constants';

/** MIME 白名单校验通过后调用 */
export function saveAudio(buffer: Buffer, mime: string): { fileName: string; url: string } {
  const ext = AUDIO_EXT[mime];
  if (!ext) throw new Error('UNSUPPORTED_AUDIO_TYPE');
  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  fs.writeFileSync(path.join(AUDIO_DIR, fileName), buffer);
  return { fileName, url: `${MEDIA_URL_BASE}/audio/${fileName}` };
}

export function saveCover(buffer: Buffer, mime: string): { fileName: string; url: string } {
  const ext = COVER_EXT[mime];
  if (!ext) throw new Error('UNSUPPORTED_COVER_TYPE');
  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  fs.mkdirSync(COVER_DIR, { recursive: true });
  fs.writeFileSync(path.join(COVER_DIR, fileName), buffer);
  return { fileName, url: `${MEDIA_URL_BASE}/covers/${fileName}` };
}

export function deleteMediaByUrl(url: string | null | undefined): void {
  if (!url) return;
  const resolved = resolveMediaPath(url);
  if (!resolved) return;
  try {
    fs.unlinkSync(resolved);
  } catch {
    /* 文件已不存在，忽略 */
  }
}

/**
 * 把 /api/v1/media/audio/xxx.mp3 还原成磁盘绝对路径。
 * 严格限制在 MEDIA_DIR 内，防目录穿越。
 */
export function resolveMediaPath(url: string): string | null {
  if (!url.startsWith(`${MEDIA_URL_BASE}/`)) return null;
  const relative = url.slice(MEDIA_URL_BASE.length + 1);
  if (!relative || relative.includes('\0')) return null;

  const resolved = path.resolve(MEDIA_DIR, relative);
  const base = path.resolve(MEDIA_DIR);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;
  return resolved;
}

const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

export function mimeForPath(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const IMMUTABLE_CACHE = { 'Cache-Control': 'public, max-age=31536000, immutable' } as const;

/**
 * 返回支持 HTTP Range 的文件响应。
 * 浏览器拖动进度条依赖 206 Partial Content。
 */
export function fileResponse(
  filePath: string,
  options: { rangeHeader?: string | null; cache?: boolean; downloadName?: string } = {},
): Response {
  const stat = fs.statSync(filePath);
  const size = stat.size;
  const mime = mimeForPath(filePath);
  const cacheControl = options.cache === false ? 'no-store' : 'public, max-age=31536000, immutable';

  const baseHeaders: Record<string, string> = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': cacheControl,
  };
  if (options.downloadName) {
    baseHeaders['Content-Disposition'] =
      `attachment; filename*=UTF-8''${encodeURIComponent(options.downloadName)}`;
  }

  const rangeHeader = options.rangeHeader ?? null;
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (match) {
      const startRaw = match[1];
      const endRaw = match[2];

      let start: number;
      let end: number;

      if (startRaw === '' && endRaw !== '') {
        // bytes=-500 → 末尾 500 字节
        const suffix = Number(endRaw);
        start = Math.max(0, size - suffix);
        end = size - 1;
      } else {
        start = Number(startRaw);
        end = endRaw === '' ? size - 1 : Math.min(Number(endRaw), size - 1);
      }

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
        return new Response(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${size}`,
            'Cache-Control': cacheControl,
          },
        });
      }

      const stream = fs.createReadStream(filePath, { start, end });
      return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${size}`,
        },
      });
    }
  }

  const stream = fs.createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers: {
      ...baseHeaders,
      'Content-Length': String(size),
    },
  });
}
