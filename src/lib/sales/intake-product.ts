export type IntakeProduct = "standard" | "short";
export function intakeProduct(value: unknown): IntakeProduct | null {
  return value === "standard" || value === "short" ? value : null;
}
export const intakeProductLabels = { standard: "일반렌탈", short: "초단기렌탈" } as const;
export function shortIntakeMessage(url: string) {
  return `[풍현] 초단기렌탈 접수 안내

아래 전용 링크에서 이번 거래의 자산 정보와 희망 시작일을 입력해 주세요.
${url}

[최초 확인·기존 자료 재사용]
사업자·본인·대표권·계좌 자료는 기존 제출 여부와 변경·만료 여부를 확인합니다. 유효한 자료는 담당자 확인 후 재사용하고 필요한 항목만 다시 요청합니다.
[이번 거래]
자산 식별·수량·상태, 소유자·권리 관계와 희망 이용일을 확인합니다. 자산 사진은 필요한 경우에만 추가합니다.
[해당하는 경우만]
개인정보 처리·조회·제공, 보증·사전확약, 담보 해소·임대인 협조는 담당자와 해당 조건을 확인합니다.
신분증 사본·다년 재무자료·세금완납·임대차를 일괄 업로드하지 마세요. 내부 확인표에 고객 서명을 요구하지 않습니다.

희망 이용기간은 7일이며 실제 계약 기산·종료시각, 매입금액·VAT·렌탈료는 거래별로 별도 확인합니다. 접수는 계약 체결이 아니며 자동 연장·자동 재매입은 없습니다.
전용 링크는 다른 사람에게 공유하지 마세요. 문의는 담당자에게 연락해 주세요.`;
}
