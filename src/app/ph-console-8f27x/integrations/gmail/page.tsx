import { gmailDependencies } from '@/lib/admin/gmail-connect-runtime';
export const dynamic = 'force-dynamic';
export default async function GmailConnection() {
  const deps = gmailDependencies();
  const user = await deps.identity();
  if (!user || !user.verified || !deps.config.ownerId || user.id !== deps.config.ownerId ||
      user.email !== 'sol.hong@punghyun.com') return <main className="space-y-4 p-4">
        <p>대표 계정으로 로그인해야 합니다.</p>
        <a className="inline-flex min-h-11 items-center underline" href="https://punghyun.vercel.app/ph-console-8f27x/login">풍현 대표 계정으로 로그인</a>
      </main>;
  // Never trust a ?result=connected query as stored connection proof.
  const ready = !!(deps.config.enabled && deps.config.clientId && deps.states && deps.secrets && deps.exchange && deps.profile);
  return <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
    <a href="/ph-console-8f27x" className="inline-flex min-h-11 items-center underline">어드민으로 돌아가기</a>
    <h1>업무 Gmail 연결</h1>
    <p>sol.hong@punghyun.com의 읽기 전용 연결입니다. 발송·수정·삭제는 허용하지 않습니다.</p>
    <p>Google 권한은 전체 메일함 읽기를 포함합니다. 승인한 업무 라벨과 기간만 처리하며 결과는 확인된 대표 전용 경로로 전달합니다.</p>
    <p>{ready ? 'Google에서 계정과 권한을 직접 확인해 주세요.' : '아직 연결되지 않았습니다. 안전한 인증 저장 설정과 범위 승인이 필요합니다.'}</p>
    <form method="post" action="/api/integrations/gmail/connect">
      <button type="submit" disabled={!ready} className="min-h-11 rounded border px-4 py-3 disabled:opacity-50">Google 읽기 권한 연결</button>
    </form>
    <form method="post" action="/api/integrations/gmail/read">
      <p>연결 후 최근 7일 INBOX 메일의 제목과 요약을 최대 20개 확인합니다. 본문 전체·첨부파일·발송 기능은 포함하지 않습니다.</p>
      <button type="submit" disabled={!ready} className="min-h-11 rounded border px-4 py-3 disabled:opacity-50">읽기 전용 조회 확인</button>
    </form>
    <form method="post" action="/api/integrations/gmail/read">
      <p>연결 후 최근 7일 INBOX 메일의 제목과 요약을 최대 20개 확인합니다. 본문 전체·첨부파일·발송 기능은 포함하지 않습니다.</p>
      <button type="submit" disabled={!ready}>읽기 전용 조회 확인</button>
    </form>
  </main>;
}
