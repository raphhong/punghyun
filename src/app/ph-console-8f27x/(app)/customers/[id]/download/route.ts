import { NextResponse, type NextRequest } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { listCustomerDocuments } from "@/lib/documents/server";
import {
  SCREENING_2_DOCS,
  SCREENING_3_DOCS,
  PURCHASE_INTENT_DOCS,
  CONTRACT_DOCS,
  DELIVERY_DOCS,
  MATURITY_DOCS,
} from "@/lib/admin/pipeline";

// 서류 key → 사람이 읽을 수 있는 파일명
const LABELS = new Map(
  [
    ...SCREENING_2_DOCS,
    ...SCREENING_3_DOCS,
    ...PURCHASE_INTENT_DOCS,
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
  if (!uid) return new NextResponse("Unauthorized", { status: 401 });
  {
    const { data: adminRow, error } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle();
    if (error || !adminRow) return new NextResponse("Forbidden", { status: 403 });
  }

  const selected = (name: string) => [...new Set((req.nextUrl.searchParams.get(name) ?? "").split(",").map((k) => k.trim()).filter(Boolean))];
  const keys = selected("keys");
  const ids = selected("ids");
  if (!keys.length && !ids.length) return new NextResponse("No documents selected", { status: 400 });
  if (keys.length + ids.length > 200) return new NextResponse("Too many documents selected", { status: 400 });
  const { data: customer, error: customerError } = await supabase.from("customers").select("hospital_name").eq("id", id).maybeSingle();
  if (customerError || !customer) return new NextResponse("Not found", { status: 404 });
  let docs;
  try { docs = await listCustomerDocuments(supabase, id); }
  catch { return new NextResponse("Document list unavailable", { status: 503 }); }
  const files = docs.filter((d) => d.file_path && !d.deleted_at && (ids.length ? ids.includes(d.attachment_id ?? d.id) : keys.includes(d.doc_key)));
  if (!files.length) return new NextResponse("Not found", { status: 404 });
  // Never silently return an incomplete selection or drop a failed download.
  if (ids.length && files.length !== ids.length) return new NextResponse("Selected files changed. Refresh the list and retry.", { status: 409 });
  if (files.length > 200) return new NextResponse("Select at most 200 files per ZIP", { status: 413 });

  const zip = new JSZip();
  const used = new Set<string>();
  let totalBytes = 0;
  for (const d of files) {
    const path = d.file_path as string;
    const { data: blob, error } = await supabase.storage
      .from("customer-docs")
      .download(path);
    if (error || !blob) return new NextResponse("A selected file could not be downloaded. No partial ZIP was created.", { status: 502 });
    totalBytes += blob.size;
    if (totalBytes > 200 * 1024 * 1024) return new NextResponse("ZIP is limited to 200MB. Select fewer files.", { status: 413 });

    const buf = Buffer.from(await blob.arrayBuffer());
    const ext = path.includes(".") ? path.split(".").pop() : "bin";
    const base = d.doc_key.startsWith("device_photo_")
      ? "기기사진"
      : (LABELS.get(d.doc_key) ?? d.doc_key);
    const original = d.original_name?.replace(/[\\/\x00-\x1f]/g, "_");
    const displayBase = original ? `${base}_${original.replace(/\.[^.]*$/, "")}` : base;
    let name = `${displayBase}.${ext}`;
    let suffix = 1;
    while (used.has(name)) name = `${displayBase} (${suffix++}).${ext}`;
    used.add(name);
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
