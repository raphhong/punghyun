import JSZip from 'jszip';

export const VERSION = 'DM26-1014-SRB-v5-electronic-r1';
export const SOURCE_SHA = '7966f8185e2006ada4e6df76d2f168a1b8e6e687a569ff4105fe77a1a862b0d7';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export type Field = { id: string; paragraph: number; start: number; end: number; label: string; group: string; kind: 'text' | 'choice'; context: string; table:number;row:number;column:number };
export type Values = Record<string,string>;
export type Seed = { id: string; hospital_name: string|null; representative: string|null; phone: string|null; email: string|null; hospital_type: string|null; contract_date: string|null; execution_amount: number|null; rental_price: number|null; rental_months: number|null; devices: {model_name:string|null;quantity:number|null}[] };
export type Parsed = { xml: string; fields: Field[]; groups: string[]; paragraphs: {text:string;group:string}[]; initial: Values; signatureCount: number };
const elements = (e: Element|Document, name: string) => Array.from(e.getElementsByTagNameNS(W,name));
const txt = (e: Element) => elements(e,'t').map(t=>t.textContent||'').join('');
const money = (v:number|null) => v == null ? '' : v.toLocaleString('ko-KR');

// The retained OOXML is authoritative: no clause rewriting or HTML-to-Word conversion.
export function parseTemplate(xml:string, seed:Seed):Parsed {
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length) throw new Error('계약서 XML을 읽을 수 없습니다.');
  // User-requested electronic variant, 2026-10-15. The source file/hash is unchanged.
  // Electronic signature is NOT a finding that a personal guarantee is enforceable.
  let inGuarantee=false;
  for(const p of elements(doc,'p')){
    const t=txt(p);if(t.startsWith('별지 7 '))inGuarantee=true;if(t.startsWith('별지 8 '))inGuarantee=false;
    if(!inGuarantee)continue;
    let revised=t;
    if(t.startsWith('법인 고객 전용 ｜'))revised='법인 고객 전용 ｜ 법인 대표 자격과 개인 보증인 자격을 구분하여 별도 본인확인 및 전자날인';
    if(t.startsWith('② 개인보증은 보증인 본인이 이 약정서 종이 원본'))revised='② 개인보증 의사표시는 보증인 본인이 별도의 본인확인을 거쳐 개인 자격으로 전자날인한다. 본인확인 일시·방법 및 서명 대상 문서 버전을 기록한다.';
    if(t.startsWith('③ 전자서명·전자문서·간편인증')){p.remove();continue;}
    revised=revised.replace('보증인 자필 기재:','보증인 확인:').replace('(자필 서명 또는 인감 날인)','(개인 자격의 별도 전자날인)').replace('서명 방식: 종이 원본 자필 서명 또는 기명날인','서명 방식: 본인확인을 거친 전자날인');
    if(revised!==t){const nodes=elements(p,'t');if(nodes[0])nodes[0].textContent=revised;nodes.slice(1).forEach(n=>n.textContent='');}
  }
  const tables=elements(doc,'tbl');
  // Only repeating asset rows are resized, before assigning stable paragraph indexes.
  for(const ti of [3,5,6,7,10,12]) {
    const table=tables[ti]; if(!table) continue;
    const rows=Array.from(table.children).filter(n=>n.localName==='tr');
    const total=rows.at(-1); const hasTotal=total&&txt(total).startsWith('합계');
    const dataRows=rows.slice(1,hasTotal?-1:undefined);
    const count=Math.min(120,Math.max(1,ti===3?(seed.rental_months||3):seed.devices.length));
    if(!dataRows[0]) continue;
    for(let i=dataRows.length;i<count;i++) table.insertBefore(dataRows[0].cloneNode(true),hasTotal?total!:null);
    for(let i=count;i<dataRows.length;i++) dataRows[i].remove();
    Array.from(table.children).filter(n=>n.localName==='tr').slice(1,hasTotal?-1:undefined).forEach((r,i)=>{
      const cell=Array.from(r.children).find(n=>n.localName==='tc');
      const texts=cell?elements(cell,'t'):[]; if(texts.length){texts[0].textContent=String(i+1);texts.slice(1).forEach(n=>n.textContent='');}
    });
  }
  const ps=elements(doc,'p'); const fields:Field[]=[];const initial:Values={};
  let group='본문';let signatureCount=0;
  const paragraphs:Parsed['paragraphs']=[];
  ps.forEach((p,pi)=>{
    const text=txt(p);
    if([
      '별지 1 당사자와 매매 조건','별지 1 렌탈 및 만기 조건',
      '별지 2 자산목록과 가격 배분','별지 3 선행조건과 서명대상 첨부',
      '별지 4 검수·인수확인서','별지 5 소유권과 권리관계 확인 확약서',
      '별지 6 개인정보 처리 안내 및 동의','별지 6 신용조회와 제3자 제공 동의',
      '별지 7 법인 대표자 개인 연대보증 약정','별지 8 거래 검토를 위한 사전확약',
    ].includes(text)) group=text;
    if(text==='지급 후 실제 개시확인') group='별지 4 지급 후 실제 개시확인';
    paragraphs.push({text,group});
    if(/서명 또는 인|서명 또는 날인|날인|자필 서명/.test(text)) signatureCount++;
    const cell=p.closest('tc, w\\:tc');
    const table=cell?.closest('tbl, w\\:tbl');const ti=table?tables.indexOf(table):-1;
    const row=cell?.parentElement; const rows=table?Array.from(table.children).filter(n=>n.localName==='tr'):[];
    const ri=row?rows.indexOf(row):-1;const cells=row?Array.from(row.children).filter(n=>n.localName==='tc'):[];
    const ci=cell?cells.indexOf(cell):-1;
    const headers=rows[0]?Array.from(rows[0].children).filter(n=>n.localName==='tc').map(txt):[];
    const rowTitle=cells[0]?txt(cells[0]):'';
    const label=[ti>=0?`${rowTitle} / ${headers[ci]||''}`:'',text||paragraphs[pi-1]?.text||'입력'].filter(Boolean).join(' · ');
    // Explicit signature cells and initials are left for the signer. Names/authority remain data fields.
    const signatureCell=(ti===0&&ri===5)||(ti===4&&ri>0&&ci===2);
    if(signatureCell) return;
    const emptyCell=cell&&text.trim()===''&&elements(cell,'p').length===1;
    const matches=Array.from(text.matchAll(/_{2,}|□/g));
    if(emptyCell) matches.push(Object.assign([''],{index:0}) as RegExpExecArray);
    matches.forEach((m,mi)=>{
      const choice=m[0]==='□';
      // The person, not the operator, must choose consents in Annex 6.
      if(choice&&group.startsWith('별지 6')) return;
      const id=`p${pi}_${mi}`;
      fields.push({id,paragraph:pi,start:m.index!,end:m.index!+m[0].length,label:`${label} [${mi+1}]`,group,kind:choice?'choice':'text',context:text,table:ti,row:ri,column:ci});
      let value='';
      if(!choice){
        const before=text.slice(0,m.index).trim();
        if(/계약번호\s*$/.test(before)) value=`SRB-${seed.id.slice(0,8)}`;
        if(/갑\s*$/.test(before)) value=seed.hospital_name||'';
        if(/대표자 또는 본인\s*$/.test(before)) value=seed.representative||'';
        if(/을 주식회사 풍현 권한 있는 서명자\s*$/.test(before)) value='홍솔';
        if(ti===1&&ri===1&&/상호\s*$/.test(before))value=seed.hospital_name||'';
        if(ti===1&&ri===1&&/법인명\s*$/.test(before))value=(seed.hospital_type==='corporate'?seed.hospital_name:seed.representative)||'';
        if(ti===1&&ri===3&&/성명·직위\s*$/.test(before))value=seed.representative||'';
        if(ti===1&&ri===3&&/전화\s*$/.test(before))value=seed.phone||'';
        if(ti===1&&ri===3&&/통지 이메일\s*$/.test(before))value=seed.email||'';
        if(ti===1&&ri===5&&seed.contract_date&&mi<3&&text.startsWith('계약일'))value=seed.contract_date.split('-')[mi]||'';
        if(ti===1&&ri===5&&mi===0&&text.startsWith('대상 수량')&&seed.devices.length&&seed.devices.every(d=>d.quantity))value=String(seed.devices.reduce((sum,d)=>sum+(d.quantity||0),0));
        if(ti===2&&ri===1&&text.startsWith('실제 소유권')&&seed.rental_months)value=String(seed.rental_months);
        if(ti===2&&ri===2&&mi===0&&text.startsWith('총 ')&&seed.rental_months)value=String(seed.rental_months);
        if(ti===0&&mi===0){if(ri===1&&ci===0)value=seed.hospital_name||'';if(ri===2&&ci===0)value=(seed.hospital_type==='corporate'?seed.hospital_name:seed.representative)||'';if(ri===3)value=ci===0?(seed.representative||''):'홍솔';}
        if(ti===5&&ri>0&&seed.devices[ri-1]){if(ci===1)value=seed.devices[ri-1].model_name||'';if(ci===3)value=String(seed.devices[ri-1].quantity??'');}
      }
      if(value)initial[id]=value;
    });
  });
  return {xml:new XMLSerializer().serializeToString(doc),fields,initial,groups:[...new Set(paragraphs.map(p=>p.group))],paragraphs,signatureCount};
}

