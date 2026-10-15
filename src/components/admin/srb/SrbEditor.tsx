'use client';
import {useState} from 'react';
import JSZip from 'jszip';
import {VERSION,SOURCE_SHA,parseTemplate,amountIssues,missingFields,allowedGroup,exportDocx,summary,type Seed,type Parsed,type Values,type Mode} from '@/lib/admin/srb/template';

const input='w-full rounded border border-neutral-300 p-2 text-sm';
const button='rounded border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-40';
export function SrbEditor({seed}:{seed:Seed}){
  const [source,setSource]=useState<ArrayBuffer>();const [parsed,setParsed]=useState<Parsed>();
  const [values,setValues]=useState<Values>({});const [mode,setMode]=useState<Mode>('contract');
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [reviewed,setReviewed]=useState(false);
  const [devices,setDevices]=useState(seed.devices);const [dirty,setDirty]=useState(false);
  const [rentalMonths,setRentalMonths]=useState(seed.rental_months||3);
  const endpoint=`/ph-console-8f27x/api/srb/${seed.id}`;
  async function jsonRequest(action:string,body?:unknown){const r=await fetch(`${endpoint}?action=${action}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await r.json();if(!r.ok)throw new Error(data.error||'요청 실패');return data;}
  async function load(buffer:ArrayBuffer,restore=true){
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(n=>n.toString(16).padStart(2,'0')).join('');
    if(hash!==SOURCE_SHA)throw new Error('확인된 최종본과 다른 파일입니다.');
    const zip=await JSZip.loadAsync(buffer);const xml=await zip.file('word/document.xml')?.async('string');if(!xml)throw new Error('DOCX 문서가 아닙니다.');
    const saved=restore?await jsonRequest('draft'):null;const draft=saved?.draft;
    const ds=draft?.devices||devices;
    const months=draft?.rentalMonths||seed.rental_months||3;
    const result=parseTemplate(xml,{...seed,rental_months:months,devices:ds});setSource(buffer);setParsed(result);setDevices(ds);setRentalMonths(months);
    setValues(draft?.version===VERSION?draft.values:result.initial);setMode(draft?.mode||'contract');setDirty(false);setReviewed(false);
    setMessage(draft?`저장본 불러옴: ${draft.savedAt}`:'최종본과 고객정보를 불러왔습니다. 자동 입력도 원자료와 대조해주세요.');
  }
  async function run(action:()=>Promise<void>){setBusy(true);setMessage('');try{await action();}catch(e){setMessage(e instanceof Error?e.message:'처리 실패');}finally{setBusy(false);}}
  async function register(file:File){await run(async()=>{const b=await file.arrayBuffer();const r=await fetch(`${endpoint}?action=template`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:b});const data=await r.json();if(!r.ok)throw new Error(data.error);await load(b);});}
  async function save(){const result=await jsonRequest('draft',{version:VERSION,sourceHash:SOURCE_SHA,mode,values,devices,rentalMonths});setDirty(false);setMessage(`작성내용 저장 완료: ${result.savedAt}`);}
  async function download(){if(!source||!parsed)return;await save();const blob=await exportDocx(source,parsed,values,mode);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${seed.hospital_name||'고객'}_SRB_5차_${mode}.docx`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);setMessage('DOCX를 내려받았습니다. Word에서 PDF로 저장 후 글로싸인에 업로드하고 도장 필드와 본인인증을 설정하세요.');}
  const missing=parsed?missingFields(parsed,values,mode):[];
  const issues=parsed&&missing.length===0?amountIssues(parsed,values,mode):[];
  const change=(key:string,value:string)=>{setValues(v=>({...v,[key]:value}));setReviewed(false);setDirty(true);};
  return <div className="mx-auto max-w-5xl space-y-5 p-5">
    <h1 className="text-2xl font-bold">SRB 최종 표준계약서 작성</h1>
    <p>{seed.hospital_name} · {VERSION}</p><p className="text-sm">{summary(seed)}</p>
    <p className="text-sm">5차 최종본 기반으로 개인보증의 종이 원본 제한을 전자날인 방식으로 수정한 버전입니다. 고객·장비 정보는 입력을 돕는 값이며 소유권, 지급, 검수 완료를 자동 인정하지 않습니다. 해당 없는 입력도 검토 후 ‘해당 없음’과 사유를 명시해주세요.</p>
    <div className="flex flex-wrap gap-3">
      <button className={button} disabled={busy||dirty} onClick={()=>run(async()=>{const r=await fetch(`${endpoint}?action=template`);if(!r.ok){const e=await r.json();throw new Error(e.error);}await load(await r.arrayBuffer());})}>최종본·저장내용 불러오기</button>
      <label className={button}>최초 1회 최종 원본 등록<input type="file" accept=".docx" disabled={busy||dirty} onChange={e=>{const f=e.target.files?.[0];if(f)register(f);}} className="ml-2 max-w-64"/></label>
    </div>
    <div role="status" className="whitespace-pre-wrap text-sm text-blue-800">{message}</div>
    {!parsed&&<section className="space-y-2"><h2 className="font-bold">장비 행 구성</h2><p className="text-sm">자산별 명판·가격·소유권을 적을 행을 만듭니다. 제조번호가 다른 장비는 행을 구분하세요.</p>{devices.map((d,i)=><div className="flex gap-2" key={i}><input aria-label={`장비 ${i+1} 모델`} className={input} value={d.model_name||''} onChange={e=>setDevices(ds=>ds.map((v,j)=>j===i?{...v,model_name:e.target.value}:v))}/><input aria-label={`장비 ${i+1} 수량`} type="number" min="1" className="w-24 border p-2" value={d.quantity??''} onChange={e=>setDevices(ds=>ds.map((v,j)=>j===i?{...v,quantity:Number(e.target.value)||null}:v))}/><button className={button} onClick={()=>setDevices(ds=>ds.filter((_,j)=>j!==i))}>제외</button></div>)}<button className={button} onClick={()=>setDevices(ds=>[...ds,{model_name:'',quantity:1}])}>장비 행 추가</button></section>}
    {parsed&&<>
      <label className="block">작성 단계<select className={input} value={mode} onChange={e=>{setMode(e.target.value as Mode);setReviewed(false);setDirty(true);}}><option value="contract">계약 체결 · 본문 및 별지 1~6</option><option value="commencement">지급 후 실제 개시확인 (실제 지급 후 작성)</option><option value="contract-guarantee">법인 계약 체결 · 별도 개인보증 포함</option><option value="guarantee">개인보증만 별도 전자날인</option><option value="preliminary">사전확약 및 소유권 확약</option></select></label>
      <p className="text-sm">개인정보 동의 선택 및 날인은 당사자가 직접 합니다. 개인보증은 대표자 개인 자격의 별도 날인을 받습니다. 전자날인 완료와 보증 효력 확인은 별개입니다. 미확인 상태를 ‘완료’로 입력하지 마세요.</p>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border bg-white p-3"><strong>남은 입력 {missing.length}개</strong><button className={button} disabled={busy} onClick={()=>run(save)}>작성내용 저장</button><button className={button} disabled={busy||!!missing.length||!!issues.length||!reviewed} onClick={()=>run(download)}>날인 전 DOCX 다운로드</button>{dirty&&<span className="text-sm">저장하지 않은 변경 있음</span>}</div>
      {issues.length>0&&<ul className="text-sm text-red-700">{issues.map(i=><li key={i}>{i}</li>)}</ul>}
      {parsed.groups.filter(g=>allowedGroup(g,mode)).map(group=>{
        const fields=parsed.fields.filter(f=>f.group===group);const count=fields.filter(f=>!values[f.id]?.trim()).length;
        return <details key={group} className="rounded border p-4" open={group==='본문'}><summary className="cursor-pointer font-bold">{group} · 미입력 {count}개</summary><div className="mt-4 space-y-4">{fields.map(f=><label key={f.id} className="block"><span className="mb-1 block whitespace-pre-line text-sm">{f.label}</span>{f.kind==='choice'?<select aria-label={f.id} className={input} value={values[f.id]||''} onChange={e=>change(f.id,e.target.value)}><option value="">선택 여부 확인 필요</option><option value="yes">☑ 선택</option><option value="no">□ 선택하지 않음</option></select>:<textarea aria-label={f.id} className={input} rows={2} value={values[f.id]||''} onChange={e=>change(f.id,e.target.value)}/>}</label>)}<details><summary>원문 확인</summary>{parsed.paragraphs.filter(p=>p.group===group).map((p,i)=><p key={i} className="my-2 whitespace-pre-wrap text-sm">{p.text}</p>)}</details></div></details>;
      })}
      <label className="flex gap-2"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/><span>당사자·금액 및 VAT·자산별 합계·사용기간·납부일정·선택조건·첨부 문서와 각 서명자를 대조했습니다. 지급 후 확인이나 동의·보증을 대신 완료 처리하지 않았습니다.</span></label>
      <p className="text-sm">글로싸인 업로드 후: 각 당사자 연락처 → 본인인증 필수 → 해당 당사자의 도장 필드 배치 → 별도 동의 선택 필드 배치 → 최종 검토 후 발송. 파일 업로드만으로 글로싸인의 도장 필드가 자동 생성되지는 않습니다.</p>
    </>}
  </div>;
}


