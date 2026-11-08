import { estimateDuration } from '@/lib/audio-duration';

/**
 * 音频内嵌元数据解析（FLAC / MP3 ID3v2）。
 *
 * 设计原则：手写轻量解析，只读头部元数据区，不碰音频帧。
 * - FLAC：STREAMINFO（精确时长）+ VORBIS_COMMENT（标签）+ PICTURE（内嵌封面）
 * - MP3：ID3v2.3/2.4 常用文本帧（标题/艺术家/专辑/歌词/流派/音轨/年份）+ APIC 封面
 * - WAV/OGG/M4A：只回退到 estimateDuration 的时长估算（WAV 精确，其余为 0）
 *
 * 所有字段都可能缺失；解析失败时整体降级为 { duration } 而不抛错——
 * 上传链路里元数据是锦上添花，不能因为一个坏 tag 让整个提交失败。
 */

export type EmbeddedCover = {
  buffer: Buffer;
  mime: string;
};

export type AudioMetadata = {
  /** 秒；解析不出为 0 */
  duration: number;
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  /** YYYY 或 YYYY-MM-DD，统一截取前 10 位 */
  releaseDate?: string;
  trackNumber?: number;
  lyrics?: string;
  cover?: EmbeddedCover;
};

/* ---------------------------------- FLAC ---------------------------------- */

/** FLAC METADATA_BLOCK 类型 */
const FLAC_STREAMINFO = 0;
const FLAC_VORBIS_COMMENT = 4;
const FLAC_PICTURE = 6;

function flacDuration(streamInfo: Buffer): number {
  // STREAMINFO 第 10 字节起的 8 字节（64bit）：
  //   sampleRate 20bit | channels 3bit | bps 5bit | totalSamples 36bit
  const hi = streamInfo.readUInt32BE(10);
  const lo = streamInfo.readUInt32BE(14);
  const sampleRate = hi >>> 12;
  const totalSamples = (hi % 0x10) * 2 ** 32 + lo; // 低 4 位 + 低 32 位
  if (sampleRate <= 0 || totalSamples <= 0) return 0;
  return Math.round(totalSamples / sampleRate);
}

const LYRICS_KEYS = new Set(['LYRICS', 'UNSYNCEDLYRICS', 'LYRIC', 'SYNCEDLYRICS']);

function parseVorbisComment(block: Buffer): Partial<AudioMetadata> {
  const out: Partial<AudioMetadata> = {};
  try {
    const vendorLen = block.readUInt32LE(0);
    let offset = 4 + vendorLen;
    const count = block.readUInt32LE(offset);
    offset += 4;

    for (let i = 0; i < count && offset + 4 <= block.length; i += 1) {
      const len = block.readUInt32LE(offset);
      offset += 4;
      if (len > block.length - offset) break;
      const entry = block.toString('utf8', offset, offset + len);
      offset += len;

      const eq = entry.indexOf('=');
      if (eq <= 0) continue;
      const key = entry.slice(0, eq).toUpperCase();
      const value = entry.slice(eq + 1).trim();
      if (!value) continue;

      if (key === 'TITLE' && !out.title) out.title = value;
      else if (key === 'ARTIST' && !out.artist) out.artist = value;
      else if (key === 'ALBUM' && !out.album) out.album = value;
      else if (key === 'ALBUMARTIST' && !out.albumArtist) out.albumArtist = value;
      else if (key === 'GENRE' && !out.genre) out.genre = value;
      else if (key === 'TRACKNUMBER' && out.trackNumber === undefined) {
        const n = Number.parseInt(value, 10);
        if (Number.isFinite(n) && n >= 0) out.trackNumber = n;
      } else if ((key === 'DATE' || key === 'YEAR' || key === 'RELEASEDATE') && !out.releaseDate) {
        out.releaseDate = value.slice(0, 10);
      } else if (LYRICS_KEYS.has(key) && !out.lyrics) {
        out.lyrics = value;
      }
    }
  } catch {
    /* 坏 block 不致命 */
  }
  return out;
}

