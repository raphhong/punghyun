import {localOcrEnabled} from './local-ocr-config';
import {extractDocument} from './document-extraction';
import type {Source,Segment} from './review';
/** Conservative labelled business lines only; never whole files or unlabelled prose.
 * All candidates still require administrator review in the exact transmission preview. */
const label=/^(?:장비명|기기명|모델(?:명)?|일련번호|제조번호|견적금액|견적총액|거래조건|결제조건|월매출|월별매출|사업장별\s*월별매출)\s*[:：]\s*\S/;
const sensitive=/신분|주민|여권|등본|계좌|통장|예금주|비밀번호|환자|진단|진료|병력|건강|password|bank|patient|diagnosis|ignore|instructions?|프롬프트|시스템|https?:|@|\b\d{6}[- ]?[1-8]\d{6}\b|\b01[016789][- ]?\d{3,4}[- ]?\d{4}\b|[\u0000-\u0008\u200b-\u200f\u202a-\u202e]/i;
export function adminBusinessSegments(segments:Segment[]):Segment[]{
 return segments.flatMap(s=>s.text.split(/\r?\n/).flatMap((text,i)=>{
  text=text.trim();if(text.length>240||!label.test(text)||sensitive.test(text))return [];
  if(/^(일련번호|제조번호)/.test(text)){const v=text.split(/[:：]/).slice(1).join(':').trim();if(!/[a-z]/i.test(v)||!/[0-9]/.test(v)||v.replace(/\D/g,'').length>=10)return [];}
  return [{...s,id:s.id+'-field-'+i,text,locator:s.locator+' · 항목 '+(i+1)}];
 }));
}
export async function extractAdminBusinessFields(source:Source){
 const ocr=localOcrEnabled(process.env);
 if(!['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',...(ocr?['image/png','image/jpeg']:[])].includes(source.mime))throw Error('unsupported_format');
 const parsed=await extractDocument(source,undefined,ocr?{ocr:async (s,signal)=>(await import('./local-ocr')).localDocumentOcr(s,signal)}:{});const out=adminBusinessSegments(parsed.segments);
 if(!out.length)throw Error('source_unreadable');return out;
}
