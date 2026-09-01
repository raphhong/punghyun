"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Item = { key: string; label: string; url: string };

// 여러 장 올린 기기 사진의 썸네일 목록 (영업자용 · 삭제 가능)
export function PublicPhotoList({
  items,
  deleteAction,
}: {
  items: Item[];
  deleteAction: (docKey: string) => Promise<{ ok: true } | { error: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function handleDelete(key: string, label: string) {
    if (!confirm(`'${label}'을(를) 삭제할까요?`)) return;
    setBusyKey(key);
    startTransition(async () => {
      await deleteAction(key);
      setBusyKey(null);
      router.refresh();
    });
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-navy-600">
        올린 기기 사진 ({items.length}장)
      </p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((it) => (
          <li
            key={it.key}
            className="relative overflow-hidden rounded-lg border border-navy-100 bg-white"
          >
            <a href={it.url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.url}
                alt={it.label}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
            </a>
            <button
              type="button"
              onClick={() => handleDelete(it.key, it.label)}
              disabled={pending && busyKey === it.key}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-sm text-white hover:bg-red-600 disabled:opacity-50"
              aria-label="삭제"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
