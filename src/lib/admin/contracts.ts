// 계약서/확인서 자동생성용 콘텐츠 정의 및 머지 헬퍼
//
// ⚠️ 본 문안은 세일앤렌탈백(SRB) 실무 초안입니다. 실제 사용 전 반드시 변호사 검수를 받으세요.
// 설계 원칙: "진정한 매매 + 진정한 임대차"를 형식·내용상 분리하여 양도담보(위장 대부)로의
// 재해석을 방지. 대출/원금/이자/연체이자/한도/환매/채권추심 등 금융 용어는 사용하지 않습니다.

import { site } from "@/lib/site";
import type { Customer } from "@/lib/admin/types";

export type ContractType = "sale" | "rental" | "delivery" | "inspection";

export type ContractMeta = {
  type: ContractType;
  title: string; // 문서 제목
  short: string; // 버튼 라벨
  core: boolean; // 핵심(반드시 분리되는 2종) 여부
};

export const CONTRACT_TYPES: ContractMeta[] = [
  { type: "sale", title: "자산 매매계약서", short: "매매계약서", core: true },
  { type: "rental", title: "자산 임대차(렌탈)계약서", short: "렌탈계약서", core: true },
  { type: "delivery", title: "자산 인도확인서", short: "인도확인서", core: false },
  { type: "inspection", title: "현장 검수확인서", short: "검수확인서", core: false },
];

export const isContractType = (v: string): v is ContractType =>
  CONTRACT_TYPES.some((c) => c.type === v);

export const contractMeta = (type: ContractType) =>
  CONTRACT_TYPES.find((c) => c.type === type)!;

// ── 포맷 헬퍼 ─────────────────────────────────────────────
const BLANK = "______________";

