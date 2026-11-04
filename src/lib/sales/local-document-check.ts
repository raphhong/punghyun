export type LocalDocumentKind='identity'|'registry'|'bank';
type Check={label:string;state:'detected'|'manual_check'};
/** Structural cues only. Never returns raw text, identifiers, names, addresses, amounts, or account numbers. */
export function inspectLocalDocument(kind:LocalDocumentKind,text:string){
 const rules:Record<LocalDocumentKind,{marker:RegExp;fields:[string,RegExp][]}>={
  identity:{marker:/주민등록증|운전면허증|여권/,fields:[['성명 표시',/성\s*명|이\s*름/],['발급 기관·일자 표시',/발급|발행|청장|구청장|시장/]]},
  registry:{marker:/등본|등기사항|주민등록표/,fields:[['발급일 표시',/발급일|발행일|발급\s*일자/],['주소·소재지 표시',/주소|소재지/]]},
  bank:{marker:/은행|통장|계좌|뱅크/,fields:[['은행 표시',/은행|뱅크/],['예금주 표시',/예금주|예금\s*주명/],['계좌 항목 표시',/계좌\s*(번호|번호란)/]]}
 };
 const rule=rules[kind];if(!rule)throw Error('invalid_request');
 const readable=!!text.trim()&&text.length<=72000,matched=readable&&rule.marker.test(text);
 const checks:Check[]=rule.fields.map(([label,pattern])=>({label,state:matched&&pattern.test(text)?'detected':'manual_check'}));
 return {mode:'local_only' as const,externalTransmission:false,status:matched?'manual_review' as const:'unreadable' as const,kind,checks,notice:matched?'표시 항목만 확인했습니다. 내용 일치·진위는 원본으로 확인해 주세요.':'서류 종류나 항목을 읽지 못했습니다. 원본을 직접 확인해 주세요.',verifiedIdentity:false,verifiedAccount:false};
}
