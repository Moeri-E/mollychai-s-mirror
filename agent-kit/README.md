# mollychai's mirror — 智能体接入套件

这个文件夹包含**外部智能体**向 mollychai's mirror 上传歌曲所需的全部资料。

> **给 AI 用**：把这个文件夹整个交给 AI 助手，让它先读本文件，然后按说明完成对接。
> 无需阅读网站源码，所有需要的信息都在这里。

---

## 0. 一句话说清你在做什么

你（智能体）会通过一个 HTTP 接口，把**一首歌的音频、封面、歌词和元数据**上传到网站。
上传成功后，这首歌会出现在网站上，访客可以播放。

---

## 1. 快速开始（3 步）

### 第一步：拿到令牌

令牌由网站管理员签发，形如：

```
mk_live_1a2b3c4d-....<43位随机串>
```

- 如果你的调用方已经给了你令牌，跳过这一步。
- 否则请让管理员在网站后台 **智能体** 页面签发（或执行 `npm run agent:token`）。
- **令牌只显示一次**，请立刻保存到安全位置。不要写进代码仓库。

### 第二步：配置环境

```bash
cp .env.agent.example .env.agent
```

编辑 `.env.agent`（`MOLLY_BASE_URL` 已经填好本站在线地址，通常只需改令牌）：

```
MOLLY_BASE_URL=https://codis.fun/mollychai-mirror
MOLLY_AGENT_TOKEN=mk_live_xxxx.yyyy
```

### 第三步：推送一首歌

准备一个目录，结构如下：

```
my-song/
├── metadata.json     # 必填：歌曲信息
├── audio.mp3         # 必填：音频文件
└── cover.jpg         # 可选：封面图
```

然后执行：

```bash
node push-song.mjs ./my-song
```

成功会输出类似：

```
✔ created  glass-garden
  songId  8f3c1d2e-...
  stream  https://站点/api/v1/songs/8f3c1d2e-.../stream
  duration 232s
```

---

## 2. 接口约定（不使用脚本时直接对接）

### 端点

```
POST {BASE_URL}/api/v1/agent/songs
```

### 请求头

```
Authorization: Bearer mk_live_xxxxxxxx.yyyy
Content-Type: multipart/form-data; boundary=...
```

### 表单字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `metadata` | string | 是 | JSON 字符串，结构见下 |
| `audio` | file | 是 | 音频文件（MP3/WAV/FLAC/OGG/M4A） |
| `cover` | file | 否 | 封面图（JPEG/PNG/WebP/AVIF） |

> 注意：`metadata` 是**字符串**，不是单独的文件，也不是 JSON part。

### metadata 结构

```json
{
  "externalId": "glass-garden",
  "title": "Glass Garden",
  "artist": "mollychai",
  "albumTitle": "Mirror / Studies",
  "albumExternalId": "mirror-studies",
  "albumArtist": "mollychai",
  "albumDescription": "A collection of reflections.",
  "albumCoverUrl": "/api/v1/media/covers/xxxx.jpg",
  "albumReleaseDate": "2026-08-01",
  "genre": "ambient",
  "releaseDate": "2026-08-01",
  "trackNumber": 1,
  "duration": 232,
  "lyrics": "第一行歌词\n第二行歌词",
  "themeColor": "#2f5fd0",
  "isPublic": true
}
```

### 字段约束

| 字段 | 必填 | 约束 |
|------|------|------|
| `externalId` | **是** | 1–100 字符，**全局唯一**，是幂等键 |
| `title` | **是** | 1–120 字符 |
| `artist` | 否 | ≤120 字符，缺省用上传者名称 |
| `albumTitle` | 否 | ≤120 字符。提供则自动归入该专辑，不存在会自动创建 |
| `albumExternalId` | 否 | ≤100 字符，专辑级幂等键，建议填 |
| `albumDescription` | 否 | ≤4000 字符 |
| `albumCoverUrl` | 否 | ≤2048 字符，专辑封面地址（专辑已存在则忽略） |
| `albumReleaseDate` | 否 | `YYYY-MM-DD` |
| `genre` | 否 | ≤60 字符 |
| `trackNumber` | 否 | 0–999，专辑内曲序 |
| `duration` | 否 | 整数秒。不传则服务端自动解析音频时长 |
| `lyrics` | 否 | ≤20000 字符，支持 `\n` 换行 |
| `themeColor` | 否 | `#RRGGBB` |
| `isPublic` | 否 | 默认 `true`。设为 `false` 则不在站点展示；接受 `true/false` 或 `"1"/"0"` |

### 文件限制

| 类型 | 格式 | 大小上限 |
|------|------|----------|
| 音频 | MP3 / WAV / FLAC / OGG / M4A / AAC | 50 MB |
| 封面 | JPEG / PNG / WebP / AVIF | 8 MB |

MIME 类型必须正确，服务端会校验，不依赖扩展名。

### 内嵌元数据自动解析

当 metadata 里没有提供某些字段时，服务端会从音频文件的内嵌 tag 自动补全（仅 FLAC 与 MP3）：

