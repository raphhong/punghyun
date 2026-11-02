'use client';
import {useEffect,useRef,useState} from 'react';
import ReleaseApprovalPanel from './ReleaseApprovalPanel';
import ReviewTriagePanel from './ReviewTriagePanel';
import type {Result} from '@/lib/admin/ai/review';
import {readReviewResult,factCanApply,readRequirementNotices,requirementMessage,type RequirementNotice} from '@/lib/admin/ai/presentation';
type PanelProps={customerId:string;documents:{id:string;label:string;filename?:string|null;uploadedAt?:string|null;deviceId?:string|null}[];evidenceKeys:string[];applicationContext?:()=>number;onApply:(fact:Result['facts'][number],key:string,context?:number)=>void|boolean};
export default function AIReviewPanel(props:PanelProps){const [reviewPath,setReviewPath]=useState<'legacy'|'registered'|'confirmed'>('legacy');const [releaseOpen,setReleaseOpen]=useState(false);const [selected,setSelected]=useState<string[]>(()=>props.documents.length===1?[props.documents[0].id]:[]),[tick,setTick]=useState(0),[accessDenied,setAccessDenied]=useState(false);const ids=selected.filter(id=>props.documents.some(d=>d.id===id));if(accessDenied)return <p role="alert">접근 권한이 변경됐습니다. 다시 로그인해 주세요.</p>;return <><details><summary>시험 경로 선택</summary><label>검수 경로<select aria-label="검수 경로" value={reviewPath} onChange={e=>setReviewPath(e.target.value==='confirmed'?'confirmed':e.target.value==='registered'?'registered':'legacy')}><option value="legacy">기존 합성 검수 결과</option><option value="confirmed">원문 구간 확인 후 등록한 검수</option><option value="registered">승인 등록된 합성 자료 1회 시험</option></select></label><p>실제 고객자료는 전송하지 않습니다. 경로 선택만으로 실행 권한이 생기지 않습니다.</p></details><AIReviewPanelInner reviewPath={reviewPath} onDenied={()=>setAccessDenied(true)} key={JSON.stringify([props.customerId,props.documents,props.evidenceKeys,[...ids].sort(),reviewPath])} {...props} selectedIds={ids} onIds={setSelected} onReviewed={()=>setTick(n=>n+1)}/>{ids.length===1&&<details onToggle={e=>{if(e.target===e.currentTarget)setReleaseOpen(e.currentTarget.open);}}><summary>보낼 원문 구간·확인 이력</summary>{releaseOpen&&<ReleaseApprovalPanel endpoint={'/api/admin/customers/'+encodeURIComponent(props.customerId)+'/ai-review/release?document='+encodeURIComponent(ids[0])} documentId={ids[0]} contextKey={JSON.stringify([props.customerId,props.documents])} onRegistered={()=>setReviewPath('confirmed')}/>}</details>}{ids.length>0&&<ReviewTriagePanel key={JSON.stringify([props.customerId,[...ids].sort()])} customerId={props.customerId} documentIds={ids} refreshKey={JSON.stringify([props.documents,tick])}/>}</>;}

