# 示例目录结构

把要推送的歌曲整理成这样一个目录，然后执行 `node push-song.mjs ./这个目录`：

```
glass-garden/
├── metadata.json     # 从 examples/metadata.json 复制一份改内容
├── audio.mp3         # 音频（MP3/WAV/FLAC/OGG/M4A/AAC）
└── cover.jpg         # 封面（可选，JPEG/PNG/WebP/AVIF）
```

脚本会自动识别：

- `metadata.json` 或 `song.metadata.json`
- 任意 `.mp3/.wav/.flac/.ogg/.m4a/.aac` 文件
- 任意 `.jpg/.jpeg/.png/.webp/.avif` 文件

## 多条歌曲

每首歌一个目录，逐个执行即可：

```bash
node push-song.mjs ./songs/glass-garden
node push-song.mjs ./songs/afterimage
node push-song.mjs ./songs/blue-hour
```

三首歌的 `metadata.json` 里如果都填同样的 `albumTitle` 和 `albumExternalId`，它们会自动归入同一张专辑，`trackNumber` 决定曲序。

## 先检查再上传

```bash
node push-song.mjs ./glass-garden --dry-run
```

只打印解析结果，不发起请求，适合确认字段填对了没有。
