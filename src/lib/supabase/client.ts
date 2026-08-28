import { createClient } from "@supabase/supabase-js";

// 브라우저 전용 Supabase 클라이언트 (anon key).
// 대용량 파일을 서버(Vercel body 제한) 우회해 Storage로 직접 업로드할 때 사용.
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
