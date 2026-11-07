import type { NextRequest } from 'next/server';

import { ok } from '@/lib/api';
import { deleteAdminSession } from '@/lib/auth';
import { ADMIN_COOKIE_NAME } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  deleteAdminSession(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
  const response = ok({ loggedOut: true });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
