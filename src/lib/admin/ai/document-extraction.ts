import {extractPdfText,pdfParserVersion} from './pdf-text';
import {extractXlsxNode} from './xlsx-node';
import {sha,type Source,type Segment} from './review';
export type CellEvidence={sheetName:string;cell:string;value:string|null;formula:string|null;rawStoredValue:string|null;formulaState:string;numberFormat:string;hidden:boolean};
export type DocumentExtraction={segments:Segment[];parserVersion:string;kind:'text_pdf'|'ocr'|'xlsx';status:'extracted_needs_review'|'ocr_needs_review';warnings:string[];cells?:CellEvidence[];dateSystem?:string};
export type DocumentRuntime={ocr?:(source:Source,signal?:AbortSignal)=>Promise<{segments:Segment[];parserVersion:string;issues:string[]}>;xlsx?:(source:Source,signal?:AbortSignal)=>Promise<{segments:Segment[];parserVersion:string;warnings:string[];sheets?:import('./xlsx-node').XlsxSheet[];dateSystem?:string}>};
/** Server-owned adapters only. Missing native tooling is unsupported, never an external-provider fallback. */
export async function extractDocument(source:Source,signal?:AbortSignal,runtime:DocumentRuntime={}):Promise<DocumentExtraction>{
 if(!source.bytes.length||source.bytes.length>8*1024*1024||sha(source.bytes)!==source.sha256)throw Error('source_changed');
 if(signal?.aborted)throw Error('cancelled');
 const mime=source.mime.split(';')[0].trim().toLowerCase();let result:DocumentExtraction;
 if(mime==='application/pdf'){
  const visual=await pdfNeedsVisualReading(source,signal);
  try{if(visual)throw Error('visual_review_required');return {segments:await extractPdfText(source,signal),parserVersion:pdfParserVersion,kind:'text_pdf',status:'extracted_needs_review',warnings:[]};}
  catch{if(signal?.aborted)throw Error('cancelled');if(!runtime.ocr)throw Error('ocr_runtime_unavailable');}
  const r=await runtime.ocr!(source,signal);result={segments:r.segments,parserVersion:r.parserVersion,kind:'ocr',status:'ocr_needs_review',warnings:r.issues};
 }else if(['image/png','image/jpeg'].includes(mime)){
  if(!runtime.ocr)throw Error('ocr_runtime_unavailable');const r=await runtime.ocr(source,signal);result={segments:r.segments,parserVersion:r.parserVersion,kind:'ocr',status:'ocr_needs_review',warnings:r.issues};
 }else if(mime==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'){
  const r=await (runtime.xlsx??extractXlsxNode)(source,signal);result={segments:r.segments,parserVersion:r.parserVersion,kind:'xlsx',status:'extracted_needs_review',warnings:r.warnings,dateSystem:r.dateSystem,cells:r.sheets?.flatMap(sheet=>sheet.cells.map(cell=>({sheetName:sheet.name,cell:cell.cell,value:cell.value,formula:cell.formula,rawStoredValue:cell.rawStoredValue,formulaState:cell.formulaState,numberFormat:cell.customNumberFormat??cell.numberFormatId,hidden:sheet.state!=='visible'||cell.hiddenRow||('hiddenColumn' in cell&&cell.hiddenColumn===true)})))};
 }else throw Error('unsupported_format');
 if(signal?.aborted)throw Error('cancelled');
 if(!result.segments.length||result.segments.length>10000||new Set(result.segments.map(s=>s.id)).size!==result.segments.length||result.segments.some(s=>s.sourceId!==source.id||s.version!==source.version||s.sha256!==source.sha256||!s.text||!s.locator)||Buffer.byteLength(JSON.stringify(result.segments))>6*1024*1024)throw Error('source_unreadable');
 return {...result,segments:result.segments.map(s=>({...s,evidenceQuality:result.kind==='ocr'?'ocr_unverified':'cell_value'}))};
}

/** This deployable Node slice has no native OCR, subprocess or external-image fallback.
 * Configuration cannot assert runtime isolation or silently activate a missing service. */
export function documentRuntimeFromEnvironment(env:Record<string,string|undefined>):DocumentRuntime{
 if(env.AI_DOCUMENT_LOCAL_RUNTIME)throw Error('ocr_runtime_unavailable');
 return {};
}

/** Conservative mixed-page check: visible text does not cover embedded scan/image contents. */
async function pdfNeedsVisualReading(source:Source,signal?:AbortSignal):Promise<boolean>{
 const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(source.bytes),useWorkerFetch:false,useWasm:false,disableFontFace:true,useSystemFonts:false,verbosity:0,stopAtErrors:true});
 let stopped=false;const stop=()=>{stopped=true;void task.destroy().catch(()=>{});};const timer=setTimeout(stop,8000);signal?.addEventListener('abort',stop,{once:true});
 const check=()=>{if(stopped||signal?.aborted)throw Error('source_unreadable');};
 try{check();const doc=await task.promise;if(doc.numPages<1||doc.numPages>20||doc.isPureXfa||await doc.getPermissions()!==null||await doc.hasJSActions()||await doc.getAttachments()||await doc.getOpenAction())throw Error('source_unreadable');let visual=false;
 const imageOps=new Set(Object.entries(OPS).filter(([name])=>/image/i.test(name)&&name.startsWith('paint')).map(([,value])=>value));
 for(let n=1;n<=doc.numPages;n++){check();const page=await doc.getPage(n);if(await page.getJSActions())throw Error('source_unreadable');const operators=await page.getOperatorList();if(operators.fnArray.length>100000)throw Error('source_unreadable');if(operators.fnArray.some(v=>imageOps.has(v)))visual=true;page.cleanup();}check();return visual;
 }catch{throw Error(signal?.aborted?'cancelled':'source_unreadable');}finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);await task.destroy().catch(()=>{});}
}
