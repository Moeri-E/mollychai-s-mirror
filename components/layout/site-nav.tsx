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

  return (
    <header className="relative z-30 border-b border-line/70">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="font-display text-lg leading-none tracking-tight text-ink">
          mollychai&rsquo;s mirror
        </Link>

        <div className="flex items-center gap-4 sm:gap-6">
          <ul className="flex items-center gap-4 sm:gap-6">
          {LINKS.map((link) => {
            const active =
              link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  data-active={active}
                  className={`nav-link text-[13px] tracking-[0.06em] ${
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
