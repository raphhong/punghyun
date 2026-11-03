import {prepareDocumentVision,type WholeVisualApproval} from '../admin/ai/document-vision-input';
import {documentVisionResult} from '../admin/ai/document-vision-result';
import {captureSyntheticResponse} from '../admin/ai/vision-server';
import {contentContract} from '../admin/ai/content-contract';
import type {Source} from '../admin/ai/review';
/** Same supported whole-file builder/result validator as the bounded adapter.
 * Still synthetic-only. Text-range consent never authorizes PDF/image bytes. */
export async function prepareNormalVision(source:Source,approval:WholeVisualApproval){
 return prepareDocumentVision({...source,bytes:Buffer.from(source.bytes)},approval,Date.now(),contentContract);
}
export async function sendNormalVision(input:{prepared:Awaited<ReturnType<typeof prepareNormalVision>>;source:Source;snapshot:string;key:string;signal:AbortSignal;timeoutMs:number;transport?:typeof fetch;diagnostic:(v:unknown)=>void}){
 const r=await(input.transport??fetch)('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+input.key},body:input.prepared.json,signal:AbortSignal.any([input.signal,AbortSignal.timeout(input.timeoutMs)]),redirect:'error'});
 input.diagnostic({httpStatus:r.status,stage:'provider_headers'});
 if(!r.ok){await r.body?.cancel();throw Error('provider_outcome_unknown');}
 const reader=r.body?.getReader();if(!reader)throw Error('provider_outcome_unknown');const chunks:Buffer[]=[];let size=0;
 for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>200000){await reader.cancel();throw Error('provider_outcome_unknown');}chunks.push(Buffer.from(chunk.value));}
 const bytes=Buffer.concat(chunks),quarantine=captureSyntheticResponse(bytes,input.key);
 input.diagnostic({httpStatus:r.status,stage:'response_quarantined',quarantine});
 if(quarantine.status==='credential_redacted')throw Error('provider_outcome_unknown');
 // Diagnostics remain server-only; GET exposes solely validated, unverified visual claims.
 const raw=JSON.parse(bytes.toString('utf8'));
 return documentVisionResult(raw,input.source,input.prepared.source.pages,input.snapshot,contentContract);
}
