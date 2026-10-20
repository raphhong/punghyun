import { createHash, timingSafeEqual } from 'node:crypto';

const stages = new Set(['intake', 'screening_1', 'screening_2', 'screening_3', 'inspection', 'contract', 'funding', 'operation', 'maturity', 'closed']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type FeedConfig = { enabled?: string; tokenHash?: string; issuedAt?: string; expiresAt?: string; stopMappingVerified?: string };

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

// Initial status-only reader uses existing columns; no AI-state migration.
export async function handleStatus(request: Request, config: FeedConfig, readStatus: (id: string) => Promise<unknown>, now = Date.now()) {
  const denied = authorization(request, config, now);
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const id = params.get('id') ?? '';
  if ([...params.keys()].some(k => k !== 'id') || params.getAll('id').length !== 1 || !uuid.test(id)) {
    return reply({error:'invalid_query'},400);
  }
  try {
    const raw = await readStatus(id) as {id:string;stage:string;updated_at:string} | null;
    if (!raw) return reply({error:'not_found'},404);
    if (raw.id !== id || !stages.has(raw.stage) || typeof raw.updated_at !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(raw.updated_at) ||
        !Number.isFinite(Date.parse(raw.updated_at))) throw new Error('invalid status');
    return reply({version:1,case_id:id,stage:raw.stage,updated_at:raw.updated_at,
      business_closed:raw.stage==='closed',
      automation_state:raw.stage==='closed'?'blocked_closed':'blocked_unverified_activation',
      cancel_pending:true,payment_evidence:'unknown'});
  } catch {
    return reply({error:'status_unavailable'},503);
  }
}

// No browser/session authentication fallback. This identity reads this feed only.
function authorization(request: Request, config: FeedConfig, now: number) {
  if (request.method !== 'GET') return reply({ error: 'method_not_allowed' }, 405);
  const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
  const issued = Date.parse(config.issuedAt ?? '');
  const expiry = Date.parse(config.expiresAt ?? '');
  if (config.enabled !== 'true' || !/^[a-f0-9]{64}$/.test(config.tokenHash ?? '') ||
      !utc.test(config.issuedAt ?? '') || !utc.test(config.expiresAt ?? '') ||
      !Number.isFinite(issued) || !Number.isFinite(expiry) || issued > now ||
      expiry <= now || expiry <= issued || expiry - issued > 30 * 86400_000) {
    return reply({ error: 'unavailable' }, 503);
  }
  const auth = request.headers.get('authorization') ?? '';
  // Require a user-provisioned 256-bit-or-stronger random base64url credential.
  if (!/^Bearer [A-Za-z0-9_-]{43,128}$/.test(auth)) return reply({ error: 'unauthorized' }, 401);
  const digest = createHash('sha256').update(auth.slice(7)).digest();
  if (!timingSafeEqual(digest, Buffer.from(config.tokenHash!, 'hex'))) return reply({ error: 'unauthorized' }, 401);
  return null;
}

