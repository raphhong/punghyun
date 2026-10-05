/** A service diagram, not a product render or a claim about specific equipment. */
export function AssetContinuity() {
  return (
    <figure className="ph-asset-diagram" aria-labelledby="asset-diagram-title">
      <figcaption id="asset-diagram-title">
        <span>세일앤렌탈백 구조</span>
      </figcaption>
      <div className="ph-asset-drawing" aria-hidden="true">
        <svg viewBox="0 0 460 220" fill="none">
          <path d="M25 180H435M65 202H395" stroke="currentColor" opacity=".2" />
          <path d="M99 58 233 29 355 67 224 99 99 58Z" fill="#214675" stroke="#88A9D1" />
          <path d="M99 58v114l125 33V99L99 58Z" fill="#10345F" stroke="#88A9D1" />
          <path d="M224 99 355 67v114l-131 24V99Z" fill="#0A2C55" stroke="#88A9D1" />
          <path d="m118 85 87 27v57l-87-24V85Z" fill="#03265A" stroke="#88A9D1" />
          <path d="m132 104 54 16v32l-54-14v-34Z" fill="#234E7F" />
          <path d="m244 115 56-13v61l-56 13v-61Z" fill="#173D69" stroke="#88A9D1" />
          <path d="m254 127 36-9m-36 20 36-9m-36 20 36-9" stroke="#88A9D1" />
          <path d="m317 100 19-4v25l-19 4v-25Z" fill="#B9CEE6" />
          <path d="m326 138 2-.5m-2 11 2-.5" stroke="#B9CEE6" strokeWidth="4" strokeLinecap="round" />
          <path d="m159 47 25-6 32 10-25 6-32-10Z" fill="#5278A5" />
          <path d="M48 61h25M60 49v24M389 142h25M401 130v24" stroke="#88A9D1" opacity=".5" />
          <path d="m355 67 38-9h25M99 172l-27 12H43" stroke="#88A9D1" opacity=".6" />
          <circle cx="420" cy="58" r="3" fill="#B9CEE6" />
          <circle cx="40" cy="184" r="3" fill="#B9CEE6" />
        </svg>
        <span>사업장에서 사용 중인 장비·설비</span>
      </div>
      <div className="ph-asset-exchange">
        <div className="ph-exchange-party"><span>자산 보유</span><strong>사업자</strong></div>
        <div className="ph-exchange-arrows">
          <span>자산 매각 <b aria-hidden="true">→</b></span>
          <span><b aria-hidden="true">←</b> 매입대금 지급</span>
        </div>
        <div className="ph-exchange-party"><span>자산 매입</span><strong>풍현</strong></div>
      </div>
      <div className="ph-continuity-note"><span aria-hidden="true">↳</span> 매각한 자산은 렌탈로 계속 사용합니다</div>
    </figure>
  );
}
