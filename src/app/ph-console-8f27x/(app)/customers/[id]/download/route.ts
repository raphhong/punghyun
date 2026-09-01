import { NextResponse, type NextRequest } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import {
  SCREENING_2_DOCS,
  SCREENING_3_DOCS,
  CONTRACT_DOCS,
  DELIVERY_DOCS,
  MATURITY_DOCS,
} from "@/lib/admin/pipeline";

// 서류 key → 사람이 읽을 수 있는 파일명
const LABELS = new Map(
  [
    ...SCREENING_2_DOCS,
    ...SCREENING_3_DOCS,
    ...CONTRACT_DOCS,
    ...DELIVERY_DOCS,
    ...MATURITY_DOCS,
  ].map((d) => [d.key, d.label]),
);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  // 관리자 인증 (라우트 핸들러는 레이아웃 가드가 적용되지 않음)
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims) return new NextResponse("Unauthorized", { status: 401 });
  const uid = typeof claims.sub === "string" ? claims.sub : undefined;
  if (uid) {
    const { data: adminRow, error } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle();
    if (!error && !adminRow) return new NextResponse("Forbidden", { status: 403 });
  }

  const keys = (req.nextUrl.searchParams.get("keys") ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (!keys.length) return new NextResponse("No documents selected", { status: 400 });

  const [{ data: customer }, { data: docs }] = await Promise.all([
    supabase.from("customers").select("hospital_name").eq("id", id).maybeSingle(),
    supabase
      .from("customer_documents")
      .select("doc_key, file_path")
      .eq("customer_id", id)
      .in("doc_key", keys),
  ]);

  const files = (docs ?? []).filter((d) => !!d.file_path);
  if (!files.length) return new NextResponse("Not found", { status: 404 });

  const zip = new JSZip();
  const used = new Map<string, number>();
  for (const d of files) {
    const path = d.file_path as string;
    const { data: blob, error } = await supabase.storage
      .from("customer-docs")
      .download(path);
    if (error || !blob) continue;

    const buf = Buffer.from(await blob.arrayBuffer());
    const ext = path.includes(".") ? path.split(".").pop() : "bin";
    const base = LABELS.get(d.doc_key) ?? d.doc_key;
    const key = `${base}.${ext}`;
    const n = used.get(key) ?? 0;
    used.set(key, n + 1);
    const name = n > 0 ? `${base} (${n}).${ext}` : key;
    zip.file(name, buf);
  }

  const content = await zip.generateAsync({ type: "nodebuffer" });
  const zipName = `${customer?.hospital_name ?? "고객"}_서류.zip`;

  return new NextResponse(new Uint8Array(content), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      "Cache-Control": "no-store",
    },
  });
}