function parseFlacPicture(block: Buffer): EmbeddedCover | undefined {
  try {
    const picType = block.readUInt32BE(0);
    const mimeLen = block.readUInt32BE(4);
    const mime = block.toString('ascii', 8, 8 + mimeLen).toLowerCase();
    let offset = 8 + mimeLen;
    const descLen = block.readUInt32BE(offset);
    offset += 4 + descLen; // 描述跳过
    offset += 16; // width/height/depth/colors 各 4 字节
    const dataLen = block.readUInt32BE(offset);
    offset += 4;
    if (dataLen <= 0 || dataLen > block.length - offset) return undefined;
    // 只接受常见图片格式，防止把奇怪的东西当封面存盘
    if (!/^(image\/(jpeg|png|webp|avif))$/.test(mime)) return undefined;
    const buffer = block.subarray(offset, offset + dataLen);
    return { buffer: Buffer.from(buffer), mime };
    // picType: 3 = 封面（front cover）。这里不区分类型，
    // 调用方按顺序取第一个合适的即可（大多数文件只有一张）
    void picType;
  } catch {
    return undefined;
  }
}

function parseFlac(buffer: Buffer): AudioMetadata {
  const out: AudioMetadata = { duration: 0 };
  if (buffer.length < 8 || buffer.toString('ascii', 0, 4) !== 'fLaC') return out;

  let offset = 4;
  // 只扫头部元数据块，audio frame 之后不再看
  while (offset + 4 <= buffer.length) {
    const header = buffer[offset];
    const isLast = (header & 0x80) !== 0;
    const type = header & 0x7f;
    const length = (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3];
    offset += 4;
    if (length > buffer.length - offset) break;

    const block = buffer.subarray(offset, offset + length);
    if (type === FLAC_STREAMINFO && length >= 18) {
      out.duration = flacDuration(block);
    } else if (type === FLAC_VORBIS_COMMENT) {
      Object.assign(out, parseVorbisComment(block));
    } else if (type === FLAC_PICTURE && !out.cover) {
      const cover = parseFlacPicture(block);
      if (cover) out.cover = cover;
    }

    offset += length;
    if (isLast) break;
  }
  return out;
}

/* --------------------------------- MP3 ID3v2 -------------------------------- */

function decodeId3Text(bytes: Buffer, encoding: number): string {
  try {
    if (encoding === 0) return bytes.toString('latin1');
    if (encoding === 1) {
      // UTF-16 with BOM
      if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
        return bytes.subarray(2).toString('utf16le');
      }
      if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        return bytes.subarray(2).swap16().toString('utf16le');
      }
      return bytes.toString('utf16le');
    }
    if (encoding === 2) return bytes.swap16().toString('utf16le'); // UTF-16BE
    return bytes.toString('utf8'); // 3 = UTF-8
  } catch {
    return '';
  }
}

/** 去掉结尾的 NUL 终止符 */
function stripTrailingNul(text: string): string {
  return text.replace(/\0+$/g, '');
}

