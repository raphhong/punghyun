export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD 구조화 데이터 — 검색엔진/AI 크롤러가 콘텐츠를 이해하도록 돕습니다.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
