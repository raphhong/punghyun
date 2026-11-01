import {Pool,type PoolConfig} from 'pg';
type Client={query(sql:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[]}>;release(destroy?:boolean):void};
type DriverPool={connect():Promise<Client>;end():Promise<void>;on(event:'error',fn:()=>void):unknown};
export type TriageConnection={projectRef:string;host:string;port:5432|6543;mode:'direct'|'transaction_pooler';user:string;password:string};
export function triageConnectionOptions(c:TriageConnection):PoolConfig{
 const project='zatlumldeqhghhrsgtdq',role='admin_triage_executor';
 if(c.projectRef!==project||typeof c.password!=='string'||!c.password||c.password.includes('\0'))throw Error('triage_connection_configuration');
 const direct=c.mode==='direct'&&c.host==='db.'+project+'.supabase.co'&&c.port===5432&&c.user===role;
 const pooler=c.mode==='transaction_pooler'&&/^[a-z0-9-]+\.[a-z0-9-]+\.pooler\.supabase\.com$/.test(c.host)&&c.port===6543&&c.user===role+'.'+project;
 if(!direct&&!pooler)throw Error('triage_connection_configuration');
 return {host:c.host,port:c.port,user:c.user,password:c.password,database:'postgres',ssl:{rejectUnauthorized:true,servername:c.host},max:2,connectionTimeoutMillis:5000,idleTimeoutMillis:10000,statement_timeout:15000,query_timeout:20000,application_name:'admin-triage-preview'};
}
/** Server-only. Actual pooler host must be copied from approved Connect metadata, never inferred. */
export function createTriageDriver(c:TriageConnection,factory:(c:PoolConfig)=>DriverPool=config=>new Pool(config)){
 const pool=factory(triageConnectionOptions(c));pool.on('error',()=>{});let closed=false,closing:Promise<void>|undefined;const pending=new Set<Promise<unknown>>();
 return {transaction<T>(fn:(client:Client)=>Promise<T>):Promise<T>{
  if(closed)return Promise.reject(Error('triage_store_closed'));
  const task=(async()=>{let client:Client|undefined;let commitStarted=false,failed=false;try{client=await pool.connect();await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='3s'");const value=await fn(client);commitStarted=true;await client.query('COMMIT');return value;}catch(e){failed=true;if(client&&!commitStarted)try{await client.query('ROLLBACK');}catch{}const code=e instanceof Error?e.message:'';if(commitStarted)throw Error('triage_commit_unknown');throw Error(['forbidden','invalid_request','context_changed','triage_conflict','source_changed','review_required'].includes(code)?code:'triage_unavailable');}finally{client?.release(failed);}})();
  pending.add(task);void task.finally(()=>pending.delete(task)).catch(()=>{});return task;
 },close(){if(!closing){closed=true;closing=(async()=>{await Promise.allSettled([...pending]);try{await pool.end();}catch{throw Error('triage_close_failed');}})();}return closing;}};
}
