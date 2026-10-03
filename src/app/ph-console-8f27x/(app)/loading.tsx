export default function Loading() {
  return (
    <div role="status" aria-label="화면 불러오는 중" className="space-y-6">
      <p className="text-sm text-navy-500">화면을 불러오는 중입니다.</p>
      <div aria-hidden="true" className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded-lg bg-navy-100" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-navy-100" />
        ))}
      </div>
      <div className="space-y-3 rounded-2xl border border-navy-100 bg-white p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-navy-50" />
        ))}
      </div>
      </div>
    </div>
  );
}
