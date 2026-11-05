import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "@/components/account/PasswordForm";

export default async function PasswordPage() {
  const { data, error } = await (await createClient()).auth.getUser();
  if (error || !data.user) redirect("/sales/login");
  return <PasswordForm />;
}
