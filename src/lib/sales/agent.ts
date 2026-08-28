import { createClient } from "@/lib/supabase/server";

export type AgentStatus = "pending" | "approved" | "rejected";

export type SalesAgent = {
  id: string;
  user_id: string | null;
  parent_id: string | null;
  ancestor_ids: string[];
  name: string;
  phone: string | null;
  email: string | null;
  status: AgentStatus;
  invite_token: string;
  created_at: string;
  approved_at: string | null;
};

// 현재 로그인 세션의 영업자 정보. 로그인 안 됐으면 user: null.
export async function getSessionAgent(): Promise<
  | { user: null; agent: null }
  | { user: { id: string; email?: string }; agent: SalesAgent | null }
> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { user: null, agent: null };

  const { data: agent } = await supabase
    .from("sales_agents")
    .select("*")
    .eq("user_id", claims.sub)
    .maybeSingle();

  return {
    user: {
      id: claims.sub as string,
      email: typeof claims.email === "string" ? claims.email : undefined,
    },
    agent: (agent as SalesAgent | null) ?? null,
  };
}
