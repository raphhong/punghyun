"use client";

import { useState } from "react";

export function EditableContract({
  subtitle,
  children,
}: {
  subtitle: string;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

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
            onClick={() => window.print()}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            인쇄 / PDF 저장
          </button>
        </div>
      </div>

      {editing && (
        <p className="no-print mx-auto max-w-[210mm] px-6 pt-3 text-xs text-amber-600">
          편집 모드 · 문서 내용을 직접 수정할 수 있습니다. 수정 내용은 저장되지 않으며 인쇄/PDF 출력에만 반영됩니다.
        </p>
      )}

      {/* A4 문서 (편집 모드에서 직접 수정 가능) */}
      <div
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
