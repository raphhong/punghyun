import { handleDisconnect } from '@/lib/admin/gmail-disconnect';
import { gmailDependencies } from '@/lib/admin/gmail-connect-runtime';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const deps = gmailDependencies();
  return handleDisconnect(request, { enabled: deps.config.enabled, ownerId: deps.config.ownerId,
    identity: deps.identity, accounts: ['sol_hong'], disconnect: deps.disconnect });
}
