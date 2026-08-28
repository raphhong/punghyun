"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminPath } from "@/lib/admin/config";

// 승인 (RLS: admin full access 로 관리자만 통과)
export async function approveAgent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_agents")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(adminPath("agents"));
}

// 거절
export async function rejectAgent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_agents")
    .update({ status: "rejected", approved_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(adminPath("agents"));
}

// 승인 취소 → 대기로 되돌림
export async function resetAgent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_agents")
    .update({ status: "pending", approved_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(adminPath("agents"));
}
