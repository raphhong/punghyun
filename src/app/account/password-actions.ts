"use server";

import { createClient as createIsolatedClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { changeOwnPassword, passwordError, requestPasswordNonce, type PasswordResult } from "@/lib/account/password";

export async function changePassword(form: FormData): Promise<PasswordResult> {
  try {
    const supabase = await createClient();
    const verification = createIsolatedClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    );
    return await changeOwnPassword(form, supabase.auth, verification.auth);
  } catch { return passwordError(); }
}

export async function sendPasswordNonce(): Promise<PasswordResult> {
  try { return await requestPasswordNonce((await createClient()).auth); }
  catch { return passwordError(); }
}
