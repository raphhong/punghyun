import { gmailDependencies } from '@/lib/admin/gmail-connect-runtime';
export const dynamic = 'force-dynamic';
export default async function GmailConnection() {
  const deps = gmailDependencies();
  const user = await deps.identity();
  if (!user || !user.verified || !deps.config.ownerId || user.id !== deps.config.ownerId ||
      user.email !== 'sol.hong@punghyun.com') return <main>대표 계정으로 로그인해야 합니다.</main>;
  // Never trust a ?result=connected query as stored connection proof.
  const ready = !!(deps.config.enabled && deps.config.clientId && deps.states && deps.secrets && deps.exchange && deps.profile);
  return <main>
    <h1>업무 Gmail 연결</h1>
    <p>sol.hong@punghyun.com의 읽기 전용 연결입니다. 발송·수정·삭제는 허용하지 않습니다.</p>
    <p>Google 권한은 전체 메일함 읽기를 포함합니다. 승인한 업무 라벨과 기간만 처리하며 결과는 확인된 대표 전용 경로로 전달합니다.</p>
    <p>{ready ? 'Google에서 계정과 권한을 직접 확인해 주세요.' : '아직 연결되지 않았습니다. 안전한 인증 저장 설정과 범위 승인이 필요합니다.'}</p>
    <form method="post" action="/api/integrations/gmail/connect">
      <button type="submit" disabled={!ready}>Google 읽기 권한 연결</button>
    </form>
  </main>;
}
