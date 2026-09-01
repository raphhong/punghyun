"use client";

import { useRef, useState } from "react";

export function EditableContract({
  subtitle,
  fileName,
  children,
}: {
  subtitle: string;
  fileName: string;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  function downloadWord() {
    const src = sheetRef.current;
    if (!src) return;

    // 현재 문서(편집 내용 포함)를 복제해 Word용 HTML로 변환
    const clone = src.cloneNode(true) as HTMLElement;
    // 조항 본문의 줄바꿈(\n)을 <br>로 치환 (Word가 공백을 접지 않도록)
    clone.querySelectorAll(".whitespace-pre-line").forEach((el) => {
      el.innerHTML = el.innerHTML.replace(/\n/g, "<br>");
    });

    const html = `\uFEFF<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${fileName}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: "Malgun Gothic", "맑은 고딕", sans-serif; font-size: 11pt; color: #000; line-height: 1.6; }
  h1 { font-size: 18pt; text-align: center; margin: 0 0 6pt; }
  h2 { font-size: 12pt; margin: 12pt 0 2pt; }
  p { margin: 2pt 0; }
  .party-grid { width: 100%; }
  .party-grid td { vertical-align: top; width: 50%; border: 1px solid #ccc; padding: 8pt; }
</style>
</head>
<body>${clone.innerHTML}</body>
</html>`;

    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* 화면 전용 상단 바 */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-6 py-3">
        <span className="truncate text-sm text-neutral-500">{subtitle}</span>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={
              editing
                ? "rounded-lg border border-brand-500 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700"
                : "rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            }
          >
            {editing ? "편집 중" : "편집"}
          </button>
          <button
            type="button"
            onClick={downloadWord}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Word 다운로드
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            인쇄 / PDF 저장
          </button>
        </div>
      </div>

      {editing && (
        <p className="no-print mx-auto max-w-[210mm] px-6 pt-3 text-xs text-amber-600">
          편집 모드 · 문서 내용을 직접 수정할 수 있습니다. 수정 내용은 저장되지 않으며 인쇄/PDF·Word 출력에만 반영됩니다.
        </p>
      )}

      {/* A4 문서 (편집 모드에서 직접 수정 가능) */}
      <div
        ref={sheetRef}
        contentEditable={editing}
        suppressContentEditableWarning
        className={`sheet mx-auto my-6 max-w-[210mm] bg-white px-[16mm] py-[12mm] shadow-sm outline-none print:my-0 print:shadow-none print:outline-none ${
          editing ? "outline-1 outline-dashed outline-brand-300 focus:outline-brand-500" : ""
        }`}
      >
        {children}
      </div>
    </>
  );
}
