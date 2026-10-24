import { encryptedSink, type AccountContext, type AccountRegistry, type Envelope, type accountVault } from './gmail-account-vault';
type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
export function vaultStore(rpc: Rpc, vault: ReturnType<typeof accountVault>, labels: readonly string[]) {
  if (!labels.length || labels.length > 10 || labels.some(s => !/^[A-Za-z0-9_-]{1,100}$/.test(s))) throw new Error('mail labels not configured');
  async function call(name: string, args: Record<string, unknown>) {
    const result = await rpc(name,args);
    if (result.error) throw new Error('credential store unavailable');
    return result.data;
  }
  const secrets = encryptedSink(vault, async row => {
    await call('gmail_vault_save', { p_operation: row.operation, p_owner: row.context.owner,
      p_account: row.context.accountId, p_mailbox: row.context.mailbox, p_scope: row.context.scope,
      p_envelope: row.envelope, p_labels: [...labels] });
  });
  const registry: AccountRegistry = {
    async disable(c: AccountContext) {
      const rows = await call('gmail_vault_disable', {p_owner:c.owner,p_account:c.accountId,p_mailbox:c.mailbox});
      if (!Array.isArray(rows) || rows.length > 1) throw new Error('invalid store response');
      if (!rows.length) return null;
      const row=rows[0];
      if (!Number.isSafeInteger(row.generation) || row.generation<1 || !row.envelope) throw new Error('invalid store response');
      return {generation:row.generation as number,envelope:row.envelope as Envelope};
    },
    async finishDisconnect(c,generation,result) {
      if (await call('gmail_vault_finish_disconnect',{p_owner:c.owner,p_account:c.accountId,p_generation:generation,p_result:result}) !== true)
        throw new Error('disconnect generation changed');
    },
  };
  return {secrets,registry};
}
