"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionAgent } from "@/lib/sales/agent";

const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

type FormState = { error: string } | null;

// ── 회원가입 (초대 토큰 있으면 해당 상위 밑으로, 없으면 루트 후보) ──
// 가입 즉시 로그인 가능하되, 승인 전에는 포털 접근이 막힘.
export async function registerAgent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData, "name");
  const phone = str(formData, "phone");
  const email = str(formData, "email");
  const password = String(formData.get("password") ?? "");
  const invite = str(formData, "invite");

  if (!name || !email || !password) {
    return { error: "이름·이메일·비밀번호를 입력하세요." };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }

  const db = createAdminClient();

  // 초대 토큰 → 상위 영업자 확인
  let parentId: string | null = null;
  if (invite) {
    const { data: parent } = await db
      .from("sales_agents")
      .select("id")
      .eq("invite_token", invite)
      .maybeSingle();
    if (!parent) return { error: "유효하지 않은 초대 링크입니다." };
    parentId = parent.id as string;
  }

  // auth 유저 생성 (이메일 확인 생략 → 바로 로그인 가능)
  const { data: created, error: authErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !created.user) {
    const msg = authErr?.message ?? "";
    if (msg.toLowerCase().includes("already")) {
      return { error: "이미 가입된 이메일입니다." };
    }
    return { error: "가입에 실패했습니다. " + msg };
  }

  // 영업자 레코드 생성 (pending)
  const { error: insErr } = await db.from("sales_agents").insert({
    user_id: created.user.id,
    parent_id: parentId,
    name,
    phone,
    email,
    status: "pending",
  });
  if (insErr) {
    // 롤백: 방금 만든 auth 유저 제거
    await db.auth.admin.deleteUser(created.user.id);
    return { error: "가입 처리 중 오류: " + insErr.message };
  }

  redirect("/sales/login?registered=1");
}

// ── 로그인 ──
export async function signInAgent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "이메일과 비밀번호를 입력하세요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "로그인에 실패했습니다. 계정 정보를 확인하세요." };

  redirect("/sales");
}

// ── 로그아웃 ──
export async function signOutAgent() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sales/login");
}

// ── 새 고객 등록 (내 sales_agent_id 로 태깅) ──
export async function createSalesCustomer(formData: FormData) {
  const { agent } = await getSessionAgent();
  if (!agent || agent.status !== "approved") {
    throw new Error("승인된 영업자만 등록할 수 있습니다.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      source: "manual",
      stage: "intake",
      sales_agent_id: agent.id,
      hospital_name: str(formData, "hospital_name"),
      representative: str(formData, "representative"),
      phone: str(formData, "phone"),
      email: str(formData, "email"),
      hospital_type: str(formData, "hospital_type"),
      needed_funds: str(formData, "needed_funds"),
      intake_date: str(formData, "intake_date"),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/sales");
  redirect(`/sales/customers/${data.id}`);
}
