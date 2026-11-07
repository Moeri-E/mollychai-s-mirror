/**
 * 部署在域名子路径（basePath）下时，手写的 fetch / img src / audio src
 * 不会自动带前缀，必须经过这里拼接。
 *
 * Next.js 的 <Link>、useRouter().push()、redirect() 会自动应用 basePath，
 * 但以下三类不会：
 *   1. 手写的 fetch('/api/...')
 *   2. <img src="/api/v1/media/...">
 *   3. new Audio().src = '/api/v1/songs/.../stream'
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function withBasePath(path: string): string {
  if (!path || !path.startsWith('/')) return path;
  if (!BASE_PATH) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}

/** 站内跳转（window.location 等不走 Next 路由的场景） */
export function goTo(path: string): void {
  window.location.href = withBasePath(path);
}
