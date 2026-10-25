import {gmailDependencies} from '@/lib/admin/gmail-connect-runtime';
import {readServerMail} from '@/lib/admin/server-mail-gateway.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
export async function GET(request:Request){
 const d=gmailDependencies().read;
 return readServerMail(request,{
  enabled:process.env.AGENT_MAIL_READ_ENABLED,
  hash:process.env.AGENT_MAIL_READ_TOKEN_SHA256,
  issued:process.env.AGENT_MAIL_READ_ISSUED_AT,
  expires:process.env.AGENT_MAIL_READ_EXPIRES_AT,
  customerGrantHash:process.env.AGENT_READ_TOKEN_SHA256,
  purpose:'gmail_summary_read',account:'sol_hong',owner:'874162eb-d569-448b-bc8b-cf103cf46c1c'
 },d);
}
