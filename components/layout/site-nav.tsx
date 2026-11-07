'use client';

import { Home, Info, Music } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ThemeToggle } from '@/components/theme-toggle';

const LINKS = [
  { href: '/', label: '首页', Icon: Home },
  { href: '/singles', label: '单曲', Icon: Music },
  { href: '/about', label: '关于', Icon: Info },
];

export function SiteNav() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin')) return null;

  return (
    <header
      data-site-nav
      className="relative z-30 h-[68px] shrink-0 border-b border-line/70"
    >
      <nav className="mx-auto flex h-full max-w-6xl items-center justify-end gap-0.5 px-4 sm:gap-1 sm:px-6">
        <ul className="flex items-center gap-0.5 sm:gap-1">
          {LINKS.map(({ href, label, Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-label={label}
                  title={label}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex h-9 w-9 items-center justify-center transition ${
                    active ? 'text-ink' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 1.8 : 1.5} />
                  {/* 当前页用一个小圆点标出来：图标本身不适合加下划线 */}
                  <span
                    aria-hidden
                    className={`absolute bottom-1 h-[3px] w-[3px] rounded-full transition ${
                      active ? 'bg-ink' : 'bg-transparent'
                    }`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
        <ThemeToggle />
      </nav>
    </header>
  );
}
