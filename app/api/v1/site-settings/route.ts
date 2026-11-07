import { ok } from '@/lib/api';
import { getSetting } from '@/lib/auth';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  return ok({
    siteName: SITE_NAME,
    tagline: SITE_TAGLINE,
    heroTitle: getSetting('hero_title') ?? '唱片档案。',
    heroSubtitle: getSetting('hero_subtitle') ?? SITE_TAGLINE,
    aboutTitle: getSetting('about_title') ?? '关于这面镜子',
    aboutBody:
      getSetting('about_body') ??
      'mollychai’s mirror 是一个记录音乐、情绪与记忆的数字空间。以专辑为单位整理作品，像翻阅实体唱片一样浏览与聆听。',
  });
}