const labels:Record<string,string>={'customer.name':'고객명','asset.model':'장비 모델','asset.serial':'제조번호','purchase.total':'매입 총액','rent.net':'렌탈 공급가액','rent.vat':'렌탈 부가세','rent.total':'렌탈 총액','rent.rate':'렌탈 요율','contract.date':'계약일','contract.days':'계약 기간'};
const human=(value:string)=>value==='unknown'?'확인 필요':value==='inclusive'?'포함':value==='exclusive'?'별도':value==='not_applicable'?'해당 없음':value;
function AIReviewPanelInner({reviewPath,customerId,documents,evidenceKeys,applicationContext,onApply,selectedIds:ids,onIds:setIds,onReviewed,onDenied}:PanelProps&{reviewPath:'legacy'|'registered'|'confirmed';selectedIds:string[];onIds:(ids:string[])=>void;onReviewed:()=>void;onDenied:()=>void}){
 const endpoint='/api/admin/customers/'+encodeURIComponent(customerId)+'/ai-review'+(reviewPath!=='legacy'?'?reviewPath='+reviewPath:'');
 const [evidenceKey,setEvidenceKey]=useState('');
 const [requirements,setRequirements]=useState<RequirementNotice[]>([]);
 const [result,setResult]=useState<Result|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[hasRequest,setHasRequest]=useState(false),[denied,setDenied]=useState(false);
 const requestKey=useRef<string|null>(null),controller=useRef<AbortController|null>(null),epoch=useRef(0),inFlight=useRef(false);

 useEffect(()=>{const fence=epoch,c=controller;return()=>{fence.current++;c.current?.abort();};},[]);
 function stop(){epoch.current++;controller.current?.abort();inFlight.current=false;setBusy(false);}
 function resetSelection(next:string[]){stop();requestKey.current=null;setHasRequest(false);setResult(null);setRequirements([]);setNotice('');setIds(next);}
 function cancel(){stop();setNotice('화면 대기를 멈췄습니다. 서버 처리 결과는 다시 확인해 주세요.');}
 async function run(readOnly=false){
  if(inFlight.current||denied||ids.length!==1)return;
  stop();requestKey.current??=crypto.randomUUID();setHasRequest(true);const ticket=epoch.current,c=new AbortController();controller.current=c;inFlight.current=true;setBusy(true);setResult(null);setRequirements([]);setNotice('자료를 확인하고 있습니다.');
  try{
   const response=await fetch(readOnly?endpoint+(reviewPath!=='legacy'?'&':'?')+'documentId='+encodeURIComponent(ids[0]):endpoint,readOnly?{cache:'no-store',signal:c.signal}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentIds:ids,key:requestKey.current}),signal:c.signal});
   if(ticket!==epoch.current)return;
   if(response.status===401||response.status===403){stop();setDenied(true);onDenied();setResult(null);setIds([]);setEvidenceKey('');requestKey.current=null;setHasRequest(false);setNotice('접근 권한을 확인해 주세요.');return;}
   const raw=await response.json();if(ticket!==epoch.current)return;
   if(raw?.state==='ready'){setHasRequest(false);setNotice('합성 자료 1건을 검수할 수 있습니다. 실제 고객자료는 처리하지 않습니다.');return;}
   if(['attachment_not_configured','synthetic_source_required'].includes(raw?.code)){setNotice(raw.code==='attachment_not_configured'?'첨부 검수 저장 연결을 준비하고 있습니다. 아직 실행되지 않았습니다.':'이번 연결 시험에 등록된 합성 자료를 선택해 주세요. 실제 고객자료는 전송하지 않습니다.');return;}
   if(['approval_required','repository_unavailable','budget_reconciliation_required','minimization_required'].includes(raw?.code)){setNotice(({approval_required:'이 자료의 시험 등록을 기다리고 있습니다. 새 검수는 실행하지 않습니다.',repository_unavailable:'저장 연결을 확인해야 합니다. 새로 실행하지 않고 결과를 다시 확인합니다.',budget_reconciliation_required:'시험 사용량 확인이 필요합니다. 새 검수는 실행하지 않습니다.',minimization_required:'보낼 원문 범위가 현재 자료와 맞는지 확인해야 합니다. 새 검수는 실행하지 않습니다.'} as Record<string,string>)[raw.code]);return;}
   if(raw?.code==='source_unreadable'){setNotice('원문을 읽을 수 없습니다. 스캔·암호화·지원하지 않는 자료는 풍현에서 먼저 확인합니다. AI는 실행하지 않았습니다.');return;}
   if(raw?.code==='attachment_expired'||raw?.state==='attachment_expired'){setNotice('이번 시험의 실행 기간이 끝났습니다. 새 실행은 하지 않습니다.');return;}
   if(raw?.code==='receipt_unverified'){setNotice('저장된 결과의 검증이 필요합니다. 새 검수는 실행하지 않습니다.');return;}
   if(raw?.status==='waiting_provider'||raw?.state==='waiting_provider'||raw?.code==='provider_not_configured'){setNotice('AI 연결 설정을 기다리고 있습니다. 검수는 아직 실행되지 않았습니다.');return;}
   if(['request_conflict','source_changed','context_changed'].includes(raw?.code)){requestKey.current=null;setHasRequest(false);setResult(null);setNotice('자료가 바뀌었습니다. 현재 자료로 다시 검수해 주세요.');return;}
   if(raw?.code==='budget_exhausted'){setNotice('이번 시험의 검수 한도에 도달했습니다. 기존 결과를 확인해 주세요.');return;}
   if(raw?.code==='provider_outcome_unknown'){setNotice('이전 요청의 결과를 아직 확인하지 못했습니다. 중복 실행하지 않고 결과를 다시 확인합니다.');return;}
   if(!response.ok||raw.receiptVerified!==true||raw.persistedResult!==true)throw Error('review_unavailable');const next=readReviewResult(raw);if(next.facts.some(f=>!ids.includes(f.sourceId))||next.supplements.some(s=>s.sourceId&&!ids.includes(s.sourceId)))throw Error('invalid_review_source');const assessed=readRequirementNotices(raw.requirements,next.sourceSnapshot);setRequirements(assessed);setResult(next);onReviewed();setNotice(next.mode==='not_run'?'읽을 수 있는 내용을 찾지 못해 AI 분석은 실행하지 않았습니다.':next.mode==='mock'?'합성 응답 시험입니다. 실제 AI 검수 결과가 아닙니다.':'합성 첨부에서 AI가 읽은 값과 원문 근거입니다. 금융 승인이나 전체 자료 검수 완료는 아닙니다.');
  }catch{if(ticket===epoch.current)setNotice('결과를 확인하지 못했습니다. 선택한 자료를 유지했으니 결과를 다시 확인해 주세요.');}
  finally{if(ticket===epoch.current){inFlight.current=false;setBusy(false);}}
 }
 useEffect(()=>{
  let active=true;
  void Promise.resolve().then(()=>{if(active&&ids.length===1)void run(true);});
  return()=>{active=false;};
  // The outer key remounts for customer, selected documents and metadata changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 async function applyFact(f:Result['facts'][number]){
  if(inFlight.current||!result?.sourceSnapshot||!evidenceKeys.includes(evidenceKey)||!factCanApply(result,f))return;
  const previous=result,chosenKey=evidenceKey,applyContext=applicationContext?.(),ticket=epoch.current,c=new AbortController();controller.current=c;inFlight.current=true;setBusy(true);
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify',documentIds:ids,sourceSnapshot:previous.sourceSnapshot}),signal:c.signal});
   const raw=await response.json();if(ticket!==epoch.current)return;
   if(response.status===401||response.status===403){setDenied(true);onDenied();setResult(null);setEvidenceKey('');setIds([]);return;}
   if(!response.ok||raw.receiptVerified!==true||raw.persistedResult!==true)throw Error('stale');
   const current=readReviewResult(raw);if(current.sourceSnapshot!==previous.sourceSnapshot||!current.facts.some(value=>JSON.stringify(value)===JSON.stringify(f))||!factCanApply(current,f))throw Error('stale');
   if(applicationContext?.()!==applyContext)throw Error('stale');
   if(onApply(f,chosenKey,applyContext)===false){setNotice('기존 입력을 유지했습니다. 추출값과 원문 근거는 다시 확인할 수 있습니다.');return;}setNotice('현재 원문을 다시 확인하고 입력에 반영했습니다. 최종 거래 내용은 따로 확인합니다.');
  }catch{if(ticket===epoch.current){setResult(null);setNotice('자료 또는 권한을 다시 확인해야 합니다. 이전 값은 반영하지 않았습니다.');}}
  finally{if(ticket===epoch.current){inFlight.current=false;setBusy(false);}}
 }
 if(denied)return <p role="alert">접근 권한이 변경됐습니다. 다시 로그인해 주세요.</p>;
 return <details open><summary>AI 자료 검수</summary><div className="space-y-3 pt-3">
  <p>이미 제출한 자료를 사용합니다. 읽은 값과 보완사항을 확인한 뒤 계약 입력에 반영합니다.</p>
  {!documents.length&&<p>선택할 자료가 없습니다. 기존 자료 목록을 먼저 확인해 주세요.</p>}
  <details open><summary>검수할 자료 {ids.length}개</summary>{documents.map(d=><label className="block break-words" key={d.id}><input type="checkbox" checked={ids.includes(d.id)} onChange={e=>resetSelection(e.target.checked?[...ids,d.id]:ids.filter(i=>i!==d.id))}/>{d.filename??d.label}<span className="block text-sm text-slate-600">{d.filename?d.label+' · ':''}{d.uploadedAt?'등록 '+d.uploadedAt.replace('T',' ').slice(0,19)+' UTC':'등록일 확인 필요'} · 자료 {d.id.slice(0,8)}</span></label>)}</details>
  <button disabled={busy||ids.length!==1} onClick={()=>void run(hasRequest)}>{hasRequest?'결과 다시 확인':'선택한 자료 AI 검수'}</button>
  {ids.length===0&&documents.length>0&&<p>검수할 합성 자료 1개를 선택해 주세요.</p>}{ids.length>1&&<p>이번 합성 연결 시험에서는 등록된 자료 1개를 선택합니다.</p>}
  {busy&&<button onClick={cancel}>대기 중단</button>}<p role="status">{notice}</p>
  <RequirementStatus items={requirements}/>
  {result&&<><h3>보완·확인할 내용</h3>
<label>연결할 문구 근거<select value={evidenceKey} onChange={e=>setEvidenceKey(e.target.value)}><option value="">선택해 주세요</option>{evidenceKeys.map(k=><option key={k}>{k}</option>)}</select></label>
   {Array.from(new Map(result.supplements.map(s=>[s.kind+':'+s.field+':'+s.sourceId,s])).entries()).map(([key,s])=><div key={key}><p>{labels[s.field]||'자료'} · {s.kind==='conflict'?'자료 간 내용이 다릅니다':s.kind==='unreadable'?'먼저 풍현에서 원문을 확인합니다':'원문 근거와 단위·기간·세금 기준을 확인합니다'}</p></div>)}
   <p className="text-sm">미확인은 자료 누락과 다릅니다. 아래에서 처리 담당자와 메모를 저장할 수 있습니다.</p>
   {result.facts.map((f,i)=><details key={JSON.stringify([f.sourceId,f.version,f.field,i])}><summary>{labels[f.field]||'확인 항목'} · {f.value}</summary><p>{f.locator} · {f.quote}</p><p>단위 {human(f.unit)} / VAT {human(f.vat)} / 기간 {human(f.period)}</p><button disabled={busy||!evidenceKey||!factCanApply(result,f)} onClick={()=>void applyFact(f)}>원문을 확인하고 입력에 반영</button></details>)}
   <p className="text-sm">AI 추출과 입력 반영은 금융 승인·계약 확정이 아닙니다.</p>
  </>}
 </div></details>;
}

export function RequirementStatus({items}:{items:RequirementNotice[]}){return <section className="min-w-0 break-words" aria-label="자료 준비 상태">{items.length===0?<p>이 거래의 필수 자료 요건은 아직 확인되지 않았습니다. AI가 읽지 못한 값을 자료 누락으로 판단하지 않습니다.</p>:<details><summary>자료 준비 상태 확인</summary>{items.filter(r=>r.state!=='not_required').map(r=><div key={r.ruleId}><p>{requirementMessage(r)}</p><p>{r.responsibility==='sales'?'영업자 자료 확보':'풍현 확인'}</p><details><summary>요건 근거</summary><p>{r.basisRef}</p></details></div>)}</details>}</section>;}
