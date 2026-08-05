// 예상 한도 계산기 모델
// 주의: 아래 요율은 대외 안내용 "참고 예상치"를 위한 기본값입니다.
// 실제 지급 금액과 조건은 자산 심사·상담을 통해 결정됩니다.
// 요율을 조정하려면 이 파일의 상수만 바꾸면 됩니다.

export const calcConfig = {
  // 카드매출 기반 한도 = 월평균 카드매출 × 배수
  // (미래 카드매출을 근거로 확보 가능한 자금의 상한)
  cardSalesMultiple: 2,

  // 자산 기반 한도 = 보유 자산 가치 × 선지급률
  // (세일앤렌탈백으로 자산을 매입할 때 지급되는 비율)
  assetAdvanceRate: 0.7,

  // 안전계수: 위 두 한도 중 낮은 값에 곱해 보수적으로 산정
  safetyFactor: 0.9,

  // 월 예상 이용료율 (풍현 수익률) — 월 렌탈료 = 지급액 × 요율
  monthlyFeeRate: 0.02,

  // 결과 표시 밴드(±)
  rangeBand: 0.1,
} as const;

// 보유 자산 선택지 (대표값 기준으로 계산)
export const assetOptions = [
  { label: "5천만원 미만", value: 30_000_000 },
  { label: "5천만원 ~ 1억원", value: 75_000_000 },
  { label: "1억원 ~ 3억원", value: 200_000_000 },
  { label: "3억원 ~ 5억원", value: 400_000_000 },
  { label: "5억원 이상", value: 600_000_000 },
] as const;

export type CalcInput = {
  // 최근 3개월 카드매출 합계 (원)
  cardSales3m: number;
  // 보유 자산 대표값 (원)
  assetValue: number;
};

export type CalcResult = {
  monthlyCardAvg: number;
  cardBasedLimit: number;
  assetBasedLimit: number;
  estimate: number; // 예상 지급 가능액 (중앙값)
  estimateLow: number;
  estimateHigh: number;
  monthlyFee: number; // 월 예상 이용료
};

export function calculate({ cardSales3m, assetValue }: CalcInput): CalcResult {
  const monthlyCardAvg = cardSales3m > 0 ? cardSales3m / 3 : 0;
  const cardBasedLimit = monthlyCardAvg * calcConfig.cardSalesMultiple;
  const assetBasedLimit = assetValue * calcConfig.assetAdvanceRate;

  // 낮은 쪽 한도에 안전계수 적용
  const raw = Math.min(cardBasedLimit, assetBasedLimit) * calcConfig.safetyFactor;

  // 10만원 단위 반올림
  const estimate = Math.round(raw / 100_000) * 100_000;
  const estimateLow =
    Math.round((estimate * (1 - calcConfig.rangeBand)) / 100_000) * 100_000;
  const estimateHigh =
    Math.round((estimate * (1 + calcConfig.rangeBand)) / 100_000) * 100_000;
  const monthlyFee =
    Math.round((estimate * calcConfig.monthlyFeeRate) / 1_000) * 1_000;

  return {
    monthlyCardAvg,
    cardBasedLimit,
    assetBasedLimit,
    estimate,
    estimateLow,
    estimateHigh,
    monthlyFee,
  };
}

export function formatKRW(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0원";
  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok.toLocaleString("ko-KR")}억`);
  if (man > 0) parts.push(`${man.toLocaleString("ko-KR")}만원`);
  if (parts.length === 0) return `${n.toLocaleString("ko-KR")}원`;
  // "억"으로 끝나면 원 붙이기
  if (man === 0) return parts.join(" ") + "원";
  return parts.join(" ");
}
