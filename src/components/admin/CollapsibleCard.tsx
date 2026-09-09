// 단계 집중형 카드 — 현재 단계면 펼침(open), 아니면 접힘. 네이티브 <details>라 JS 불필요.
export function CollapsibleCard({
  title,
  desc,
  open = false,
  badge,
  children,
}: {
  title: string;
  desc?: string;
  open?: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <details
      open={open}
      className="group rounded-2xl border border-navy-100 bg-white [&[open]]:shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-6 marker:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-navy-900">{title}</h2>
            {badge && (
              <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                {badge}
              </span>
            )}
          </div>
          {desc && <p className="mt-0.5 text-sm text-navy-500">{desc}</p>}
        </div>
        <svg
          className="h-5 w-5 shrink-0 text-navy-400 transition-transform group-open:rotate-180"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </summary>
      <div className="px-6 pb-6">{children}</div>
    </details>
  );
}
