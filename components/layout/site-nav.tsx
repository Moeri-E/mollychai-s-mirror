'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ThemeToggle } from '@/components/theme-toggle';

const LINKS = [
  { href: '/', label: '首页' },
  { href: '/albums', label: '专辑' },
  { href: '/singles', label: '单曲' },
  { href: '/about', label: '关于' },
];

export function SiteNav() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin')) return null;

  // 首页正中央已有手写体主标题，左上角再放一遍同样的名字会显得重复
  const isHome = pathname === '/';

  return (
    <header className="relative z-30 h-[68px] shrink-0 border-b border-line/70">
      <nav
        className={`mx-auto flex h-full max-w-6xl items-center px-4 sm:px-6 ${
          isHome ? 'justify-end' : 'justify-between'
        }`}
      >
        {!isHome && (
          <Link
            href="/"
            className="font-display shrink-0 text-[14px] leading-none tracking-tight text-ink sm:text-lg"
          >
            mollychai&rsquo;s mirror
          </Link>
        )}

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-6">
          <ul className="flex items-center gap-1.5 sm:gap-6">
          {LINKS.map((link) => {
            const active =
              link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  data-active={active}
                  className={`nav-link whitespace-nowrap text-[11px] tracking-[0] sm:text-[13px] sm:tracking-[0.06em] ${
                    active ? 'text-ink' : 'text-ink-mute hover:text-ink'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
          </ul>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
