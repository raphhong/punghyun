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

  // getUser() 네트워크 왕복 대신 로컬 JWT 검증 + 집계 쿼리를 병렬 실행.
  const [claimsRes, countsRes] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("customers").select("stage"),
  ]);

  const claims = claimsRes.data?.claims;
  if (!claims) redirect(`${ADMIN_BASE}/login`);
  const email = typeof claims.email === "string" ? claims.email : undefined;

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
