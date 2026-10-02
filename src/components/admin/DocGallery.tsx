"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminPath } from "@/lib/admin/config";

export type GalleryItem = {
  key: string;
  docKey: string;
  attachmentId?: string;
  filename: string;
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
  const router = useRouter();
  const deleteLock = useRef(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<string | null>(null);

  const imageItems = items.filter((it) => it.isImage);
  const selectedItems = items.filter((item) => selected.has(item.key));
  const allSelected = items.length > 0 && selectedItems.length === items.length;
  const imageIndex = imageItems.findIndex((item) => item.key === lightbox);
  const activeImage = imageItems[imageIndex];

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
    if (!selectedItems.length) return;
    const params = new URLSearchParams();
    const ids = selectedItems.filter((item) => !item.key.startsWith("legacy:")).map((item) => item.attachmentId ?? item.key);
    const legacyKeys = selectedItems.filter((item) => item.key.startsWith("legacy:")).map((item) => item.docKey);
    if (ids.length) params.set("ids", ids.join(","));
    if (legacyKeys.length) params.set("keys", legacyKeys.join(","));
    // This route returns a ZIP attachment, not a client-side page.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `${adminPath(`customers/${customerId}/download`)}?${params}`;
  }

  function openLightbox(itemIndex: number) {
    const item = items[itemIndex];
    if (!item.isImage) {
      window.open(item.url, "_blank", "noopener");
      return;
    }
    setLightbox(item.key);
  }

  async function removeItem(item: GalleryItem) {
    if (!deleteAction || !item.attachmentId || deleteLock.current) return;
    if (!confirm(`다음 파일만 목록에서 제거할까요?\n${item.filename}\n파일 ID: ${item.attachmentId}\n해당 서류의 제거한 파일 목록에서 복원할 수 있습니다.`)) return;
    deleteLock.current = true;
    setDeleting(item.key);
    setDeleteError("");
    try {
      const data = new FormData();
      data.set("customer_id", customerId);
      data.set("doc_key", item.docKey);
      data.set("attachment_id", item.attachmentId);
      await deleteAction(data);
      setSelected((previous) => { const next = new Set(previous); next.delete(item.key); return next; });
      router.refresh();
    } catch (error) {
      setDeleteError(`${item.filename}: ${error instanceof Error ? error.message : "제거하지 못했습니다."}`);
    } finally {
      deleteLock.current = false;
      setDeleting(null);
    }
  }

  const closeLightbox = () => setLightbox(null);
  const prev = () => { if (imageItems.length) setLightbox(imageItems[(imageIndex - 1 + imageItems.length) % imageItems.length].key); };
  const next = () => { if (imageItems.length) setLightbox(imageItems[(imageIndex + 1) % imageItems.length].key); };

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
  }, [lightbox, imageItems]);

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
        <span className="text-xs text-navy-400">선택 {selectedItems.length} / {items.length}</span>
        <button
          type="button"
          onClick={downloadSelected}
          disabled={selectedItems.length === 0}
          className="ml-auto rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          선택 다운로드 (ZIP)
        </button>
      </div>

      {deleteError && <p role="alert" className="mb-3 text-xs text-red-600">{deleteError}</p>}

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
                <span className="truncate text-xs text-navy-700" title={`${it.label} · ${it.filename}`}>
                  {it.label} · {it.filename}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <a
                    href={`${it.url}&download`}
                    className="text-xs font-medium text-navy-400 hover:text-brand-600"
                    title="개별 다운로드"
                  >
                    ↓
                  </a>
                  {deleteAction && it.attachmentId && (
                    <button
                      type="button"
                      disabled={deleting !== null}
                      onClick={() => removeItem(it)}
                      aria-label={`${it.filename} (${it.attachmentId}) 목록에서 제거`}
                      className="text-xs font-medium text-navy-400 hover:text-red-600 disabled:opacity-40"
                      title="목록에서 제거 (복원 가능)"
                    >{deleting === it.key ? "…" : "×"}</button>
                  )}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* 라이트박스 */}
      {lightbox !== null && activeImage && (
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
              src={activeImage.url}
              alt={activeImage.label}
              className="max-h-[85vh] max-w-full rounded object-contain"
            />
            <figcaption className="mt-3 text-sm text-white/90">
              {activeImage.label} · {activeImage.filename} · {imageIndex + 1} / {imageItems.length}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
