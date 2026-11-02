// LOCAL TEST PRELOAD ONLY. Mocks Auth and OpenAI; translates only bounded RPC to isolated PostgreSQL.
const fs=require('fs'),{Pool}=require('pg');
const cfg=JSON.parse(fs.readFileSync(process.env.VISION_LOCAL_TEST_CONFIG));if(!/^vision_http_v119_[0-9]+$/.test(cfg.database))throw Error('local_database_required');
const db=new Pool({host:'/tmp/smoke-pg-socket',port:55492,user:'postgres',database:cfg.database});
const native=global.fetch;
global.fetch=async(input,init)=>{const req=new Request(input,init),url=new URL(req.url);
 if(['127.0.0.1','localhost'].includes(url.hostname))return native(input,init);
 if(url.hostname==='zatlumldeqhghhrsgtdq.supabase.co'){
  const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));}catch{}
  if(!claims||token.split('.')[2]!=='local-test-only')return Response.json({message:'invalid token'},{status:401});
  if(url.pathname==='/auth/v1/user')return Response.json({id:claims.sub,aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',app_metadata:{},user_metadata:{}});
  if(url.pathname==='/rest/v1/rpc/admin_vision_comparison_v119'){const p=await req.json(),c=await db.connect();try{await c.query('BEGIN;SET LOCAL ROLE authenticated');await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);const r=await c.query('select public.admin_vision_comparison_v119($1,$2,$3) r',[p.p_customer,p.p_action,p.p_data]);await c.query('COMMIT');const data=r.rows[0].r;const control=JSON.parse(fs.readFileSync(cfg.control));if(control.mode==='tamper_receipt'&&data.receipt)data.receipt.outcome='unknown';return Response.json(data);}catch(e){await c.query('ROLLBACK');return Response.json({message:e.message,code:'P0001'},{status:400});}finally{c.release();}}
  throw Error('unmocked_supabase_path');
 }
 if(url.href==='https://api.openai.com/v1/responses'){
  const body=await req.json(),ids=body.input[1].content.filter(x=>x.type==='input_text').map(x=>JSON.parse(x.text).imageId);
  fs.appendFileSync(cfg.events,JSON.stringify({kind:'mock_provider',ids,model:body.model})+'\n');
  const control=JSON.parse(fs.readFileSync(cfg.control));if(control.mode==='timeout')throw Error('synthetic_transport_timeout');
  if(control.mode==='revoke')await db.query("UPDATE public.admins SET user_id=$1 WHERE user_id=$2",['00000000-0000-4000-8000-000000000099',cfg.actor]);
  const readings=ids.map(id=>({imageId:id,field:'purchase.total',raw:'70,000',quote:'70,000',box:[880,274,174,54],status:'readable',unit:'unknown',vat:'unknown',period:'unknown'}));
  return Response.json({status:'completed',model:body.model,usage:{input_tokens:1000,output_tokens:100,total_tokens:1100},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({readings})}]}]});
 }
 throw Error('local_test_external_network_denied');
};
