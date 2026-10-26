import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {adminPath} from "@/lib/admin/config";
import {intakeChecks,intakeConditions,type IntakeRow} from "@/lib/admin/short-rental-intake";
const reuseLabels={new:"최초 확인 필요",unchanged:"변경 없음·재사용 요청",changed:"변경·만료 갱신 요청",review_existing:"기존 제출 이력·유효성 확인 요청"};
const conditionLabels={unknown:"담당자 확인 필요",yes:"해당 가능성 있음",no:"고객은 미해당으로 인지"};
export default async function SevenDayIntakesPage(){
  const db=await createClient();const claims=await db.auth.getClaims();const uid=claims.data?.claims?.sub;
  if(!uid)return <p role="alert">관리자 로그인이 필요합니다.</p>;
  const admin=await db.from("admins").select("user_id").eq("user_id",uid).maybeSingle();
  if(admin.error||!admin.data)return <p role="alert">관리자만 접수 목록을 확인할 수 있습니다.</p>;
  const rows:IntakeRow[]=[];
  for(let from=0;;from+=500){const result=await db.from("short_rental_intakes").select("request_id,customer_id,device_id,payload,created_at").order("request_id").range(from,from+499);if(result.error||!result.data)return <p role="alert">7일 전용 접수 저장소가 준비되지 않았습니다. 접수 가능 상태와 DB 적용 여부를 확인하세요.</p>;rows.push(...result.data as IntakeRow[]);if(result.data.length<500)break;}
  rows.sort((a,b)=>b.created_at.localeCompare(a.created_at));
  return <main className="space-y-5"><header><h1 className="text-2xl font-bold">초단기렌탈 고객 접수</h1><p>고객·장비는 공통 목록에 연결됩니다. 고객의 희망·진술을 확인한 뒤 유효 자료만 재사용하세요.</p><Link className="underline" href="/seven-day">신규 고객용 접수 화면</Link></header><aside className="rounded-lg bg-amber-50 p-4">계약 문안·기산일·종료시각은 검토 중입니다. 아래 희망일은 계약 개시나 만기가 아닙니다. 계약 확정·체결용 출력·자동 발송은 지원하지 않습니다.</aside>
  {!rows.length&&<p>접수된 내역이 없습니다.</p>}{rows.map(row=><article className="space-y-3 rounded-xl border bg-white p-5" key={row.request_id}><h2 className="text-lg font-bold">{row.payload.company||row.payload.name} · {row.payload.model}</h2><p>{row.created_at} · 접수번호 {row.request_id}</p><Link className="underline" href={adminPath(`customers/${row.customer_id}`)}>공통 고객·기존 거래 확인</Link><dl className="grid gap-2 sm:grid-cols-2"><div><dt>담당자·연락처</dt><dd>{row.payload.name} / {row.payload.phone}</dd></div><div><dt>희망 시작일</dt><dd>{row.payload.startDate} (계약일 미확정)</dd></div><div><dt>자산 식별·수량·상태</dt><dd>{row.payload.identity} / {row.payload.quantity}개 / {row.payload.condition}</dd></div><div><dt>소유자·권리 공개</dt><dd>{row.payload.owner} / {row.payload.rights}</dd></div><div><dt>간단한 납부재원 설명</dt><dd>{row.payload.resources||"담당자 확인 필요"}</dd></div></dl><h3 className="font-bold">최초 확인 자료</h3><ul>{intakeChecks.map(([k,label])=><li key={k}>{label}: {reuseLabels[row.payload.reuse[k]]}</li>)}</ul><h3 className="font-bold">조건부 확인</h3><ul>{intakeConditions.map(([k,label])=><li key={k}>{label} — {conditionLabels[row.payload.conditions[k]]}</li>)}</ul><p className="text-sm">고객의 답변만으로 권리·동의·보증이 확정되지 않습니다. 내부 선행조건 확인표에 고객 서명을 요구하지 않습니다.</p></article>)}
  </main>;
}
