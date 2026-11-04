const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(n=>n.startsWith('@/')?load(path.resolve('src',n.slice(2))+'.ts'):n.startsWith('.')?load(path.resolve(path.dirname(file),n)+'.ts'):require(n),m,m.exports);return m.exports;}
const paths=load('src/lib/admin/other-document-path.ts');
test('ordinary upload paths are not decoded as base64; valid encoded Korean names round trip',()=>{
 assert.equal(paths.otherDocumentFilename('synthetic/card_sales_6m-1790000000000.xlsx'),'card_sales_6m-1790000000000.xlsx');
 const key='other_document_11111111-1111-4111-8111-111111111111';
 const p=paths.otherDocumentPath('synthetic',key,'합성 매출 (11월).xlsx');assert.equal(paths.otherDocumentFilename(p),'합성 매출 (11월).xlsx');assert(paths.validOtherDocumentPath('synthetic',key,p));
 assert.equal(paths.otherDocumentFilename('synthetic/'+key+'/____.pdf'),'파일 이름 확인 필요');
 assert.equal(paths.validOtherDocumentPath('synthetic',key,'synthetic/'+key+'/____.pdf'),false);
});
test('initial view distinguishes selection, primary start and saved results with safe empty state',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const Panel=load('src/components/sales/NormalReviewPanel.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Panel,{customerId:'synthetic',documents:[]}));
 for(const text of ['AI 검수 시작','저장된 결과 보기','등록된 자료가 없습니다','3. 검수 결과','사진·스캔 PDF OCR 미지원'])assert(html.includes(text),text);
 assert(!html.includes('현재 파일 전송 내용 확인'));assert(!html.includes('동의하고 AI 검수 요청'));assert(html.includes('bg-blue-700'));assert(html.includes('<details'));
});
