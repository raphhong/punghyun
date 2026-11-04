-- Local candidate: deploy only after reviewed production definitions and write approval.
-- Preserves jobs, UNKNOWN states, lifetime counters and existing consent validation.
begin;
lock table public.sales_ai_budgets, public.sales_ai_transmission_grants, public.sales_ai_jobs in access exclusive mode;
do $$ begin
 if (select count(*) from public.sales_ai_budgets)<>1 then raise exception 'single_budget_required'; end if;
 if to_regclass('public.sales_reviewed_jobs') is not null then raise exception 'alternate_ledger_requires_review'; end if;
 if exists(select 1 from public.sales_ai_jobs where status='running') then raise exception 'drain_running_requests_first'; end if;
 if exists(select 1 from public.sales_ai_budgets b where b.reserved_calls<>(select count(*) from public.sales_ai_jobs) or b.reserved_microusd<>(select coalesce(sum(reserved_microusd),0) from public.sales_ai_jobs)) then raise exception 'budget_reconciliation_required'; end if;
end $$;
alter table public.sales_ai_budgets add column monthly_enabled boolean not null default false,
 add column monthly_limit_microusd bigint not null default 200000000 check(monthly_limit_microusd between 0 and 200000000);
-- clock_timestamp is evaluated by server after budget lock, never supplied by callers.
create function public.sales_ai_monthly_usage() returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.sales_ai_budgets%rowtype; started timestamptz; used numeric;
begin
 select * into b from public.sales_ai_budgets where singleton for share;
 if not found then return null; end if;
 started:=date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
 select coalesce(sum(j.reserved_microusd),0) into used from public.sales_ai_jobs j
 where j.created_at>=started or j.status in ('running','unknown');
 return jsonb_build_object('mode',case when b.monthly_enabled then 'monthly' else 'legacy' end,
 'limitMicrousd',b.monthly_limit_microusd,'usedMicrousd',used,'periodStart',started,
 'scope','punghyun_only','billingVerified',false);
end $$;
alter function public.sales_ai_reserve(uuid,uuid,uuid,text,text,uuid,text) rename to sales_ai_reserve_premonthly;
revoke all on function public.sales_ai_reserve_premonthly(uuid,uuid,uuid,text,text,uuid,text) from public,anon,authenticated,service_role;
create function public.sales_ai_reserve(p_grant uuid,p_actor uuid,p_customer uuid,p_snapshot text,p_scope text,p_key uuid,p_binding text)
returns uuid language plpgsql security definer set search_path='' as $$
declare b public.sales_ai_budgets%rowtype; g public.sales_ai_transmission_grants%rowtype; admitted timestamptz; used numeric; j uuid;
begin
 if p_grant is null or p_actor is null or p_customer is null or p_snapshot is null or p_scope is null or p_key is null or p_binding is null then return null; end if;
 select * into b from public.sales_ai_budgets where singleton for update;
 if not found then return null; end if;
 if not b.monthly_enabled then return public.sales_ai_reserve_premonthly(p_grant,p_actor,p_customer,p_snapshot,p_scope,p_key,p_binding); end if;
 select * into g from public.sales_ai_transmission_grants where id=p_grant for update;
 if not found or g.budget_id is distinct from b.id or g.reserve_microusd is null or g.reserve_microusd<=0 or g.reserve_microusd>1000000 then return null; end if;
 admitted:=clock_timestamp();
 select coalesce(sum(reserved_microusd),0) into used from public.sales_ai_jobs
 where created_at>=(date_trunc('month',admitted at time zone 'UTC') at time zone 'UTC') or status in ('running','unknown');
 if used+g.reserve_microusd>b.monthly_limit_microusd then return null; end if;
 -- Preserve legacy CHECK constraints and monotonic audit counters, without resetting them.
 -- These are lifetime high-water marks in monthly mode, not a separate spending grant.
 update public.sales_ai_budgets set max_calls=greatest(max_calls,reserved_calls+1),
 max_microusd=greatest(max_microusd,reserved_microusd+g.reserve_microusd) where id=b.id;
 j:=public.sales_ai_reserve_premonthly(p_grant,p_actor,p_customer,p_snapshot,p_scope,p_key,p_binding);
 if j is null then
  update public.sales_ai_budgets set max_calls=b.max_calls,max_microusd=b.max_microusd where id=b.id;
 else
  -- Original RPC defaults to transaction-start now(); a waiter may cross a month boundary.
  update public.sales_ai_jobs set created_at=admitted where id=j;
 end if;
 return j;
end $$;
revoke all on function public.sales_ai_monthly_usage(),public.sales_ai_reserve(uuid,uuid,uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.sales_ai_monthly_usage(),public.sales_ai_reserve(uuid,uuid,uuid,text,text,uuid,text) to service_role;
create function public.sales_ai_revoke_consent(p_grant uuid,p_actor uuid,p_customer uuid,p_snapshot text,p_scope text)
returns boolean language plpgsql security definer set search_path='' as $$
declare bid uuid;
begin
 select budget_id into bid from public.sales_ai_transmission_grants where id=p_grant;
 if not found then return false; end if;
 perform 1 from public.sales_ai_budgets where id=bid for share;
 update public.sales_ai_transmission_grants set active=false
 where id=p_grant and actor_id=p_actor and customer_id=p_customer and snapshot=p_snapshot and scope_hash=p_scope;
 return found;
end $$;
revoke all on function public.sales_ai_revoke_consent(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.sales_ai_revoke_consent(uuid,uuid,uuid,text,text) to service_role;
commit;
