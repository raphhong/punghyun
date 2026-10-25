import { createClient } from '@/lib/supabase/server';
import type { Dependencies } from './gmail-connect';
import { GMAIL_SCOPE, INITIAL_ACCOUNTS } from './gmail-connect';
import { createAdminClient } from '@/lib/supabase/admin';
import { postgresStateStore } from './gmail-state-store';
import { accountVault, disconnectAccount } from './gmail-account-vault';
import { vaultStore } from './gmail-vault-store';
import { googleTransport } from './gmail-google-transport';
import type { ReadDependencies } from './gmail-read';
import { gmailMessages } from './gmail-message-transport';

// Off until explicitly configured after reviewed schema deployment. Secrets are
// read only inside this server module; never returned to a page/model/log.
export function gmailDependencies(): Dependencies & { disconnect?: (accountId: string) => Promise<string>; read?: ReadDependencies } {
  const deps: Dependencies & { disconnect?: (accountId: string) => Promise<string>; read?: ReadDependencies } = {
    config: { enabled: false, ownerId: '874162eb-d569-448b-bc8b-cf103cf46c1c' },
    async identity() {
      const db = await createClient();
      const { data: { user }, error } = await db.auth.getUser();
      if (error || !user) return null;
      return { id: user.id, email: user.email ?? '', verified: !!user.email_confirmed_at };
    },
  };
  if (process.env.GMAIL_CONNECT_ENABLED !== 'true') return deps;
  try {
    const key=process.env.GMAIL_VAULT_KEY_BASE64 ?? '';
    const clientId=process.env.GMAIL_OAUTH_CLIENT_ID ?? '';
    const clientSecret=process.env.GMAIL_OAUTH_CLIENT_SECRET ?? '';
    const labels=(process.env.GMAIL_BUSINESS_LABEL_IDS ?? '').split(',').filter(Boolean);
    if (!/^[A-Za-z0-9+/]{43}=$/.test(key) || !clientId.endsWith('.apps.googleusercontent.com') || !clientSecret ||
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://esapurmauiuwfzkmdijy.supabase.co') return deps;
    const db=createAdminClient();
    const rpc=(name:string,args:Record<string,unknown>)=>db.rpc(name,args);
    const vault=accountVault(Buffer.from(key,'base64'),process.env.GMAIL_VAULT_KEY_ID ?? '');
    const store=vaultStore(rpc,vault,labels);
    const transport=googleTransport(clientId,clientSecret);
    deps.states=postgresStateStore(rpc);deps.secrets=store.secrets;
    deps.exchange=transport.exchange;deps.profile=transport.profile;
    deps.config={...deps.config,enabled:true,clientId,accounts:INITIAL_ACCOUNTS};
    const context={owner:deps.config.ownerId!,accountId:'sol_hong',mailbox:'sol.hong@punghyun.com',scope:GMAIL_SCOPE};
    const scoped=()=>db.from('gmail_account_vault').select('owner_id,account_id,mailbox,scope,status,generation,label_ids,envelope')
      .eq('owner_id',context.owner).eq('account_id',context.accountId).eq('mailbox',context.mailbox).eq('scope',context.scope);
    deps.read={enabled:true,identity:deps.identity,open:vault.open,refresh:transport.refresh,profile:transport.profile,
      messages:gmailMessages(),
      async load(){
        const {data,error}=await scoped().maybeSingle(); if(error) throw new Error('store unavailable');
        return data ? {...context,status:data.status,generation:data.generation,labelIds:data.label_ids,envelope:data.envelope}:null;
      },
      async current(generation){
        const {data,error}=await db.from('gmail_account_vault').select('generation').eq('owner_id',context.owner)
          .eq('account_id',context.accountId).eq('mailbox',context.mailbox).eq('scope',context.scope)
          .eq('status','active').eq('generation',generation).eq('label_ids','{INBOX}').maybeSingle();
        return !error && !!data;
      },
      async rotate(row,token){
        const generation=row.generation+1;
        const {data,error}=await db.from('gmail_account_vault').update({envelope:vault.seal(context,token),generation,
          updated_at:new Date().toISOString()}).eq('owner_id',context.owner).eq('account_id',context.accountId)
          .eq('mailbox',context.mailbox).eq('scope',context.scope).eq('status','active').eq('generation',row.generation)
          .select('generation').maybeSingle();
        if(error || data?.generation!==generation) throw new Error('rotation unconfirmed');
        return generation;
      },
    };
    deps.disconnect=async accountId=>{
      // HTTP handler separately authenticates owner immediately before this call.
      const account=INITIAL_ACCOUNTS.find(a=>a.id===accountId);
      if(!account) throw new Error('account not allowed');
      return disconnectAccount({owner:deps.config.ownerId!,accountId,mailbox:account.email,scope:GMAIL_SCOPE},
        {authorizedOwner:deps.config.ownerId!,approvedAccounts:INITIAL_ACCOUNTS.map(a=>a.id),registry:store.registry,
          open:vault.open,revoke:transport.revoke});
    };
  } catch { return {...deps,config:{...deps.config,enabled:false}}; }
  return deps;
}
