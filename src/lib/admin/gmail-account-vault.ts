import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
export type AccountContext = { owner: string; accountId: string; mailbox: string; scope: string };
export type Envelope = { version: 1; keyId: string; iv: string; tag: string; ciphertext: string };
function context(c: AccountContext) {
  if (!c.owner || !/^[a-z0-9_]{1,40}$/.test(c.accountId) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.mailbox) ||
      c.scope !== 'https://www.googleapis.com/auth/gmail.readonly') throw new Error('invalid context');
  return JSON.stringify(['gmail-v1', c.owner, c.accountId, c.mailbox, c.scope]);
}
// The master key is supplied by an approved secret store, never read from disk/env
// here. Persist only this envelope; expose neither decrypt() nor the key to models.
export function accountVault(key: Buffer, keyId: string) {
  if (key.length !== 32 || !/^[a-zA-Z0-9_-]{1,40}$/.test(keyId)) throw new Error('invalid key configuration');
  return {
    seal(c: AccountContext, token: string): Envelope {
      if (!token || token.length > 4096) throw new Error('invalid credential');
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(context(c)));
      const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
      return { version: 1, keyId, iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), ciphertext: ciphertext.toString('base64url') };
    },
    open(c: AccountContext, e: Envelope): string {
      try {
        if (e.version !== 1 || e.keyId !== keyId || e.ciphertext.length > 8192 ||
            !/^[A-Za-z0-9_-]{16}$/.test(e.iv) || !/^[A-Za-z0-9_-]{22}$/.test(e.tag) ||
            !/^[A-Za-z0-9_-]+$/.test(e.ciphertext)) throw new Error();
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(e.iv, 'base64url'));
        decipher.setAAD(Buffer.from(context(c))); decipher.setAuthTag(Buffer.from(e.tag, 'base64url'));
        return Buffer.concat([decipher.update(Buffer.from(e.ciphertext, 'base64url')), decipher.final()]).toString('utf8');
      } catch { throw new Error('credential unavailable'); }
    },
  };
}
export type ReadScope = { labelIds: readonly string[]; afterMs: number; maxMessages: number };
export function mailQuery(c: AccountContext, scope: ReadScope, now: number) {
  context(c);
  if (!scope.labelIds.length || scope.labelIds.length > 10 ||
      scope.labelIds.some(id => !/^[A-Za-z0-9_-]{1,100}$/.test(id)) ||
      !Number.isSafeInteger(scope.afterMs) || scope.afterMs < now - 7 * 86400000 || scope.afterMs > now ||
      !Number.isSafeInteger(scope.maxMessages) || scope.maxMessages < 1 || scope.maxMessages > 20)
    throw new Error('mail scope unavailable');
  // Fixed query, never arbitrary model/third-party Gmail search syntax.
  return { accountId: c.accountId, mailbox: c.mailbox, labelIds: [...scope.labelIds],
    q: `after:${Math.floor(scope.afterMs / 1000)}`, maxResults: scope.maxMessages };
}
export function ingestKey(c: AccountContext, messageId: string, revision: string) {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(messageId) || !/^[a-zA-Z0-9_-]{1,200}$/.test(revision)) throw new Error('invalid source');
  return createHash('sha256').update(JSON.stringify([context(c),messageId,revision])).digest('hex');
}
export interface AccountRegistry {
  // All operations are owner+account scoped; no global "current account" token.
  // disable atomically invalidates leases/pending outputs and advances generation.
  disable(c: AccountContext): Promise<{ generation: number; envelope: Envelope } | null>;
  // Compare generation before completion. Preserve encrypted token on uncertain
  // revocation for manual reconciliation; it remains unusable for reads meanwhile.
  finishDisconnect(c: AccountContext, generation: number, result: 'revoked' | 'revoke_unconfirmed'): Promise<void>;
}
export async function disconnectAccount(c: AccountContext, deps: {
  authorizedOwner: string; approvedAccounts: readonly string[]; registry: AccountRegistry;
  open(c: AccountContext, e: Envelope): string; revoke(token: string): Promise<void>;
}) {
  context(c);
  if (deps.authorizedOwner !== c.owner || !deps.approvedAccounts.includes(c.accountId)) throw new Error('unauthorized');
  const disabled = await deps.registry.disable(c);
  if (!disabled) return 'already_disabled';
  let result: 'revoked' | 'revoke_unconfirmed' = 'revoke_unconfirmed';
  try { await deps.revoke(deps.open(c, disabled.envelope)); result = 'revoked'; } catch { /* no raw errors */ }
  await deps.registry.finishDisconnect(c, disabled.generation, result);
  return result;
}

export function encryptedSink(vault: ReturnType<typeof accountVault>, putEncrypted: (row: {
  context: AccountContext; operation: string; envelope: Envelope;
}) => Promise<void>) {
  return { async save(input: AccountContext & { operation: string; refreshToken: string }) {
    if (!/^[a-f0-9]{64}$/.test(input.operation)) throw new Error('invalid operation');
    const c = { owner: input.owner, accountId: input.accountId, mailbox: input.mailbox, scope: input.scope };
    await putEncrypted({ context: c, operation: input.operation, envelope: vault.seal(c, input.refreshToken) });
  } };
}
export interface IngestLedger {
  // Atomically INSERT key if absent while matching enabled account generation.
  // Advance checkpoints only after durable work reservation. No content in keys.
  claim(c: AccountContext, generation: number, key: string): Promise<boolean>;
}
export async function reserveMail(c: AccountContext, source: {
  mailbox: string; messageId: string; revision: string; labelIds: readonly string[]; dateMs: number;
}, scope: ReadScope, generation: number, ledger: IngestLedger, now: number) {
  mailQuery(c, scope, now);
  if (source.mailbox !== c.mailbox || source.dateMs < scope.afterMs || source.dateMs > now ||
      !Number.isSafeInteger(source.dateMs) || !scope.labelIds.every(label => source.labelIds.includes(label)) ||
      !Number.isSafeInteger(generation) || generation < 1) throw new Error('source outside account scope');
  return ledger.claim(c, generation, ingestKey(c, source.messageId, source.revision));
}
