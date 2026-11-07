import { requireAdminPage } from '@/lib/auth';
import { getSiteStats } from '@/lib/catalog';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const stats = getSiteStats();

  const submissions = getDb()
    .prepare(
      `SELECT s.id, s.external_id AS externalId, s.status, s.created_at AS createdAt,
              s.detail_json AS detailJson, u.display_name AS uploaderName
       FROM agent_submissions s
       LEFT JOIN uploaders u ON u.id = s.uploader_id
       ORDER BY s.created_at DESC
       LIMIT 15`,
    )
    .all() as {
    id: string;
    externalId: string | null;
    status: string;
    createdAt: string;
    detailJson: string | null;
    uploaderName: string | null;
  }[];

  const recentSongs = getDb()
    .prepare(
      `SELECT s.id, s.title, s.artist, s.created_at AS createdAt, a.title AS albumTitle
       FROM songs s LEFT JOIN albums a ON a.id = s.album_id
       ORDER BY s.created_at DESC LIMIT 8`,
    )
    .all() as { id: string; title: string; artist: string; createdAt: string; albumTitle: string | null }[];

  return (
    <div>
      <header>
        <h1 className="font-display text-3xl text-ink">概览</h1>
        <p className="mt-2 text-sm text-ink-soft">内容概览与智能体提交记录。</p>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: '专辑', value: stats.albums },
          { label: '曲目', value: stats.songs },
          { label: '上传者', value: stats.uploaders },
          { label: '有效令牌', value: stats.activeTokens },
        ].map((item) => (
          <div key={item.label} className="border border-line px-4 py-5">
            <p className="text-[10px] tracking-[0.22em] text-ink-mute uppercase">{item.label}</p>
            <p className="font-display mt-2 text-3xl text-ink">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-10 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-[11px] tracking-[0.16em] text-ink-mute">最近上传</h2>
          <ul className="mt-4 divide-y divide-line/70">
            {recentSongs.length === 0 && (
              <li className="py-6 text-sm text-ink-mute">暂无歌曲</li>
            )}
            {recentSongs.map((song) => (
              <li key={song.id} className="flex items-baseline justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{song.title}</p>
                  <p className="truncate text-[11px] text-ink-mute">
                    {song.albumTitle ?? '单曲'} · {song.artist}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-ink-mute">
                  {song.createdAt.slice(5, 16).replace('T', ' ')}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-[11px] tracking-[0.16em] text-ink-mute">
            智能体提交
          </h2>
          <ul className="mt-4 divide-y divide-line/70">
            {submissions.length === 0 && (
              <li className="py-6 text-sm text-ink-mute">还没有智能体提交记录</li>
            )}
            {submissions.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{item.externalId ?? '—'}</p>
                  <p className="truncate text-[11px] text-ink-mute">
                    {item.uploaderName ?? '未知'} ·{' '}
                    <span
                      className={
                        item.status === 'failed'
                          ? 'text-ember'
                          : item.status === 'updated'
                            ? 'text-accent'
                            : ''
                      }
                    >
                      {item.status}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-ink-mute">
                  {item.createdAt.slice(5, 16).replace('T', ' ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-12 border border-line bg-paper-deep/40 px-5 py-4 text-xs leading-relaxed text-ink-soft">
        <p className="font-medium text-ink">给智能体的说明包</p>
        <p className="mt-1">
          仓库根目录的 <code className="text-ink">agent-kit/</code> 文件夹可直接发给外部智能体，
          内含接入说明、推送脚本与示例。令牌在 <strong>Agents</strong> 页面签发，明文只显示一次。
        </p>
      </section>
    </div>
  );
}
