import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminPath } from "@/lib/admin/config";
import { PasswordForm } from "@/components/account/PasswordForm";

export default async function PasswordPage() {
  const { data, error } = await (await createClient()).auth.getUser();
  if (error || !data.user) redirect(adminPath("login"));
  return <PasswordForm />;
}
