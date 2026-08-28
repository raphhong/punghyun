import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_BASE } from "@/lib/admin/config";

// 인쇄 전용 레이아웃 — AdminShell(사이드바) 없이 깨끗한 전체 화면.
// (app) 레이아웃과 동일한 관리자 인증 가드만 재사용한다.
export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect(`${ADMIN_BASE}/login`);

  const uid = typeof claims.sub === "string" ? claims.sub : undefined;
  if (uid) {
    const { data: adminRow, error } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle();
    if (!error && !adminRow) redirect("/sales");
  }

  return <div className="min-h-screen bg-white text-black">{children}</div>;
}
