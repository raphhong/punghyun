import { gmailDependencies } from '@/lib/admin/gmail-connect-runtime';
import { readGmail } from '@/lib/admin/gmail-read';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function POST(request: Request) {
  const deps=gmailDependencies();
  if(!deps.read) return Response.json({error:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
  return readGmail(request,deps.read);
}
