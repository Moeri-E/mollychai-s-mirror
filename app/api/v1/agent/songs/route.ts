import { randomUUID } from 'node:crypto';

import { fail, ok, serverError, zodFail } from '@/lib/api';
import { estimateDuration } from '@/lib/audio-duration';
import { auditAdmin, getRequestIp, requireAgentRequest } from '@/lib/auth';
import { LIMITS } from '@/lib/constants';
import { getDb } from '@/lib/db';
import { deleteMediaByUrl, saveAudio, saveCover } from '@/lib/media';
import { songSubmissionSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = requireAgentRequest(request);
  if (!auth.ok) {
    return fail(
      auth.status,
      auth.code,
      auth.message,
      undefined,
      auth.retryAfterSeconds ? { 'Retry-After': String(auth.retryAfterSeconds) } : undefined,
    );
  }

  const { principal } = auth;
  const ip = getRequestIp(request);
  const db = getDb();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, 'INVALID_FORM', '请求必须是 multipart/form-data 格式');
  }

  const rawMetadata = form.get('metadata');
  if (typeof rawMetadata !== 'string' || !rawMetadata.trim()) {
    return fail(422, 'MISSING_METADATA', '缺少 metadata 字段（JSON 字符串）');
  }

  let metadataJson: unknown;
  try {
    metadataJson = JSON.parse(rawMetadata);
  } catch {
    return fail(422, 'INVALID_METADATA_JSON', 'metadata 不是合法 JSON');
  }

  const parsed = songSubmissionSchema.safeParse(metadataJson);
  if (!parsed.success) return zodFail(parsed.error);
  const meta = parsed.data;

  const audioFile = form.get('audio');
  if (!(audioFile instanceof File) || audioFile.size === 0) {
    return fail(422, 'MISSING_AUDIO', '缺少 audio 文件字段');
  }
  if (audioFile.size > LIMITS.audioMaxBytes) {
    return fail(
      413,
      'AUDIO_TOO_LARGE',
      `音频文件超过上限 ${Math.floor(LIMITS.audioMaxBytes / 1024 / 1024)}MB`,
    );
  }
  const audioMime = (audioFile.type || 'application/octet-stream').toLowerCase();
  if (!LIMITS.audioMimeTypes.includes(audioMime)) {
    return fail(415, 'UNSUPPORTED_AUDIO_TYPE', `不支持的音频类型：${audioMime}`, {
      supported: LIMITS.audioMimeTypes,
    });
  }

  const coverFile = form.get('cover');
  let coverBuffer: Buffer | null = null;
  let coverMime = '';
  if (coverFile instanceof File && coverFile.size > 0) {
    if (coverFile.size > LIMITS.coverMaxBytes) {
      return fail(
        413,
        'COVER_TOO_LARGE',
        `封面文件超过上限 ${Math.floor(LIMITS.coverMaxBytes / 1024 / 1024)}MB`,
      );
    }
    coverMime = (coverFile.type || '').toLowerCase();
    if (!LIMITS.coverMimeTypes.includes(coverMime)) {
      return fail(415, 'UNSUPPORTED_COVER_TYPE', `不支持的封面类型：${coverMime}`, {
        supported: LIMITS.coverMimeTypes,
      });
    }
    coverBuffer = Buffer.from(await coverFile.arrayBuffer());
  }

  const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
  const duration = meta.duration && meta.duration > 0 ? meta.duration : estimateDuration(audioBuffer, audioMime);

  const existing = db
    .prepare('SELECT id, audio_url AS audioUrl, cover_url AS coverUrl FROM songs WHERE external_id = ?')
    .get(meta.externalId) as { id: string; audioUrl: string; coverUrl: string | null } | undefined;

  let savedAudio: { fileName: string; url: string } | null = null;
  let savedCover: { fileName: string; url: string } | null = null;

  try {
    savedAudio = saveAudio(audioBuffer, audioMime);
    if (coverBuffer) savedCover = saveCover(coverBuffer, coverMime);

    const now = new Date().toISOString();
    const songId = existing?.id ?? randomUUID();

    const result = db.transaction(() => {
      // ---- 专辑归属 ----
      let albumId: string | null = null;
      if (meta.albumExternalId || meta.albumTitle) {
        albumId = resolveAlbum({
          externalId: meta.albumExternalId ?? null,
          title: meta.albumTitle ?? null,
          artist: meta.albumArtist ?? meta.artist ?? principal.uploaderName,
          description: meta.albumDescription ?? null,
          releaseDate: meta.albumReleaseDate ?? meta.releaseDate ?? null,
          themeColor: meta.themeColor ?? null,
          coverUrl: savedCover?.url ?? null,
          uploaderId: principal.uploaderId,
          now,
        });
      }

      if (existing) {
        db.prepare(
          `UPDATE songs SET
             album_id = ?, title = ?, artist = ?, audio_url = ?, cover_url = ?,
             duration = ?, track_number = ?, audio_format = ?, genre = ?, lyrics = ?,
             is_public = ?, external_id = ?, uploader_id = ?, updated_at = ?
           WHERE id = ?`,
        ).run(
          albumId,
          meta.title,
          meta.artist ?? principal.uploaderName,
          savedAudio!.url,
          savedCover?.url ?? existing.coverUrl,
          duration,
          meta.trackNumber ?? 0,
          audioMime,
          meta.genre ?? null,
          meta.lyrics ?? null,
          meta.isPublic ? 1 : 0,
          meta.externalId,
          principal.uploaderId,
          now,
          songId,
        );
      } else {
        db.prepare(
          `INSERT INTO songs(
             id, album_id, title, artist, audio_url, cover_url, duration, track_number,
             audio_format, genre, lyrics, is_public, sort_order, external_id, uploader_id,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        ).run(
          songId,
          albumId,
          meta.title,
          meta.artist ?? principal.uploaderName,
          savedAudio!.url,
          savedCover?.url ?? null,
          duration,
          meta.trackNumber ?? 0,
          audioMime,
          meta.genre ?? null,
          meta.lyrics ?? null,
          meta.isPublic ? 1 : 0,
          meta.externalId,
          principal.uploaderId,
          now,
          now,
        );
      }

      db.prepare(
        `INSERT INTO agent_submissions(
           id, token_id, uploader_id, external_id, song_id, status, detail_json, ip, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        randomUUID(),
        principal.tokenId,
        principal.uploaderId,
        meta.externalId,
        songId,
        existing ? 'updated' : 'created',
        JSON.stringify({ title: meta.title, duration, bytes: audioFile.size }),
        ip,
        now,
      );

      return songId;
    })();

    // 更新场景下清理被替换掉的旧文件
    if (existing) {
      if (existing.audioUrl !== savedAudio.url) deleteMediaByUrl(existing.audioUrl);
      if (savedCover && existing.coverUrl && existing.coverUrl !== savedCover.url) {
        deleteMediaByUrl(existing.coverUrl);
      }
    }

    return ok(
      {
        songId: result,
        externalId: meta.externalId,
        action: existing ? 'updated' : 'created',
        audioUrl: savedAudio.url,
        coverUrl: savedCover?.url ?? existing?.coverUrl ?? null,
        duration,
        streamUrl: `/api/v1/songs/${result}/stream`,
        detailUrl: `/api/v1/songs/${result}`,
      },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    if (savedAudio) deleteMediaByUrl(savedAudio.url);
    if (savedCover) deleteMediaByUrl(savedCover.url);

    const message = error instanceof Error ? error.message : '未知错误';
    if (message === 'UNSUPPORTED_AUDIO_TYPE' || message === 'UNSUPPORTED_COVER_TYPE') {
      return fail(415, message, '不支持的文件类型');
    }
    try {
      getDb()
        .prepare(
          `INSERT INTO agent_submissions(
             id, token_id, uploader_id, external_id, song_id, status, detail_json, ip, created_at
           ) VALUES (?, ?, ?, ?, NULL, 'failed', ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          principal.tokenId,
          principal.uploaderId,
          meta.externalId,
          JSON.stringify({ error: message }),
          ip,
          new Date().toISOString(),
        );
    } catch {
      /* 审计写入失败不影响主流程 */
    }
    return serverError('保存歌曲失败');
  }
}

function resolveAlbum(input: {
  externalId: string | null;
  title: string | null;
  artist: string;
  description: string | null;
  releaseDate: string | null;
  themeColor: string | null;
  coverUrl: string | null;
  uploaderId: string;
  now: string;
}): string | null {
  const db = getDb();

  if (input.externalId) {
    const byExternal = db
      .prepare('SELECT id FROM albums WHERE external_id = ?')
      .get(input.externalId) as { id: string } | undefined;
    if (byExternal) return byExternal.id;
  }

  if (input.title) {
    const byTitle = db
      .prepare('SELECT id FROM albums WHERE title = ? AND artist = ?')
      .get(input.title, input.artist) as { id: string } | undefined;
    if (byTitle) return byTitle.id;
  }

  if (!input.title) return null;

  const id = randomUUID();
  db.prepare(
    `INSERT INTO albums(
       id, title, artist, cover_url, description, release_date, theme_color,
       is_public, sort_order, external_id, uploader_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?)`,
  ).run(
    id,
    input.title,
    input.artist,
    input.coverUrl,
    input.description,
    input.releaseDate,
    input.themeColor,
    input.externalId,
    input.uploaderId,
    input.now,
    input.now,
  );
  return id;
}
