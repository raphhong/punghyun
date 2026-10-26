import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
// No rows or mutations. Missing schema must not be presented as a working submission form.
export async function shortRentalIntakeReady() {
  try {
    const db=createAdminClient();
    const intakes=await db.from("short_rental_intakes").select("request_id").limit(0);
    return !intakes.error;
  }catch{return false;}
}
