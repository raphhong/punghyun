"use client";
import { useState } from "react";
import { ShareLink } from "@/components/admin/ShareLink";
import { ShareMessage } from "@/components/admin/ShareMessage";
import { intakeProductLabels, shortIntakeMessage, type IntakeProduct } from "@/lib/sales/intake-product";

export function ProductShare({ url, standardMessage, initialProduct = null }: { url: string; standardMessage: string; initialProduct?: IntakeProduct | null }) {
  const [product, setProduct] = useState<IntakeProduct | null>(initialProduct);
  const target = product === "short" ? `${url}/seven-day` : url;
  return <section className="space-y-4" aria-label="상품별 고객 안내">
    <fieldset><legend className="mb-2 font-semibold">안내할 상품을 선택하세요</legend><div className="flex flex-wrap gap-4">{(["standard", "short"] as const).map(value => <label key={value} className="flex gap-2"><input type="radio" name="share-product" value={value} checked={product === value} onChange={() => setProduct(value)} />{intakeProductLabels[value]}</label>)}</div></fieldset>
    <p className="text-sm text-navy-500">이번에 보낼 안내만 선택합니다. 기존 고객·계약·접수의 상품은 변경되지 않습니다.</p>
    {product ? <div key={product} className="space-y-3"><h3 className="font-bold">{intakeProductLabels[product]} 고객 안내</h3><ShareLink url={target} /><a className="text-sm underline" href={target} target="_blank" rel="noreferrer">{intakeProductLabels[product]} 고객 화면 확인</a><ShareMessage message={product === "short" ? shortIntakeMessage(target) : standardMessage} /></div> : <p role="status">상품을 선택하면 해당 링크와 서류 안내문이 함께 표시됩니다.</p>}
  </section>;
}
