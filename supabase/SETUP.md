# 풍현 어드민 — Supabase 연동 가이드

어드민 콘솔(`/ph-console-8f27x`)은 Supabase(Postgres + Auth + Storage)를 백엔드로 사용합니다.
아래 순서대로 5~10분이면 연결됩니다.

---

## 1. Supabase 프로젝트 생성

1. https://supabase.com 로그인 → **New project**
2. 이름(예: `punghyun-admin`), DB 비밀번호 설정, 리전은 **Northeast Asia (Seoul)** 권장
3. 생성 완료까지 1~2분 대기

## 2. DB 스키마 실행

1. 좌측 메뉴 **SQL Editor** → **New query**
2. 이 저장소의 [`supabase/schema.sql`](./schema.sql) 내용을 통째로 붙여넣기
3. **Run** 실행 → 테이블(`customers`, `customer_documents`), ENUM, RLS 정책,
   Storage 버킷(`customer-docs`)이 한 번에 생성됩니다.

## 3. API 키 확인

**Project Settings → API** 에서 아래 3개 값을 복사:

| 값 | 환경변수 |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` 키 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` 키 (비공개) | `SUPABASE_SERVICE_ROLE_KEY` |

## 4. 환경변수 설정

로컬은 `.env.example` 를 `.env.local` 로 복사 후 위 값 입력:

```bash
cp .env.example .env.local
```

Vercel 배포 시에는 **Project → Settings → Environment Variables** 에 동일하게 3개를 추가하고
재배포하세요.

## 5. 관리자 로그인 계정 생성

이메일/비밀번호로 로그인합니다. 회원가입 화면은 없으므로 계정은 직접 만듭니다.

1. Supabase 좌측 **Authentication → Users → Add user → Create new user**
2. 담당자 이메일 + 비밀번호 입력
3. **Auto Confirm User** 체크(이메일 인증 생략)
4. 저장 → 이 계정으로 `/ph-console-8f27x/login` 에서 로그인 가능

> 담당자가 여러 명이면 위 과정을 반복해 계정을 추가하면 됩니다.

## 6. 접속 확인

```bash
npm run dev
```

- 관리자 콘솔: `http://localhost:3000/ph-console-8f27x`
- 미로그인 상태면 자동으로 로그인 페이지로 이동합니다.

---

## 참고

- **URL 보안**: 콘솔 경로는 `/ph-console-8f27x` 로 숨겨져 있고, robots 로 검색 노출도 차단됩니다.
  경로만으로는 접근할 수 없고 반드시 로그인이 필요합니다. 경로를 바꾸려면
  `src/lib/admin/config.ts` 의 `ADMIN_BASE` 를 수정하세요.
- **RLS**: 로그인한(authenticated) 사용자만 데이터에 접근할 수 있도록 정책이 걸려 있습니다.
- **파일 저장**: 서류/사진은 비공개 버킷 `customer-docs` 에 저장되며 로그인 사용자만 열람 가능합니다.
- **공홈 인입 연동(선택)**: 공개 홈페이지 상담폼을 `customers` 테이블에 `source='homepage'`,
  `stage='intake'` 로 자동 삽입하려면 `SUPABASE_SERVICE_ROLE_KEY` 를 사용하는 서버 라우트를
  추가하면 됩니다. (현재는 미연동 — 필요 시 요청하세요.)
