import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {localOnlySalesSources} from '@/lib/sales/normal-review';
import {inspectLocalDocument,type LocalDocumentKind} from '@/lib/sales/local-document-check';
import {extractDocument} from '@/lib/admin/ai/document-extraction';
import {localOcrEnabled} from '@/lib/admin/ai/local-ocr-config';
export const runtime='nodejs';export const maxDuration=180;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={'Cache-Control':'no-store'};
 try{
  if(!localOcrEnabled(process.env))throw Error('not_enabled');
  if(request.headers.get('origin')!==new URL(request.url).origin)throw Error('forbidden');
  const body=await request.text();if(body.length>2000)throw Error('invalid_request');const input=JSON.parse(body);
  if(!['identity','registry','bank'].includes(input.kind)||typeof input.documentId!=='string')throw Error('invalid_request');
  const db=await createClient(),context=localOnlySalesSources(db,createAdminClient,(await params).id,[input.documentId]);
  const before=await context();if(before.sources.length!==1)throw Error('source_unreadable');
  const {localDocumentOcr}=await import('@/lib/admin/ai/local-ocr');
  const parsed=await extractDocument(before.sources[0],request.signal,{ocr:localDocumentOcr});
  const result=inspectLocalDocument(input.kind as LocalDocumentKind,parsed.segments.map(s=>s.text).join('\n'));
  const after=await context();if(before.snapshot!==after.snapshot||JSON.stringify(before.scope)!==JSON.stringify(after.scope))throw Error('source_changed');
  // No persistence, raw snippets, source hashes, model calls, or budget reservations.
  return Response.json(result,{headers});
 }catch(e){const code=e instanceof Error&&['forbidden','not_enabled','source_changed','invalid_request'].includes(e.message)?e.message:'source_unreadable';return Response.json({code,externalTransmission:false,status:'unreadable'},{status:code==='forbidden'?403:409,headers});}
}
