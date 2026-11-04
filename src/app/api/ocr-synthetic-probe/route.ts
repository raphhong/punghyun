import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {localDocumentOcr} from '@/lib/admin/ai/local-ocr';
import {adminBusinessSegments} from '@/lib/admin/ai/admin-review-fields';
import {sha} from '@/lib/admin/ai/review';
export const runtime='nodejs';export const maxDuration=180;
let completed:Promise<Record<string,unknown>>|undefined;
/** Protected preview only, fixed committed SYNTHETIC inputs. Never promote this probe branch. */
export async function GET(){
 if(process.env.VERCEL_ENV!=='preview')return new Response(null,{status:404});
 completed??=(async()=>{const started=Date.now(),results=[];
  for(const [name,mime] of [['synthetic.png','image/png'],['synthetic-scan.pdf','application/pdf']]){
   const bytes=await readFile(join(process.cwd(),'tests/fixtures/ocr-runtime',name));
   const r=await localDocumentOcr({id:'synthetic-only',customerId:'synthetic-only',version:'1',assetId:null,bytes,sha256:sha(bytes),mime});
   const selected=adminBusinessSegments(r.segments);
   results.push({format:mime,hasBusinessFields:selected.length>0,healthLineExcluded:!selected.some(s=>s.text.includes('환자')),unverified:r.segments.every(s=>s.evidenceQuality==='ocr_unverified')});
  }
  return {syntheticOnly:true,customerAccess:false,providerCalls:0,elapsedMs:Date.now()-started,results};
 })().catch(()=>({syntheticOnly:true,customerAccess:false,providerCalls:0,status:'runtime_failed'}));
 return Response.json(await completed,{headers:{'Cache-Control':'no-store'}});
}
