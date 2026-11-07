#!/usr/bin/env node
/**
 * mollychai's mirror — 歌曲推送脚本（零依赖，Node 18+）
 *
 * 用法：
 *   node push-song.mjs ./my-song
 *   node push-song.mjs --metadata m.json --audio a.mp3 [--cover c.jpg]
 *   node push-song.mjs ./my-song --dry-run
 *
 * 目录约定：metadata.json + audio.* + cover.*（cover 可选）
 * 环境变量读取顺序：命令行 > .env.agent > 进程环境
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const AUDIO_EXT = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'];
const COVER_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

const MIME_BY_EXT = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.agent');
  if (!fs.existsSync(envPath)) return {};
  const result = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function parseArgs(argv) {
  const options = { dir: null, metadata: null, audio: null, cover: null, dryRun: false };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dir') options.dir = argv[++i];
    else if (token === '--metadata') options.metadata = argv[++i];
    else if (token === '--audio') options.audio = argv[++i];
    else if (token === '--cover') options.cover = argv[++i];
    else if (token === '--dry-run') options.dryRun = true;
    else if (!token.startsWith('--')) rest.push(token);
  }
  if (!options.dir && rest.length > 0) options.dir = rest[0];
  return options;
}

function pickFile(dir, extensions, candidates = []) {
  for (const name of candidates) {
    const full = path.join(dir, name);
    if (fs.existsSync(full)) return full;
  }
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    if (extensions.includes(path.extname(entry).toLowerCase())) {
      return path.join(dir, entry);
    }
  }
  return null;
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const envFile = loadEnvFile();

  const baseUrl = (process.env.MOLLY_BASE_URL || envFile.MOLLY_BASE_URL || '').replace(/\/+$/, '');
  const token = process.env.MOLLY_AGENT_TOKEN || envFile.MOLLY_AGENT_TOKEN || '';

  if (!options.dryRun) {
    if (!baseUrl) fail('缺少 MOLLY_BASE_URL（在 .env.agent 或环境变量里配置）');
    if (!token) fail('缺少 MOLLY_AGENT_TOKEN（在 .env.agent 或环境变量里配置）');
  }

  // 定位三个文件
  let metadataPath = options.metadata;
  let audioPath = options.audio;
  let coverPath = options.cover;

  if (options.dir) {
    const dir = path.resolve(options.dir);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      fail(`目录不存在：${dir}`);
    }
    metadataPath ??= pickFile(dir, ['.json'], ['metadata.json', 'song.metadata.json']);
    audioPath ??= pickFile(dir, AUDIO_EXT);
    coverPath ??= pickFile(dir, COVER_EXT);
  }

  if (!metadataPath) fail('找不到 metadata.json（或用 --metadata 指定）');
  if (!audioPath) fail('找不到音频文件（或用 --audio 指定）');

  metadataPath = path.resolve(metadataPath);
  audioPath = path.resolve(audioPath);
  coverPath = coverPath ? path.resolve(coverPath) : null;

  if (!fs.existsSync(metadataPath)) fail(`metadata 不存在：${metadataPath}`);
  if (!fs.existsSync(audioPath)) fail(`音频不存在：${audioPath}`);
  if (coverPath && !fs.existsSync(coverPath)) fail(`封面不存在：${coverPath}`);

  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch (error) {
    fail(`metadata.json 不是合法 JSON：${error.message}`);
  }

  if (!metadata.externalId) fail('metadata 缺少必填字段 externalId');
  if (!metadata.title) fail('metadata 缺少必填字段 title');

  const audioExt = path.extname(audioPath).toLowerCase();
  const audioMime = MIME_BY_EXT[audioExt];
  if (!audioMime) fail(`不支持的音频扩展名：${audioExt}`);

  const audioSize = fs.statSync(audioPath).size;
  if (audioSize > 50 * 1024 * 1024) fail('音频超过 50MB 上限，请压缩后重试');

  const coverExt = coverPath ? path.extname(coverPath).toLowerCase() : null;
  const coverMime = coverExt ? MIME_BY_EXT[coverExt] : null;

  console.log('');
  console.log('  mollychai’s mirror · push');
  console.log('  ─────────────────────────────');
  console.log(`  externalId : ${metadata.externalId}`);
  console.log(`  title      : ${metadata.title}`);
  console.log(`  album      : ${metadata.albumTitle ?? '(single)'}`);
  console.log(`  audio      : ${path.basename(audioPath)} (${(audioSize / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  cover      : ${coverPath ? path.basename(coverPath) : '(none)'}`);
  console.log(`  target     : ${baseUrl || '(dry-run)'}`);
  console.log('');

  if (options.dryRun) {
    console.log('  dry-run：未发起请求。\n');
    return;
  }

  const form = new FormData();
  form.append('metadata', JSON.stringify(metadata));
  form.append(
    'audio',
    new Blob([fs.readFileSync(audioPath)], { type: audioMime }),
    path.basename(audioPath),
  );
  if (coverPath && coverMime) {
    form.append(
      'cover',
      new Blob([fs.readFileSync(coverPath)], { type: coverMime }),
      path.basename(coverPath),
    );
  }

  const endpoint = `${baseUrl}/api/v1/agent/songs`;
  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const text = await response.text();
      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {
        /* 非 JSON 响应 */
      }

      if (response.ok && payload?.ok) {
        const data = payload.data;
        console.log(`  ✔ ${data.action}  ${data.externalId}`);
        console.log(`    songId   ${data.songId}`);
        console.log(`    duration ${data.duration}s`);
        if (data.streamUrl) console.log(`    stream   ${baseUrl}${data.streamUrl}`);
        console.log('');
        return;
      }

      const code = payload?.error?.code ?? `HTTP_${response.status}`;
      const message = payload?.error?.message ?? text.slice(0, 200);

      // 令牌/校验类错误不重试
      if ([400, 401, 403, 413, 415, 422].includes(response.status)) {
        console.error(`  ✖ ${code}: ${message}`);
        if (payload?.error?.details) {
          console.error('    details:', JSON.stringify(payload.error.details, null, 2));
        }
        console.log('');
        process.exit(1);
      }

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after') ?? '5');
        console.log(`  … 限流，${retryAfter}s 后重试（${attempt}/${maxAttempts}）`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      lastError = `${code}: ${message}`;
      console.log(`  … 失败，重试中（${attempt}/${maxAttempts}）`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    } catch (error) {
      lastError = error.message;
      console.log(`  … 网络错误，重试中（${attempt}/${maxAttempts}）`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }

  console.error(`  ✖ 推送失败：${lastError}`);
  console.log('');
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
