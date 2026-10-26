# 초단기렌탈 영업자 경유 전용 수정

기준: main `440346bfa32cfde61c698d7b4853015acd4461d6` (PR23).

## 수정 범위

- 공개 `/contact`의 초단기 신규접수 배너 제거.
- 공개 `/seven-day`는 DB 조회 없이 `notFound()`로 종료. 쿼리에 토큰을 넣어도 접수 화면을 제공하지 않음.
- `submitSevenDayIntake`는 null/누락/빈 값/형식 오류 토큰을 DB 접근 전에 거부. 유효 형식도 기존 고객 share_token 조회에 성공해야 RPC 실행. 토큰 없는 privileged-client 생성 분기 제거.
- 고객별 `/s/{token}/seven-day`의 접수·사진·자료 재사용 및 장비 소유권 검증 유지. SevenDayIntake의 token prop을 필수로 변경.
- 관리자 접수 목록의 공개 신규 링크를 `/sales/new?product=short`로 변경. 기존 승인 영업자 등록 절차를 사용.
- 일반렌탈, 고객 데이터, 계약, 원장, 자료, SQL, RLS, secret 설정, 자산결 관련 코드 변경 없음.

## 격리 검증

- `node --test tests/short-rental-intake.test.mjs tests/sales-intake-product.test.mjs`: 19/19 통과.
- 직접 action 함수 호출: 정상 payload라도 토큰 없으면 거부, privileged DB client/RPC 호출 0회. 정상 고객 토큰은 원래 request/token으로 RPC 호출. 외부 장비와 잘못된/존재하지 않는 토큰 거부.
- 실제 컴포넌트 합성 렌더: 공개 화면 차단, 정상 고객 토큰의 접수·사진 유지, 일반 상담 폼 유지.
- 영업자 상품 선택/승인/고객 등록/안내 링크, 일반 고객 token 범위 기존 테스트 통과. 일반 상담 API는 fetch를 mock하여 외부 발송 없이 검증.
- `npx tsc --noEmit`, 변경 TS/TSX 파일 ESLint, `git diff --check` 통과.
- `npm run build` 성공. 기존 middleware 폐기 예정 경고 및 Google Fonts DNS 실패 경고가 있었으나 빌드 종료 코드 0.
- 빌드된 로컬 서버 HTTP: `/seven-day`와 token 쿼리 변형 404, `/s/bad/seven-day` 404, `/contact` 200 및 일반 상담 폼 유지.
- 빌드의 실제 action ID로 로컬 HTTP POST: token=null/빈 문자열/bad 모두 오류 반환. 유효 payload를 사용했으며 실제 DB나 외부 메일을 호출하지 않음.
- 전체 `node --test tests/*.test.mjs tests/*.test.cjs`: 203개 중 200 통과, 3 실패. 수정 전 main을 별도 디렉터리에 추출해 동일 실행: 198개 중 195 통과, 같은 3 실패. 기존 DocGallery PDF/PNG 렌더 검사 2개와 sales-other-documents 테스트 로더의 ProductShare.tsx 해석 실패 1개. 전체 통과로 간주하지 않음.

## 운영 반영 범위

이 변경은 앱 코드 배포만 필요하다. 신규 SQL/접근권한/secret 변경은 필요 없으며 실행하지 않는다. 기존 SQL 초안에는 service_role 전용 RPC의 null-token 분기가 남아 있지만 이번 앱 action에서는 도달할 수 없다. 익명/일반 인증 역할의 RPC 실행은 기존 SQL에서 revoke되어 있다. 운영 DB의 실제 권한을 변경하거나 검사한 결과로 해석하면 안 된다.

운영 가짜 신청·외부 발송 없이 테스트했다. 정상 토큰/존재하지 않는 UUID 검증은 합성 DB 응답 기반이며 운영 고객 링크를 열거나 수정하지 않았다. 원격 PR/병합/배포 상태는 별도 작업 결과에서 확인한다. 로컬 검증 성공만으로 운영 수정 완료를 뜻하지 않는다.
