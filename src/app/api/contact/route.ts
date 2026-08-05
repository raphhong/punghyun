import { NextResponse } from "next/server";
import { site } from "@/lib/site";

export const runtime = "nodejs";

type ContactPayload = {
  company?: string;
  name?: string;
  phone?: string;
  email?: string;
  industry?: string;
  amount?: string;
  message?: string;
  // 허니팟(봇 필터) — 사람은 비워둠
  website?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(request: Request) {
  let data: ContactPayload;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 봇이 채운 허니팟이면 조용히 성공 처리
  if (data.website) {
    return NextResponse.json({ ok: true });
  }

  const name = data.name?.trim();
  const phone = data.phone?.trim();
  if (!name || !phone) {
    return NextResponse.json(
      { error: "담당자 성함과 연락처는 필수입니다." },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL || site.contact.email;
  const from = process.env.CONTACT_FROM_EMAIL || "onboarding@resend.dev";

  const rows: [string, string | undefined][] = [
    ["회사명", data.company],
    ["담당자", name],
    ["연락처", phone],
    ["이메일", data.email],
    ["업종", data.industry],
    ["필요 자금(대략)", data.amount],
    ["문의 내용", data.message],
  ];
  const html = `
    <h2>풍현 상담 신청</h2>
    <table cellpadding="6" style="border-collapse:collapse">
      ${rows
        .filter(([, v]) => v)
        .map(
          ([k, v]) =>
            `<tr><td style="font-weight:600">${k}</td><td>${escapeHtml(
              String(v),
            )}</td></tr>`,
        )
        .join("")}
    </table>
  `;

  // API 키가 없으면(개발/미설정) 서버 로그로만 남기고 성공 반환.
  if (!apiKey) {
    console.info("[contact] 상담 신청 접수 (이메일 미발송 — RESEND_API_KEY 미설정):", rows);
    return NextResponse.json({ ok: true, delivered: false });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `풍현 상담신청 <${from}>`,
        to: [to],
        reply_to: data.email || undefined,
        subject: `[풍현 상담] ${data.company || name}님의 상담 신청`,
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("[contact] Resend 오류:", res.status, detail);
      return NextResponse.json(
        { error: "메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, delivered: true });
  } catch (err) {
    console.error("[contact] 전송 예외:", err);
    return NextResponse.json(
      { error: "일시적인 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
