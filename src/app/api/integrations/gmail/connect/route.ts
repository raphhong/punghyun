import { beginConnect } from '@/lib/admin/gmail-connect';
import { gmailDependencies } from '@/lib/admin/gmail-connect-runtime';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return beginConnect(request, gmailDependencies());
}
