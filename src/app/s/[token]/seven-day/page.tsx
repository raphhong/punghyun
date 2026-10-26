import { notFound } from "next/navigation";
import { SevenDayIntake } from "@/components/SevenDayIntake";
import { shortRentalPublicAccess } from "@/lib/admin/short-rental-public-access";
import { SevenDayPhoto } from "@/components/SevenDayPhoto";
export const metadata = { title: "초단기렌탈 자료 확인·접수", robots: {index:false,follow:false}, referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";
export default async function ExistingSevenDayPage({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  const access=await shortRentalPublicAccess(token).catch(()=>null);
  if(!access)notFound();
  return <main className="mx-auto max-w-2xl space-y-5 px-4 py-10"><h1 className="text-2xl font-bold">초단기렌탈 접수</h1><p>기존 자료의 변경 여부만 확인하고 이번 거래 정보를 입력하세요. 전용 링크를 다른 사람에게 공유하지 마세요.</p><SevenDayIntake token={token} initial={{name:access.customer.representative??"",phone:access.customer.phone??"",company:access.customer.hospital_name??""}} devices={access.devices} available={access.available}/><details><summary>필요한 자산 사진만 추가 (선택)</summary>{access.devices.map(d=><SevenDayPhoto key={d.id} token={token} deviceId={d.id} label={d.model_name||"등록 장비"}/>)}</details></main>;
}
