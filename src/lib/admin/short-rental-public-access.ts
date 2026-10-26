import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuid } from "./short-rental-intake";
import { intakeChecks, type ReusableChecks } from "./short-rental-intake";
import { todayISO } from "./payments";
// Same customer-scoped bearer link as /s/[token]. Never accept a customer ID from the caller.
export async function shortRentalPublicAccess(token: string) {
  if (!uuid(token)) throw new Error("Invalid link");
  const db = createAdminClient();
  const result = await db.from("customers").select("id,hospital_name,representative,phone").eq("share_token",token).maybeSingle();
  if (result.error || !result.data) throw new Error("Invalid link");
  const customer = result.data as { id: string; hospital_name: string | null; representative: string | null; phone: string | null };
  const devices = await db.from("customer_devices").select("id,model_name,quantity").eq("customer_id",customer.id).order("created_at");
  const prior = await db.from("short_rentals").select("checks").eq("customer_id",customer.id).not("confirmed_at","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if (devices.error) throw new Error("Unavailable");
  // Intake-only release does not require the contract schema. Missing/failed verification data never grants reuse.
  const available: ReusableChecks = {};
  const today = todayISO();
  for (const [key] of intakeChecks) { const check = !prior.error && prior.data?.checks?.[key]; available[key] = !!check && ["verified","reused"].includes(check.status) && (!check.validUntil || check.validUntil >= today); }
  // The customer sees only availability, never internal evidence, pricing or another customer's data.
  return { db, customer, devices: devices.data as {id:string;model_name:string|null;quantity:number|null}[], available };
}
