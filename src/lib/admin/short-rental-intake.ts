import { validPaymentDate } from "./payments";
export const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const intakeChecks = [
  ["business", "사업자 정보"], ["identity", "본인 확인"], ["authority", "대표권·처분 권한"], ["account", "정산 계좌 확인"],
] as const;
export const intakeConditions = [
  ["privacy", "개인정보·신용조회/제공: 실제 처리·조회·제공 행위에 따라 담당자가 확인"],
  ["guarantee", "개인보증: 이번 거래에서 별도 보증을 약정하는 경우만 검토"],
  ["undertaking", "사전확약: 이번 거래에 별도 확약 조건이 있는 경우만 검토"],
  ["release", "담보·제3자 권리: 담보 설정이나 타인의 권리가 있는 경우 공개"],
  ["landlord", "임대인 협조: 설치 장소나 반출 조건상 협조가 필요한 경우 확인"],
] as const;
export type IntakePayload = {
  name: string; phone: string; company: string;
  deviceId: string | null; model: string; quantity: number; identity: string; condition: string;
  startDate: string; owner: string; rights: string; resources: string;
  reuse: Record<typeof intakeChecks[number][0], "new" | "unchanged" | "changed" | "review_existing">;
  conditions: Record<typeof intakeConditions[number][0], "unknown" | "yes" | "no">;
  confirmed: boolean;
};
export type ReusableChecks = Partial<Record<typeof intakeChecks[number][0], boolean>>;
const text = (v: unknown, max: number, required = false): v is string => typeof v === "string" && v.length <= max && (!required || !!v.trim());
export function validIntake(v: unknown): v is IntakePayload {
  if (!v || typeof v !== "object") return false;
  const p = v as IntakePayload;
  return text(p.name,100,true) && text(p.phone,40,true) && /^[+\d()\s-]{7,40}$/.test(p.phone) && text(p.company,200) &&
    (p.deviceId === null || uuid(p.deviceId)) && text(p.model,200,true) && Number.isInteger(p.quantity) && p.quantity > 0 && p.quantity <= 1000 &&
    text(p.identity,500,true) && text(p.condition,500,true) && validPaymentDate(p.startDate) && p.startDate >= "1900-01-01" && p.startDate <= "2199-12-24" &&
    text(p.owner,500,true) && text(p.rights,500,true) && text(p.resources,500) && p.confirmed === true &&
    intakeChecks.every(([k]) => ["new","unchanged","changed","review_existing"].includes(p.reuse?.[k])) &&
    intakeConditions.every(([k]) => ["unknown","yes","no"].includes(p.conditions?.[k]));
}
export function reuseAllowed(p: IntakePayload, available: ReusableChecks, existing = false) {
  return intakeChecks.every(([k]) => p.reuse[k] === "review_existing" ? existing : p.reuse[k] !== "unchanged" || available[k] === true);
}
export type IntakeRow = { request_id: string; customer_id: string; device_id: string; payload: IntakePayload; created_at: string };
