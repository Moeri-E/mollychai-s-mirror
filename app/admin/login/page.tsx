'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message ?? '登录失败');
        return;
      }
      try {
        window.localStorage.setItem('mm_csrf', payload.data.csrfToken);
      } catch {
        /* ignore */
      }
      router.push('/admin');
      router.refresh();
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="font-display text-2xl text-ink">mollychai&rsquo;s mirror</p>
      <p className="mt-1 text-[10px] tracking-[0.28em] text-ink-mute uppercase">admin console</p>

      <form onSubmit={submit} className="mt-10 space-y-4">
        <label className="block">
          <span className="text-[11px] tracking-[0.16em] text-ink-mute uppercase">password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            className="mt-2 w-full border-b border-line bg-transparent py-2 text-sm text-ink outline-none transition focus:border-ink"
            placeholder="输入管理员密码"
          />
        </label>

        {error && <p className="text-xs text-ember">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full border border-ink bg-ink py-2.5 text-[11px] tracking-[0.18em] text-paper uppercase transition hover:bg-transparent hover:text-ink disabled:opacity-40"
        >
          {loading ? 'verifying…' : 'enter'}
        </button>
      </form>

      <p className="mt-8 text-[11px] leading-relaxed text-ink-mute">
        首次使用需在服务器执行 <code className="text-ink-soft">npm run admin:password</code>{' '}
        初始化管理员密码。
      </p>
    </div>
  );
}
