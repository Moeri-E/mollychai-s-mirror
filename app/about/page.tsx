import { getSetting } from '@/lib/auth';
import { getSiteStats } from '@/lib/catalog';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'About' };

export default function AboutPage() {
  const stats = getSiteStats();
  const aboutTitle = getSetting('about_title') ?? 'About this mirror';
  const aboutBody =
    getSetting('about_body') ??
    'mollychai’s mirror 是一个记录音乐、情绪与记忆的数字空间。以专辑为单位整理作品，像翻阅实体唱片一样浏览与聆听。';

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <header className="pt-14 pb-10 sm:pt-20">
        <p className="text-[10px] tracking-[0.34em] text-ink-mute uppercase">about</p>
        <h1 className="font-display mt-3 text-4xl text-ink sm:text-5xl">{aboutTitle}</h1>
      </header>

      <section className="border-t border-line/70 py-10">
        <p className="whitespace-pre-line text-base leading-[1.9] text-ink-soft">{aboutBody}</p>
      </section>

      <section className="border-t border-line/70 py-10">
        <dl className="grid grid-cols-3 gap-6 text-center">
          <div>
            <dt className="text-[10px] tracking-[0.24em] text-ink-mute uppercase">albums</dt>
            <dd className="font-display mt-2 text-3xl text-ink">{stats.albums}</dd>
          </div>
          <div>
            <dt className="text-[10px] tracking-[0.24em] text-ink-mute uppercase">tracks</dt>
            <dd className="font-display mt-2 text-3xl text-ink">{stats.songs}</dd>
          </div>
          <div>
            <dt className="text-[10px] tracking-[0.24em] text-ink-mute uppercase">sources</dt>
            <dd className="font-display mt-2 text-3xl text-ink">{stats.uploaders}</dd>
          </div>
        </dl>
      </section>

      <footer className="border-t border-line/70 py-10 text-xs leading-relaxed text-ink-mute">
        <p className="font-display text-base text-ink">{SITE_NAME}</p>
        <p className="mt-1">{SITE_TAGLINE}</p>
        <p className="mt-4">
          所有音乐内容仅用于个人归档与展示，请确保上传内容为本人创作或已获授权。
        </p>
      </footer>
    </div>
  );
}
