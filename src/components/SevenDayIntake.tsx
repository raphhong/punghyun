"use client";
import { useState, useTransition } from "react";
import { submitSevenDayIntake } from "@/app/seven-day/actions";
import { intakeChecks, intakeConditions, type IntakePayload, type ReusableChecks } from "@/lib/admin/short-rental-intake";

const input="mt-1 block w-full rounded-lg border border-navy-200 p-3";
export function SevenDayIntake({ token, initial, devices = [], available = {} }: { token: string; initial?: {name:string;phone:string;company:string};devices?: {id:string;model_name:string|null;quantity:number|null}[]; available?: ReusableChecks }) {
  const [step,setStep]=useState(0),[message,setMessage]=useState(""),[done,setDone]=useState(false),[pending,start]=useTransition();
  const [requestId]=useState(()=>crypto.randomUUID());
  const [p,setP]=useState<IntakePayload>({name:initial?.name??"",phone:initial?.phone??"",company:initial?.company??"",deviceId:null,model:"",quantity:1,identity:"",condition:"",startDate:"",owner:"",rights:"",resources:"",reuse:{business:"new",identity:"new",authority:"new",account:"new"},conditions:{privacy:"unknown",guarantee:"unknown",undertaking:"unknown",release:"unknown",landlord:"unknown"},confirmed:false});
  const [trap,setTrap]=useState("");
  const field=(key:"name"|"phone"|"company"|"model"|"identity"|"condition"|"startDate"|"owner"|"rights"|"resources",label:string,required=true)=><label className="block">{label}<input className={input} type={key==="startDate"?"date":key==="phone"?"tel":"text"} value={p[key]} required={required} maxLength={["name","phone","company","model"].includes(key)?key==="phone"?40:key==="name"?100:200:500} onChange={e=>setP({...p,[key]:e.target.value})}/></label>;
  if(done)return <section role="status" className="rounded-xl bg-brand-50 p-6"><h2 className="text-xl font-bold">초단기렌탈 접수를 받았습니다</h2><p>담당자가 자료 재사용·거래 조건을 확인한 뒤 안내합니다. 접수는 계약 확정이나 매입대금 집행이 아닙니다.</p><p>접수번호 {requestId}</p></section>;
  return <form className="space-y-5 rounded-xl border bg-white p-5" onSubmit={e=>{e.preventDefault();if(step<2){setStep(step+1);return;}start(async()=>{const result=await submitSevenDayIntake(requestId,token,p,trap);if("error" in result)setMessage(result.error);else setDone(true);});}}>
    <ol className="flex flex-wrap gap-3 text-sm" aria-label="접수 단계">{["1 기본·자산 정보","2 기존 자료·조건 확인","3 검토 후 제출"].map((label,i)=><li key={label} aria-current={step===i?"step":undefined} className={step===i?"font-bold text-brand-700":"text-navy-500"}>{label}</li>)}</ol>
    <input className="hidden" aria-hidden="true" tabIndex={-1} autoComplete="off" value={trap} onChange={e=>setTrap(e.target.value)} />
    {step===0&&<div className="space-y-4"><p>전용 링크에 연결된 고객의 접수입니다. 다른 고객의 자료를 검색하지 않습니다.</p>
      {field("name","담당자 이름")}{field("phone","연락처")}{field("company","사업자명 / 상호",false)}
      {token&&<label className="block">기존 장비 선택 (없으면 새 장비)<select className={input} value={p.deviceId??""} onChange={e=>{const d=devices.find(d=>d.id===e.target.value);setP({...p,deviceId:d?.id??null,model:d?.model_name??"",quantity:d?.quantity??1});}}><option value="">새 장비</option>{devices.map(d=><option key={d.id} value={d.id}>{d.model_name||"모델 미등록"}</option>)}</select></label>}
      {field("model","장비 모델명")}<label className="block">수량<input className={input} type="number" min="1" max="1000" required value={p.quantity} onChange={e=>setP({...p,quantity:Number(e.target.value)})}/></label>{field("identity","일련번호 / 개별 자산 식별 정보")}{field("condition","장비 상태·기존 사진 위치 (사진은 담당자 확인 후 필요한 것만)")}{field("startDate","희망 시작일")}<p>희망 시작일만 접수합니다. 실제 계약 기산일·종료일·시각은 별도 확인 후 확정합니다.</p>
      {field("owner","실제 소유자와 신청 권한 (미확인이면 미확인으로 작성)")}{field("rights","담보·제3자 권리 공개 (없음 / 있음과 내용 / 미확인)")}
    </div>}
    {step===1&&<div className="space-y-4"><h2 className="font-bold">바뀐 자료만 다시 확인합니다</h2><p>신분증·인감증명은 원본 대조 후 반환하며 사본 업로드를 요구하지 않습니다. 다년 재무·세금완납·임대차는 전 건 필수 제출이 아닙니다.</p>
      {intakeChecks.map(([key,label])=><label className="block" key={key}>{label}<select className={input} value={p.reuse[key]} onChange={e=>setP({...p,reuse:{...p.reuse,[key]:e.target.value}})}><option value="new">최초 확인 / 담당자와 확인 필요</option>{available[key]&&<option value="unchanged">기존 유효 자료에 변경 없음 — 재사용 요청</option>}{token&&<option value="review_existing">이전에 제출함 — 담당자에게 유효성·재사용 확인 요청</option>}<option value="changed">변경·만료됨 — 해당 항목만 갱신</option></select></label>)}
      {field("resources","간단한 납부재원 설명 (아는 범위에서)",false)}<h2 className="font-bold">조건이 있을 때만 추가 확인</h2>
      {intakeConditions.map(([key,label])=><label key={key} className="block">{label}<select className={input} value={p.conditions[key]} onChange={e=>setP({...p,conditions:{...p.conditions,[key]:e.target.value}})}><option value="unknown">모름 / 담당자 확인 필요</option><option value="yes">해당 가능성 있음</option><option value="no">해당 없음으로 알고 있음</option></select></label>)}
      <p className="text-sm">위 답변은 동의나 보증 약정이 아닙니다. 개인정보 처리·조회·제공 근거는 담당자가 별도로 확인하며 법인도 일괄 제외하지 않습니다. 개인보증 서면 방식은 별도 법률 검토가 필요합니다.</p>
    </div>}
    {step===2&&<div className="space-y-3"><h2 className="font-bold">입력 내용 확인</h2><dl><dt>연락</dt><dd>{p.name} / {p.phone} / {p.company}</dd><dt>자산</dt><dd>{p.model} · {p.quantity}개 · {p.identity}</dd><dt>희망 기간 참고 — 실제 계약 개시·종료는 별도 확정</dt><dd>{p.startDate}부터 7일 이용 희망 (기산·종료 미확정)</dd><dt>소유·권리</dt><dd>{p.owner} / {p.rights}</dd></dl><p>렌탈료·매입 공급가/VAT·반환 조건은 담당자와 거래별로 확인합니다. 5% 등 고정 요율을 적용하지 않습니다. 자동 연장·자동 재매입은 없습니다.</p><p>거래조건·자산목록·검수인수·소유권 확인은 계약 검토에서 한 번 입력한 자료로 연결합니다. 내부 선행조건 확인표에는 고객 서명이나 업로드를 요구하지 않습니다.</p><label className="flex gap-2"><input type="checkbox" required checked={p.confirmed} onChange={e=>setP({...p,confirmed:e.target.checked})}/>입력 내용과 재사용 요청 자료의 변경 여부를 확인했습니다. 이 제출은 계약 체결이 아닙니다.</label></div>}
    <p role="alert">{message}</p><div className="flex gap-3">{step>0&&<button className="ph-button ph-button--secondary" type="button" disabled={pending} onClick={()=>setStep(step-1)}>이전</button>}<button disabled={pending} className="ph-button ph-button--primary">{pending?"접수 중…":step<2?"다음":"초단기렌탈 접수하기"}</button></div>
  </form>;
}
