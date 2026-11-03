import {prepareDocumentVision,type WholeVisualApproval} from './document-vision-input';
import {documentVisionResult} from './document-vision-result';
import {captureSyntheticResponse} from './vision-server';
import type {DocumentExtraction} from './document-extraction';
import {createHmac,hkdfSync,randomBytes,timingSafeEqual} from 'node:crypto';
import {boundedSyntheticTrial,responsesTransport} from './openai';
import {runReview,reviewSourceSnapshot,sha,schemaVersion,type Result,type Scope,type Source,type Segment} from './review';
import {readReviewResult} from './presentation';
import {sourceVersion} from './sources';
import {pdfParserVersion} from './pdf-text';
import {smokeEnvironment,smokeFixture} from './synthetic-smoke';

export const attachmentPolicy='synthetic-attachment-v98';
export type AttachmentPin={tenantId:string;customerId:string;documentId:string;assetId:string|null;uploadedAt:string;pathHash:string;bytesHash:string;objectSnapshot:string};
export type BudgetPolicy={id:string;revision:number;maxAttempts:number;maxMicrousd:number};
type Slot={budget?:BudgetPolicy;receiptReadable?:boolean;pin:AttachmentPin;permit:boolean;reserved:boolean;sameSession:boolean;binding:string|null;usedAttempts:number;reservedMicrousd:number;expiresAt:string;receipt:unknown;receiptMac:string|null};
type Usage={inputTokens:number;outputTokens:number;cachedInputTokens:number;conservativeCostUsd:number};
type Envelope={quarantine?:ReturnType<typeof captureSyntheticResponse>|null;policy:string;parser:string;codeBinding:string;actorHash:string;binding:string;pinHash:string;sourceSnapshot:string;outcome:'needs_review'|'provider_outcome_unknown';result:Result|null;usage:Usage|null};
export type AttachmentDiagnostic={stage:'start'|'source_verified'|'parse_start'|'parse_complete'|'reserved'|'dispatch_start'|'provider_headers'|'provider_usage'|'finish_start'|'finished'|'failure';elapsedMs:number;code?:string;httpStatus?:number;usage?:Usage};
export type AttachmentPorts={env:Record<string,string|undefined>;scope():Promise<Scope>;sources(ids:string[],scope:Scope):Promise<Source[]>;extract(s:Source,signal:AbortSignal):Promise<Segment[]>;rpc(action:'read'|'reserve'|'finish',documentId:string,cap?:string,receipt?:unknown,mac?:string):Promise<unknown>;transport?:typeof fetch;now?:()=>number;observe?:(event:AttachmentDiagnostic)=>void};
const codes=['forbidden','unauthorized','invalid_request','source_changed','context_changed','source_unavailable','source_unreadable','ocr_limit','ocr_timeout','ocr_runtime_unavailable','xlsx_runtime_unavailable','ocr_language_unavailable','unsupported_format','synthetic_source_required','attachment_not_configured','provider_not_configured','provider_outcome_unknown','receipt_unverified','budget_exhausted','attachment_expired','repository_unavailable','cancelled','minimization_required'];
const safe=(e:unknown)=>e instanceof Error&&codes.includes(e.message)?e.message:'repository_unavailable';
const hex=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const uuid=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
function exact(v:unknown,keys:string[]){return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.slice().sort().join();}
export function canonicalAttachment(v:unknown):string{
 if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);
 if(Array.isArray(v))return '['+v.map(canonicalAttachment).join(',')+']';
 if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonicalAttachment((v as Record<string,unknown>)[k])).join(',')+'}';
 throw Error('receipt_unverified');
}
export type RegisteredAttachmentProfile={reviewContract?:'document-review-v1';visualApproval?:WholeVisualApproval;extractDocument?:(source:Source,signal?:AbortSignal)=>Promise<DocumentExtraction>;selectedFields?:string[];policy:string;syntheticOnly:boolean;budget?:BudgetPolicy;pin:AttachmentPin;minimize:(segments:Segment[],scope:Scope)=>Promise<Segment[]>};
function slot(raw:unknown,scope:Scope,profile?:RegisteredAttachmentProfile):Slot{
 if(!exact(raw,['pin','permit','reserved','sameSession','binding','usedAttempts','reservedMicrousd','expiresAt','receipt','receiptMac',...(profile?.budget?['budget','receiptReadable']:[])]))throw Error('repository_unavailable');
 const r=raw as Slot,p=r.pin;
 if(!exact(p,['tenantId','customerId','documentId','assetId','uploadedAt','pathHash','bytesHash','objectSnapshot'])||p.tenantId!=='zatlumldeqhghhrsgtdq'||p.tenantId!==scope.tenantId||p.customerId!==scope.customerId||!uuid(p.documentId)||p.assetId!==null&&!uuid(p.assetId)||!Number.isFinite(Date.parse(p.uploadedAt))||!hex(p.pathHash)||!hex(p.objectSnapshot)||(!hex(p.bytesHash)||(!profile&&p.bytesHash!==smokeFixture.pdfHash)))throw Error('synthetic_source_required');
 if(typeof r.permit!=='boolean'||typeof r.reserved!=='boolean'||typeof r.sameSession!=='boolean'||!Number.isFinite(Date.parse(r.expiresAt))||(profile?.budget?(!Number.isSafeInteger(r.usedAttempts)||r.usedAttempts<0||!Number.isSafeInteger(r.reservedMicrousd)||r.reservedMicrousd<0||canonicalAttachment(r.budget)!==canonicalAttachment(profile.budget)||typeof r.receiptReadable!=='boolean'||r.receiptReadable&&(!r.reserved||!hex(r.binding))):(profile?((r.reserved?r.usedAttempts<9:![9,10].includes(r.usedAttempts))||r.reservedMicrousd!==4215360+(r.usedAttempts-9)*500000):(r.usedAttempts!==(r.reserved?9:8)||r.reservedMicrousd!==(r.reserved?4215360:3715360))))||r.permit&&(!r.reserved||!r.sameSession)||r.sameSession&&(!r.reserved||!hex(r.binding)))throw Error('repository_unavailable');
 if(profile&&canonicalAttachment(p)!==canonicalAttachment(profile.pin))throw Error('source_changed');
 return r;
}
function mac(key:string,body:Envelope){const derived=hkdfSync('sha256',key,'punghyun-attachment-v98','server-result-not-provider-attestation',32);return createHmac('sha256',Buffer.from(derived)).update(canonicalAttachment(body)).digest('hex');}
function usage(raw:unknown,maxOutput=1000):Usage{
 if(!raw||typeof raw!=='object')throw Error('provider_outcome_unknown');const u=raw as Record<string,unknown>,details=u.input_tokens_details as {cached_tokens?:number}|undefined;
 const i=u.input_tokens as number,o=u.output_tokens as number,c=details?.cached_tokens??0;
 if(![i,o,c].every(n=>Number.isSafeInteger(n)&&n>=0)||i>20000||o>maxOutput||c>i)throw Error('provider_outcome_unknown');
 return {inputTokens:i,outputTokens:o,cachedInputTokens:c,conservativeCostUsd:(i*2.5+o*15)/1000000};
}
/** The sole activation here is a DB-registered, byte-pinned synthetic PDF. No customer-document opt-in flag. */
export async function handleAttachmentReview(request:Request,p:AttachmentPorts,profile?:RegisteredAttachmentProfile){
 const policy=profile?.policy??attachmentPolicy;
 const headers={'Cache-Control':'no-store','Pragma':'no-cache'};
 let cap:string|null=null,initial:Scope|null=null,initialSlot:Slot|null=null,sourceSnapshot:string|null=null;
 let observedUsage:Usage|null=null;let visual:Awaited<ReturnType<typeof prepareDocumentVision>>|undefined;let quarantine:ReturnType<typeof captureSyntheticResponse>|undefined;
 const started=Date.now();const observe=(stage:AttachmentDiagnostic['stage'],extra:Pick<AttachmentDiagnostic,'code'|'httpStatus'|'usage'>={})=>{try{p.observe?.({stage,elapsedMs:Date.now()-started,...extra});}catch{/* Diagnostics never authorize or change the operation. */}};observe('start');
 let parserVersion=pdfParserVersion;let parsedDocument:DocumentExtraction|undefined;let codeBinding=sha([p.env.VERCEL_PROJECT_ID,p.env.VERCEL_GIT_COMMIT_REF,profile?'registered-verifier-v104:'+schemaVersion+':'+pdfParserVersion:p.env.VERCEL_GIT_COMMIT_SHA,policy].join(':'));
 const verifiedPredecessor=profile?null:sha([p.env.VERCEL_PROJECT_ID,p.env.VERCEL_GIT_COMMIT_REF,'1a87a99a0aecf93bae6cfe3c90b029ced2d117d4',attachmentPolicy].join(':'));
 try{
  if(!smokeEnvironment(p.env))throw Error('attachment_not_configured');
  if(!['GET','POST'].includes(request.method)||request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)throw Error('forbidden');
  let action='read',ids:string[],expectedSnapshot:string|undefined;
  if(request.method==='GET'){
   const url=new URL(request.url);if([...url.searchParams.keys()].some(k=>k!=='documentId')||url.searchParams.getAll('documentId').length!==1)throw Error('invalid_request');ids=[url.searchParams.get('documentId')!];
  }else{
   const reader=request.body?.getReader();if(!reader)throw Error('invalid_request');let bytes=0,text='';const decoder=new TextDecoder();
   for(;;){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;if(bytes>4096){await reader.cancel();throw Error('invalid_request');}text+=decoder.decode(item.value,{stream:true});}text+=decoder.decode();
   let b;try{b=JSON.parse(text);}catch{throw Error('invalid_request');}
   if(!b||typeof b!=='object'||Object.keys(b).some(k=>!['documentIds','key','action','sourceSnapshot'].includes(k))||!Array.isArray(b.documentIds)||b.documentIds.length!==1)throw Error('invalid_request');
   ids=b.documentIds;action=b.action??'run';expectedSnapshot=b.sourceSnapshot;
   if(!['run','verify'].includes(action)||action==='run'&&(typeof b.key!=='string'||!/^[-\w]{8,100}$/.test(b.key))||action==='verify'&&!hex(expectedSnapshot))throw Error('invalid_request');
  }
  if(ids.length!==1||!uuid(ids[0]))throw Error('invalid_request');
  initial=await p.scope();const scope=initial;
  const currentScope=async()=>{const now=await p.scope();if(canonicalAttachment(now)!==canonicalAttachment(scope))throw Error('context_changed');return now;};
  const read=async()=>{const r=slot(await p.rpc('read',ids[0]),scope,profile);if(r.pin.documentId!==ids[0])throw Error('synthetic_source_required');await currentScope();return r;};
  initialSlot=await read();
  const pinHash=sha(canonicalAttachment(initialSlot.pin));
  let verifiedReceiptSnapshot:string|null=null;
  const currentSources=async()=>{
   const current=await read();if(sha(canonicalAttachment(current.pin))!==pinHash)throw Error('source_changed');
   if(initialSlot?.reserved&&(!(current.sameSession||profile?.budget&&current.receiptReadable)||current.binding!==initialSlot.binding))throw Error('context_changed');
   if(verifiedReceiptSnapshot&&sha(canonicalAttachment([current.receipt,current.receiptMac]))!==verifiedReceiptSnapshot)throw Error('receipt_unverified');
   const values=await p.sources(ids,scope),pin=current.pin;
   if(values.length!==1)throw Error('source_changed');const s=values[0];
   if(s.id!==pin.documentId||s.customerId!==pin.customerId||s.assetId!==pin.assetId||s.sha256!==pin.bytesHash||sha(s.bytes)!==pin.bytesHash||s.version!==sourceVersion(pin.uploadedAt,pin.pathHash,pin.bytesHash)||(!profile?.extractDocument&&s.mime.split(';')[0]!=='application/pdf'))throw Error('source_changed');
   return values;
  };
  const sources=await currentSources();if(profile?.visualApproval){visual=await prepareDocumentVision({id:sources[0].id,customerId:sources[0].customerId,version:sources[0].version,mime:sources[0].mime,bytes:Buffer.from(sources[0].bytes)},profile.visualApproval,Date.now(),profile.reviewContract);parserVersion='document-vision-v1';codeBinding=sha([p.env.VERCEL_PROJECT_ID,p.env.VERCEL_GIT_COMMIT_REF,'registered-verifier-v104:'+schemaVersion+':'+parserVersion,policy].join(':'));}else if(profile?.extractDocument){parsedDocument=await profile.extractDocument(sources[0],request.signal);parserVersion=parsedDocument.parserVersion;codeBinding=sha([p.env.VERCEL_PROJECT_ID,p.env.VERCEL_GIT_COMMIT_REF,'registered-verifier-v104:'+schemaVersion+':'+parserVersion,policy].join(':'));}observe('source_verified');sourceSnapshot=reviewSourceSnapshot(scope,sources);const snapshot=sourceSnapshot;
  const recheck=async()=>{if(reviewSourceSnapshot(scope,await currentSources())!==snapshot)throw Error('source_changed');};
  const verified=(r:Slot):Envelope|null=>{
   try{
    if(!p.env.OPENAI_API_KEY||!(r.sameSession||profile?.budget&&r.receiptReadable)||!hex(r.receiptMac)||!exact(r.receipt,['policy','parser','codeBinding','actorHash','binding','pinHash','sourceSnapshot','outcome','result','usage',...(visual?['quarantine']:[])]))return null;
    const e=r.receipt as Envelope;
    if(e.policy!==policy||e.parser!==parserVersion||(e.codeBinding!==codeBinding&&e.codeBinding!==verifiedPredecessor)||e.actorHash!==sha(scope.actorId)||e.binding!==r.binding||e.pinHash!==pinHash||e.sourceSnapshot!==snapshot||!['needs_review','provider_outcome_unknown'].includes(e.outcome)||Buffer.byteLength(canonicalAttachment(e))>32000)return null;
    if(!timingSafeEqual(Buffer.from(r.receiptMac,'hex'),Buffer.from(mac(p.env.OPENAI_API_KEY,e),'hex')))return null;
    if(e.outcome==='needs_review'){
     const result=readReviewResult(e.result);if(result.mode!=='live'||result.sourceSnapshot!==snapshot||result.contentReview?.observations.some(o=>o.evidence.some(e=>e.sourceId!==sources[0].id||e.version!==sources[0].version||e.sha256!==sources[0].sha256))||result.facts.some(f=>f.sourceId!==sources[0].id||f.version!==sources[0].version||f.sha256!==sources[0].sha256||f.assetId!==sources[0].assetId))return null;
    }else if(e.result!==null)return null;
    verifiedReceiptSnapshot=sha(canonicalAttachment([r.receipt,r.receiptMac]));return e;
   }catch{return null;}
  };
  const respond=(e:Envelope)=>e.outcome==='needs_review'?Response.json({...e.result,...(e.parser===pdfParserVersion?{}:{extraction:{kind:e.parser==='document-vision-v1'?'vision':e.parser.startsWith('local-tesseract-tsv-v1-')?'ocr':'xlsx',parserVersion:e.parser,warnings:[],reviewRequired:true}}),receiptVerified:true,persistedResult:true,usage:e.usage,syntheticOnly:profile?.syntheticOnly??true},{headers}):Response.json({code:'provider_outcome_unknown',receiptVerified:true,persistedResult:true,usage:e.usage,automaticRetryAllowed:false},{status:409,headers});
  if(initialSlot.reserved){
   await recheck();const latest=await read(),e=verified(latest);await recheck();
   if(!e)throw Error(latest.receipt?'receipt_unverified':'provider_outcome_unknown');
   if(action==='verify'&&expectedSnapshot!==snapshot)throw Error('source_changed');
   return respond(e);
  }
  if(action==='verify')throw Error('receipt_unverified');
  if(action==='read'&&profile&&!initialSlot.reserved&&(initialSlot.usedAttempts>=(profile.budget?.maxAttempts??10)||!!profile.budget&&initialSlot.reservedMicrousd+500000>profile.budget.maxMicrousd))return Response.json({code:'budget_exhausted',financialApproval:false,automaticRetryAllowed:false},{status:429,headers});
  if(action==='read')return Response.json({state:Date.parse(initialSlot.expiresAt)<=(p.now?.()??Date.now())?'attachment_expired':p.env.OPENAI_API_KEY?'ready':'waiting_provider',syntheticOnly:profile?.syntheticOnly??true,financialApproval:false},{headers});
  if(!p.env.OPENAI_API_KEY)throw Error('provider_not_configured');
  if(Date.parse(initialSlot.expiresAt)<=(p.now?.()??Date.now()))throw Error('attachment_expired');
  let dispatches=0;
  const transport:typeof fetch=async(url,options)=>{
   if(dispatches++||request.signal.aborted)throw Error('provider_outcome_unknown');
   // runReview's beforeDispatch just completed the fresh bytes/scope/slot check.
   // No await or externally supplied callback occurs between that check and this transport.
   if(!initialSlot?.sameSession||!initialSlot.binding)throw Error('forbidden');
   if(options?.signal?.aborted||request.signal.aborted)throw Error('provider_outcome_unknown');
   observe('dispatch_start');const response=await(p.transport??fetch)(url,options);observe('provider_headers',{httpStatus:response.status});
   if(!response.ok){await response.body?.cancel();throw Error('provider_outcome_unknown');}
   const reader=response.body?.getReader();if(!reader)throw Error('provider_outcome_unknown');let size=0,text='';const decoder=new TextDecoder();
   for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>200000){await reader.cancel();throw Error('provider_outcome_unknown');}text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();
   if(visual){quarantine=captureSyntheticResponse(Buffer.from(text),p.env.OPENAI_API_KEY!);if(quarantine.status==='credential_redacted')throw Error('provider_outcome_unknown');}const raw=JSON.parse(text);if(raw.model!=='gpt-5.4-2026-03-05')throw Error('provider_outcome_unknown');observedUsage=usage(raw.usage,visual?4000:1000);observe('provider_usage',{usage:observedUsage});
   return new Response(text,{status:200,headers:{'Content-Type':'application/json'}});
  };
  const persist=async(result:Result|null)=>{
   await recheck();if(!cap||!initialSlot?.binding)throw Error('repository_unavailable');
   const envelope:Envelope={...(visual?{quarantine:quarantine??null}:{}),policy,parser:parserVersion,codeBinding,actorHash:sha(scope.actorId),binding:initialSlot.binding,pinHash,sourceSnapshot:snapshot,outcome:result?'needs_review':'provider_outcome_unknown',result,usage:observedUsage};
   const signed=mac(p.env.OPENAI_API_KEY!,envelope);
   observe('finish_start');const saved=slot(await p.rpc('finish',ids[0],cap,envelope,signed),scope,profile);
   if(!verified(saved)||canonicalAttachment(saved.receipt)!==canonicalAttachment(envelope))throw Error('repository_unavailable');
   await recheck();const latest=await read(),confirmed=verified(latest);if(!confirmed)throw Error('receipt_unverified');await recheck();observe('finished');return confirmed;
  };
  try{
   if(visual){
    await recheck();if(request.signal.aborted)throw Error('cancelled');cap=randomBytes(32).toString('hex');
    const reserved=slot(await p.rpc('reserve',ids[0],sha(cap)),scope,profile);if(!reserved.permit||!reserved.sameSession)throw Error('provider_outcome_unknown');initialSlot=reserved;
    await recheck();const response=await transport('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+p.env.OPENAI_API_KEY},body:visual.json,signal:AbortSignal.any([request.signal,AbortSignal.timeout(60000)]),redirect:'error'});
    const result=documentVisionResult(await response.json(),sources[0],visual.source.pages,snapshot,profile?.reviewContract);return respond(await persist(result));
   }
   let initialSourcesAvailable=true;
   const result=await runReview({policyVersion:policy+':'+parserVersion,scope:async()=>scope,sources:async()=>{if(initialSourcesAvailable){initialSourcesAvailable=false;return sources;}return currentSources();},
    extract:async s=>{observe('parse_start');const parsed=parsedDocument?.segments??await p.extract(s,request.signal);observe('parse_complete');return parsed;},minimize:async segments=>{
     if(profile)return profile.minimize(segments,scope);
     // One exact synthetic text page only. Extractor output is checked, never substituted with fixture text.
     if(segments.length!==1||segments[0].locator!=='page:1'||sha(segments[0].text)!==sha(smokeFixture.text))throw Error('synthetic_source_required');return segments;
    },model:responsesTransport({...boundedSyntheticTrial(p.env.OPENAI_API_KEY),...(profile?.reviewContract?{reviewContract:profile.reviewContract}:{}),...(profile?.selectedFields?{selectedFields:profile.selectedFields}:{})},transport),reserve:async()=>{
     await recheck();if(request.signal.aborted)throw Error('cancelled');cap=randomBytes(32).toString('hex');
     const reserved=slot(await p.rpc('reserve',ids[0],sha(cap)),scope,profile);if(!reserved.permit||!reserved.sameSession)throw Error('provider_outcome_unknown');initialSlot=reserved;observe('reserved');return true;
    }},ids,'attachment-single-v98',request.signal);
   if(parsedDocument&&parsedDocument.kind!=='text_pdf'){if(parsedDocument.warnings.includes('unreadable_page'))result.supplements.push({kind:'unreadable',sourceId:sources[0].id,field:''});}
   if(result.mode!=='live')throw Error('source_unreadable');
   return respond(await persist(result));
  }catch(e){
   if(cap&&initialSlot?.binding){try{await persist(null);}catch{/* A consumed slot stays consumed. Never fall back to unsigned results. */}}
   throw e;
  }
 }catch(e){const code=safe(e);observe('failure',{code});return Response.json({code,financialApproval:false,automaticRetryAllowed:false},{headers,status:['unauthorized'].includes(code)?401:code==='forbidden'?403:code==='invalid_request'?400:['source_changed','context_changed','provider_outcome_unknown','receipt_unverified','attachment_expired'].includes(code)?409:code==='budget_exhausted'?429:503});}
}
