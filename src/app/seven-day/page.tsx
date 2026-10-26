import { SevenDayIntake } from "@/components/SevenDayIntake";
import { shortRentalIntakeReady } from "@/lib/admin/short-rental-readiness";
export const metadata = { title: "초단기렌탈 접수", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function SevenDayPage() {
  if(!await shortRentalIntakeReady())return <main className="mx-auto max-w-2xl space-y-4 px-4 py-10"><h1 className="text-2xl font-bold">초단기렌탈 접수 준비 중</h1><p role="status">아직 온라인 접수를 받지 않습니다. 담당자에게 초단기렌탈 상담을 요청해 주세요. 이 화면에서는 신청을 저장하거나 전송하지 않습니다.</p></main>;
  return <main className="mx-auto max-w-2xl space-y-5 px-4 py-10"><h1 className="text-2xl font-bold">초단기렌탈 접수</h1><p>신규 고객은 아래에서 접수하세요. 기존 고객은 담당자가 전달한 전용 링크로 접수하면 유효 자료를 재사용할 수 있습니다. 이름·연락처로 기존 고객 정보를 조회하지 않습니다.</p><SevenDayIntake /></main>;
}
