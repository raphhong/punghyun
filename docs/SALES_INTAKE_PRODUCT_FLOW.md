# 영업자 상품별 접수 동선 개선 — 로컬 검증

기준 원격 main: e1bc5c91cf9118defaaec7e04fe3fa1d85863d8d (PR22). 개발 시작 때 GitHub 읽기 및 git fetch로 대조했다.
브랜치: codex/sales-intake-product-flow-20261026.
작업 폴더: C:\Users\sol hong\Documents\Codex\2026-10-26\task\punghyun-intake-release-20261026.

## 동작

- /sales의 기존 고객 등록 링크 → /sales/new에서 일반렌탈 / 초단기렌탈 명시 선택. 기존 고객 중복등록 방지 안내.
- 선택 후 공통 고객 등록. 기존 sales_agent_id와 인입 저장 필드는 유지. 상품은 새 DB 컬럼으로 저장하지 않으며 계약/접수 상품을 전환하지 않는다.
- 등록 후 ?product=standard 또는 short로 고객 상세 안내 영역에 이동. 기존 상세 직접 진입은 상품 미선택 상태이며 선택 전에 복사 버튼을 노출하지 않는다.
- 상세에서 선택한 상품의 링크·안내문·고객 화면 확인 링크를 함께 표시. 초단기는 /s/{token}/seven-day, 일반은 /s/{token}. 초단기는 최초 자료 재사용/이번 거래/조건부 자료를 분리하며 일반의 전체서류 안내를 섞지 않는다.
- 일반 고객 제출 화면 제목에 일반렌탈을 명시. 초단기 고객 화면은 기존 초단기렌탈 제목과 3단계 유지.
- 영업자 상세의 기존 스크리닝 자료는 일반렌탈 기존 자료라고 표시하며 삭제하지 않는다.
- 선택은 이번 안내 용도이며 새로고침/재방문 시 URL에 있는 선택만 복원된다. DB의 상품 상태로 간주하지 않는다.

## 변경 범위와 검증

실행 로직은 상품 입력값 검증과 등록 성공 후 이동 경로만 변경. 승인된 영업자 확인, 고객 소유권, insert 필드, 기존 수정/삭제/수납/계약 로직은 보존. SQL/RLS/새 권한/금액·요율 계산/자산결 변경 없음.
사업 불변성 manifest는 의도적으로 변경된 sales/actions.ts의 LF 기준 SHA만 갱신했다. 다른 항목은 갱신하지 않았다.

- 타입 tsc --noEmit 통과.
- 변경 실행 파일 ESLint 통과.
- Next production build 통과 (.validation/sales-flow-build.log).
- 관련 테스트14개 모두 통과 (.validation/sales-flow-focused.log). 선택 누락/변조, 영업자 미승인, 기존 담당자 유지, 상품 필드 DB 미저장, 두 상품 링크·안내 일치, 실제 일반 고객 페이지의 token 조회 범위 포함.
- 전체 *.test.mjs 실행은 추가 테스트2개 전 175개/168통과/7실패. 실패 이름은 기존 main에서 확인된7개와 동일: Python 부재1, CRLF 바이트 검사4, 기존 DocGallery 선택자2. 최초 바이트 비교 실패는 변경하지 않은 next.config.ts에서 발생. 전체 통과로 보고하지 않는다.
- 로컬 합성 브라우저: 실제 신규 페이지에서 초단기 선택 → 합성 등록 → 실제 ProductShare의 초단기 선택 유지 → 안내문/링크 클립보드 복사 → 실제 SevenDayIntake 고객 화면 확인. 일반 전환 후 일반 링크와 안내문 복사도 확인. UI에서 운영 API를 mock했으며 실제 고객 생성·수납·서류 업로드 없음.
- 일반 고객 전체 화면은 실제 서버 컴포넌트의 합성 렌더 테스트로 확인. 브라우저 fixture의 일반 도착 화면은 경로 확인용이므로 운영 전체 UI 검증으로 간주하지 않는다.
- 합성 UI 증거: .validation/sales-flow-short-guide.png. 테스트 harness는 .validation/sales-flow-ui*.tsx/mjs, 포트4320; 운영 서버가 아니다.

## 게시 상태

이번 UX 변경은 로컬 개발만. 원격 게시/PR/병합/배포/DB변경을 시도하지 않았다. 이전 github_create_tree 자동검토 거절을 우회하거나 재시도하지 않았다. 원래 접수 기능은 PR22로 main에 반영됐지만 이 후속 UX는 미반영이다. 향후 게시 범위는 위 화면·이동·안내문·테스트·문서만이며 DB migration은 필요 없다. 클라우드 환경 설정은 이 로컬 UX 결과에 포함되지 않는다.
