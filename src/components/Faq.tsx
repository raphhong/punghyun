import { faqs } from "@/lib/content";

export function Faq() {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-navy-100 rounded-2xl border border-navy-100 bg-white">
      {faqs.map((item) => (
        <details key={item.q} className="group px-6 py-5 [&_summary]:list-none">
          <summary className="flex cursor-pointer items-center justify-between gap-4 text-left text-lg font-semibold text-navy-900">
            {item.q}
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-500 transition-transform group-open:rotate-45">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </summary>
          <p className="mt-3 leading-relaxed text-navy-600">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
