'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  /** 常态下的按钮文案，如「吊销」 */
  label: string;
  /** 二次确认时的文案，默认「确认 + label」 */
  confirmLabel?: string;
  /** 排版类名（字号、字距、过渡），颜色由组件自己控制 */
  className?: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  /** 确认态自动收起的时间，避免误触后一直挂着 */
  timeout?: number;
};

/**
 * 危险操作的二次确认按钮。
 *
 * 不用 window.confirm：它在沙箱 iframe、或文档未聚焦时会被浏览器直接屏蔽，
 * 返回 false 且没有任何提示——点了等于没点。这里改成页面内的两步确认：
 * 第一次点击把按钮换成「确认 / 取消」，再点一次才真正执行。
 */
export function ConfirmButton({
  label,
  confirmLabel,
  className = '',
  onConfirm,
  disabled = false,
  timeout = 5000,
}: Props) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!armed) return;
    timer.current = window.setTimeout(() => setArmed(false), timeout);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [armed, timeout]);

  if (!armed) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setArmed(true)}
        className={`${className} text-ink-mute transition hover:text-ember disabled:opacity-40`}
      >
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2.5">
      <button
        type="button"
        disabled={busy || disabled}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setArmed(false);
          }
        }}
        className={`${className} text-ember transition hover:opacity-70 disabled:opacity-40`}
      >
        {busy ? '处理中…' : (confirmLabel ?? `确认${label}`)}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setArmed(false)}
        className={`${className} text-ink-mute transition hover:text-ink disabled:opacity-40`}
      >
        取消
      </button>
    </span>
  );
}
