// Only allowlisted categories/codes reach the UI. Never render raw database errors,
// details, hints, connection strings, query values or customer data as diagnostics.
export function cashflowSourceFailure(table: string, error: { code?: string } | null): string {
  const label = table === "cashflow_profiles" ? "자금구분 원장 (cashflow_profiles)" : table === "cashflow_movements" ? "지급·유동화 원장 (cashflow_movements)" : "고객 원장 (customers)";
  const code = error?.code;
  if (code === "PGRST205" || code === "42P01") return `${label}: 테이블을 찾을 수 없습니다 [${code}]. 신규 스키마 미적용 또는 API 스키마 캐시 미반영 상태입니다. 관련 금액 계산이 준비되지 않았습니다.`;
  if (code === "42501") return `${label}: 조회 권한이 거부되었습니다 [42501]. 현재 관리자 계정의 기존 권한과 RLS를 확인해야 합니다. 권한을 자동 확대하지 않습니다.`;
  if (code === "PGRST301" || code === "PGRST303") return `${label}: 인증 세션 확인이 필요합니다 [${code}]. 다시 로그인한 뒤 조회해 주세요.`;
  if (code === "42703" || code === "PGRST204") return `${label}: 필요한 컬럼을 찾을 수 없습니다 [${code}]. 배포 코드와 DB 스키마를 대조해야 합니다.`;
  return `${label}: 연결 또는 조회 오류로 읽지 못했습니다. 원인을 확정할 수 없으며 관련 금액을 미확인으로 표시합니다.`;
}
