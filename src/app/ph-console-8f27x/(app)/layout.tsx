import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_BASE } from "@/lib/admin/config";
import { STAGES } from "@/lib/admin/pipeline";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // getClaims()는 로컬 JWT 검증(무네트워크) → 먼저 실행해 uid를 확보.
  const claimsRes = await supabase.auth.getClaims();
  const claims = claimsRes.data?.claims;
  if (!claims) redirect(`${ADMIN_BASE}/login`);
  const uid = typeof claims.sub === "string" ? claims.sub : undefined;
  const email = typeof claims.email === "string" ? claims.email : undefined;

  // 네트워크 왕복을 줄이기 위해 관리자 확인 + 단계 집계를 병렬 실행.
  const [adminRes, countsRes] = await Promise.all([
    uid
      ? supabase.from("admins").select("user_id").eq("user_id", uid).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("customers").select("stage"),
  ]);

  // 내부 관리자만 접근 허용. 영업자 계정은 영업자 포털(/sales)로 보냄.
  // (마이그레이션 전에는 admins 테이블이 없어 error 반환 → 통과시켜 기존 관리자 잠금 방지)
  if (uid && !adminRes.error && !adminRes.data) redirect("/sales");

  // 단계별 고객 수 집계
  const counts: Record<string, number> = { __all__: 0 };
  for (const s of STAGES) counts[s.key] = 0;

  const data = countsRes.data;
  if (data) {
    counts.__all__ = data.length;
    for (const row of data) {
      const key = row.stage as string;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return (
    <AdminShell email={email} counts={counts}>
      {children}
    </AdminShell>
  );
}
