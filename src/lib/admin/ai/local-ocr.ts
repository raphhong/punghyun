import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {createWorker,OEM,type Worker} from 'tesseract.js';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {sha,type Source,type Segment} from './review';
const requireLocal=createRequire(join(process.cwd(),'package.json'));
const MAX_PIXELS=4000000,MAX_TOTAL=8000000,MAX_PAGES=3;
let occupied=false;
/** No uploads, provider calls, customer-file cache, or runtime language downloads. */
function imageSize(bytes:Buffer,mime:string){
 if(mime==='image/png'&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&bytes.subarray(12,16).toString()==='IHDR')return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
 if(mime==='image/jpeg'&&bytes.readUInt16BE(0)===0xffd8){let p=2;while(p<bytes.length-2){if(bytes[p++]!==255)break;while(bytes[p]===255)p++;const mark=bytes[p++];if(mark===0xda||mark===0xd9)break;if(mark===1||mark>=0xd0&&mark<=0xd7)continue;const size=bytes.readUInt16BE(p);if(size<2||p+size>bytes.length)break;if([0xc0,0xc1,0xc2].includes(mark)&&size>=8)return [bytes.readUInt16BE(p+5),bytes.readUInt16BE(p+3)];p+=size;}}
 throw Error('source_unreadable');
}
function bounded(w:number,h:number){if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||w*h>MAX_PIXELS)throw Error('source_unreadable');}
export async function localDocumentOcr(source:Source,signal?:AbortSignal){
 if(occupied)throw Error('ocr_runtime_unavailable');
 if(signal?.aborted)throw Error('cancelled');
 if(source.bytes.length<24||source.bytes.length>8*1024*1024||sha(source.bytes)!==source.sha256)throw Error('source_changed');
 if(!['application/pdf','image/png','image/jpeg'].includes(source.mime))throw Error('unsupported_format');
 occupied=true;let worker:Worker|undefined,expired=false;let languageDir:string|undefined;let disposePdf:(()=>Promise<void>)|undefined;
 let fail:(e:Error)=>void=()=>{};
 const stopped=new Promise<never>((_,reject)=>{fail=reject;});
 const stop=()=>{expired=true;void worker?.terminate();void disposePdf?.();fail(Error(signal?.aborted?'cancelled':'source_unreadable'));};
 const timer=setTimeout(stop,60000);signal?.addEventListener('abort',stop,{once:true});
 const check=()=>{if(expired||signal?.aborted)throw Error(signal?.aborted?'cancelled':'source_unreadable');};
 try{return await Promise.race([stopped,(async()=>{
  // Only public language-model files enter this private temporary directory; customer bytes stay in memory.
  languageDir=await mkdtemp(join(tmpdir(),'punghyun-ocr-models-'));
  await Promise.all(['kor','eng'].map(async code=>writeFile(join(languageDir!,code+'.traineddata.gz'),await readFile(join(dirname(requireLocal.resolve('@tesseract.js-data/'+code+'/package.json')),'4.0.0',code+'.traineddata.gz')))));
  check();const pending=createWorker('kor+eng',OEM.LSTM_ONLY,{langPath:languageDir,cacheMethod:'none',gzip:true,logger:()=>{},errorHandler:()=>{}});
  void pending.then(w=>{if(expired)void w.terminate();}).catch(()=>{});
  worker=await pending;check();await worker.setParameters({preserve_interword_spaces:'1'});
  const segments:Segment[]=[];let total=0;
  const recognize=async(png:Buffer,page:number)=>{check();const {data}=await worker!.recognize(png,{}, {text:true});check();if(!data.text.trim()||data.confidence<65||data.text.length>24000)throw Error('source_unreadable');segments.push({id:source.id+'-ocr-'+page,sourceId:source.id,version:source.version,sha256:source.sha256,assetId:source.assetId,text:data.text.trim(),locator:`${page}쪽 · OCR 원문 확인 필요`,evidenceQuality:'ocr_unverified'});};
  if(source.mime==='application/pdf'){
   const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
   const task=getDocument({data:new Uint8Array(source.bytes),maxImageSize:MAX_PIXELS,useWorkerFetch:false,useWasm:false,disableFontFace:true,useSystemFonts:false,verbosity:0,stopAtErrors:true});disposePdf=()=>task.destroy();
   const doc=await task.promise;check();if(doc.numPages<1||doc.numPages>MAX_PAGES||doc.isPureXfa||await doc.getPermissions()!==null||await doc.hasJSActions()||await doc.getAttachments()||await doc.getOpenAction())throw Error('source_unreadable');
   for(let n=1;n<=doc.numPages;n++){check();const page=await doc.getPage(n);if(await page.getJSActions()||(await page.getAnnotations()).length)throw Error('source_unreadable');const view=page.getViewport({scale:1.5}),w=Math.ceil(view.width),h=Math.ceil(view.height);bounded(w,h);total+=w*h;if(total>MAX_TOTAL)throw Error('source_unreadable');const canvas=createCanvas(w,h);try{await page.render({canvasContext:canvas.getContext('2d') as unknown as CanvasRenderingContext2D,viewport:view,canvas:null}).promise;await recognize(canvas.toBuffer('image/png'),n);}finally{canvas.width=1;canvas.height=1;page.cleanup();}}
  }else{const [w,h]=imageSize(Buffer.from(source.bytes),source.mime);bounded(w,h);const image=await loadImage(source.bytes);bounded(image.width,image.height);check();const canvas=createCanvas(image.width,image.height);try{canvas.getContext('2d').drawImage(image,0,0);await recognize(canvas.toBuffer('image/png'),1);}finally{canvas.width=1;canvas.height=1;}}
  return {segments,parserVersion:'local-tesseract-6.0.1-kor-eng-v1',issues:['OCR_UNVERIFIED_REVIEW_ORIGINAL']};
 })()]);}catch(e){if(e instanceof Error&&['source_changed','cancelled','unsupported_format'].includes(e.message))throw e;throw Error('source_unreadable');}
 finally{expired=true;clearTimeout(timer);signal?.removeEventListener('abort',stop);await worker?.terminate().catch(()=>{});await disposePdf?.().catch(()=>{});if(languageDir)await rm(languageDir,{recursive:true,force:true}).catch(()=>{});occupied=false;}
}
