import {createBoundedReviewRuntime} from './bounded-rpc';
type Config=Omit<Parameters<typeof createBoundedReviewRuntime>[0],'documentId'|'approvalId'>&{resolveApprovalId?:(documentId:string)=>Promise<string>};
/** Server route bridge: current SSR client and route customer supplied by server composition.
 * No approval, actor, tenant, release plan, cost, or result can be asserted by request JSON. */
export function createBoundedReviewEndpoint(config:Config){return async(request:Request)=>{
 const headers={'Cache-Control':'no-store','Pragma':'no-cache'};
 try{
  if(!['GET','POST'].includes(request.method)||request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({code:'forbidden'},{status:403,headers});
  let documentId:unknown,forward=request;
  if(request.method==='GET'){const u=new URL(request.url);if([...u.searchParams.keys()].some(k=>k!=='documentId')||u.searchParams.getAll('documentId').length!==1)throw Error('invalid_request');documentId=u.searchParams.get('documentId');}
  else{
   const reader=request.body?.getReader();if(!reader)throw Error('invalid_request');let size=0,text='';const decoder=new TextDecoder();
   for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>4096){await reader.cancel();throw Error('invalid_request');}text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();
   const body=JSON.parse(text);if(!body||typeof body!=='object'||Object.keys(body).some(k=>!['action','documentIds','key','sourceSnapshot'].includes(k))||!Array.isArray(body.documentIds)||body.documentIds.length!==1)throw Error('invalid_request');documentId=body.documentIds[0];
   forward=new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(body),signal:request.signal});
  }
  if(typeof documentId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(documentId))throw Error('invalid_request');
  const approvalId=config.resolveApprovalId?await config.resolveApprovalId(documentId):undefined;return createBoundedReviewRuntime({...config,documentId,approvalId})(forward);
 }catch(e){const code=e instanceof Error&&['approval_required','forbidden','repository_unavailable'].includes(e.message)?e.message:'invalid_request';return Response.json({code,financialApproval:false,automaticRetryAllowed:false},{status:code==='forbidden'?403:code==='invalid_request'?400:503,headers});}
};}