export function fmtWon(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return BLANK;
  return `${Number(v).toLocaleString("ko-KR")} 원`;
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return BLANK;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return BLANK;
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

const orBlank = (v: string | null | undefined) => (v && v.trim() !== "" ? v : BLANK);

// ── 당사자 정보 ───────────────────────────────────────────
export type Party = {
  role: string;
  name: string;
  ceo: string;
  address: string;
  contact: string;
};

// 풍현(매수인/임대인) — site.ts 기준
export function punghyunParty(role: string): Party {
  return {
    role,
    name: site.name,
    ceo: site.ceo,
    address: site.contact.address,
    contact: site.contact.phone,
  };
}

// 고객(매도인/임차인) — customers 레코드 기준
export function customerParty(role: string, c: Customer): Party {
  return {
    role,
    name: orBlank(c.hospital_name),
    ceo: orBlank(c.representative),
    address: BLANK, // 스키마에 주소 없음 → Phase C에서 필드화
    contact: orBlank(c.phone),
  };
}

// ── 문서 데이터 (머지 완료된 표시용 값) ────────────────────
export type ContractView = {
  meta: ContractMeta;
  today: string;
  seller: Party; // 매도인 = 고객
  buyer: Party; // 매수인 = 풍현
  lessor: Party; // 임대인 = 풍현
  lessee: Party; // 임차인 = 고객
  saleAmount: string; // 매매대금
  rentAmount: string; // 월 렌탈료
  periodStart: string;
  periodEnd: string;
  blank: string;
};

export function buildContractView(type: ContractType, c: Customer): ContractView {
  return {
    meta: contractMeta(type),
    today: fmtDate(new Date().toISOString()),
    seller: customerParty("매도인 (이하 '갑')", c),
    buyer: punghyunParty("매수인 (이하 '을')"),
    lessor: punghyunParty("임대인 (이하 '갑')"),
    lessee: customerParty("임차인 (이하 '을')", c),
    saleAmount: fmtWon(c.execution_amount),
    rentAmount: fmtWon(c.rental_price),
    periodStart: fmtDate(c.contract_date),
    periodEnd: fmtDate(c.maturity_date),
    blank: BLANK,
  };
}

// ── 조항 본문(초안) ───────────────────────────────────────
// 각 항목은 { title, body } 문단. body의 {{...}} 자리는 페이지에서 이미 머지된 값으로 치환됨.

export type Clause = { title: string; body: string };

// 매매계약서 (독립) — 매수인=풍현
export function saleClauses(v: ContractView): Clause[] {
  return [
    {
      title: "제1조 (목적)",
      body:
        "본 계약은 매도인이 소유·점유하는 아래 목적물의 소유권을 매수인에게 완전히 이전하는 " +
        "진정한 매매(true sale)에 관한 사항을 정함을 목적으로 한다. 본 계약은 별도로 체결되는 " +
        "임대차(렌탈)계약과 형식·내용상 독립된 별개의 계약이다.",
    },
    {
      title: "제2조 (목적물의 표시)",
      body:
        "품목·모델명: " + v.blank + "\n" +
        "제조번호(S/N): " + v.blank + "\n" +
        "수량: " + v.blank + "\n" +
        "설치·소재지: " + v.blank,
    },
    {
      title: "제3조 (매매대금 및 지급)",
      body:
        "매매대금은 금 " + v.saleAmount + " (부가가치세 별도)로 하며, 매수인은 소유권 이전과 " +
        "상환으로 매도인이 지정한 계좌에 일시 지급한다. 본 대금은 목적물의 매매대가이며, " +
        "대여금·원리금이 아니다.",
    },
    {
      title: "제4조 (소유권의 이전 및 인도)",
      body:
        "목적물의 소유권은 매매대금 완납일에 매수인에게 이전된다. 목적물의 현실 인도에 갈음하여 " +
        "매도인은 이를 점유개정의 방법으로 매수인을 위하여 점유하며, 별도 임대차계약에 따라 " +
        "임차인의 지위에서 이를 계속 사용한다.",
    },
    {
      title: "제5조 (매도인의 확약 및 하자담보)",
      body:
        "매도인은 목적물이 자신의 진정한 소유이며 질권·양도담보·압류 등 어떠한 제한물권이나 " +
        "제3자 권리의 대상이 아님을 확약한다. 이에 위반이 있는 경우 매도인은 매수인의 손해를 배상한다.",
    },
    {
      title: "제6조 (위험부담)",
      body:
        "소유권 이전 시점 이후 목적물의 멸실·훼손에 관한 위험은 별도 임대차계약이 정하는 바에 따른다. " +
        "본 계약에는 환매·재매입·이자·담보 제공에 관한 어떠한 약정도 포함되지 아니한다.",
    },
    {
      title: "제7조 (계약의 독립성)",
      body:
        "본 매매계약의 효력은 임대차계약의 존속·해지 여부에 영향을 받지 아니한다. 다만 당사자는 " +
        "본 목적물에 관하여 별도의 임대차계약을 함께 체결한다.",
    },
  ];
}

// 임대차(렌탈)계약서 (독립) — 임대인=풍현
export function rentalClauses(v: ContractView): Clause[] {
  return [
    {
      title: "제1조 (목적)",
      body:
        "본 계약은 임대인이 소유하는 아래 목적물을 임차인에게 임대하고 임차인이 정액의 렌탈료를 " +
        "지급하는 진정한 임대차에 관한 사항을 정함을 목적으로 한다. 본 계약은 별도 매매계약과 " +
        "독립된 별개의 계약이다.",
    },
    {
      title: "제2조 (목적물의 표시)",
      body:
        "품목·모델명: " + v.blank + " / 제조번호(S/N): " + v.blank + " / 수량: " + v.blank + "\n" +
        "본 목적물은 임대인이 매매계약에 의하여 적법하게 소유권을 취득한 자산이다.",
    },
    {
      title: "제3조 (임대차 기간)",
      body:
        "임대차 기간은 " + v.periodStart + " 부터 " + v.periodEnd + " 까지로 한다. 기간 만료 시 " +
        "본 계약은 자동으로 연장되지 아니하며, 제9조의 만기 선택 절차에 따른다.",
    },
    {
      title: "제4조 (렌탈료 및 지급)",
      body:
        "임차인은 매월 정액 렌탈료 금 " + v.rentAmount + " (부가가치세 별도)를 임대인이 지정한 " +
        "계좌에 매월 " + v.blank + "일에 지급한다. 렌탈료는 목적물 사용의 대가이며 원리금·이자가 아니다.",
    },
    {
      title: "제5조 (임차인의 의무)",
      body:
        "임차인은 선량한 관리자의 주의로 목적물을 사용·보관하며, 임대인의 사전 서면동의 없이 " +
        "목적물을 지정 장소 외로 반출하거나 제3자에게 양도·전대·담보제공·처분하지 못한다. " +
        "임차인은 목적물에 부착된 임대인 소유표시(라벨)를 임의로 제거·훼손하지 아니한다.",
    },
    {
      title: "제6조 (임대인의 권리 및 점검)",
      body:
        "임대인은 목적물의 소유자로서 사전 통지 후 목적물의 소재·현황을 점검하거나 실사할 수 있으며, " +
        "임차인은 이에 협조한다. 목적물의 소유권은 임대차 기간 중 임대인에게 있다.",
    },
    {
      title: "제7조 (렌탈료 미지급 시 조치)",
      body:
        "임차인이 렌탈료를 지급하지 아니하거나 제5조의 의무를 위반한 경우, 임대인은 상당한 기간을 " +
        "정하여 시정을 최고한 후 본 임대차계약을 해지하고 목적물의 반환(회수)을 청구할 수 있다. " +
        "이는 소유자인 임대인의 목적물 반환청구이며, 대여금 채권의 추심이 아니다.",
    },
    {
      title: "제8조 (원상회복 및 반납)",
      body:
        "임차인은 계약 종료 시 목적물을 통상의 사용에 따른 자연적 마모를 제외하고 인도받은 상태로 " +
        "임대인이 지정하는 장소에 반납한다. 반납에 따른 별도의 위약·불이익은 부과하지 아니한다.",
    },
    {
      title: "제9조 (만기 선택권)",
      body:
        "임차인은 기간 만료 전 임대인의 통지에 따라 ① 반납 ② 인수 ③ 재렌탈 중 하나를 선택한다. " +
        "인수를 선택하는 경우 인수가는 금 " + v.blank + " (별도 산정)로 하며, 감가상각을 반영하여 " +
        "회차가 경과할수록 낮아진다. 본 계약은 자동 연장되지 아니한다.",
    },
    {
      title: "제10조 (완전 비소구)",
      body:
        "임대인이 회수한 목적물을 처분한 매각대금이 잔존가치 또는 인수가에 미달하더라도 임대인은 " +
        "그 차액을 임차인에게 청구하지 아니한다(완전 비소구). 임대차 종료로써 당사자 간 권리·의무는 " +
        "정산 없이 종결된다.",
    },
    {
      title: "제11조 (연대보증)",
      body:
        "연대보증인 " + v.blank + " 은 임차인이 본 임대차계약에 따라 부담하는 렌탈료 및 원상회복 " +
        "의무에 한하여 임차인과 연대하여 이행할 책임을 진다. 본 보증은 대여금 채무에 대한 보증이 아니다.",
    },
    {
      title: "제12조 (계약의 독립성)",
      body:
        "본 임대차계약은 매매계약과 독립된 별개의 계약이며, 어느 일방 계약의 무효·취소가 다른 계약의 " +
        "효력에 당연히 영향을 미치지 아니한다.",
    },
  ];
}

// 인도확인서 (매매: 고객→풍현 / 임대차: 풍현→고객)
export function deliveryClauses(v: ContractView): Clause[] {
  return [
    {
      title: "1. 매매에 따른 인도 (매도인 → 매수인)",
      body:
        "매도인은 매매계약에 따라 아래 목적물의 소유권과 점유(점유개정 포함)를 매수인에게 인도하였음을 확인한다.\n" +
        "품목·모델: " + v.blank + " / 제조번호(S/N): " + v.blank + " / 수량: " + v.blank,
    },
    {
      title: "2. 임대차에 따른 인도 (임대인 → 임차인)",
      body:
        "임대인은 임대차계약에 따라 동일 목적물을 임차인이 사용하도록 인도하였고, 임차인은 임차인의 " +
        "지위에서 이를 점유·사용함을 확인한다.",
    },
    {
      title: "3. 상태 확인",
      body: "인도 시점의 목적물 외관·작동 상태: " + v.blank + "\n특이사항: " + v.blank,
    },
  ];
}

// 검수확인서
export function inspectionClauses(v: ContractView): Clause[] {
  return [
    {
      title: "1. 검수 대상",
      body:
        "품목·모델: " + v.blank + " / 제조번호(S/N): " + v.blank + " / 수량: " + v.blank + "\n" +
        "설치·소재지: " + v.blank,
    },
    {
      title: "2. 제조번호(S/N) 대조",
      body: "명판 기재 S/N 과 계약서 기재 S/N 일치 여부: [ ] 일치  [ ] 불일치( " + v.blank + " )",
    },
    {
      title: "3. 외관 및 작동 상태",
      body: "외관: " + v.blank + "\n작동: " + v.blank + "\n파손·흠집: " + v.blank,
    },
    {
      title: "4. 소유자 표시(라벨) 부착 확인",
      body: "임대인 소유표시 라벨 부착 여부: [ ] 부착완료  [ ] 미부착",
    },
  ];
}

export function clausesFor(type: ContractType, v: ContractView): Clause[] {
  switch (type) {
    case "sale":
      return saleClauses(v);
    case "rental":
      return rentalClauses(v);
    case "delivery":
      return deliveryClauses(v);
    case "inspection":
      return inspectionClauses(v);
  }
}

// 문서별 당사자 쌍 (서명란/머리말 공용)
export function partiesFor(type: ContractType, v: ContractView): [Party, Party] {
  if (type === "sale" || type === "delivery" || type === "inspection") {
    return type === "sale" ? [v.seller, v.buyer] : [v.buyer, v.seller];
  }
  // rental
  return [v.lessor, v.lessee];
}
