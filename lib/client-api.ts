'use client';

/** 管理后台的 fetch 封装：自动带 CSRF token，处理会话过期 */
export async function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  try {
    const csrf = window.localStorage.getItem('mm_csrf');
    if (csrf) headers.set('x-csrf-token', csrf);
  } catch {
    /* ignore */
  }
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...init, headers, credentials: 'same-origin' });

  if (response.status === 401) {
    try {
      window.localStorage.removeItem('mm_csrf');
    } catch {
      /* ignore */
    }
    window.location.href = '/admin/login';
    throw new Error('UNAUTHORIZED');
  }

  return response;
}

export async function readError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    return payload?.error?.message ?? `请求失败（${response.status}）`;
  } catch {
    return `请求失败（${response.status}）`;
  }
}

export async function uploadMedia(
  file: File,
  kind: 'audio' | 'cover',
): Promise<{ url: string; duration?: number; format?: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  const response = await adminFetch('/api/admin/upload', { method: 'POST', body: form });
  if (!response.ok) throw new Error(await readError(response));
  const payload = await response.json();
  return payload.data;
}
