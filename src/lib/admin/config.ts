// 어드민 진입 경로 — 추측하기 어려운 경로로 보안을 강화합니다.
// 필요하면 이 값만 바꾸면 전체 어드민 경로가 변경됩니다.
// (예: 배포 후 팀에만 공유하는 URL)
export const ADMIN_BASE = "/ph-console-8f27x";

export const adminPath = (sub = "") =>
  sub ? `${ADMIN_BASE}/${sub.replace(/^\//, "")}` : ADMIN_BASE;
