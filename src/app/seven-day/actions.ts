"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shortRentalPublicAccess } from "@/lib/admin/short-rental-public-access";
import { validIntake, reuseAllowed } from "@/lib/admin/short-rental-intake";
import { uuid } from "@/lib/admin/short-rental-intake";
export async function submitSevenDayIntake(requestId: string, token: string | null, payload: unknown, honeypot: string) {
  const failure = { error: "접수하지 못했습니다. 입력과 전용 링크를 확인하거나 담당자에게 문의하세요." };
  if (honeypot || !uuid(requestId) || !validIntake(payload) || token !== null && !uuid(token)) return failure;
  try {
    let db;
    if (token) {
      const access = await shortRentalPublicAccess(token);
      if (!reuseAllowed(payload,access.available,true) || payload.deviceId && !access.devices.some(d=>d.id===payload.deviceId)) return failure;
      db = access.db;
    } else {
      if (payload.deviceId || !reuseAllowed(payload,{})) return failure;
      db = createAdminClient();
    }
    const result = await db.rpc("submit_short_rental_intake",{p_request:requestId,p_token:token,p_payload:payload});
    if (result.error || result.data?.ok !== true) return failure;
    return { ok: true as const };
  } catch { return failure; }
}
