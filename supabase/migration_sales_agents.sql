-- 영업자 조직(계층) + 내부 관리자 권한 분리 마이그레이션
-- Supabase 프로젝트의 SQL Editor에서 한 번 실행하세요.
-- (schema.sql 을 이미 실행한 프로젝트 기준)

create extension if not exists "pgcrypto";

-- ══════════════════════════════════════════════════════════
--  1) admins : 내부 풍현 관리자
-- ══════════════════════════════════════════════════════════
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

-- 현재 존재하는 모든 auth 유저를 관리자로 시드.
-- (지금은 영업자가 없으므로 로그인 계정 = 전부 내부 관리자)
insert into public.admins (user_id, email)
select id, email from auth.users
on conflict (user_id) do nothing;

-- 관리자 여부 헬퍼
create or replace function public.is_admin(uid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where a.user_id = uid);
$$;

-- ══════════════════════════════════════════════════════════
--  2) sales_agents : 영업자 조직 (무제한 트리)
-- ══════════════════════════════════════════════════════════
do $$ begin
  create type sales_agent_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.sales_agents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique references auth.users(id) on delete set null,
  parent_id    uuid references public.sales_agents(id) on delete set null,
  ancestor_ids uuid[] not null default '{}',   -- 루트→부모 조상 id들 (본인 제외). 서브트리·집계용
  name         text not null,
  phone        text,
  email        text,
  status       sales_agent_status not null default 'pending',
  invite_token uuid not null default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  approved_at  timestamptz
);

create index if not exists sales_agents_parent_idx   on public.sales_agents (parent_id);
create index if not exists sales_agents_user_idx     on public.sales_agents (user_id);
create index if not exists sales_agents_ancestor_idx on public.sales_agents using gin (ancestor_ids);
create unique index if not exists sales_agents_invite_token_idx on public.sales_agents (invite_token);

-- 삽입 시 parent 로부터 ancestor_ids 자동 계산 (재부모화는 미지원)
create or replace function public.set_sales_agent_ancestors()
returns trigger language plpgsql as $$
declare parent_ancestors uuid[];
begin
  if new.parent_id is null then
    new.ancestor_ids := '{}';
  else
    select ancestor_ids into parent_ancestors from public.sales_agents where id = new.parent_id;
    new.ancestor_ids := coalesce(parent_ancestors, '{}') || new.parent_id;
  end if;
  return new;
end $$;

drop trigger if exists sales_agents_set_ancestors on public.sales_agents;
create trigger sales_agents_set_ancestors
  before insert on public.sales_agents
  for each row execute function public.set_sales_agent_ancestors();

-- 현재 로그인 유저의 (승인된) 영업자 id
create or replace function public.current_agent_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.sales_agents
  where user_id = auth.uid() and status = 'approved'
  limit 1;
$$;

-- 고객의 담당 영업자가 현재 영업자의 서브트리(본인 포함)에 속하는지
create or replace function public.customer_in_my_subtree(cust_agent uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case when cust_agent is null then false else exists (
    select 1 from public.sales_agents sa, public.sales_agents me
    where sa.id = cust_agent
      and me.user_id = auth.uid() and me.status = 'approved'
      and (sa.id = me.id or me.id = any(sa.ancestor_ids))
  ) end;
$$;

-- ══════════════════════════════════════════════════════════
--  3) customers 에 담당 영업자 연결
-- ══════════════════════════════════════════════════════════
alter table public.customers
  add column if not exists sales_agent_id uuid references public.sales_agents(id) on delete set null;
create index if not exists customers_sales_agent_idx on public.customers (sales_agent_id);

-- ══════════════════════════════════════════════════════════
--  4) RLS : 관리자=전체 / 영업자=자기 서브트리
-- ══════════════════════════════════════════════════════════
alter table public.admins        enable row level security;
alter table public.sales_agents  enable row level security;

-- admins (조회는 관리자만, 관리는 service role 로)
drop policy if exists "admin read admins" on public.admins;
create policy "admin read admins" on public.admins
  for select to authenticated using (public.is_admin(auth.uid()));

-- sales_agents
drop policy if exists "admin full access agents" on public.sales_agents;
create policy "admin full access agents" on public.sales_agents
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "agent read self and subtree" on public.sales_agents;
create policy "agent read self and subtree" on public.sales_agents
  for select to authenticated
  using (
    user_id = auth.uid()                       -- 본인(승인 전 포함)
    or id = public.current_agent_id()          -- 본인(승인 후)
    or public.current_agent_id() = any(ancestor_ids)  -- 내 하위
  );

-- customers : 기존 "authenticated 전체 허용" 정책 제거 후 세분화
drop policy if exists "authenticated full access" on public.customers;

drop policy if exists "admin full access customers" on public.customers;
create policy "admin full access customers" on public.customers
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "agent read subtree customers" on public.customers;
create policy "agent read subtree customers" on public.customers
  for select to authenticated
  using (public.customer_in_my_subtree(sales_agent_id));

drop policy if exists "agent insert own customers" on public.customers;
create policy "agent insert own customers" on public.customers
  for insert to authenticated
  with check (sales_agent_id = public.current_agent_id());

-- customer_documents : 기존 "authenticated 전체 허용" 제거 후 세분화
drop policy if exists "authenticated full access docs" on public.customer_documents;

drop policy if exists "admin full access docs" on public.customer_documents;
create policy "admin full access docs" on public.customer_documents
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "agent read subtree docs" on public.customer_documents;
create policy "agent read subtree docs" on public.customer_documents
  for select to authenticated
  using (exists (
    select 1 from public.customers c
    where c.id = customer_documents.customer_id
      and public.customer_in_my_subtree(c.sales_agent_id)
  ));

-- 참고:
--  · 공개 제출(/s/[token])·공홈 인입은 Service Role Key(RLS 우회)로 동작하므로 영향 없음.
--  · Storage(customer-docs) 서명 URL은 서버에서 서브트리 확인 후 발급 (Phase 2).
