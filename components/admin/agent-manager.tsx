'use client';

import { useRef, useState } from 'react';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { adminFetch, readError } from '@/lib/client-api';
import { copyText } from '@/lib/clipboard';

export type UploaderRow = {
  id: string;
  displayName: string;
  enabled: number;
  updatedAt: string;
  songCount: number;
  tokens: {
    id: string;
    name: string;
    tokenPrefix: string;
    tokenSecret: string | null;
    enabled: number;
    expiresAt: string | null;
    lastUsedAt: string | null;
    createdAt: string;
  }[];
};

export function AgentManager({ initial }: { initial: UploaderRow[] }) {
  const [uploaders, setUploaders] = useState(initial);
  const [uploaderId, setUploaderId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [tokenName, setTokenName] = useState('agent-default');
  const [expiresAt, setExpiresAt] = useState('');
  const [issued, setIssued] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** 复制按钮的反馈状态：点一下必须有回应，否则看起来像没生效 */
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const codeRef = useRef<HTMLElement | null>(null);

  async function reload() {
    const response = await adminFetch('/api/admin/agents');
    const payload = await response.json();
    setUploaders(payload.data ?? []);
  }

  async function handleCopy() {
    if (!issued) return;
    const ok = await copyText(issued);
    setCopyState(ok ? 'ok' : 'fail');

    // 浏览器拦截写入时（常见于 iframe 内或窗口未聚焦），把令牌自动选中，
    // 用户直接 Ctrl/Cmd + C 就行，不至于卡在这一步
    if (!ok && codeRef.current) {
      const range = document.createRange();
      range.selectNodeContents(codeRef.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    window.setTimeout(() => setCopyState('idle'), ok ? 1800 : 6000);
  }

  async function issue(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setIssued(null);
    try {
      const response = await adminFetch('/api/admin/agents', {
        method: 'POST',
        body: JSON.stringify({
          uploaderId: uploaderId.trim(),
          displayName: displayName.trim() || uploaderId.trim(),
          tokenName: tokenName.trim() || 'agent-default',
          expiresAt: expiresAt || null,
        }),
      });
      if (!response.ok) {
        setMessage(await readError(response));
        return;
      }
      const payload = await response.json();
      setIssued(payload.data.token);
      setUploaderId('');
      setDisplayName('');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function toggleToken(tokenId: string, enabled: boolean) {
    setBusy(true);
    try {
      await adminFetch('/api/admin/agents', {
        method: 'PATCH',
        body: JSON.stringify({ tokenId, enabled }),
      });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function toggleUploader(id: string, enabled: boolean) {
    setBusy(true);
    try {
      await adminFetch('/api/admin/agents', {
        method: 'PATCH',
        body: JSON.stringify({ uploaderId: id, enabled }),
      });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(tokenId: string) {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/agents?tokenId=${encodeURIComponent(tokenId)}`, {
        method: 'DELETE',
      });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header>
        <h1 className="font-display text-3xl text-ink">智能体</h1>
        <p className="mt-2 text-sm text-ink-soft">
          为外部智能体签发上传令牌。令牌明文只显示一次，请立即保存。
        </p>
      </header>

      <section className="mt-8 border border-line px-5 py-5">
        <h2 className="text-[11px] tracking-[0.2em] text-ink-mute">签发令牌</h2>

        <form onSubmit={issue} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] tracking-[0.12em] text-ink-mute">
              上传者 ID
            </span>
            <input
              value={uploaderId}
              onChange={(event) => setUploaderId(event.target.value)}
              placeholder="例如 suno-agent"
              className="input-line"
              required
            />
          </label>
          <label className="block">
            <span className="text-[11px] tracking-[0.12em] text-ink-mute">
              显示名称
            </span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="显示名称"
              className="input-line"
            />
          </label>
          <label className="block">
            <span className="text-[11px] tracking-[0.12em] text-ink-mute">令牌名称</span>
            <input
              value={tokenName}
              onChange={(event) => setTokenName(event.target.value)}
              className="input-line"
            />
          </label>
          <label className="block">
            <span className="text-[11px] tracking-[0.12em] text-ink-mute">
              到期时间（可选）
            </span>
            <input
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="input-line"
            />
          </label>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy || !uploaderId.trim()}
              className="border border-ink bg-ink px-4 py-2 text-[11px] tracking-[0.16em] text-paper uppercase transition hover:bg-transparent hover:text-ink disabled:opacity-40"
            >
              {busy ? '签发中…' : '签发令牌'}
            </button>
          </div>
        </form>

        {message && <p className="mt-3 text-xs text-ember">{message}</p>}

        {issued && (
          <div className="mt-4 border border-accent/40 bg-accent/5 px-4 py-3">
            <p className="text-[10px] tracking-[0.18em] text-accent uppercase">
              新令牌 · 只显示这一次
            </p>
            <div className="mt-2 flex items-center gap-3">
              <code ref={codeRef} className="break-all text-xs text-ink select-all">
                {issued}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 border border-ink px-2 py-1 text-[10px] tracking-[0.1em] uppercase transition hover:bg-ink hover:text-paper"
              >
                {copyState === 'ok' ? '已复制' : copyState === 'fail' ? '复制失败' : '复制'}
              </button>
            </div>
            {copyState === 'fail' && (
              <p className="mt-2 text-[11px] text-ember">
                浏览器拦截了写入剪贴板，令牌已自动选中，按 Ctrl / Cmd + C 复制。
              </p>
            )}
          </div>
        )}
      </section>

      <section className="mt-10 space-y-8">
        {uploaders.length === 0 && (
          <p className="py-6 text-sm text-ink-mute">还没有签发过令牌</p>
        )}

        {uploaders.map((uploader) => (
          <div key={uploader.id} className="border border-line">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
              <div>
                <p className="text-sm text-ink">{uploader.displayName}</p>
                <p className="text-[11px] text-ink-mute">
                  id: {uploader.id} · {uploader.songCount} 首 ·{' '}
                  <span className={uploader.enabled === 1 ? 'text-ink-soft' : 'text-ember'}>
                    {uploader.enabled === 1 ? '启用' : '停用'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleUploader(uploader.id, uploader.enabled !== 1)}
                className="border border-line px-3 py-1 text-[10px] tracking-[0.12em] uppercase transition hover:border-ink hover:text-ink"
              >
                {uploader.enabled === 1 ? '停用' : '启用'}
              </button>
            </div>

            <ul className="divide-y divide-line/60">
              {uploader.tokens.map((token) => (
                <li key={token.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink">
                      {token.name}
                      <span className="ml-2 text-[10px] tracking-[0.1em] text-ink-mute uppercase">
                        {token.enabled === 1 ? '启用中' : '已停用'}
                      </span>
                    </p>
                    <p className="text-[11px] text-ink-mute">
                      {token.tokenPrefix}… · 创建 {token.createdAt.slice(0, 10)}
                      {token.lastUsedAt ? ` · 最近使用 ${token.lastUsedAt.slice(0, 16).replace('T', ' ')}` : ' · 从未使用'}
                      {token.expiresAt ? ` · 到期 ${token.expiresAt.slice(0, 10)}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => toggleToken(token.id, token.enabled !== 1)}
                      className="text-[10px] tracking-[0.12em] text-ink-soft uppercase transition hover:text-ink"
                    >
                      {token.enabled === 1 ? '停用' : '启用'}
                    </button>
                    <ConfirmButton
                      label="吊销"
                      confirmLabel="确认吊销"
                      onConfirm={() => revoke(token.id)}
                      className="text-[10px] tracking-[0.12em] uppercase"
                    />
                  </div>
                </li>
              ))}
              {uploader.tokens.length === 0 && (
                <li className="px-5 py-3 text-[11px] text-ink-mute">没有令牌</li>
              )}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