function parseId3v2(buffer: Buffer): AudioMetadata {
  const out: AudioMetadata = { duration: 0 };
  if (buffer.length < 10 || buffer.toString('ascii', 0, 3) !== 'ID3') return out;

  const version = buffer[3];
  const size =
    ((buffer[6] & 0x7f) << 21) |
    ((buffer[7] & 0x7f) << 14) |
    ((buffer[8] & 0x7f) << 7) |
    (buffer[9] & 0x7f);

  let offset = 10;
  const end = Math.min(buffer.length, 10 + size);
  const frameHeaderSize = 10;

  while (offset + frameHeaderSize <= end) {
    const id = buffer.toString('ascii', offset, offset + 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) break; // padding 或坏帧

    let frameSize: number;
    if (version === 4) {
      // v2.4 frame size 是 syncsafe
      frameSize =
        ((buffer[offset + 4] & 0x7f) << 21) |
        ((buffer[offset + 5] & 0x7f) << 14) |
        ((buffer[offset + 6] & 0x7f) << 7) |
        (buffer[offset + 7] & 0x7f);
    } else {
      frameSize = buffer.readUInt32BE(offset + 4);
    }
    offset += frameHeaderSize;
    if (frameSize <= 0 || frameSize > end - offset) break;
    const data = buffer.subarray(offset, offset + frameSize);
    offset += frameSize;

    if (id === 'TIT2') {
      out.title = stripTrailingNul(decodeId3Text(data.subarray(1), data[0]));
    } else if (id === 'TPE1') {
      out.artist = stripTrailingNul(decodeId3Text(data.subarray(1), data[0]));
    } else if (id === 'TALB') {
      out.album = stripTrailingNul(decodeId3Text(data.subarray(1), data[0]));
    } else if (id === 'TPE2') {
      out.albumArtist = stripTrailingNul(decodeId3Text(data.subarray(1), data[0]));
    } else if (id === 'TCON') {
      out.genre = stripTrailingNul(decodeId3Text(data.subarray(1), data[0]));
    } else if (id === 'TRCK') {
      const raw = stripTrailingNul(decodeId3Text(data.subarray(1), data[0]));
      const n = Number.parseInt(raw.split('/')[0] ?? '', 10);
      if (Number.isFinite(n) && n >= 0) out.trackNumber = n;
    } else if ((id === 'TDRC' || id === 'TYER') && !out.releaseDate) {
      out.releaseDate = stripTrailingNul(decodeId3Text(data.subarray(1), data[0])).slice(0, 10);
    } else if (id === 'USLT' && !out.lyrics) {
      // [encoding][language(3)][descriptor(以 NUL 终止)][lyrics]
      const encoding = data[0];
      let cursor = 4;
      const termWidth = encoding === 1 || encoding === 2 ? 2 : 1;
      while (cursor + termWidth <= data.length) {
        const isNul =
          termWidth === 1 ? data[cursor] === 0 : data[cursor] === 0 && data[cursor + 1] === 0;
        if (isNul) break;
        cursor += termWidth;
      }
      cursor += termWidth;
      const lyrics = decodeId3Text(data.subarray(cursor), encoding);
      if (lyrics.trim()) out.lyrics = lyrics;
    } else if (id === 'APIC' && !out.cover) {
      // [encoding][mime(NUL 终止, v2.3=latin1 / v2.4=utf8)][picType(1)][description(NUL 终止)][data]
      const encoding = data[0];
      let cursor = 1;
      const mimeEnd = data.indexOf(0, cursor);
      if (mimeEnd < 0) continue;
      const mime = data.toString('latin1', cursor, mimeEnd).toLowerCase();
      cursor = mimeEnd + 1 + 1; // mime NUL + picType
      const termWidth = encoding === 1 || encoding === 2 ? 2 : 1;
      while (cursor + termWidth <= data.length) {
        const isNul =
          termWidth === 1 ? data[cursor] === 0 : data[cursor] === 0 && data[cursor + 1] === 0;
        if (isNul) break;
        cursor += termWidth;
      }
      cursor += termWidth;
      if (cursor < data.length && /^image\/(jpeg|png|webp|avif)$/.test(mime)) {
        out.cover = { buffer: Buffer.from(data.subarray(cursor)), mime };
      }
    }
  }

  if (!out.title) delete out.title;
  if (!out.artist) delete out.artist;
  if (!out.album) delete out.album;
  if (!out.albumArtist) delete out.albumArtist;
  if (!out.genre) delete out.genre;
  if (!out.releaseDate) delete out.releaseDate;
  return out;
}

/* ---------------------------------- 入口 ---------------------------------- */

export function parseAudioMetadata(buffer: Buffer, mime: string): AudioMetadata {
  const normalized = mime.toLowerCase();
  try {
    if (normalized.includes('flac')) return parseFlac(buffer);
    if (normalized.includes('mpeg') || normalized.includes('mp3')) {
      const meta = parseId3v2(buffer);
      meta.duration = estimateDuration(buffer, mime);
      return meta;
    }
    if (normalized.includes('wav')) {
      return { duration: estimateDuration(buffer, mime) };
    }
  } catch {
    /* 降级 */
  }
  return { duration: estimateDuration(buffer, mime) };
}
