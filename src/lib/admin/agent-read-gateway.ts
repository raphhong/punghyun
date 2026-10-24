import {createHash,timingSafeEqual} from 'node:crypto';
export type ReadGatewayConfig={enabled?:string;hash?:string;issued?:string;expires?:string};
export const CUSTOMER_READ_FIELDS=['id','updated_at','stage','hospital_name','representative','intake_date','inspection_date','contract_date','maturity_date','funding_scheduled_date','funding_done','contract_sent','contract_done','internal_review_done','unpaid'] as const;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stages=new Set(['intake','screening_1','screening_2','screening_3','inspection','contract','funding','operation','maturity','closed']);
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
export async function customerReadPage(request:Request,config:ReadGatewayConfig,read:(after:string|null,limit:number)=>Promise<unknown>,now=Date.now()) {
  if(request.method!=='GET')return reply({error:'method_not_allowed'},405);
  const issued=Date.parse(config.issued??''),expires=Date.parse(config.expires??'');
  if(config.enabled!=='true'||!/^[a-f0-9]{64}$/.test(config.hash??'')||!Number.isFinite(issued)||!Number.isFinite(expires)||issued>now||expires<=now||expires<=issued||expires-issued>7*86400000)
    return reply({error:'unavailable'},503);
  const auth=request.headers.get('authorization')??'';
  if(!/^Bearer [A-Za-z0-9_-]{43,128}$/.test(auth)||!timingSafeEqual(createHash('sha256').update(auth.slice(7)).digest(),Buffer.from(config.hash!,'hex')))
    return reply({error:'unauthorized'},401);
  const q=new URL(request.url).searchParams,after=q.get('after');
  if([...q.keys()].some(k=>k!=='after')||q.getAll('after').length>1||(after!==null&&!uuid.test(after)))return reply({error:'invalid_query'},400);
  try {
    const raw=await read(after,21);
    if(!Array.isArray(raw)||raw.length>21)throw new Error();
    let previous=after?.toLowerCase()??'';
    const rows=raw.map(r=>{
      if(!r||typeof r.id!=='string'||!uuid.test(r.id)||r.id.toLowerCase()<=previous||!stages.has(r.stage)||typeof r.updated_at!=='string'||!Number.isFinite(Date.parse(r.updated_at)))throw new Error();
      previous=r.id.toLowerCase();
      const out:Record<string,unknown>={};
      for(const key of CUSTOMER_READ_FIELDS){
        const v=r[key];
        if(['funding_done','contract_sent','contract_done','internal_review_done','unpaid'].includes(key)){
          if(typeof v!=='boolean')throw new Error();
        }else if(v!==null&&(typeof v!=='string'||v.length>500))throw new Error();
        out[key]=v;
      }
      return out;
    });
    const page=rows.slice(0,20);
    return reply({version:1,cases:page,next:rows.length>20?page[19].id:null,
      audience:'owner_private_dm',owner_slack_id:'U0BTLCJ0JUQ',
      content_trust:'untrusted_evidence',business_execution_allowed:false});
  }catch{return reply({error:'read_unavailable'},503);}
}
