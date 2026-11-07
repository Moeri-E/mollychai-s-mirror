'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'HOME' },
  { href: '/albums', label: 'ALBUMS' },
  { href: '/singles', label: 'SINGLES' },
  { href: '/about', label: 'ABOUT' },
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

        <ul className="flex items-center gap-5 sm:gap-7">
          {LINKS.map((link) => {
            const active =
              link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  data-active={active}
                  className={`nav-link text-[11px] tracking-[0.16em] ${
                    active ? 'text-ink' : 'text-ink-mute hover:text-ink'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
