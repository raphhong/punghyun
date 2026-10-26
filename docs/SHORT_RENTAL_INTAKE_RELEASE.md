# 초단기렌탈 접수 전용 배포 범위

기준 원격 main: `277d7b6a7f3afbeb7cb17d2141e08377d9938f5f`.
독립 작업 디렉터리: `punghyun-intake-release-20261026`.
브랜치: `codex/seven-day-intake-release-20261026`.

## 포함하는 기능

- `/seven-day`: 신규 고객 3단계 접수. 기존 고객 조회/매칭 없음. 이름·연락처가 기존 고객과 같아도 기존 행을 덮어쓰지 않는다. 담당자가 공통 고객 목록에서 중복 가능성을 확인한다.
- `/s/[token]/seven-day`: 기존 고객 전용 링크. 기존 `/s/[token]`와 같은 bearer token을 검증해 해당 고객 범위만 읽는다. 새 장비 또는 해당 고객의 기존 장비를 선택한다. 토큰/고객 ID/내부 증빙은 익명 신규 화면에 반환하지 않는다.
- 최초 4종은 변경/만료 또는 기존 제출자료 확인 요청을 구분한다. 유효성을 확인한 기존 7일 계약 자료가 있을 때만 변경 없음 재사용 옵션을 제공한다. 계약 테이블이 없는 접수 단독 배포에서는 이를 확인 완료로 간주하지 않고 담당자 확인 요청으로 처리한다.
- 개인정보/신용조회·제공, 개인보증, 사전확약, 담보 해소, 임대인 협조는 해당 가능성/미해당 인지/담당자 확인 필요로 기록한다. 고객의 답변을 법률 동의나 보증으로 전환하지 않는다.
- 기존 링크에서는 해당 고객 장비의 변경 사진만 선택적으로 추가한다. JPEG/PNG/WebP 최대 10MB. 기존 사진은 삭제·교체하지 않는다. 신분증·인감증명 사본, 다년 재무자료, 세금완납, 임대차의 일괄 필수 업로드를 추가하지 않았다.
- `/ph-console-8f27x/seven-day-intakes`: 관리자만 읽는 전용 접수 목록. 공통 고객·장비 및 기존 거래로 연결한다. 기존 영업자 하위조직 권한이나 기존 상품의 수정 액션은 변경하지 않는다.
- 표시 상품명/메뉴명은 `초단기렌탈`. 7일은 희망 이용기간 설명이다. 희망 시작일만 저장하고 실제 계약 기산일·종료시각을 계산하거나 확정하지 않는다.

## 제외하는 기능

수납원장 등록, paid_count 변경, 기존 cashflow 집계 변경, 신규 계약 테이블·계약 확정·체결용 출력·법적 자동발송은 이 브랜치에 포함하지 않는다. 계약 v0/v02 본문을 코드에 삽입하지 않았다. 운영 검증용 신청이나 가짜 고객도 생성하지 않는다.

## 별도 승인 필요한 정확한 DB 변경

검토 SQL: `supabase/drafts/20261026_short_rental_intake.sql`. 아직 운영 적용하지 않았다. 기존 contract/receipt 마이그레이션 없이 독립적으로 적용할 수 있다.

1. 새 테이블 `public.short_rental_intakes`: `request_id uuid PRIMARY KEY`, `customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT`, `device_id uuid REFERENCES customer_devices(id) ON DELETE RESTRICT`, `source text CHECK(new/existing)`, `payload jsonb`, `created_at timestamptz DEFAULT now()`.
2. 새 함수 `public.submit_short_rental_intake(uuid,uuid,jsonb) RETURNS jsonb`, `SECURITY INVOKER`. 신규 고객/장비/접수를 하나의 트랜잭션으로 추가하고 요청 UUID로 반복 제출을 방지한다. 기존 고객·장비는 수정하지 않는다. 동일 연락처 신규접수는 하루 3건으로 제한한다.
3. 테이블 RLS 활성화. `short_rental_intakes_admin_read` SELECT 정책: authenticated 중 `public.is_admin(auth.uid())`만 허용.
4. 새 테이블의 anon/authenticated/service_role 기본 권한을 REVOKE한 후 authenticated에는 SELECT만, service_role에는 SELECT/INSERT만 부여한다. 함수의 PUBLIC/anon/authenticated 실행 권한을 REVOKE하고 service_role에만 EXECUTE를 부여한다.

기존 customers/customer_devices/customer_documents/Storage 권한은 변경하지 않는다. 서버 역할의 기존 SELECT/INSERT 권한과 기존 is_admin 정의가 전제다. 기존 역할의 정확한 ACL은 운영 적용 전 읽기 확인이 필요하다. 새 계정·자격증명·공개 버킷·익명 직접 DB 접근은 요구하지 않는다.

화면 배포 승인은 받았으나 위 새 RLS/GRANT는 별도 승인 대상이다. 미적용 상태에서는 신규 화면에 준비 중 안내만 표시하며, 저장 성공을 가장하지 않는다. 운영 활성화 전에 승인된 SQL 적용과 실제 역할 권한 확인이 필요하다.

## 검증 및 한계

- 타입 검사, 기본 Next 프로덕션 빌드, 새 접수 파일 lint 통과. 의존성은 같은 작업에서 이미 설치된 버전을 복사했으며 새 패키지를 설치하지 않았다.
- 접수 단위/접근 테스트 8개 통과. 기존 main 전체 테스트의 7개 실패는 Python 실행기 부재 1개, CRLF 바이트 비교 4개, 기존 purchase-intent DocGallery 선택자 2개다. 기존 상품 액션·로그인·공통 원장 파일은 변경하지 않았다.
- PGlite 합성 통합 검증: 20개 반복 요청으로 고객/장비/접수 각 1건, 기존 고객과 동일 전화번호에도 기존 행 불변, 잘못된 토큰·다른 고객 장비·만료 자료 거부, 계약 테이블 없는 단독 접수, 익명 조회/직접 RPC와 비관리자 조회 차단 통과.
- 브라우저 합성 UI 검증: 신규 3단계 제출, 기존 장비 선택, 자료 재사용/담당자 확인 요청, 모바일 검토 화면, 명칭 및 계약기간 미확정 표시 확인. 실제 운영 제출은 하지 않는다.
- 실제 PostgREST 다중 연결 동시성, 실제 운영 ACL 및 저장 요청은 미검증이다. PGlite 결과는 이를 대신하지 않는다.

## 계약서 파일 경계

Library 가이드/계약 v02(version1)의 텍스트는 지원 읽기 도구로 확인했다. Library 지정 전송 도우미는 PC에 Python 실행기가 없어 실행하지 못했으며 로컬 Word/PDF 파일은 materialize되지 않았다. 새 설치나 비지원 다운로드로 우회하지 않았다. 계약 파일 미확보와 무관하게 이 접수 배포 범위는 분리되어 있다.
