const ts = require('typescript');
module.exports = function(source) {
 const result=ts.transpileModule(source,{fileName:this.resourcePath,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});
 const errors=result.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error)||[];
 if(errors.length)throw Error(ts.formatDiagnosticsWithColorAndContext(errors,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:f=>f,getNewLine:()=>"\n"}));
 return result.outputText;
};
