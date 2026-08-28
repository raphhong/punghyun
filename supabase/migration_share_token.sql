-- 영업자 제출 링크용 공유 토큰 추가
-- 이미 schema.sql을 실행한 프로젝트라면 이 파일을 SQL Editor에서 한 번 실행하세요.

alter table public.customers
  add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists customers_share_token_idx
  on public.customers (share_token);
