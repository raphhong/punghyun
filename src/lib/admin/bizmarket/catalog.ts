/** User-supplied Bizmarket / 고현수 checklist, 2026-11-02. Not NICE policy or a credit decision. */
export const profileLabels={none:'사용 안 함',hospital:'병원',manufacturing:'일반 제조',medical_corporation:'의료법인'} as const;
export type Profile=keyof typeof profileLabels;
export type Item={id:string;label:string;kind:'document'|'phone'|'number'|'percent'|'address';sensitive?:boolean;hint?:string;existingKeys?:string[]};
export const items:Item[]=[
 {id:'business_registration',label:'계약자 사업자등록증',kind:'document',existingKeys:['business_registration']},
 {id:'quotation',label:'견적서',kind:'document'},
 {id:'representative_id',label:'원장·이사장·대표 신분증 사본',kind:'document',sensitive:true,existingKeys:['rep_id']},
 {id:'resident_register',label:'원장·이사장·대표 주민등록등본',kind:'document',sensitive:true},
 {id:'income_certificate',label:'원장·이사장 소득금액증명원',kind:'document',sensitive:true},
 {id:'financial_3years',label:'원장·이사장·대표 3개년 재무제표',kind:'document',hint:'연도별 자료를 여러 파일로 연결할 수 있습니다.'},
 {id:'representative_phone',label:'원장·이사장·대표 연락처',kind:'phone'},
 {id:'medical_permit',label:'의료기관 개설허가증 및 이력',kind:'document',existingKeys:['medical_license'],hint:'현재 허가와 변경 이력을 함께 확인합니다.'},
 {id:'doctor_license',label:'의사면허증',kind:'document',sensitive:true},
 {id:'biography',label:'약력',kind:'document'},
 {id:'current_revenue_certificate',label:'금년 최근 분기까지 면세·부가 사업자 수입금액증명원',kind:'document'},
 {id:'monthly_sales',label:'월별 매출집계표',kind:'document'},
 {id:'bed_occupancy',label:'월평균 병상가동률 (%)',kind:'percent'},
 {id:'national_tax',label:'국세 완납증명',kind:'document',existingKeys:['tax_payment_cert']},
 {id:'local_tax',label:'지방세 완납증명',kind:'document',existingKeys:['tax_payment_cert']},
 {id:'employee_count',label:'직원 수',kind:'number'},
 {id:'organization_chart',label:'조직도',kind:'document'},
 {id:'premises_lease',label:'병원·사업장 임대차계약서',kind:'document'},
 {id:'purchase_tax_summary',label:'매입처별 세금계산서 합계표',kind:'document'},
 {id:'sales_tax_summary',label:'매출처별 세금계산서 합계표',kind:'document'},
 {id:'supplier_registration',label:'공급사 사업자등록증',kind:'document'},
 {id:'supplier_phone',label:'공급사 연락처',kind:'phone'},
 {id:'owned_property_address',label:'원장·이사장 보유 부동산 주소',kind:'address',sensitive:true},
 {id:'vat_base_certificate',label:'부가세 과세표준증명원',kind:'document'},
 {id:'corporate_seal',label:'법인인감증명서 1부',kind:'document',sensitive:true},
 {id:'corporate_registry',label:'법인등기부등본 1부',kind:'document',existingKeys:['corporate_registration']},
 {id:'business_bank_copy',label:'사업자 통장 사본',kind:'document',sensitive:true},
 {id:'articles',label:'정관 사본 1부',kind:'document',hint:'비즈마켓 원문: “주주명부 포함”. 의료법인에 해당하는지 확인이 필요합니다. 자동 필수 판단하지 않습니다.'},
];
const hospital=['business_registration','quotation','representative_id','resident_register','income_certificate','financial_3years','representative_phone','medical_permit','doctor_license','biography'];
const additional=['current_revenue_certificate','monthly_sales','bed_occupancy','national_tax','local_tax','employee_count','organization_chart','premises_lease','purchase_tax_summary','sales_tax_summary','supplier_registration','supplier_phone','owned_property_address'];
export function groups(profile:Profile):{label:string;ids:string[]}[]{return profile==='hospital'?[{label:'병원 필수',ids:hospital},{label:'병원 추가',ids:additional}]:profile==='manufacturing'?[{label:'일반 제조',ids:['business_registration','quotation','representative_id','resident_register','representative_phone','financial_3years','vat_base_certificate','national_tax','local_tax','premises_lease','purchase_tax_summary','sales_tax_summary']}]:profile==='medical_corporation'?[{label:'의료법인',ids:['corporate_seal','corporate_registry','business_bank_copy','articles','quotation','representative_id','resident_register','income_certificate','financial_3years','representative_phone','medical_permit','premises_lease','monthly_sales','bed_occupancy','national_tax','local_tax','employee_count','organization_chart']}]:[];}
export const statuses={unknown:'미확인',held:'보유',missing:'부족',completed:'보완 완료'} as const;
export type Ref={kind:'existing'|'upload';id:string;version:string};
export type Entry={status:keyof typeof statuses;value:string;refs:Ref[];confirmed:boolean};
export type State={profile:Profile;entries:Record<string,Entry>};
export type Document={kind:'existing'|'upload';id:string;version:string;label:string;uploadedAt:string|null;key?:string};
export const blank=():State=>({profile:'none',entries:{}});
export const emptyEntry=():Entry=>({status:'unknown',value:'',refs:[],confirmed:false});
export function effectiveEntry(entry:Entry|undefined,documents:Document[]):Entry&{changed:boolean}{const e=entry??emptyEntry(),changed=e.refs.some(r=>!documents.some(d=>d.kind===r.kind&&d.id===r.id&&d.version===r.version));return {...e,status:changed?'unknown':e.status,confirmed:changed?false:e.confirmed,changed};}
export function requestDraft(state:State,documents:Document[]){const ids=groups(state.profile).flatMap(g=>g.ids),missing=ids.filter(id=>effectiveEntry(state.entries[id],documents).status==='missing');return missing.length?`비즈마켓 ${profileLabels[state.profile]} 자료 요청입니다.\n현재 부족으로 확인한 아래 자료를 확보해 주세요.\n${missing.map(id=>'• '+items.find(i=>i.id===id)!.label+(effectiveEntry(state.entries[id],documents).refs.length?' — 기존 제출 자료 외 보완분(필요한 추가 내용 확인)':'')).join('\n')}\n신분증·등본 등 개인정보 서류는 카카오톡 첨부 대신 승인된 보호 업로드 경로로 받아 주세요.\n미확인 항목은 별도 확인 중이며, 보유 자료는 다시 요청하지 않습니다.`:'부족으로 확인한 자료가 없습니다. 미확인은 자료 없음이 아닙니다.';}
export function validateState(raw:unknown):State{if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('invalid_request');const s=raw as State;if(Object.keys(s).sort().join()!=='entries,profile'||!Object.hasOwn(profileLabels,s.profile)||!s.entries||typeof s.entries!=='object'||Array.isArray(s.entries)||Object.keys(s.entries).length>items.length)throw Error('invalid_request');for(const [key,e] of Object.entries(s.entries)){const item=items.find(i=>i.id===key);if(!item||!e||Object.keys(e).sort().join()!=='confirmed,refs,status,value'||!Object.hasOwn(statuses,e.status)||typeof e.value!=='string'||e.value.length>300||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(e.value)||/\d{6}[- ]?[1-8]\d{6}/.test(e.value)||typeof e.confirmed!=='boolean'||!Array.isArray(e.refs)||e.refs.length>12||new Set(e.refs.map(r=>r.kind+':'+r.id)).size!==e.refs.length)throw Error('invalid_request');if(e.value&&item.kind==='number'&&(!/^\d+$/.test(e.value)||Number(e.value)>1000000))throw Error('invalid_request');if(e.value&&item.kind==='percent'&&(!/^\d+(\.\d{1,2})?$/.test(e.value)||Number(e.value)>100))throw Error('invalid_request');if(e.status==='completed'&&item.kind==='phone'&&!/^\+?[0-9][0-9 -]{6,20}$/.test(e.value))throw Error('invalid_request');if(e.status==='completed'&&(!e.confirmed||(item.kind==='document'?!e.refs.length:!e.value.trim())))throw Error('confirmation_required');for(const ref of e.refs)if(!ref||Object.keys(ref).sort().join()!=='id,kind,version'||!['existing','upload'].includes(ref.kind)||!/^[a-f0-9-]{36}$/i.test(ref.id)||!/^[a-f0-9]{64}$/.test(ref.version))throw Error('invalid_request');}return s;}
