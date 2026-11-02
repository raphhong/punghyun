/* eslint-disable @typescript-eslint/no-require-imports -- synthetic server-rendered UI test */
const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.join(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'requirements-ui-'));
fs.writeFileSync(out+'/presentation.js',ts.transpileModule(fs.readFileSync(root+'/src/lib/admin/ai/presentation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
const box={exports:{},require:n=>n.includes('presentation')?require(out+'/presentation'):(n.includes('ReviewTriagePanel')||n.includes('ReleaseApprovalPanel'))?()=>null:require(n)};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(root+'/src/components/admin/contract/AIReviewPanel.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,box);
const render=items=>renderToStaticMarkup(React.createElement(box.exports.RequirementStatus,{items}));
assert.match(render([]),/아직 확인되지 않았습니다/);assert.doesNotMatch(render([]),/필수 자료가 확인되지/);
const base={responsibility:'punghyun',requestUpload:false,ruleId:'rule1',policyVersion:'v1',basisRef:'<script>synthetic</script>'};
for(const state of ['inventory_unknown','unreadable','present_needs_review','applicability_unknown']){const html=render([{...base,state}]);assert.doesNotMatch(html,/<script>/);assert.match(html,/풍현 확인/);assert.doesNotMatch(html,/담당자가 자료를 확보합니다/)}
assert.match(render([{...base,state:'missing_confirmed',requestUpload:true,responsibility:'sales'}]),/영업자 자료 확보/);
assert.match(renderToStaticMarkup(React.createElement(box.exports.default,{customerId:'synthetic',documents:[],evidenceKeys:[],onApply(){}})),/필수 자료 요건은 아직 확인되지/);
console.log(JSON.stringify({passed:7,realReactServerRender:true,actualBrowser:false,externalCalls:0}));fs.rmSync(out,{recursive:true,force:true});
