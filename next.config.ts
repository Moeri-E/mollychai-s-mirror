import type { NextConfig } from 'next';

// 部署在域名子路径下时通过环境变量注入，例如 /mollychai-mirror
// 注意：这个值在构建时会被内联进客户端包，改动后必须重新构建
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  reactStrictMode: true,
  // 图片走原生 img，避免 next/image 优化器依赖
  images: { unoptimized: true },
  // better-sqlite3 是原生模块，不能被打包进 server bundle
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    // 智能体上传的音频/封面可能较大
    serverActions: { bodySizeLimit: '60mb' },
  },
};

export default nextConfig;
