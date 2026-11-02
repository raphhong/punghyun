'use client';
import {useState,useRef,useEffect} from 'react';
type Image={id:string;width:number;height:number;sha256:string;version:string;crop:{x:number;y:number;width:number;height:number};preview:string};
type FieldReview={readings:{imageId:string;field:string;raw:string;status:string;quote:string;box:number[]|null}[];issues:{index:number;code:string;original:unknown}[];normalized:{imageId:string;field:string;syntax:{decimal:string;explicitUnit:string|null}|null}[]};
type State={fieldReview?:FieldReview|null;approval:{id:string;slot:string;revision:number;status:string;expiresAt:number;images:Image[]};reserved:boolean;providerHttpStatus:number|null;usedAttempts:number;reservedMicrousd:number;receiptVerified:boolean;executionAllowed:boolean;catalog:Image[];diagnostic:{inputTokens:number;outputTokens:number;estimatedMicrousd:number}|null;result:{readings:{imageId:string;field:string;raw:string;status:string;box:number[]|null}[];usage:{inputTokens:number;outputTokens:number;estimatedMicrousd:number}}|null};
export default function VisionComparisonPanel({customerId}:{customerId:string}){return <VisionComparisonSession key={customerId} customerId={customerId}/>;}
function VisionComparisonSession({customerId}:{customerId:string}){
 const [slot,setSlot]=useState('vision-v118-1'),[state,setState]=useState<State|null>(null),[selected,setSelected]=useState<string[]>([]),[ack,setAck]=useState(''),[message,setMessage]=useState('미승인·미설정 상태에서는 전송할 수 없습니다.'),[busy,setBusy]=useState(false);const sequence=useRef(0);
 useEffect(()=>()=>{sequence.current++;},[]);
 const endpoint=`/api/admin/customers/${customerId}/ai-review/image-comparison`;
 const same=!!state&&JSON.stringify([...selected].sort())===JSON.stringify(state.approval.images.map(x=>x.id).sort());
 const key=state?`${slot}:${state.approval.id}:${state.approval.revision}:${selected.slice().sort().join(',')}`:'';
 async function call(action:string){
  if(busy)return;if(['confirm','execute'].includes(action)&&(!same||ack!==key))return;
  const requestId=++sequence.current;setBusy(true);setMessage('서버 상태를 확인하고 있습니다.');
  try{const data=action==='read'?null:action==='prepare'?{action,slot,images:selected.map(id=>{const i=state?.catalog.find(i=>i.id===id);if(!i)throw Error();return {id,crop:i.crop};})}:action==='execute'?{action,slot,revision:state?.approval.revision}:{action,slot,revision:state?.approval.revision,confirmed:true};
   const response=await fetch(endpoint+(action==='read'?`?slot=${slot}`:''),{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined,cache:'no-store'});const body=await response.json();if(requestId!==sequence.current)return;if(!response.ok)throw Error(typeof body.code==='string'?body.code:'unavailable');
   setState(body);setSelected(body.approval.images.map((x:Image)=>x.id));setAck('');setMessage(action==='execute'?'응답을 저장했습니다. 정확도는 별도 원문 대조가 필요합니다.':action==='revoke'?'전송 확인을 회수했습니다.':'서버의 저장 상태를 불러왔습니다.');
  }catch{if(requestId===sequence.current){setState(null);setAck('');setMessage('결과를 확인할 수 없습니다. 다시 실행하지 말고 저장 상태를 조회하세요.');}}finally{if(requestId===sequence.current)setBusy(false);}
 }
 return <section className="mx-auto max-w-4xl space-y-4 p-4"><h1 className="text-xl font-semibold">합성 이미지 판독 비교</h1><p>실제 고객 서류는 사용할 수 없습니다. OpenAI에 선택한 합성 이미지 전체 픽셀을 보냅니다. 결과는 금융 승인이나 계약 입력 확정이 아닙니다.</p><p>비교 한도 최대 5회·$2, 회당 $0.40 예약. 기존 사용량을 포함해 관리하며 실패·응답 미확인도 횟수에 포함됩니다.</p>
 <label>시험 슬롯 <select disabled={busy} value={slot} onChange={e=>{sequence.current++;setSlot(e.target.value);setState(null);setSelected([]);setAck('');}}>{[1,2,3,4,5].map(n=><option key={n} value={`vision-v118-${n}`}>{n}회차</option>)}</select></label><button disabled={busy} onClick={()=>call('read')}>저장 상태 조회</button><p role="status">{message}</p>
 {state&&<><p>상태: {state.approval.status} · 만료: {new Date(state.approval.expiresAt).toLocaleString()} · 누적 {state.usedAttempts}회 / ${(state.reservedMicrousd/1e6).toFixed(5)} 예약</p>
 <div className="grid gap-4 sm:grid-cols-2">{state.catalog.map(i=><article key={i.id} className="min-w-0 rounded border p-3"><label><input type="checkbox" disabled={busy||!['empty','draft'].includes(state.approval.status)||state.approval.images.length>0} checked={selected.includes(i.id)} onChange={e=>{setSelected(a=>e.target.checked?[...a,i.id]:a.filter(x=>x!==i.id));setAck('');}}/> {i.id}</label><p>{i.width} × {i.height} · 원본 전체 범위 · {i.sha256.slice(0,12)}</p>
 {/* Synthetic pinned data URLs only. No remote image URLs or customer files. */}
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={i.preview} alt={`${i.id} 합성 원문`} className="h-auto w-full"/></article>)}</div>
 <button disabled={busy||selected.length<1||selected.length>3||state.approval.images.length>0} onClick={()=>call('prepare')}>선택 이미지·범위 준비</button>
 {state.approval.images.length>0&&<label className="block"><input type="checkbox" checked={ack===key&&key!==''} disabled={busy||!same||state.approval.status==='revoked'} onChange={e=>setAck(e.target.checked?key:'')}/> 이미지 원문·전체 픽셀 범위·기한·횟수·금액을 확인했습니다.</label>}
 <div className="flex flex-wrap gap-3"><button disabled={busy||state.approval.status!=='draft'||!same||ack!==key} onClick={()=>call('confirm')}>전송 확인 저장</button><button disabled={busy||!state.executionAllowed||!same||ack!==key} onClick={()=>call('execute')}>승인된 합성 비교 1회 실행</button><button disabled={busy||state.approval.status==='revoked'} onClick={()=>call('revoke')}>확인 회수</button></div>
 {state.providerHttpStatus!==null&&<p>저장된 공급자 HTTP 상태: {state.providerHttpStatus}</p>}
 {state.reserved&&!state.result&&<p>예약됨 · 결과 미확인. 다시 실행하지 않습니다.</p>}
 {state.receiptVerified&&state.diagnostic&&!state.result&&<p>저장된 사용량: 입력 {state.diagnostic.inputTokens} / 출력 {state.diagnostic.outputTokens} 토큰 · 계산 비용 ${(state.diagnostic.estimatedMicrousd/1e6).toFixed(6)}</p>}
 {same&&state.receiptVerified&&state.fieldReview&&<div><p>필드별 판독 초안 · 전체 검수 완료 아님 · 대표 확인 필요</p>{state.fieldReview.readings.map((r,i)=><details key={i}><summary>{r.imageId} / {r.field}: {r.status==='readable'?r.raw:r.status==='absent'?'원문 값 없음으로 판독 · 확인 필요':'판독 불가'}</summary><p>{r.quote} · 픽셀 {r.box?.join(', ')??'없음'}</p></details>)}{state.fieldReview.issues.map(issue=><details key={issue.index}><summary>형식 불일치 필드 {issue.index+1} · {issue.code} · 격리됨</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify(issue.original,null,2)}</pre><p>값이나 사실로 반영하지 않습니다. 원문 확인이 필요합니다.</p></details>)}{state.fieldReview.normalized.filter(n=>n.syntax).map((n,i)=><p key={i}>{n.imageId} / {n.field} · 문법 정규화 {n.syntax!.decimal} · 표시 단위 {n.syntax!.explicitUnit??'미기재'} · 원문 값은 위에 그대로 보존</p>)}<p>정규화는 쉼표·명시 부호·단위 문법만 처리하며 금액 정확성이나 지급 사실을 확정하지 않습니다.</p></div>}
 {same&&state.receiptVerified&&!state.fieldReview&&state.result&&<div><p>저장된 서버 결과 검증 완료 · 판독 내용은 미확인</p>{state.result.readings.map(r=><p key={r.imageId+r.field}>{r.imageId} / {r.field}: {r.status==='readable'?r.raw:'판독 불가·미확인'} · 원문 위치 {r.box?.join(', ')??'없음'}</p>)}<p>입력 {state.result.usage.inputTokens} / 출력 {state.result.usage.outputTokens} 토큰 · 계산 비용 ${(state.result.usage.estimatedMicrousd/1e6).toFixed(6)}</p></div>}</>}
 </section>;
}
