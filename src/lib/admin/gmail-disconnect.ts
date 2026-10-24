export async function handleDisconnect(request: Request, deps: {
  enabled: boolean; ownerId?: string;
  identity(): Promise<{ id: string; email: string; verified: boolean } | null>;
  accounts: readonly string[];
  disconnect?: (accountId: string) => Promise<string>;
}) {
  const reply = (error: string, status: number) => Response.json({ error }, { status,
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  try {
    if (request.method !== 'POST') return reply('method_not_allowed',405);
    const u = new URL(request.url);
    if (u.origin !== 'https://punghyun.vercel.app' || request.headers.get('origin') !== u.origin ||
        u.searchParams.getAll('account').length !== 1 || [...u.searchParams.keys()].some(k => k !== 'account'))
      return reply('invalid_request',403);
    const identity = await deps.identity();
    if (!identity?.verified || identity.id !== deps.ownerId || identity.email !== 'sol.hong@punghyun.com')
      return reply('unauthorized',401);
    if (!deps.enabled || !deps.disconnect) return reply('connection_not_configured',503);
    const id = u.searchParams.get('account')!;
    if (!deps.accounts.includes(id)) return reply('account_not_allowed',403);
    const result = await deps.disconnect(id);
    if (!['revoked','revoke_unconfirmed','already_disabled'].includes(result)) throw new Error();
    return Response.json({ result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return reply('disconnect_unconfirmed',503); }
}
