import type {DocumentExtraction} from './document-extraction';
import type {Source} from './review';

export type ContentReference={sourceId:string;version:string;sha256:string;locator:string;quote:string};
export type ContentFinding={kind:'observed'|'confirm';title:string;detail:string;next:string;refs:ContentReference[];requestOriginal:false};
export type ContentReview={sourceId:string;version:string;sha256:string;status:'read'|'unavailable';findings:ContentFinding[];financialApproval:false;modelCalled:false};
const month=/^\d{4}-(0[1-9]|1[0-2])$/;
const ordinal=(v:string)=>Number(v.slice(0,4))*12+Number(v.slice(5))-1;
function months(from:string,to:string){if(!month.test(from)||!month.test(to)||ordinal(to)<ordinal(from)||ordinal(to)-ordinal(from)>35)return null;return Array.from({length:ordinal(to)-ordinal(from)+1},(_,i)=>{const n=ordinal(from)+i;return `${Math.floor(n/12)}-${String(n%12+1).padStart(2,'0')}`;});}
/** Conservative, declared-table grammar. Does not infer absent rows as zero activity or missing documents. */
export function firstPassContent(source:Pick<Source,'id'|'version'|'sha256'>,parsed:DocumentExtraction|null):ContentReview{
 const findings:ContentFinding[]=[];const reference=(locator:string,quote:string):ContentReference=>({sourceId:source.id,version:source.version,sha256:source.sha256,locator,quote});
 const report:ContentReview={sourceId:source.id,version:source.version,sha256:source.sha256,status:parsed?'read':'unavailable',findings,financialApproval:false,modelCalled:false};
 if(!parsed){findings.push({kind:'confirm',title:'등록 자료 내용 미확인',detail:'파일 수신과 내용 판독은 별개입니다. 판독되지 않았다고 자료가 없다고 판단하지 않습니다.',next:'현재 파일의 지원 형식과 판독 상태를 먼저 확인하세요. 같은 원본을 다시 요청하지 않습니다.',refs:[],requestOriginal:false});return report;}
 // Never trust a caller's detached extraction as current source evidence.
 if(parsed.segments.some(s=>s.sourceId!==source.id||s.version!==source.version||s.sha256!==source.sha256))throw Error('source_changed');
 if(parsed.kind==='xlsx')for(const sheet of parsed.sheets??[]){
  if(sheet.state!=='visible')continue;
  const cells=(parsed.cells??[]).filter(c=>c.sheetName===sheet.name&&!c.hidden&&c.formulaState==='not_formula');
  const headers=cells.filter(c=>/^조회기간\s*[:：]?\s*\d{4}-\d{2}\s*[~～]\s*\d{4}-\d{2}$/.test(c.value??''));
  const table=cells.find(c=>c.value==='월');if(headers.length!==1||!table)continue;
  const match=/([0-9]{4}-[0-9]{2})\s*[~～]\s*([0-9]{4}-[0-9]{2})$/.exec(headers[0].value!);if(!match)continue;
  const expected=months(match[1],match[2]);if(!expected)continue;
  const col=/^[A-Z]+/.exec(table.cell)![0],row=Number(table.cell.slice(col.length));
  if(!cells.some(c=>c.value==='매출액'&&Number(c.cell.replace(/^[A-Z]+/,''))===row))continue;
  const entries=cells.filter(c=>c.cell.startsWith(col)&&/^[A-Z]+/.exec(c.cell)?.[0]===col&&Number(c.cell.slice(col.length))>row&&month.test(c.value??''));
  const observed=[...new Set(entries.map(c=>c.value!))].sort(),absent=expected.filter(m=>!observed.includes(m));
  const locator=(cell:string)=>`sheet:${sheet.sheet};name:${encodeURIComponent(sheet.name)};cell:${cell};part:value`;
  const refs=[reference(locator(headers[0].cell),headers[0].value!),...entries.map(c=>reference(locator(c.cell),c.value!))];
  findings.push({kind:'observed',title:sheet.name+' · 실제 월 행 범위',detail:`조회 머리글 ${match[1]}~${match[2]}; 관측 월 ${observed.join(', ')||'없음'}. 이는 원문 행의 존재 확인이며 매출 사실·입금 확인이 아닙니다.`,next:'원문 셀에서 조회기간과 실제 행을 구분해 검토하세요.',refs,requestOriginal:false});
  if(absent.length)findings.push({kind:'confirm',title:sheet.name+' · 기간 공백 확인',detail:`머리글 범위 중 ${absent.join(', ')} 월 행은 관측되지 않았습니다. 무실적 또는 미제출이라고 단정하지 않습니다.`,next:`${absent.join(', ')}이 무실적·휴업 기간인지, 별도 자료에 포함됐는지 확인해 주세요. 이미 받은 매출자료는 다시 요청하지 말고 해당 월의 설명 또는 별도 제출 위치만 확인하세요.`,refs,requestOriginal:false});
  if(observed.some(m=>!expected.includes(m))||entries.length!==observed.length)findings.push({kind:'confirm',title:sheet.name+' · 행 범위 대조 필요',detail:'조회기간 밖 행 또는 같은 월의 여러 행이 있습니다. 합산하거나 중복 삭제하지 않았습니다.',next:'월별 세부내역인지 수정본 중복인지 원문을 확인하세요.',refs,requestOriginal:false});
 }
 const aggregate=parsed.segments.filter(s=>s.evidenceQuality!=='ocr_unverified'&&/개인\s*합산\s*사업소득/.test(s.text));
 if(aggregate.length)findings.push({kind:'confirm',title:'개인 합산 사업소득 · 대상 사업장 단독 이익 아님',detail:'개인 합산 사업소득으로 기재된 자료가 있습니다. 대상 사업장의 단독 순이익·매출·상환재원으로 귀속하지 않습니다.',next:'이미 받은 소득자료를 재요청하지 말고, 포함 사업장과 기간·귀속 범위 및 대상 사업장의 분리 근거가 있는지 설명을 확인하세요.',refs:aggregate.map(s=>reference(s.locator,'개인 합산 사업소득')),requestOriginal:false});
 if(!findings.length)findings.push({kind:'confirm',title:'지원되는 내용 대조 규칙 미확인',detail:'원문 추출은 됐지만 월별 매출 표 또는 소득 귀속을 확정할 구조가 확인되지 않았습니다.',next:'원문 위치와 표 구조를 확인하세요. 없는 자료로 분류하거나 전체 자료를 재요청하지 않습니다.',refs:[],requestOriginal:false});
 return report;
}
export function evidenceVersion(review:ContentReview,current:Pick<Source,'id'|'version'|'sha256'>){return review.sourceId===current.id&&review.version===current.version&&review.sha256===current.sha256?'current':'previous';}