export function allowedGroup(group:string,mode:'contract'|'contract-guarantee'|'commencement'|'guarantee'|'preliminary') {
  if(mode==='guarantee')return group.startsWith('별지 7');
  if(mode==='commencement')return group==='별지 4 지급 후 실제 개시확인';
  if(mode==='preliminary')return group.startsWith('별지 8')||group.startsWith('별지 5');
  return (mode==='contract-guarantee'||!group.startsWith('별지 7'))&&!group.startsWith('별지 8')&&group!=='별지 4 지급 후 실제 개시확인';
}
export type Mode=Parameters<typeof allowedGroup>[1];
export function missingFields(parsed:Parsed,values:Values,mode:Mode){return parsed.fields.filter(f=>allowedGroup(f.group,mode)&&!values[f.id]?.trim());}

export function amountIssues(parsed:Parsed,values:Values,mode:Mode):string[]{
  if(mode!=='contract'&&mode!=='contract-guarantee')return [];
  const issues:string[]=[];
  const amount=(f:Field|undefined)=>{if(!f)return null;const s=(values[f.id]||'').replace(/[,원\s]/g,'');return /^\d+$/.test(s)&&Number.isSafeInteger(Number(s))?Number(s):null;};
  const sale=parsed.fields.filter(f=>f.table===1&&f.row===6&&f.kind==='text'&&f.context.startsWith('공급가액'));
  const rent=parsed.fields.filter(f=>f.table===2&&f.row===2&&f.kind==='text'&&f.context.startsWith('공급가액'));
  const check=(fs:Field[],label:string)=>{const a=fs.map(amount);if(a.length!==3||a.some(n=>n===null)){issues.push(`${label}: 공급가액·세액·합계는 원 단위 숫자로 입력하세요.`);return;}if((a[0]??0)+(a[1]??0)!==a[2])issues.push(`${label}: 공급가액 + 세액과 합계가 다릅니다.`);};
  check(sale,'매매대금');check(rent,'렌탈료 총액');
  for(const [ti,label,target] of [[3,'납부일정',rent],[7,'자산별 가격배분',sale]] as const){
    const rows=[...new Set(parsed.fields.filter(f=>f.table===ti).map(f=>f.row))];let total=0;
    for(const row of rows){const fs=parsed.fields.filter(f=>f.table===ti&&f.row===row&&f.column>=(ti===3?2:1)&&f.column<=(ti===3?4:3));const nums=fs.map(amount);if(nums.length!==3||nums.some(n=>n===null)){issues.push(`${label} ${row}행: 금액을 모두 숫자로 입력하세요.`);continue;}if((nums[0]??0)+(nums[1]??0)!==nums[2])issues.push(`${label} ${row}행: 세액 합계가 맞지 않습니다.`);if(row!==rows.at(-1))total+=nums[2]!;else if(total!==nums[2])issues.push(`${label}: 상세 금액과 합계행이 다릅니다.`);}
    if(total!==amount(target[2]))issues.push(`${label}: 별지 1의 총액과 일치하지 않습니다.`);
  }
  return issues;
}