- **FLAC**：Vorbis comment（TITLE / ARTIST / ALBUM / GENRE / TRACKNUMBER / DATE / LYRICS 等）+ 内嵌封面（PICTURE block）+ STREAMINFO 精确时长
- **MP3**：ID3v2.3 / v2.4 文本帧（TIT2 / TPE1 / TALB / TCON / TRCK / TDRC / TYER）+ 歌词（USLT）+ 内嵌封面（APIC）；时长为估算值

优先级：metadata 显式提交的字段 > 音频内嵌 tag > 上传者名称（artist 兜底）。
表单里单独上传的 cover 文件 > 音频内嵌封面。
albumTitle 未提供时会使用内嵌的 ALBUM 字段并自动创建专辑。

也就是说：**一首自带完整 tag 的 FLAC，理论上只需要 externalId 和 title 就能上传成一条带封面、歌词、作者、专辑信息的完整记录。**

### 幂等行为

`externalId` 是幂等键：

- 首次提交 → 创建，返回 `201`，`action: "created"`
- 相同 `externalId` 再次提交 → **覆盖更新**，返回 `200`，`action: "updated"`

所以网络超时后可以放心重试，不会产生重复歌曲。旧音频文件会被自动清理。

### 成功响应

```json
{
  "ok": true,
  "data": {
    "songId": "8f3c1d2e-...",
    "externalId": "glass-garden",
    "action": "created",
    "audioUrl": "/api/v1/media/audio/1730000000000-ab12cd34.mp3",
    "coverUrl": "/api/v1/media/covers/1730000000000-ef56gh78.jpg",
    "duration": 232,
    "streamUrl": "/api/v1/songs/8f3c1d2e-.../stream",
    "detailUrl": "/api/v1/songs/8f3c1d2e-..."
  }
}
```

`streamUrl` 支持 HTTP Range，可直接交给 `<audio>` 播放并拖动进度条。

### 错误响应

统一格式：

```json
{
  "ok": false,
  "error": { "code": "INVALID_CREDENTIALS", "message": "令牌无效、已停用或已过期" }
}
```

| HTTP | code | 含义 | 处理建议 |
|------|------|------|----------|
| 401 | `INVALID_CREDENTIALS` | 令牌无效/停用/过期 | 联系管理员重新签发 |
| 413 | `AUDIO_TOO_LARGE` | 音频超过 50MB | 压缩后重试 |
| 415 | `UNSUPPORTED_AUDIO_TYPE` | 音频格式不支持 | 转成 MP3 |
| 415 | `UNSUPPORTED_COVER_TYPE` | 封面格式不支持 | 转成 JPEG/PNG |
| 422 | `VALIDATION_FAILED` | 字段校验失败 | 看 `details` 数组定位字段 |
| 422 | `MISSING_METADATA` | 缺 metadata | 补上 |
| 429 | `RATE_LIMITED` | 频繁请求 | 按 `Retry-After` 等待后重试 |
| 500 | `INTERNAL_ERROR` | 服务端异常 | 可重试一次，仍失败则反馈 |

**限流**：同一令牌每分钟 30 次，同一 IP 每分钟 60 次。

---

## 3. 文件说明

| 文件 | 用途 |
|------|------|
| `README.md` | 本文件，接入说明 |
| `push-song.mjs` | 推送脚本，零依赖（Node 18+ 原生 fetch/FormData） |
| `.env.agent.example` | 环境变量模板 |
| `examples/metadata.json` | 元数据示例 |
| `examples/README.md` | 目录结构示例说明 |

---

## 4. 常见问题

**Q：令牌放哪里？**
放在 `.env.agent`，不要提交到 git。`.gitignore` 已排除该文件。

**Q：一首歌没有专辑可以吗？**
可以。不传 `albumTitle` 和 `albumExternalId`，这首歌就是"单曲"，会出现在站点的 Singles 页面。

**Q：同一首歌要替换音频怎么办？**
用**相同的 `externalId`** 重新提交，会覆盖更新，不会产生重复。

**Q：歌词格式？**
纯文本，用 `\n` 分行。暂不支持 LRC 时间轴标记。

**Q：封面必须和音频一起传吗？**
不必须。也可以把 cover 省略，站点会显示专辑封面或无封面占位。封面之后可以再传一次（相同 externalId）来补充。

**Q：能批量传吗？**
逐个调用接口即可。建议串行或限制并发（≤3），避免触发限流。

---

## 5. 最小可运行示例（curl）

```bash
curl -X POST "$MOLLY_BASE_URL/api/v1/agent/songs" \
  -H "Authorization: Bearer $MOLLY_AGENT_TOKEN" \
  -F 'metadata={"externalId":"demo-001","title":"Demo","artist":"mollychai","albumTitle":"Demos"};type=application/json' \
  -F "audio=@./audio.mp3;type=audio/mpeg" \
  -F "cover=@./cover.jpg;type=image/jpeg"
```

注意 `metadata` 那段要带 `;type=application/json`，curl 才会把它当作字符串字段而不是文件。

---

*文档版本：V1.0 · 与 mollychai's mirror 站点 API V1 对应*
