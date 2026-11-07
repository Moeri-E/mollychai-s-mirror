/**
 * 轻量音频时长估算。
 * 目的只是列表展示和进度条，不需要精确到毫秒。
 * 优先使用智能体提交的 duration，缺失时才走这里。
 */

const MP3_BITRATES_MPEG1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MP3_BITRATES_MPEG2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

function skipId3(buffer: Buffer): number {
  if (buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'ID3') {
    const size =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f);
    return 10 + size;
  }
  return 0;
}

function mp3Duration(buffer: Buffer): number {
  const start = skipId3(buffer);
  const limit = Math.min(buffer.length - 4, start + 400_000);

  for (let i = start; i < limit; i += 1) {
    if (buffer[i] !== 0xff || (buffer[i + 1] & 0xe0) !== 0xe0) continue;

    const versionBits = (buffer[i + 1] >> 3) & 0x03;
    const layerBits = (buffer[i + 1] >> 1) & 0x03;
    const bitrateIndex = (buffer[i + 2] >> 4) & 0x0f;

    // Layer III 且 bitrate 合法
    if (layerBits !== 0x01 || bitrateIndex === 0 || bitrateIndex === 0x0f) continue;

    const table =
      versionBits === 0x03 ? MP3_BITRATES_MPEG1_L3 : MP3_BITRATES_MPEG2_L3;
    const kbps = table[bitrateIndex];
    if (!kbps) continue;

    const audioBytes = buffer.length - i;
    const seconds = Math.round((audioBytes * 8) / (kbps * 1000));
    return seconds > 0 ? seconds : 0;
  }
  return 0;
}

function wavDuration(buffer: Buffer): number {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return 0;
  }
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      if (offset + 8 + 12 <= buffer.length) byteRate = buffer.readUInt32LE(offset + 16);
    } else if (chunkId === 'data') {
      dataSize = Math.min(chunkSize, buffer.length - offset - 8);
      break;
    }

    offset += 8 + chunkSize + (chunkSize % 2);
  }

  if (byteRate > 0 && dataSize > 0) return Math.round(dataSize / byteRate);
  return 0;
}

export function estimateDuration(buffer: Buffer, mime: string): number {
  const normalized = mime.toLowerCase();
  if (normalized.includes('wav')) return wavDuration(buffer);
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return mp3Duration(buffer);
  return 0;
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '--:--';
  const seconds = Math.round(totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