// Replace only character spans in their original runs; font, tables, sections and clauses survive.
export function fillXml(parsed:Parsed,values:Values,mode:Mode){
  const doc=new DOMParser().parseFromString(parsed.xml,'application/xml');const ps=elements(doc,'p');
  for(let pi=0;pi<ps.length;pi++){
    const p=ps[pi];if(!allowedGroup(parsed.paragraphs[pi].group,mode))continue;
    const edits=parsed.fields.filter(f=>f.paragraph===pi).sort((a,b)=>b.start-a.start);
    for(const f of edits){
      const value=f.kind==='choice'?(values[f.id]==='yes'?'☑':'□'):(values[f.id]||'');
      let ts=elements(p,'t');
      if(!ts.length){const r=doc.createElementNS(W,'w:r');const t=doc.createElementNS(W,'w:t');r.appendChild(t);p.appendChild(r);ts=[t];}
      const spans:{t:Element;start:number;end:number}[]=[];let at=0;
      ts.forEach(t=>{const s=t.textContent||'';spans.push({t,start:at,end:at+s.length});at+=s.length;});
      const first=spans.find(s=>s.end>f.start)||spans.at(-1)!;
      const last=spans.find(s=>s.end>=f.end)||spans.at(-1)!;
      if(first===last)first.t.textContent=(first.t.textContent||'').slice(0,f.start-first.start)+value+(first.t.textContent||'').slice(f.end-first.start);
      else{first.t.textContent=(first.t.textContent||'').slice(0,f.start-first.start)+value;let active=false;for(const s of spans){if(s===first){active=true;continue;}if(!active)continue;if(s===last){s.t.textContent=(s.t.textContent||'').slice(f.end-s.start);break;}s.t.textContent='';}}
      first.t.setAttribute('xml:space','preserve');
    }
  }
  // Remove entire top-level blocks of other signing stages, including their tables.
  const body=elements(doc,'body')[0];const index=new Map(ps.map((p,i)=>[p,i]));
  for(const node of Array.from(body.children)){
    const p=node.localName==='p'?node:elements(node,'p')[0];const i=p?index.get(p):undefined;
    if(i!==undefined&&!allowedGroup(parsed.paragraphs[i].group,mode))node.remove();
  }
  return new XMLSerializer().serializeToString(doc);
}
export async function exportDocx(source:ArrayBuffer,parsed:Parsed,values:Values,mode:Mode){
  if(missingFields(parsed,values,mode).length)throw new Error('미입력 항목을 먼저 확인하세요.');
  const issues=amountIssues(parsed,values,mode);if(issues.length)throw new Error(issues.join('\n'));
  const zip=await JSZip.loadAsync(source);zip.file('word/document.xml',fillXml(parsed,values,mode));
  return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
export function summary(seed:Seed){return `매매대금 ${money(seed.execution_amount)}원 / 월 렌탈료 ${money(seed.rental_price)}원 / ${seed.rental_months??'?'}개월 (VAT 구분은 별지에서 확인)`;}

