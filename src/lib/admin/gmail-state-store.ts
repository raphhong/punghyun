import type { Pending, StateStore } from './gmail-connect';
type Rpc = (name: string, args: Record<string, string>) => PromiseLike<{
  data: unknown; error: unknown;
}>;
// Bind only after the reviewed SQL has been installed. Uses server RPC only;
// never a browser client. Atomic consume occurs in PostgreSQL, across instances.
export function postgresStateStore(rpc: Rpc): StateStore {
  return {
    async put(keyHash: string, row: Pending) {
      const { error } = await rpc('gmail_oauth_put', { p_key: keyHash, p_owner: row.owner,
        p_account: row.accountId, p_binding: row.bindingHash, p_verifier: row.verifier, p_expires: new Date(row.expires).toISOString() });
      if (error) throw new Error('state unavailable');
    },
    async consume(keyHash: string, owner: string, bindingHash: string, now: number) {
      const { data, error } = await rpc('gmail_oauth_consume', { p_key: keyHash, p_owner: owner, p_binding: bindingHash });
      if (error) throw new Error('state unavailable');
      if (!Array.isArray(data) || data.length !== 1) return null;
      const row = data[0];
      if (!row || row.owner_id !== owner || row.binding_hash !== bindingHash ||
          typeof row.account_id !== 'string' || !/^[a-z0-9_]{1,40}$/.test(row.account_id) ||
          typeof row.verifier !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(row.verifier) ||
          typeof row.expires_at !== 'string' || !Number.isFinite(Date.parse(row.expires_at)) ||
          Date.parse(row.expires_at) <= now) return null;
      return { owner, accountId: row.account_id, bindingHash, verifier: row.verifier, expires: Date.parse(row.expires_at) };
    },
  };
}
