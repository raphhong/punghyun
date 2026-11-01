'use client';
import {useEffect,useRef,useState} from 'react';
import ReviewTriagePanel from './ReviewTriagePanel';
import type {Result} from '@/lib/admin/ai/review';
import {readReviewResult,factCanApply} from '@/lib/admin/ai/presentation';
type PanelProps={customerId:string;documents:{id:string;label:string}[];evidenceKeys:string[];onApply:(fact:Result['facts'][number],key:string)=>void};
export default function AIReviewPanel(props:PanelProps){const [selected,setSelected]=useState<string[]>(()=>props.documents.length<=8?props.documents.map(d=>d.id):[]),[tick,setTick]=useState(0);const ids=selected.filter(id=>props.documents.some(d=>d.id===id));return <><AIReviewPanelInner key={JSON.stringify([props.customerId,props.documents,props.evidenceKeys])} {...props} selectedIds={ids} onIds={setSelected} onReviewed={()=>setTick(n=>n+1)}/>{ids.length>0&&<ReviewTriagePanel key={JSON.stringify([props.customerId,[...ids].sort()])} customerId={props.customerId} documentIds={ids} refreshKey={JSON.stringify([props.documents,tick])}/>}</>;}

const labels:Record<string,string>={'customer.name':'고객명','asset.model':'장비 모델','asset.serial':'제조번호','purchase.total':'매입 총액','rent.net':'렌탈 공급가액','rent.vat':'렌탈 부가세','rent.total':'렌탈 총액','rent.rate':'렌탈 요율','contract.date':'계약일','contract.days':'계약 기간'};
const human=(value:string)=>value==='unknown'?'확인 필요':value==='inclusive'?'포함':value==='exclusive'?'별도':value==='not_applicable'?'해당 없음':value;
function AIReviewPanelInner({customerId,documents,evidenceKeys,onApply,selectedIds:ids,onIds:setIds,onReviewed}:PanelProps&{selectedIds:string[];onIds:(ids:string[])=>void;onReviewed:()=>void}){
 const [evidenceKey,setEvidenceKey]=useState('');
 const [result,setResult]=useState<Result|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[hasRequest,setHasRequest]=useState(false),[denied,setDenied]=useState(false);
 const requestKey=useRef<string|null>(null),controller=useRef<AbortController|null>(null),epoch=useRef(0),inFlight=useRef(false);

 useEffect(()=>{const fence=epoch,c=controller;return()=>{fence.current++;c.current?.abort();};},[]);
 function stop(){epoch.current++;controller.current?.abort();inFlight.current=false;setBusy(false);}
 function resetSelection(next:string[]){stop();requestKey.current=null;setHasRequest(false);setResult(null);setNotice('');setIds(next);}
 function cancel(){stop();setNotice('화면 대기를 멈췄습니다. 서버 처리 결과는 다시 확인해 주세요.');}
 async function run(){
  if(inFlight.current||denied||!ids.length||ids.length>8)return;
  stop();requestKey.current??=crypto.randomUUID();setHasRequest(true);const ticket=epoch.current,c=new AbortController();controller.current=c;inFlight.current=true;setBusy(true);setResult(null);setNotice('자료를 확인하고 있습니다.');
  try{
   const response=await fetch('/api/admin/customers/'+encodeURIComponent(customerId)+'/ai-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentIds:ids,key:requestKey.current}),signal:c.signal});
   if(ticket!==epoch.current)return;
   if(response.status===401||response.status===403){stop();setDenied(true);setResult(null);setIds([]);setEvidenceKey('');requestKey.current=null;setHasRequest(false);setNotice('접근 권한을 확인해 주세요.');return;}
   const raw=await response.json();if(ticket!==epoch.current)return;
   if(raw?.status==='waiting_provider'){setNotice('AI 연결 설정을 기다리고 있습니다. 검수는 아직 실행되지 않았습니다.');return;}
   if(['request_conflict','source_changed','context_changed'].includes(raw?.code)){requestKey.current=null;setHasRequest(false);setResult(null);setNotice('자료가 바뀌었습니다. 현재 자료로 다시 검수해 주세요.');return;}
   if(raw?.code==='budget_exhausted'){setNotice('이번 시험의 검수 한도에 도달했습니다. 기존 결과를 확인해 주세요.');return;}
   if(raw?.code==='provider_outcome_unknown'){setNotice('이전 요청의 결과를 아직 확인하지 못했습니다. 중복 실행하지 않고 결과를 다시 확인합니다.');return;}
   if(!response.ok)throw Error('review_unavailable');const next=readReviewResult(raw);if(next.facts.some(f=>!ids.includes(f.sourceId))||next.supplements.some(s=>s.sourceId&&!ids.includes(s.sourceId)))throw Error('invalid_review_source');setResult(next);onReviewed();setNotice(next.mode==='not_run'?'읽을 수 있는 내용을 찾지 못해 AI 분석은 실행하지 않았습니다.':next.mode==='mock'?'합성 응답 시험입니다. 실제 AI 검수 결과가 아닙니다.':'AI가 읽은 값과 원문 근거를 확인해 주세요.');
  }catch{if(ticket===epoch.current)setNotice('결과를 확인하지 못했습니다. 선택한 자료를 유지했으니 결과를 다시 확인해 주세요.');}
  finally{if(ticket===epoch.current){inFlight.current=false;setBusy(false);}}
 }
 if(denied)return <p role="alert">접근 권한이 변경됐습니다. 다시 로그인해 주세요.</p>;
 return <details><summary>AI 자료 검수</summary><div className="space-y-3 pt-3">
  <p>이미 제출한 자료를 사용합니다. 읽은 값과 보완사항을 확인한 뒤 계약 입력에 반영합니다.</p>
  {!documents.length&&<p>선택할 자료가 없습니다. 기존 자료 목록을 먼저 확인해 주세요.</p>}
  <details><summary>검수할 자료 {ids.length}개</summary>{documents.map(d=><label className="block" key={d.id}><input type="checkbox" checked={ids.includes(d.id)} onChange={e=>resetSelection(e.target.checked?[...ids,d.id]:ids.filter(i=>i!==d.id))}/>{d.label}</label>)}</details>
  <button disabled={busy||!ids.length||ids.length>8} onClick={run}>{hasRequest?'결과 다시 확인':'선택한 자료 AI 검수'}</button>
  {busy&&<button onClick={cancel}>대기 중단</button>}<p role="status">{notice}</p>
  {result&&<><h3>보완·확인할 내용</h3><label>연결할 문구 근거<select value={evidenceKey} onChange={e=>setEvidenceKey(e.target.value)}><option value="">선택해 주세요</option>{evidenceKeys.map(k=><option key={k}>{k}</option>)}</select></label>
   {Array.from(new Map(result.supplements.map(s=>[s.kind+':'+s.field+':'+s.sourceId,s])).entries()).map(([key,s])=><div key={key}><p>{labels[s.field]||'자료'} · {s.kind==='conflict'?'자료 간 내용이 다릅니다':s.kind==='unreadable'?'먼저 풍현에서 원문을 확인합니다':'원문 근거와 단위·기간·세금 기준을 확인합니다'}</p></div>)}
   <p className="text-sm">미확인은 자료 누락과 다릅니다. 아래에서 처리 담당자와 메모를 저장할 수 있습니다.</p>
   {result.facts.map((f,i)=><details key={JSON.stringify([f.sourceId,f.version,f.field,i])}><summary>{labels[f.field]||'확인 항목'} · {f.value}</summary><p>{f.locator} · {f.quote}</p><p>단위 {human(f.unit)} / VAT {human(f.vat)} / 기간 {human(f.period)}</p><button disabled={busy||!evidenceKey||!factCanApply(result,f)} onClick={()=>{if(!inFlight.current&&evidenceKeys.includes(evidenceKey)&&factCanApply(result,f)){try{onApply(f,evidenceKey);setNotice('입력에 반영했습니다. 나머지 결과도 이어서 확인할 수 있습니다.');}catch{setNotice('현재 계약 항목과 근거 연결을 확인해 주세요.');}}}}>원문을 확인하고 입력에 반영</button></details>)}
   <p className="text-sm">AI 추출과 입력 반영은 금융 승인·계약 확정이 아닙니다.</p>
  </>}
 </div></details>;
}
