"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export type DevicePhoto = { key: string; url: string };
export type DeviceView = {
  id: string;
  model_name: string | null;
  quantity: number | null;
  photos: DevicePhoto[];
};

type Result<T = { ok: true }> = T | { error: string };

type Actions = {
  addDevice: (id: string) => Promise<Result<{ id: string }>>;
  saveDevice: (
    id: string,
    deviceId: string,
    model: string | null,
    quantity: number | null,
  ) => Promise<Result>;
  deleteDevice: (id: string, deviceId: string) => Promise<Result>;
  createPhotoUrl: (
    id: string,
    deviceId: string,
    filename: string,
  ) => Promise<{ path: string; token: string } | { error: string }>;
  recordPhoto: (id: string, deviceId: string, path: string) => Promise<Result>;
  deletePhoto: (id: string, docKey: string) => Promise<Result>;
};

// 한 회사가 여러 대의 기기를 한 번에 등록 — 기기별로 모델명·수량·사진을 묶어서 관리.
export function DeviceManager({
  id,
  devices,
  actions,
}: {
  id: string;
  devices: DeviceView[];
  actions: Actions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    startTransition(async () => {
      await actions.addDevice(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {devices.length === 0 && (
        <p className="rounded-xl border border-dashed border-navy-200 bg-navy-50/50 px-4 py-6 text-center text-sm text-navy-500">
          아직 등록된 기기가 없습니다. 아래 버튼으로 판매할 기계를 한 대씩 추가하세요.
        </p>
      )}

      {devices.map((d, i) => (
        <DeviceCard
          key={d.id}
          index={i}
          id={id}
          device={d}
          actions={actions}
        />
      ))}

      <button
        type="button"
        onClick={handleAdd}
        disabled={pending}
        className="w-full rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/60 px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
      >
        + 기기 추가
      </button>
    </div>
  );
}

function DeviceCard({
  index,
  id,
  device,
  actions,
}: {
  index: number;
  id: string;
  device: DeviceView;
  actions: Actions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [model, setModel] = useState(device.model_name ?? "");
  const [qty, setQty] = useState(
    device.quantity != null ? String(device.quantity) : "",
  );
  const [saved, setSaved] = useState<"idle" | "saving" | "done">("idle");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [msg, setMsg] = useState("");

  function saveInfo() {
    const model_name = model.trim() === "" ? null : model.trim();
    const q = qty.replace(/[,\s]/g, "");
    const quantity = q === "" ? null : Number.isFinite(Number(q)) ? Number(q) : null;
    setSaved("saving");
    startTransition(async () => {
      await actions.saveDevice(id, device.id, model_name, quantity);
      setSaved("done");
      setTimeout(() => setSaved("idle"), 1500);
      router.refresh();
    });
  }

  function handleDeleteDevice() {
    if (!confirm(`기기 ${index + 1}${model ? ` (${model})` : ""}을(를) 삭제할까요? 사진도 함께 삭제됩니다.`))
      return;
    startTransition(async () => {
      await actions.deleteDevice(id, device.id);
      router.refresh();
    });
  }

  async function handleUpload(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    setMsg("");
    const supabase = createBrowserClient();
    let ok = 0;
    for (const file of files) {
      try {
        const signed = await actions.createPhotoUrl(id, device.id, file.name);
        if ("error" in signed) {
          setMsg(signed.error);
          continue;
        }
        const { error: upErr } = await supabase.storage
          .from("customer-docs")
          .uploadToSignedUrl(signed.path, signed.token, file);
        if (upErr) {
          setMsg("업로드 실패: " + upErr.message);
          continue;
        }
        const rec = await actions.recordPhoto(id, device.id, signed.path);
        if ("error" in rec) {
          setMsg(rec.error);
          continue;
        }
        ok += 1;
        setProgress({ done: ok, total: files.length });
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "오류");
      }
    }
    setUploading(false);
    if (ok > 0) router.refresh();
  }

  function handleDeletePhoto(key: string) {
    startTransition(async () => {
      await actions.deletePhoto(id, key);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-navy-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-navy-100 px-2.5 py-1 text-xs font-bold text-navy-700">
          기기 {index + 1}
        </span>
        <button
          type="button"
          onClick={handleDeleteDevice}
          disabled={pending}
          className="text-xs font-medium text-navy-400 hover:text-red-600 disabled:opacity-50"
        >
          기기 삭제
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-navy-600">모델명</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            onBlur={saveInfo}
            placeholder="예: GE Voluson E10"
            className="mt-1 w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy-600">수량(대)</label>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={saveInfo}
            inputMode="numeric"
            placeholder="1"
            className="mt-1 w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
      </div>
      {saved !== "idle" && (
        <p className="mt-1 text-xs text-brand-600">
          {saved === "saving" ? "저장 중…" : "저장됨"}
        </p>
      )}

      {/* 사진 */}
      <div className="mt-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-navy-600">
            사진 ({device.photos.length}장)
          </span>
          <label className="cursor-pointer rounded-md bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-800">
            {uploading
              ? `업로드 중… (${progress.done}/${progress.total})`
              : "사진 추가"}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={(e) => {
                handleUpload(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
              className="hidden"
            />
          </label>
        </div>
        {msg && <p className="mb-2 text-xs text-red-600">{msg}</p>}

        {device.photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {device.photos.map((p) => (
              <li
                key={p.key}
                className="relative overflow-hidden rounded-lg border border-navy-100 bg-white"
              >
                <a href={p.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt="기기 사진"
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                </a>
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(p.key)}
                  disabled={pending}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-sm text-white hover:bg-red-600 disabled:opacity-50"
                  aria-label="사진 삭제"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
