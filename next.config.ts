import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
