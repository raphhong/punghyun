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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`${ADMIN_BASE}/login`);

  // 단계별 고객 수 집계
  const counts: Record<string, number> = { __all__: 0 };
  for (const s of STAGES) counts[s.key] = 0;

  const { data } = await supabase.from("customers").select("stage");
  if (data) {
    counts.__all__ = data.length;
    for (const row of data) {
      const key = row.stage as string;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return (
    <AdminShell email={user.email} counts={counts}>
      {children}
    </AdminShell>
  );
}
