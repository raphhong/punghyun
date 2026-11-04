import type {TransmissionCeiling} from './normal-consent';
export type Readiness={ready:boolean;reasons:string[];notice:string};
export function salesReviewReadiness(b:Record<string,unknown>|null,ceiling:TransmissionCeiling|null,hasProvider:boolean,now=Date.now(),monthly?:Record<string,unknown>|null):Readiness{
 const reasons:string[]=[];const p=b?.owner_policy as Record<string,unknown>|undefined;
 if(!b||!ceiling)reasons.push('전송 설정이 준비되지 않았습니다.');
 if(b&&ceiling){
  if(ceiling.dataClass!=='customer'||p?.dataClass!=='customer')reasons.push('현재 합성 시험자료만 허용되어 실제 고객자료 검수는 아직 열리지 않았습니다.');
  if(ceiling.expiresAt<=now||p?.active!==true||typeof p?.expiresAt!=='number'||p.expiresAt<=now||p?.revision!==b.policy_revision)reasons.push('전송 정책이 만료되었거나 현재 정책 확인이 필요합니다.');
  if(b.allocation_approved!==true||typeof b.allocation_expires_at!=='string'||!Number.isFinite(Date.parse(b.allocation_expires_at))||Date.parse(b.allocation_expires_at)<=now)reasons.push('검수 비용 할당이 비활성 또는 만료 상태입니다.');
  if(monthly?.mode==='monthly'){
   const limit=monthly.limitMicrousd,used=monthly.usedMicrousd;
   if(typeof limit!=='number'||typeof used!=='number'||!Number.isSafeInteger(limit)||!Number.isSafeInteger(used)||limit<0||limit>200000000||used<0||limit-used<500000)reasons.push('이번 달 검수 예약 한도가 부족합니다. 이전 달 결과 미확인 예약도 유지됩니다.');
  }else if(monthly!==undefined&&monthly?.mode!=='legacy'){reasons.push('월간 검수 예약 상태를 확인하지 못했습니다.');}
  else {
  const numbers=['max_calls','reserved_calls','max_microusd','reserved_microusd'].map(k=>Number(b[k]));
  if(numbers.some(n=>!Number.isSafeInteger(n)||n<0)||numbers[0]<=numbers[1]||numbers[2]-numbers[3]<500000)reasons.push('공통 검수 한도에 새 요청을 예약할 여유가 없습니다. 기존 결과 미확인 예약은 유지됩니다.');
  }
 }
 if(!hasProvider)reasons.push('AI 제공자 연결이 준비되지 않았습니다.');
 return {ready:reasons.length===0,reasons,notice:'이 화면은 준비 상태만 확인합니다. 파일별 전송 범위·현재 권한·동의·예산은 요청 시 다시 검사합니다.'};
}
