# mollychai's mirror

个人音乐档案馆：以专辑为中心浏览、滑动展示、全局连续播放，并支持外部智能体用令牌上传歌曲。

- 前台：首页 / Cover Flow 专辑墙 / 专辑详情 / 单曲 / 全局播放器
- 后台：登录、专辑与歌曲管理、媒体上传、智能体令牌签发
- 智能体：`agent-kit/` 说明包 + `POST /api/v1/agent/songs` 上传接口

## 技术栈

Next.js 16（App Router）+ React 19 + TypeScript + Tailwind CSS 4 + better-sqlite3 + zod

前后端同仓一体部署，无需单独的后端服务；数据库与媒体文件都落在本地 `data/` 目录。

## 本地开发

```bash
npm install
cp .env.example .env
npm run db:migrate          # 初始化数据库
npm run admin:password -- '你的管理员密码'
npm run dev                 # http://127.0.0.1:3000
```

## 生产部署

```bash
npm ci
npm run db:migrate
npm run admin:password -- '强密码'

# 挂在域名子路径下时必须带这个变量构建
NEXT_PUBLIC_BASE_PATH=/mollychai-mirror npm run build

npm start                   # 默认 0.0.0.0:5020
```

两个环境变量都必须设置，否则会出问题：

| 变量 | 何时需要 | 作用 |
|---|---|---|
| `NEXT_PUBLIC_BASE_PATH` | 部署在子路径（如 `/mollychai-mirror`）时 | 构建和**运行时都要有**，否则路由 404 |
| `PUBLIC_BASE_URL` | 始终 | 站点真实地址，用于 CSRF Origin 校验；支持逗号分隔多个 |

`NEXT_PUBLIC_BASE_PATH` 会被 `next.config.ts` 和客户端代码同时读取，**构建时和 `npm start` 时必须是同一个值**——只在 build 时设置而运行时缺失，会导致页面 404。

## 部署在域名子路径下

典型拓扑（本项目线上实际用法）：

```
浏览器 → https://codis.fun/mollychai-mirror
           ↓ nginx（443，Let's Encrypt）
           ↓ location ^~ /mollychai-mirror → proxy_pass http://127.0.0.1:5021
           ↓ frp 隧道（阿里云 frps ← 内网 frpc）
        内网 192.168.5.22:5020（Next.js）
```

nginx 侧要点：`proxy_pass` **不要带尾斜杠**（保留完整路径，因为 Next.js 自己带 basePath 前缀），上传体积上限要放大：

```nginx
location ^~ /mollychai-mirror {
    proxy_pass http://127.0.0.1:5021;
    client_max_body_size 60m;
    proxy_request_buffering off;
    proxy_buffering off;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## 数据目录

```
data/
├── mollychai.db            # SQLite 数据库
└── media/
    ├── audio/              # 音频文件
    └── covers/             # 封面文件
```

整个 `data/` 目录已加入 `.gitignore`，备份时单独拷走即可。

## 给外部智能体

把 `agent-kit/` 整个文件夹发给智能体（或它的调用方），里面有：

- `README.md` 接入说明与完整字段表
- `push-song.mjs` 零依赖推送脚本
- `.env.agent.example` 配置模板
- `examples/` 示例

签发令牌有两种方式：管理后台 **Agents** 页面，或命令行：

```bash
npm run agent:token -- --uploader suno-agent --name "Suno"
```

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/albums` | 公开专辑列表 |
| GET | `/api/v1/albums/:id` | 专辑详情与曲目 |
| GET | `/api/v1/songs` | 公开歌曲列表（支持 `albumId`、`limit`） |
| GET | `/api/v1/songs/:id` | 歌曲详情 |
| GET | `/api/v1/songs/:id/stream` | 音频流，支持 HTTP Range |
| GET | `/api/v1/media/...` | 媒体文件（封面、音频） |
| GET | `/api/v1/site-settings` | 站点公开文案 |
| POST | `/api/v1/agent/songs` | **智能体上传歌曲**（Bearer 令牌） |
