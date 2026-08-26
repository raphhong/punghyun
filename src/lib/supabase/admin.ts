import "server-only";
import { createClient } from "@supabase/supabase-js";

// 서버 전용 관리자 클라이언트 (Service Role Key) — RLS 우회.
// 공홈 인입 삽입, 파일 서명 URL 발급 등 서버 로직에서만 사용하세요.
// 절대 브라우저로 노출되면 안 됩니다.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
