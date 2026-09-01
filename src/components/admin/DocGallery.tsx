"use client";

import { useEffect, useState } from "react";
import { adminPath } from "@/lib/admin/config";

export type GalleryItem = {
  key: string;
  label: string;
  url: string;
  isImage: boolean;
};

export function DocGallery({
  customerId,
  items,
  deleteAction,
}: {
  customerId: string;
  items: GalleryItem[];
  deleteAction?: (formData: FormData) => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<number | null>(null);

  const imageItems = items.filter((it) => it.isImage);
  const allSelected = items.length > 0 && selected.size === items.length;

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((it) => it.key)));
  }

  function downloadSelected() {
    const keys = [...selected];
    if (!keys.length) return;
    const url = `${adminPath(`customers/${customerId}/download`)}?keys=${encodeURIComponent(
      keys.join(","),
    )}`;
    window.location.href = url;
  }

  // 라이트박스: 이미지 목록 기준 인덱스
  function openLightbox(itemIndex: number) {
    const it = items[itemIndex];
    if (!it.isImage) {
      window.open(it.url, "_blank", "noopener");
      return;
    }
    const imgIdx = imageItems.findIndex((im) => im.key === it.key);
    setLightbox(imgIdx);
  }

  const closeLightbox = () => setLightbox(null);
  const prev = () =>
    setLightbox((i) => (i === null ? i : (i - 1 + imageItems.length) % imageItems.length));
  const next = () =>
    setLightbox((i) => (i === null ? i : (i + 1) % imageItems.length));

  useEffect(() => {
    if (lightbox === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, imageItems.length]);

  if (!items.length) {
    return (
      <p className="py-4 text-sm text-navy-400">
        업로드된 서류가 없습니다.
      </p>
    );
  }

  return (
    <div>
      {/* 상단 도구 */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-navy-700">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-navy-300"
          />
          전체 선택
        </label>
        <span className="text-xs text-navy-400">선택 {selected.size} / {items.length}</span>
        <button
          type="button"
          onClick={downloadSelected}
          disabled={selected.size === 0}
          className="ml-auto rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          선택 다운로드 (ZIP)
        </button>
      </div>

      {/* 썸네일 그리드 */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((it, i) => {
          const checked = selected.has(it.key);
          return (
            <li
              key={it.key}
              className={`relative overflow-hidden rounded-xl border ${
                checked ? "border-brand-400 ring-2 ring-brand-200" : "border-navy-100"
              } bg-white`}
            >
              <label className="absolute left-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-white/90 shadow">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(it.key)}
                  className="h-4 w-4 rounded border-navy-300"
                />
              </label>

              <button
                type="button"
                onClick={() => openLightbox(i)}
                className="block w-full"
                title={it.isImage ? "크게 보기" : "새 탭에서 열기"}
              >
                <div className="flex aspect-square items-center justify-center bg-navy-50">
                  {it.isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.url}
                      alt={it.label}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-4xl text-navy-300">📄</span>
                  )}
                </div>
              </button>

              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className="truncate text-xs text-navy-700" title={it.label}>
                  {it.label}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <a
                    href={`${it.url}&download`}
                    className="text-xs font-medium text-navy-400 hover:text-brand-600"
                    title="개별 다운로드"
                  >
                    ↓
                  </a>
                  {deleteAction && (
                    <form
                      action={deleteAction}
                      onSubmit={(e) => {
                        if (!confirm(`'${it.label}' 파일을 삭제할까요?`))
                          e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="customer_id" value={customerId} />
                      <input type="hidden" name="doc_key" value={it.key} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-navy-400 hover:text-red-600"
                        title="삭제"
                      >
                        ×
                      </button>
                    </form>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* 라이트박스 */}
      {lightbox !== null && imageItems[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
            aria-label="닫기"
          >
            ×
          </button>

          {imageItems.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-3xl text-white hover:bg-white/20"
                aria-label="이전"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-3xl text-white hover:bg-white/20"
                aria-label="다음"
              >
                ›
              </button>
            </>
          )}

          <figure
            className="flex max-h-full max-w-full flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageItems[lightbox].url}
              alt={imageItems[lightbox].label}
              className="max-h-[85vh] max-w-full rounded object-contain"
            />
            <figcaption className="mt-3 text-sm text-white/90">
              {imageItems[lightbox].label} · {lightbox + 1} / {imageItems.length}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
