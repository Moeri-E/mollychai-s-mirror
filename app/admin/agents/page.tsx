import { AgentManager, type UploaderRow } from '@/components/admin/agent-manager';
import { getAdminUploaders, requireAdminPage } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminAgentsPage() {
  await requireAdminPage();

  const uploaders = getAdminUploaders().map((uploader) => ({
    id: uploader.id,
    displayName: uploader.displayName,
    enabled: uploader.enabled,
    updatedAt: uploader.updatedAt,
    songCount: uploader.songCount,
    tokens: uploader.tokens.map((token) => ({
      id: token.id,
      name: token.name,
      tokenPrefix: token.tokenPrefix,
      tokenSecret: token.tokenSecret,
      enabled: token.enabled,
      expiresAt: token.expiresAt,
      lastUsedAt: token.lastUsedAt,
      createdAt: token.createdAt,
    })),
  })) satisfies UploaderRow[];

  return <AgentManager initial={uploaders} />;
}
