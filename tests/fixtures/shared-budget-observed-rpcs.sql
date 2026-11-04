-- Catalog metadata only; all inserted test rows are synthetic. No production rows.
create schema auth;create table auth.users(id uuid primary key);create table public.customers(id uuid primary key);
create table public.sales_ai_budgets(id uuid not null,allocation_approved boolean not null default false,allocation_manifest_hash text not null,allocation_expires_at timestamp with time zone not null,owner_policy jsonb,policy_revision integer not null default 0,singleton boolean not null default true,max_calls integer not null,max_microusd bigint not null,reserved_calls integer not null,reserved_microusd bigint not null);
alter table public.sales_ai_budgets add constraint sales_ai_budgets_allocation_manifest_hash_check CHECK ((allocation_manifest_hash ~ '^[a-f0-9]{64}$'::text));
alter table public.sales_ai_budgets add constraint sales_ai_budgets_check CHECK (((reserved_calls <= max_calls) AND (reserved_microusd <= max_microusd)));
alter table public.sales_ai_budgets add constraint sales_ai_budgets_max_calls_check CHECK ((max_calls > 0));
alter table public.sales_ai_budgets add constraint sales_ai_budgets_max_microusd_check CHECK ((max_microusd > 0));
alter table public.sales_ai_budgets add constraint sales_ai_budgets_pkey PRIMARY KEY (id);
alter table public.sales_ai_budgets add constraint sales_ai_budgets_policy_revision_check CHECK ((policy_revision >= 0));
alter table public.sales_ai_budgets add constraint sales_ai_budgets_reserved_calls_check CHECK ((reserved_calls >= 0));
alter table public.sales_ai_budgets add constraint sales_ai_budgets_reserved_microusd_check CHECK ((reserved_microusd >= 0));
alter table public.sales_ai_budgets add constraint sales_ai_budgets_singleton_check CHECK (singleton);
alter table public.sales_ai_budgets add constraint sales_ai_budgets_singleton_key UNIQUE (singleton);
alter table public.sales_ai_budgets enable row level security;
create table public.sales_ai_transmission_grants(id uuid not null,budget_id uuid not null,policy_revision integer not null,consent jsonb not null,actor_id uuid not null,customer_id uuid not null,snapshot text not null,scope_hash text not null,active boolean not null default false,expires_at timestamp with time zone not null,release jsonb not null,model text not null,max_output_tokens integer not null,max_request_bytes integer not null,timeout_ms integer not null,reserve_microusd bigint not null);
alter table public.sales_ai_transmission_grants add constraint sales_ai_transmission_grants_actor_id_customer_id_snapshot__key UNIQUE (actor_id, customer_id, snapshot, scope_hash, policy_revision);
alter table public.sales_ai_transmission_grants add constraint sales_ai_transmission_grants_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);
alter table public.sales_ai_transmission_grants add constraint sales_ai_transmission_grants_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES sales_ai_budgets(id);
alter table public.sales_ai_transmission_grants add constraint sales_ai_transmission_grants_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id);
alter table public.sales_ai_transmission_grants add constraint sales_ai_transmission_grants_max_output_tokens_check CHECK (((max_output_tokens >= 1) AND (max_output_tokens <= 4000)));
alter table public.sales_ai_transmission_grants add constraint sales_ai_transmission_grants_max_request_bytes_check CHECK (((max_request_bytes >= 1000) AND (max_request_bytes <= 8388608)));
alter table public.sales_ai_transmission_grants add constraint sales_ai_transmission_grants_pkey PRIMARY KEY (id);
alter table public.sales_ai_transmission_grants add constraint sales_ai_transmission_grants_policy_revision_check CHECK ((policy_revision > 0));
alter table public.sales_ai_transmission_grants add constraint sales_ai_transmission_grants_reserve_microusd_check CHECK ((reserve_microusd > 0));
alter table public.sales_ai_transmission_grants add constraint sales_ai_transmission_grants_scope_hash_check CHECK ((scope_hash ~ '^[a-f0-9]{64}$'::text));
alter table public.sales_ai_transmission_grants add constraint sales_ai_transmission_grants_snapshot_check CHECK ((snapshot ~ '^[a-f0-9]{64}$'::text));
alter table public.sales_ai_transmission_grants add constraint sales_ai_transmission_grants_timeout_ms_check CHECK (((timeout_ms >= 1) AND (timeout_ms <= 60000)));
alter table public.sales_ai_transmission_grants enable row level security;
create table public.sales_ai_jobs(id uuid not null default gen_random_uuid(),grant_id uuid not null,actor_id uuid not null,customer_id uuid not null,snapshot text not null,scope_hash text not null,idempotency_key uuid not null,binding text not null,status text not null,result jsonb,diagnostic jsonb,reserved_microusd bigint not null,created_at timestamp with time zone not null default now(),finished_at timestamp with time zone);
alter table public.sales_ai_jobs add constraint sales_ai_jobs_actor_id_customer_id_snapshot_scope_hash_key UNIQUE (actor_id, customer_id, snapshot, scope_hash);
alter table public.sales_ai_jobs add constraint sales_ai_jobs_actor_id_idempotency_key_key UNIQUE (actor_id, idempotency_key);
alter table public.sales_ai_jobs add constraint sales_ai_jobs_check CHECK (((status = 'completed'::text) = (result IS NOT NULL)));
alter table public.sales_ai_jobs add constraint sales_ai_jobs_diagnostic_check CHECK (((diagnostic IS NULL) OR (octet_length((diagnostic)::text) <= 40000)));
alter table public.sales_ai_jobs add constraint sales_ai_jobs_grant_id_fkey FOREIGN KEY (grant_id) REFERENCES sales_ai_transmission_grants(id);
alter table public.sales_ai_jobs add constraint sales_ai_jobs_pkey PRIMARY KEY (id);
alter table public.sales_ai_jobs add constraint sales_ai_jobs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'unknown'::text, 'completed'::text])));
alter table public.sales_ai_jobs enable row level security;
grant select on sales_ai_budgets,sales_ai_jobs,sales_ai_transmission_grants to service_role;grant insert on sales_ai_transmission_grants to service_role;
CREATE OR REPLACE FUNCTION public.sales_ai_finish(p_job uuid, p_actor uuid, p_customer uuid, p_snapshot text, p_scope text, p_result jsonb, p_diagnostic jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE j public.sales_ai_jobs%ROWTYPE; g public.sales_ai_transmission_grants%ROWTYPE; b public.sales_ai_budgets%ROWTYPE;
BEGIN
 IF p_job IS NULL OR p_actor IS NULL OR p_customer IS NULL OR p_snapshot IS NULL OR p_scope IS NULL THEN RETURN false; END IF;
 SELECT * INTO j FROM public.sales_ai_jobs WHERE id=p_job;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO g FROM public.sales_ai_transmission_grants WHERE id=j.grant_id;
 SELECT * INTO b FROM public.sales_ai_budgets WHERE id=g.budget_id FOR SHARE;
 SELECT * INTO g FROM public.sales_ai_transmission_grants WHERE id=j.grant_id FOR SHARE;
 SELECT * INTO j FROM public.sales_ai_jobs WHERE id=p_job FOR UPDATE;
 IF NOT FOUND OR j.actor_id IS DISTINCT FROM p_actor OR j.customer_id IS DISTINCT FROM p_customer OR j.snapshot IS DISTINCT FROM p_snapshot OR j.scope_hash IS DISTINCT FROM p_scope THEN RETURN false; END IF;
 -- Completed results are immutable; late failure handling cannot erase them.
 IF j.status='completed' THEN RETURN p_result IS NULL OR j.result=p_result; END IF;
 IF j.status<>'running' THEN RETURN p_result IS NULL; END IF;
 IF p_result IS NOT NULL THEN
  SELECT * INTO g FROM public.sales_ai_transmission_grants WHERE id=j.grant_id FOR SHARE;
  IF NOT COALESCE(b.allocation_approved AND b.allocation_expires_at>clock_timestamp() AND g.active AND g.expires_at>clock_timestamp() AND b.policy_revision=g.policy_revision AND b.owner_policy->'active'='true'::jsonb AND (b.owner_policy->>'expiresAt')::bigint>extract(epoch from clock_timestamp())*1000,false) THEN RETURN false; END IF;
  IF (p_result->>'sourceSnapshot' = p_snapshot AND p_result->>'mode' = 'live' AND p_result->'financialApproval' = 'false'::jsonb) IS DISTINCT FROM true THEN RETURN false; END IF;
 END IF;
 UPDATE public.sales_ai_jobs SET status=CASE WHEN p_result IS NULL THEN 'unknown' ELSE 'completed' END,result=p_result,diagnostic=p_diagnostic,finished_at=clock_timestamp() WHERE id=j.id;
 RETURN true;
END $function$
;
revoke all on function public.sales_ai_finish(uuid,uuid,uuid,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.sales_ai_finish(uuid,uuid,uuid,text,text,jsonb,jsonb) to service_role;
CREATE OR REPLACE FUNCTION public.sales_ai_reserve(p_grant uuid, p_actor uuid, p_customer uuid, p_snapshot text, p_scope text, p_key uuid, p_binding text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g public.sales_ai_transmission_grants%ROWTYPE; b public.sales_ai_budgets%ROWTYPE; j uuid; u jsonb;
BEGIN
 -- One immutable environment allocation, one lock order: budget -> grant -> job.
 SELECT budget_id INTO j FROM public.sales_ai_transmission_grants WHERE id=p_grant;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO b FROM public.sales_ai_budgets WHERE id=j FOR UPDATE;
 IF NOT FOUND OR NOT b.allocation_approved OR b.allocation_expires_at<=clock_timestamp() THEN RETURN NULL; END IF;
 SELECT * INTO g FROM public.sales_ai_transmission_grants WHERE id=p_grant FOR UPDATE;
 IF NOT FOUND OR g.budget_id<>b.id OR NOT g.active OR g.expires_at<=clock_timestamp() OR g.actor_id<>p_actor OR g.customer_id<>p_customer OR g.snapshot<>p_snapshot OR g.scope_hash<>p_scope THEN RETURN NULL; END IF;
 IF NOT FOUND OR NOT COALESCE(b.policy_revision=g.policy_revision AND b.owner_policy->'active'='true'::jsonb
 AND (b.owner_policy->>'expiresAt')::bigint>extract(epoch from clock_timestamp())*1000
 AND g.model=b.owner_policy->>'model' AND g.max_output_tokens<=(b.owner_policy->>'maxOutputTokens')::integer
 AND g.max_request_bytes<=(b.owner_policy->>'maxRequestBytes')::integer AND g.timeout_ms<=(b.owner_policy->>'timeoutMs')::integer
 AND g.release->>'policyVersion'=b.id::text||':'||b.policy_revision::text AND g.release->>'scopeHash'=p_scope
 AND g.consent->'confirmed'='true'::jsonb AND g.consent->>'snapshot'=p_snapshot
 AND g.consent->>'actorId'=p_actor::text AND g.consent->>'customerId'=p_customer::text
 AND (g.consent->>'expiresAt')::bigint>extract(epoch from clock_timestamp())*1000,false) THEN RETURN NULL; END IF;
 u:=public.sales_ai_shared_usage();
 IF (u->>'calls')::integer<>b.reserved_calls OR (u->>'microusd')::bigint<>b.reserved_microusd THEN RAISE EXCEPTION 'budget_reconciliation_required'; END IF;
 IF (u->>'calls')::integer+1>b.max_calls OR (u->>'microusd')::bigint+g.reserve_microusd>b.max_microusd THEN RETURN NULL; END IF;
 INSERT INTO public.sales_ai_jobs(grant_id,actor_id,customer_id,snapshot,scope_hash,idempotency_key,binding,status,reserved_microusd)
 VALUES(g.id,p_actor,p_customer,p_snapshot,p_scope,p_key,p_binding,'running',g.reserve_microusd)
 ON CONFLICT DO NOTHING RETURNING id INTO j;
 IF j IS NULL THEN RETURN NULL; END IF;
 UPDATE public.sales_ai_budgets SET reserved_calls=reserved_calls+1,reserved_microusd=reserved_microusd+g.reserve_microusd WHERE id=b.id;
 RETURN j;
END $function$
;
revoke all on function public.sales_ai_reserve(uuid,uuid,uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.sales_ai_reserve(uuid,uuid,uuid,text,text,uuid,text) to service_role;
CREATE OR REPLACE FUNCTION public.sales_ai_shared_usage()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('calls',count(*),'microusd',coalesce(sum(reserved_microusd),0),'scope','this_database_only','billingVerified',false)
 FROM public.sales_ai_jobs;
$function$
;
revoke all on function public.sales_ai_shared_usage() from public,anon,authenticated;
grant execute on function public.sales_ai_shared_usage() to service_role;
