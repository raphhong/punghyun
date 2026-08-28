-- 만기·정산 필드 추가 (Phase C)
-- 인수가 · 완전 비소구 확인 · 매각(처분) 실적
-- 이미 schema.sql을 실행한 프로젝트라면 이 파일을 SQL Editor에서 한 번 실행하세요.

alter table public.customers
  add column if not exists acquisition_price      bigint,  -- 인수가 (만기 인수 시 금액)
  add column if not exists non_recourse_confirmed boolean not null default false, -- 완전 비소구 확인
  add column if not exists sale_proceeds          bigint,  -- 매각(처분) 대금 실적
  add column if not exists sale_date              date;    -- 매각(처분) 일자
