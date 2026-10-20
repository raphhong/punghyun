import { handleStatus } from '@/lib/admin/ai-status';
import { createAdminClient } from '@/lib/supabase/admin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleStatus(request, {
    enabled: process.env.AI_FEED_ENABLED,
    tokenHash: process.env.AI_FEED_TOKEN_SHA256,
    issuedAt: process.env.AI_FEED_TOKEN_ISSUED_AT,
    expiresAt: process.env.AI_FEED_TOKEN_EXPIRES_AT,
  }, async (id) => {
    const { data, error } = await createAdminClient()
      .from('customers').select('id,stage,updated_at').eq('id',id).maybeSingle();
    if (error) throw new Error('status unavailable');
    return data;
  });
}
