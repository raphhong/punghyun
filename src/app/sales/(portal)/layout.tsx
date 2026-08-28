import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionAgent } from "@/lib/sales/agent";
import { signOutAgent } from "../actions";

function StatusScreen({
  title,
  message,
  email,
}: {
  title: string;
  message: string;
  email?: string;
}) {
  return (
    <div className="grid min-h-dvh place-items-center bg-navy-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-navy-800 bg-navy-900 p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-navy-800 text-lg font-bold text-brand-300">
          豊
        </div>
        <h1 className="mt-4 text-lg font-bold text-white">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-navy-300">{message}</p>
        {email && <p className="mt-2 text-xs text-navy-500">{email}</p>}
        <form action={signOutAgent} className="mt-6">
          <button className="text-sm font-medium text-navy-400 hover:text-white">
            로그아웃
          </button>
        </form>
      </div>
    </div>
  );
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, agent } = await getSessionAgent();

  if (!user) redirect("/sales/login");

  if (!agent) {
    return (
      <StatusScreen
        title="가입 정보가 없습니다"
        message="이 계정에 연결된 영업자 정보가 없습니다. 본사에 문의해주세요."
        email={user.email}
      />
    );
  }

  if (agent.status === "pending") {
    return (
      <StatusScreen
        title="승인 대기 중"
        message="가입이 접수되었습니다. 본사 승인 후 이용하실 수 있습니다."
        email={user.email}
      />
    );
  }

  if (agent.status === "rejected") {
    return (
      <StatusScreen
        title="가입이 거절되었습니다"
        message="자세한 사항은 본사에 문의해주세요."
        email={user.email}
      />
    );
  }

  // approved
  return (
    <div className="min-h-dvh bg-navy-50">
      <header className="border-b border-navy-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/sales" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-900 text-sm font-bold text-brand-300">
              豊
            </span>
            <span className="text-sm font-bold text-navy-900">풍현 영업자 포털</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-navy-600">{agent.name}</span>
            <form action={signOutAgent}>
              <button className="rounded-lg px-3 py-1.5 text-xs font-medium text-navy-500 hover:bg-navy-50">
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
