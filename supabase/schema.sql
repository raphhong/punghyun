-- 풍현 어드민 DB 스키마
-- Supabase 프로젝트의 SQL Editor에 붙여넣어 실행하세요.

-- ── 확장 ────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── ENUM 타입 ───────────────────────────────────────────
do $$ begin
  create type customer_source as enum ('homepage', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type customer_stage as enum (
    'intake',       -- 고객 인입
    'screening_1',  -- 1차 안내 (별도 채널)
    'screening_2',  -- 2차 안내
    'screening_3',  -- 3차 안내
    'inspection',   -- 실사 및 구조설계
    'contract',     -- 계약
    'funding',      -- 자금집행
    'operation',    -- 운영관리
    'maturity',     -- 만기처리
    'closed'        -- 종료(보관)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type hospital_type as enum ('individual', 'corporate'); -- 개인/법인
exception when duplicate_object then null; end $$;

do $$ begin
  create type maturity_result as enum ('acquire', 'return', 're_rental'); -- 인수/반납/재렌탈
exception when duplicate_object then null; end $$;

-- ── customers 테이블 ────────────────────────────────────
create table if not exists public.customers (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  source                customer_source not null default 'manual',
  stage                 customer_stage  not null default 'intake',
  share_token           uuid not null default gen_random_uuid(), -- 영업자 제출 링크 토큰

  -- 기본 정보 (인입/1차)
  representative        text,           -- 대표자
  phone                 text,           -- 연락처
  email                 text,           -- 이메일
  hospital_name         text,           -- 상호(업체명)
  hospital_type         hospital_type,  -- 고객유형(개인/법인)
  needed_funds          text,           -- 필요자금

  -- 일자
  intake_date           date,           -- 인입일자
  contract_date         date,           -- 계약일자
  maturity_date         date,           -- 만기일자

  -- 실사 및 구조설계
  inspection_date       date,           -- 실사 일정
  execution_amount      bigint,         -- 집행금액
  rental_price          bigint,         -- 렌탈가
  internal_review_done  boolean not null default false, -- 내부 심의

  -- 계약
  contract_sent         boolean not null default false, -- 계약서 전송 완료
  contract_done         boolean not null default false, -- 계약 완료

  -- 자금집행
  funding_scheduled_date date,          -- 집행 예정 일자
  funding_done          boolean not null default false, -- 집행 완료
  funding_done_date     date,           -- 집행 완료 일자

  -- 운영관리
  payment_1             boolean not null default false, -- 1회차 납부
  payment_2             boolean not null default false, -- 2회차 납부
  payment_3             boolean not null default false, -- 3회차 납부
  unpaid                boolean not null default false, -- 미납

  -- 만기처리
  maturity_result       maturity_result,-- 인수/반납/재렌탈
  acquisition_price     bigint,         -- 인수가 (만기 인수 시 금액)
  non_recourse_confirmed boolean not null default false, -- 완전 비소구 확인
  sale_proceeds         bigint,         -- 매각(처분) 대금 실적
  sale_date             date,           -- 매각(처분) 일자

  internal_memo         text            -- 내부메모
);

create index if not exists customers_stage_idx on public.customers (stage);
create index if not exists customers_created_at_idx on public.customers (created_at desc);
create unique index if not exists customers_share_token_idx on public.customers (share_token);

-- ── customer_documents 테이블 (서류/사진 체크리스트) ──────
create table if not exists public.customer_documents (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  category     text not null,          -- screening_2 | screening_3 등
  doc_key      text not null,          -- business_registration 등
  checked      boolean not null default false,
  file_path    text,                   -- Storage 내 경로
  uploaded_at  timestamptz,
  unique (customer_id, doc_key)
);

create index if not exists customer_documents_customer_idx
  on public.customer_documents (customer_id);

-- ── updated_at 자동 갱신 트리거 ─────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ── RLS (로그인한 관리자만 접근) ────────────────────────
alter table public.customers enable row level security;
alter table public.customer_documents enable row level security;

drop policy if exists "authenticated full access" on public.customers;
create policy "authenticated full access" on public.customers
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access docs" on public.customer_documents;
create policy "authenticated full access docs" on public.customer_documents
  for all to authenticated using (true) with check (true);

-- 참고: 공홈 인입은 서버(Service Role Key)로 삽입하므로 anon 정책이 필요 없습니다.

-- ── Storage 버킷 (서류/사진, 비공개) ────────────────────
insert into storage.buckets (id, name, public)
values ('customer-docs', 'customer-docs', false)
on conflict (id) do nothing;

drop policy if exists "authenticated read docs" on storage.objects;
create policy "authenticated read docs" on storage.objects
  for select to authenticated using (bucket_id = 'customer-docs');

drop policy if exists "authenticated write docs" on storage.objects;
create policy "authenticated write docs" on storage.objects
  for insert to authenticated with check (bucket_id = 'customer-docs');

drop policy if exists "authenticated update docs" on storage.objects;
create policy "authenticated update docs" on storage.objects
  for update to authenticated using (bucket_id = 'customer-docs');

drop policy if exists "authenticated delete docs" on storage.objects;
create policy "authenticated delete docs" on storage.objects
  for delete to authenticated using (bucket_id = 'customer-docs');
