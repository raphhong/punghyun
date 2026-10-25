import type { AccountContext, Envelope } from './gmail-account-vault';
import type { Identity } from './gmail-connect';
export type ReadAccount = AccountContext & { status: string; generation: number; labelIds: string[]; envelope: Envelope };
export type MailSummary = { id: string; internalDate: number; labelIds: string[]; subject: string; snippet: string };
export interface ReadDependencies {
  enabled: boolean;
  identity(): Promise<Identity | null>;
  load(): Promise<ReadAccount | null>;
  open(c: AccountContext, e: Envelope): string;
  refresh(token: string): Promise<{accessToken: string; rotatedRefreshToken?: string}>;
  profile(token: string): Promise<{emailAddress: string}>;
  rotate(c: ReadAccount, token: string): Promise<number>;
  current(generation: number): Promise<boolean>;
  messages(token: string, after: number, before: number): Promise<MailSummary[]>;
  now?: () => number;
}
const owner = '874162eb-d569-448b-bc8b-cf103cf46c1c';
const mailbox = 'sol.hong@punghyun.com';
const scope = 'https://www.googleapis.com/auth/gmail.readonly';
function result(body: unknown, status: number) {
  return Response.json(body, {status, headers: {'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff', 'Vary':'Cookie'}});
}
// Authenticated same-origin POST avoids prefetches causing private mailbox reads.
// No arbitrary query, labels, account, pagination, or recipient can be supplied.
export async function readGmail(request: Request, d: ReadDependencies) {
  try {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.origin !== 'https://punghyun.vercel.app' || url.search ||
        request.headers.get('origin') !== url.origin || (await request.text()) !== '') return result({error:'invalid_request'},400);
    const user = await d.identity();
    if (!user || !user.verified || user.id !== owner || user.email !== mailbox) return result({error:'unauthorized'},401);
    if (!d.enabled) return result({error:'unavailable'},503);
    const row = await d.load();
    if (!row || row.owner !== owner || row.accountId !== 'sol_hong' || row.mailbox !== mailbox || row.scope !== scope ||
        row.status !== 'active' || !Number.isSafeInteger(row.generation) || row.generation < 1 ||
        row.labelIds.length !== 1 || row.labelIds[0] !== 'INBOX') return result({error:'account_unavailable'},409);
    const token = await d.refresh(d.open(row,row.envelope));
    let generation = row.generation;
    if (token.rotatedRefreshToken) generation = await d.rotate(row,token.rotatedRefreshToken);
    if (!await d.current(generation) || (await d.profile(token.accessToken)).emailAddress !== mailbox) throw new Error();
    const now = (d.now ?? Date.now)(), after = now - 7 * 86400000;
    const messages = await d.messages(token.accessToken,after,now);
    if (messages.length > 20 || messages.some(m => !Number.isSafeInteger(m.internalDate) || m.internalDate < after ||
        m.internalDate > now || !m.labelIds.includes('INBOX')) || !await d.current(generation)) throw new Error();
    // Mail content is untrusted evidence, never an instruction or permission.
    return result({accountId:'sol_hong', untrusted:true, messages},200);
  } catch { return result({error:'mail_read_unavailable'},503); }
}
