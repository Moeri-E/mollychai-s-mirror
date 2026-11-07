import { z } from 'zod';

import { LIMITS } from '@/lib/constants';

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    });

/** 智能体提交歌曲时的元数据（multipart 表单里的 metadata 字段） */
export const songSubmissionSchema = z.object({
  externalId: z.string().min(1).max(LIMITS.externalIdMax),
  title: z.string().min(1).max(LIMITS.titleMax),
  artist: z.string().min(1).max(LIMITS.artistMax).optional(),
  albumTitle: optionalText(LIMITS.albumTitleMax),
  albumExternalId: optionalText(LIMITS.externalIdMax),
  albumArtist: optionalText(LIMITS.artistMax),
  albumCoverUrl: optionalText(2048),
  albumDescription: optionalText(LIMITS.descriptionMax),
  albumReleaseDate: optionalText(10),
  genre: optionalText(LIMITS.genreMax),
  releaseDate: optionalText(10),
  trackNumber: z.coerce.number().int().min(0).max(999).optional(),
  duration: z.coerce.number().int().min(0).max(86400).optional(),
  lyrics: z.string().max(LIMITS.lyricsMax).optional(),
  themeColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  isPublic: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return true;
      if (typeof value === 'boolean') return value;
      return value === 'true' || value === '1';
    }),
});

export type SongSubmission = z.infer<typeof songSubmissionSchema>;

/** 管理后台：创建/编辑专辑 */
export const albumInputSchema = z.object({
  title: z.string().min(1).max(LIMITS.albumTitleMax),
  artist: z.string().min(1).max(LIMITS.artistMax),
  description: z.string().max(LIMITS.descriptionMax).optional().nullable(),
  releaseDate: z.string().max(10).optional().nullable(),
  themeColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  isPublic: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
  coverUrl: z.string().max(2048).optional().nullable(),
  externalId: z.string().max(LIMITS.externalIdMax).optional().nullable(),
});

export type AlbumInput = z.infer<typeof albumInputSchema>;

/** 管理后台：创建/编辑歌曲 */
export const songInputSchema = z.object({
  title: z.string().min(1).max(LIMITS.titleMax),
  artist: z.string().max(LIMITS.artistMax).optional().nullable(),
  albumId: z.string().uuid().optional().nullable(),
  audioUrl: z.string().min(1).max(2048),
  coverUrl: z.string().max(2048).optional().nullable(),
  duration: z.coerce.number().int().min(0).max(86400).optional(),
  trackNumber: z.coerce.number().int().min(0).max(999).optional(),
  genre: z.string().max(LIMITS.genreMax).optional().nullable(),
  lyrics: z.string().max(LIMITS.lyricsMax).optional().nullable(),
  audioFormat: z.string().max(20).optional().nullable(),
  isPublic: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export type SongInput = z.infer<typeof songInputSchema>;

export const loginSchema = z.object({
  password: z.string().min(1).max(200),
});

export const issueTokenSchema = z.object({
  uploaderId: z.string().min(1).max(64),
  displayName: z.string().min(1).max(80),
  tokenName: z.string().min(1).max(80),
  expiresAt: z.string().optional().nullable(),
});

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
