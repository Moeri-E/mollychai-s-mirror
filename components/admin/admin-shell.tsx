'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { href: '/admin', label: '概览' },
  { href: '/admin/albums', label: '专辑' },
  { href: '/admin/songs', label: '歌曲' },
  { href: '/admin/agents', label: '智能体' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/admin/login') {
    return <div className="min-h-screen bg-paper">{children}</div>;
  }

  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    try {
      window.localStorage.removeItem('mm_csrf');
    } catch {
      /* ignore */
    }
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:flex-row sm:px-6">
        <aside className="sm:w-48 sm:shrink-0">
          <p className="font-display text-lg">mollychai&rsquo;s mirror</p>
          <p className="mt-1 text-[11px] tracking-[0.16em] text-ink-mute">管理后台</p>

          <nav className="mt-6">
            <ul className="space-y-1">
              {NAV.map((item) => {
                const active =
                  item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block border-l-2 py-1.5 pl-3 text-sm transition ${
                        active
                          ? 'border-ink text-ink'
                          : 'border-transparent text-ink-mute hover:text-ink'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-8 space-y-2 border-t border-line pt-4 text-xs">
            <Link href="/" className="block text-ink-mute transition hover:text-ink">
              ← 返回站点
            </Link>
            <button
              type="button"
              onClick={logout}
              className="block text-left text-ink-mute transition hover:text-ember"
            >
              退出登录
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 border-t border-line pt-6 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8">
          {children}
        </div>
      </div>
    </div>
  );
}
