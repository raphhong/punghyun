import { LEGACY_TAX_DOC } from "@/lib/admin/pipeline";
import type { CustomerDocument } from "@/lib/admin/types";

// Keep the old attachment accessible without offering another combined upload slot.
export function LegacyTaxDocument({ row, signedMap }: {
  row?: Partial<CustomerDocument>;
  signedMap: Map<string, string>;
}) {
  if (!row) return null;
  const url = row.file_path ? signedMap.get(row.file_path) : undefined;
  return (
    <aside className="mt-3 rounded-xl border border-navy-100 p-3 text-sm">
      <p className="font-medium text-navy-800">{LEGACY_TAX_DOC.label}</p>
      <p className="mt-1 text-xs text-navy-500">기존 자료는 보존됩니다. 국세·지방세 각각의 수령 여부는 위 항목에서 확인하세요.</p>
      {url && <div className="mt-2 flex gap-3">
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-600">기존 자료 보기</a>
        <a href={`${url}&download`} className="text-navy-500">다운로드</a>
      </div>}
    </aside>
  );
}
