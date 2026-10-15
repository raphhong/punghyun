import { createClient } from '@/lib/supabase/server';
import { createHash, randomUUID } from 'node:crypto';
import { SOURCE_SHA, VERSION } from '@/lib/admin/srb/template';

export const runtime='nodejs';
const templatePath=`contract-templates/${VERSION}/${SOURCE_SHA}.docx`;
async function context(id:string){
  const db=await createClient();const {data:{user},error}=await db.auth.getUser();
  if(error||!user)throw new Error('UNAUTHORIZED');
  const admin=await db.from('admins').select('user_id').eq('user_id',user.id).maybeSingle();
  if(admin.error||!admin.data)throw new Error('FORBIDDEN');
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('NOT_FOUND');
  const customer=await db.from('customers').select('id').eq('id',id).maybeSingle();
  if(customer.error||!customer.data)throw new Error('NOT_FOUND');
  return {db,user};
}
function failure(e:unknown){const s=e instanceof Error?e.message:'처리 실패';return Response.json({error:s},{status:s==='UNAUTHORIZED'?401:s==='FORBIDDEN'?403:s==='NOT_FOUND'?404:400});}
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;const {db}=await context(id);const action=new URL(req.url).searchParams.get('action');
    if(action==='template'){
      const {data,error}=await db.storage.from('customer-docs').download(templatePath);
      if(error||!data)return Response.json({error:'최종본을 한 번 등록해주세요.'},{status:404});
      return new Response(await data.arrayBuffer(),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Cache-Control':'private, no-store'}});
    }
    if(action==='draft'){
      const folder=`${id}/srb-drafts/${VERSION}`;
      const listing=await db.storage.from('customer-docs').list(folder,{limit:1,sortBy:{column:'name',order:'desc'}});
      if(listing.error)throw listing.error;
      if(!listing.data?.length)return Response.json({draft:null});
      const read=await db.storage.from('customer-docs').download(`${folder}/${listing.data[0].name}`);
      if(read.error)throw read.error;
      return new Response(await read.data.text(),{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
    }
    return Response.json({error:'지원하지 않는 요청'},{status:400});
  }catch(e){return failure(e);}
}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;const {db,user}=await context(id);
    const action=new URL(req.url).searchParams.get('action');
    if(action==='template'){
      const buffer=await req.arrayBuffer();if(buffer.byteLength>3000000)throw new Error('3MB 이하 문서만 등록할 수 있습니다.');
      if(createHash('sha256').update(Buffer.from(buffer)).digest('hex')!==SOURCE_SHA)throw new Error('등록 대상은 확인된 5차 최종본만 가능합니다. 원본 파일을 선택해주세요.');
      const prior=await db.storage.from('customer-docs').download(templatePath);
      if(prior.data)return Response.json({ok:true,version:VERSION});
      const up=await db.storage.from('customer-docs').upload(templatePath,buffer,{contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',upsert:false});
      if(up.error)throw up.error;
      return Response.json({ok:true,version:VERSION});
    }
    if(action==='draft'){
      const raw=await req.text();if(raw.length>500000)throw new Error('작성 데이터가 너무 큽니다.');
      const draft=JSON.parse(raw);
      if(draft.version!==VERSION||draft.sourceHash!==SOURCE_SHA||!draft.values||!Array.isArray(draft.devices))throw new Error('서식 버전 또는 작성 데이터가 잘못되었습니다.');
      if(!['contract','contract-guarantee','commencement','guarantee','preliminary'].includes(draft.mode))throw new Error('작성 단계 오류');
      if(Object.values(draft.values).some(v=>typeof v!=='string'||v.length>20000))throw new Error('입력값 오류');
      if(!Number.isInteger(draft.rentalMonths)||draft.rentalMonths<1||draft.rentalMonths>120)throw new Error('기간 오류');
      const savedAt=new Date().toISOString();
      // Immutable drafts preserve old versions; never overwrite signed documents or payment facts.
      const path=`${id}/srb-drafts/${VERSION}/${savedAt.replace(/:/g,'-')}_${randomUUID()}.json`;
      const data={draft:{version:VERSION,sourceHash:SOURCE_SHA,mode:draft.mode,values:draft.values,devices:draft.devices,rentalMonths:draft.rentalMonths,customerId:id,savedAt,savedBy:user.id,signatureStatus:'not_requested',guaranteeValidityStatus:'not_reviewed'}};
      const up=await db.storage.from('customer-docs').upload(path,JSON.stringify(data),{contentType:'application/json',upsert:false});
      if(up.error)throw up.error;
      return Response.json({ok:true,savedAt});
    }
    return Response.json({error:'지원하지 않는 요청'},{status:400});
  }catch(e){return failure(e);}
}
