// Real local XLSX parsing and product receipt projection; no provider or database calls.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n)+'.ts'):require(n),m,m.exports);return m.exports;}
const {decodeContent,monthlyCoverage,reconcileCoverage,monthlyCoverageProse}=load('src/lib/admin/ai/content-contract.ts'),{salesModelFeedback}=load('src/lib/sales/model-feedback.ts'),{extractXlsxNode}=load('src/lib/admin/ai/xlsx-node.ts'),{sha}=load('src/lib/admin/ai/review.ts');
const dir=process.env.SYNTHETIC_TRIAL_DIR; // Private, approved fixtures are never published with code.
const hashes=['fe572ee803babce79c4ac05d59fc1787063bd1b572ca06c25ce63e3aeff3b3be','1f51fa3c428fa191173d4aa452c45cedb529a5ec67479d66771d998b4b6a8a0f'];
const ev=(quote,cell='A1',extra={})=>({sourceId:'synthetic',version:'v2',sha256:'a'.repeat(64),locator:`sheet:1;name:example;cell:${cell};part:value`,quote,assurance:'text_match',...extra});
const title=ev('조회기간: 2026-04~2026-10'),table=ev('월별 매출 (원)\n'+Array.from({length:7},(_,i)=>`2026-${String(i+4).padStart(2,'0')}  ${i===0?0:100+i}`).join('\n'),'A2');
test('actual approved workbook rows: v2 all five sheets complete, v1 4xOctober and 1xSeptember/October absent',{skip:!dir&&'Set SYNTHETIC_TRIAL_DIR to the approved local synthetic workbook directory'},async()=>{
 for(const version of [1,2]){
  const bytes=fs.readFileSync(path.join(dir,`synthetic-content-review-v${version}.xlsx`));assert.equal(sha(bytes),hashes[version-1]);
  const parsed=await extractXlsxNode({id:'synthetic',customerId:'synthetic-customer',version:`v${version}`,sha256:sha(bytes),bytes,mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',assetId:null});
  const segments=parsed.segments;assert.equal(segments.length,12);
  const headers=segments.filter(s=>s.text.includes('조회기간'));
  const raw=[...segments.map(s=>({topic:'document_fact',citations:[{segment:s.id,quote:s.text}]})),{topic:'coverage_gap',citations:headers.map(s=>({segment:s.id,quote:s.text}))},{topic:'income_scope',citations:[{segment:segments[10].id,quote:segments[10].text}]},{topic:'vat_uncertain',citations:[{segment:segments[1].id,quote:'월별 카드매출 (원, VAT 구분 미기재)'}]}];
  const result=decodeContent(raw,segments);const gaps=result.observations.filter(o=>o.topic==='coverage_gap');assert.equal(gaps.length,version===2?0:5);assert(result.observations.some(o=>o.topic==='income_scope'));assert(result.observations.some(o=>o.topic==='vat_uncertain'));
  for(let i=0;i<5;i++){const evidence=segments.slice(i*2,i*2+2).map(s=>({...ev(s.text),sourceId:s.sourceId,version:s.version,sha256:s.sha256,locator:s.locator}));const c=monthlyCoverage(evidence);assert.deepEqual(c.absent,version===2?[]:i===4?['2026-09','2026-10']:['2026-10']);}
  // Replay the old stored shape; keep original JSON intact while suppressing contradicted warning.
  const oldObservations=raw.map(o=>({topic:o.topic,state:o.topic==='document_fact'?'document_statement':'needs_confirmation',evidence:o.citations.map(c=>{const s=segments.find(s=>s.id===c.segment);return {sourceId:s.sourceId,version:s.version,sha256:s.sha256,locator:s.locator,quote:c.quote,assurance:'text_match'};})}));
  const stored={mode:'live',status:'needs_review',facts:[],supplements:[],financialApproval:false,contentReview:{contract:'document-review-v1',observations:oldObservations,financialApproval:false}};const before=JSON.stringify(stored);const rows=salesModelFeedback([JSON.parse(before)],['synthetic']);assert.equal(rows.filter(r=>r.field==='document.coverage_gap').length,version===2?0:10);assert.equal(JSON.stringify(stored),before);
  const guide=load('src/lib/sales/review-guidance.ts').reviewIssueGuidance;
  if(version===2){const prose=rows.filter(r=>r.field==='document.document_fact'&&/^월별/.test(r.quote)).map(r=>guide(r,[]).next);assert.equal(prose.length,5);assert(prose.every(s=>s.includes('7개월의 월별 금액이 모두 기재')&&s.includes('실제 영업·입금')));}
  else {const prose=rows.filter(r=>r.field==='document.coverage_gap').map(r=>guide(r,[]).next);assert(prose.every(s=>s.includes('무실적')&&s.includes('별도로 제출')));assert(prose.some(s=>s.includes('2026년 9월·2026년 10월')));}
 }
});
test('title-only evidence is uncertain; zero-value months count as observed; duplicates/malformed tables are not silently complete',()=>{
 assert.equal(monthlyCoverage([title,table]).state,'complete');
 const observation={topic:'coverage_gap',state:'needs_confirmation',evidence:[title]};assert.equal(reconcileCoverage([observation])[0].topic,'period_uncertain');
 for(const text of [table.quote+'\n2026-10 50',table.quote.replace('2026-10  106','2026-10 ?'),table.quote.replace('2026-10  106','2026-13 106')])assert.equal(monthlyCoverage([title,{...table,quote:text}]).state,'unknown');
});
test('months from another sheet, document, version or hash cannot repair current scope',()=>{
 const observation={topic:'coverage_gap',state:'needs_confirmation',evidence:[title]};
 for(const changed of [{sourceId:'other'},{version:'old'},{sha256:'b'.repeat(64)},{locator:'sheet:2;name:other;cell:A2;part:value'},{locator:'sheet:1;name:example;cell:B2;part:value'}]){const wrong={...table,...changed};assert.equal(reconcileCoverage([observation],[title,wrong])[0].topic,'period_uncertain');assert.equal(monthlyCoverage([title,wrong]).state,'unknown');}
});
test('cross-year periods and negative/decimal amounts keep observed coverage; two competing table blocks stay unknown',()=>{
 const h=ev('조회기간 2026-11~2027-02'),r=ev('월별 정산\n2026-11 -1,234.50\n2026-12 (250)\n2027-01 0\n2027-02 +12.30 원','A3');assert.equal(monthlyCoverage([h,r]).state,'complete');assert.equal(monthlyCoverage([h,r,{...r,locator:r.locator.replace('A3','A4')}]).state,'unknown');
});

test('unknown coverage has no invented Korean month summary',()=>{assert.equal(monthlyCoverageProse([title]),null);const o=reconcileCoverage([{topic:'coverage_gap',state:'needs_confirmation',evidence:[title]}])[0];assert.equal(o.topic,'period_uncertain');const next=load('src/lib/sales/review-guidance.ts').reviewIssueGuidance({sourceId:title.sourceId,field:'document.'+o.topic,state:'unknown',quote:title.quote,locator:title.locator,action:''},[]).next;assert(next.includes('부족하다고 판정한 것은 아닙니다'));});
