import { createHash, randomBytes } from 'node:crypto';

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const CONNECT_ORIGIN = 'https://punghyun.vercel.app';
export const CALLBACK = CONNECT_ORIGIN + '/api/integrations/gmail/oauth/callback';
export const RESULT = CONNECT_ORIGIN + '/ph-console-8f27x/integrations/gmail';
export const BINDING_COOKIE = '__Host-ph-gmail-connect';
const mailbox = 'sol.hong@punghyun.com';
const opaque = /^[A-Za-z0-9_-]{43,128}$/;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export type Identity = { id: string; email: string; verified: boolean };
export type MailAccount = { id: string; email: string };
export const INITIAL_ACCOUNTS: readonly MailAccount[] = [{ id: 'sol_hong', email: mailbox }];
export type Pending = { owner: string; accountId: string; bindingHash: string; verifier: string; expires: number };
export interface StateStore {
  // Production: shared atomic storage, bounded per-owner pending entries, TTL.
  put(keyHash: string, row: Pending): Promise<void>;
  // Must atomically match owner/binding/expiry AND delete before returning.
  consume(keyHash: string, owner: string, bindingHash: string, now: number): Promise<Pending | null>;
}
export interface SecretSink {
  // Idempotent operation key. Never return credential values or log payloads.
  // Uncertain failures require operator reconciliation, never automatic replay.
  save(input: { operation: string; owner: string; accountId: string; mailbox: string; scope: string; refreshToken: string }): Promise<void>;
}
export type Dependencies = {
  config: { enabled: boolean; ownerId?: string; clientId?: string; accounts?: readonly MailAccount[] };
  identity(): Promise<Identity | null>;
  states?: StateStore;
  secrets?: SecretSink;
  exchange?: (code: string, verifier: string, redirect: string) => Promise<{
    access_token: string; refresh_token: string; scope: string; token_type: string;
  }>;
  profile?: (accessToken: string) => Promise<{ emailAddress: string }>;
  now?: () => number;
};
function response(error: string, status: number) {
  return Response.json({ error }, { status, headers: {
    'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  } });
}
function cookie(value: string, age: number) {
  return `${BINDING_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
}
function redirect(target: string, binding: string, age: number) {
  return new Response(null, { status: 303, headers: { Location: target,
    'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Set-Cookie': cookie(binding, age) } });
}
async function owner(d: Dependencies) {
  const u = await d.identity();
  return u && u.verified && u.id === d.config.ownerId && u.email === mailbox ? u : null;
}
function ready(d: Dependencies) {
  return d.config.enabled && d.config.ownerId && d.config.clientId && d.states && d.secrets && d.exchange && d.profile;
}
function selectedAccount(d: Dependencies, id: string) {
  const accounts = d.config.accounts ?? INITIAL_ACCOUNTS;
  if (accounts.length > 20 || new Set(accounts.map(a => a.id)).size !== accounts.length ||
      new Set(accounts.map(a => a.email)).size !== accounts.length) return null;
  return accounts.find(a => a.id === id && /^[a-z0-9_]{1,40}$/.test(a.id) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) ?? null;
}
export async function beginConnect(request: Request, d: Dependencies) {
  try {
    if (request.method !== 'POST') return response('method_not_allowed', 405);
    const url = new URL(request.url);
    if (url.origin !== CONNECT_ORIGIN || request.headers.get('origin') !== CONNECT_ORIGIN ||
        [...url.searchParams.keys()].some(k => k !== 'account') || url.searchParams.getAll('account').length > 1)
      return response('invalid_origin', 403);
    const u = await owner(d);
    if (!u) return response('unauthorized', 401);
    if (!ready(d)) return response('connection_not_configured', 503);
    const selected = selectedAccount(d, url.searchParams.get('account') ?? 'sol_hong');
    if (!selected) return response('account_not_allowed', 403);
    const state = randomBytes(32).toString('base64url');
    const binding = randomBytes(32).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    await d.states!.put(hash(state), { owner: u.id, accountId: selected.id, bindingHash: hash(binding), verifier,
      expires: (d.now?.() ?? Date.now()) + 600000 });
    const target = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    target.search = new URLSearchParams({ client_id: d.config.clientId!, redirect_uri: CALLBACK,
      response_type: 'code', scope: GMAIL_SCOPE, access_type: 'offline', prompt: 'consent',
      include_granted_scopes: 'false', login_hint: selected.email, state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
    return redirect(target.href, binding, 600);
  } catch { return response('connection_unavailable', 503); }
}
export async function finishConnect(request: Request, d: Dependencies) {
  try {
    if (request.method !== 'GET') return response('method_not_allowed', 405);
    const u = await owner(d);
    if (!u) return response('unauthorized', 401);
    if (!ready(d)) return response('connection_not_configured', 503);
    const url = new URL(request.url), q = url.searchParams;
    if (url.origin !== CONNECT_ORIGIN || request.url.length > 8192 ||
        [...q.keys()].some(k => !['state','iss','code','error','scope','authuser','prompt'].includes(k)) ||
        [...q.keys()].some(k => q.getAll(k).length !== 1)) return response('invalid_callback', 400);
    // Google sends RFC 9207 issuer identification. Pin its exact issuer before
    // consuming state or exchanging a code; do not accept arbitrary extra fields.
    if (q.get('iss') !== 'https://accounts.google.com') return response('invalid_callback', 400);
    const state = q.get('state') ?? '';
    const matches = (request.headers.get('cookie') ?? '').split(';').map(x => x.trim())
      .filter(x => x.startsWith(BINDING_COOKIE + '='));
    const binding = matches.length === 1 ? matches[0].slice(BINDING_COOKIE.length + 1) : '';
    if (!opaque.test(state) || !opaque.test(binding)) return response('invalid_state', 400);
    const pending = await d.states!.consume(hash(state), u.id, hash(binding), d.now?.() ?? Date.now());
    if (!pending) return response('invalid_state', 400);
    const selected = selectedAccount(d, pending.accountId);
    if (!selected) return response('account_not_allowed', 403);
    // State is consumed even on denial/invalid code/network failure; no retry of uncertain exchanges.
    if (q.has('error')) return redirect(RESULT + '?result=denied', '', 0);
    const code = q.get('code') ?? '';
    if (!code || code.length > 4096) return response('invalid_callback', 400);
    const token = await d.exchange!(code, pending.verifier, CALLBACK);
    if (token.scope !== GMAIL_SCOPE || token.token_type.toLowerCase() !== 'bearer' ||
        !token.access_token || token.access_token.length > 4096 ||
        !token.refresh_token || token.refresh_token.length > 4096) throw new Error('invalid token');
    const account = await d.profile!(token.access_token);
    if (account.emailAddress !== selected.email) throw new Error('wrong mailbox');
    await d.secrets!.save({ operation: hash(state), owner: u.id, accountId: selected.id, mailbox: selected.email, scope: GMAIL_SCOPE,
      refreshToken: token.refresh_token });
    return redirect(RESULT + '?result=connected', '', 0);
  } catch {
    // No provider descriptions, codes, query strings or token responses in output/logs.
    return redirect(RESULT + '?result=failed', '', 0);
  }
}
