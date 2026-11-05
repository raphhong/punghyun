import type { SupabaseClient } from "@supabase/supabase-js";

export type PasswordResult = { status: "idle" | "error" | "success" | "reauthentication"; message: string };
type Auth = SupabaseClient["auth"];
const failure = (message: string): PasswordResult => ({ status: "error", message });

export function passwordError(code?: string): PasswordResult {
  switch (code) {
    case "reauthentication_needed":
    case "reauthentication_not_valid":
      return { status: "reauthentication", message: "추가 본인 인증이 필요합니다. 인증코드를 요청한 뒤 입력해 주세요." };
    case "invalid_credentials":
    case "current_password_mismatch":
      return failure("현재 비밀번호를 확인해 주세요.");
    case "same_password": return failure("현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.");
    case "weak_password": return failure("보안 정책에 맞지 않는 비밀번호입니다. 더 길고 추측하기 어려운 비밀번호를 사용해 주세요.");
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit": return failure("요청이 많습니다. 잠시 후 다시 시도해 주세요.");
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found": return failure("로그인이 만료되었습니다. 다시 로그인해 주세요.");
    default: return failure("요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

// No caller-supplied email, user ID, token, or privileged client is accepted.
export async function changeOwnPassword(form: FormData, auth: Auth, verificationAuth: Auth): Promise<PasswordResult> {
  const current = form.get("currentPassword");
  const password = form.get("password");
  const confirmation = form.get("confirmation");
  const nonce = form.get("nonce");
  if (typeof current !== "string" || !current || current.length > 1024 ||
      typeof password !== "string" || password.length < 12 || password.length > 128 ||
      typeof confirmation !== "string" || confirmation !== password ||
      (nonce !== null && (typeof nonce !== "string" || nonce.length > 128))) {
    return failure("현재 비밀번호와 새 비밀번호(12~128자), 일치하는 비밀번호 확인을 입력해 주세요.");
  }
  if (current === password) return passwordError("same_password");

  try {
    const { data, error } = await auth.getUser();
    if (error || !data.user?.email || data.user.is_anonymous) return failure("다시 로그인한 후 시도해 주세요.");
    // Verify in an isolated, non-persistent client: never replace the existing
    // session (including its MFA assurance) with a password-only login.
    const verified = await verificationAuth.signInWithPassword({ email: data.user.email, password: current });
    if (verified.error) return passwordError(verified.error.code);
    if (!verified.data.session || verified.data.user?.id !== data.user.id) return failure("본인 확인에 실패했습니다. 다시 로그인해 주세요.");
    const updated = await auth.updateUser({ password, current_password: current, ...(nonce ? { nonce } : {}) });
    if (updated.error) return passwordError(updated.error.code);
    return { status: "success", message: "비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용해 주세요." };
  } catch {
    return failure("연결을 확인해 주세요. 변경 여부가 불확실하면 새 비밀번호로 로그인을 확인해 주세요.");
  } finally {
    // Revoke only the temporary verification session; never all user sessions.
    try { await verificationAuth.signOut({ scope: "local" }); } catch { /* No secrets in logs or returned errors. */ }
  }
}

export async function requestPasswordNonce(auth: Auth): Promise<PasswordResult> {
  try {
    const { data, error } = await auth.getUser();
    if (error || !data.user || data.user.is_anonymous) return failure("다시 로그인한 후 시도해 주세요.");
    const sent = await auth.reauthenticate();
    if (sent.error) return passwordError(sent.error.code);
    return { status: "reauthentication", message: "계정의 인증된 이메일 또는 휴대전화로 인증코드를 보냈습니다." };
  } catch { return passwordError(); }
}
