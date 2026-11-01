import type {TrustedTenantConfig} from './policy';
import {triageConnectionOptions,type TriageConnection} from './triage-driver';
type Input=Record<string,string|undefined>;
export function triageEnvironment(e:Input){
 if(e.ADMIN_TRIAGE_ENABLED!=='true')return null;
 try{
  if(e.VERCEL_ENV!=='preview'||e.VERCEL_GIT_COMMIT_REF!=='codex/standard-contract-preparation-v51'||e.NEXT_PUBLIC_SUPABASE_URL!=='https://zatlumldeqhghhrsgtdq.supabase.co')throw Error();
  const scope=JSON.parse(e.ADMIN_TRIAGE_SCOPE_JSON??'') as TrustedTenantConfig;
  const db=JSON.parse(e.ADMIN_TRIAGE_DB_CONFIG??'') as Omit<TriageConnection,'password'>;
  const connection={...db,password:e.ADMIN_TRIAGE_DB_PASSWORD??''};triageConnectionOptions(connection);
  if(scope.projectRef!=='zatlumldeqhghhrsgtdq'||!scope.version||!scope.tenantId||!Array.isArray(scope.allowedActorIds)||!scope.allowedActorIds.length||!scope.customers||typeof scope.customers!=='object')throw Error();
  if(Object.values(scope.customers).some(c=>!c||!Array.isArray(c.caseIds)||c.caseIds.length!==1||!c.caseIds[0]||!Array.isArray(c.assetIds)))throw Error();
  return {scope,connection};
 }catch{throw Error('triage_configuration_required');}
}
