-- 기기 단위 등록 (여러 기계를 한 회사에서 한 번에 등록)
-- 이미 schema.sql을 실행한 프로젝트라면 이 파일을 SQL Editor에서 한 번 실행하세요.

-- ── 기기 테이블 ─────────────────────────────────────────
create table if not exists public.customer_devices (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  model_name   text,             -- 모델명
  quantity     integer,          -- 수량(대)
  note         text,             -- 비고
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists customer_devices_customer_idx
  on public.customer_devices (customer_id);

-- ── 서류/사진에 기기 연결 (기기별 사진 그룹핑) ───────────
alter table public.customer_documents
  add column if not exists device_id uuid
    references public.customer_devices(id) on delete cascade;

create index if not exists customer_documents_device_idx
  on public.customer_documents (device_id);

-- ── RLS (로그인한 관리자만 접근 · 공개링크는 Service Role) ─
alter table public.customer_devices enable row level security;

drop policy if exists "authenticated full access devices" on public.customer_devices;
create policy "authenticated full access devices" on public.customer_devices
  for all to authenticated using (true) with check (true);
