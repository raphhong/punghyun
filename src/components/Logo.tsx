import { cn } from "@/lib/cn";

// 풍현 로고 심볼 — "P"를 하나의 흐르는 선으로 그려
// 상승(베이스에서 위로 솟는 흐름) + 자금 흐름의 연속성을 담았습니다.
export function LogoMark({
  size = 32,
  tone = "light",
  className,
}: {
  size?: number;
  tone?: "light" | "dark";
  className?: string;
}) {
  const bg = tone === "dark" ? "#14284a" : "#0a1830";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="풍현 로고"
    >
      <rect width="32" height="32" rx="8" fill={bg} />
      <path
        d="M10 25 C 10.5 19, 12 19, 12 8 H16.5 A4 4 0 0 1 16.5 16 H12"
        fill="none"
        stroke="#57d7a3"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  tone = "light",
  className,
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark size={32} tone={tone} className="h-8 w-8" />
      <span
        className={cn(
          "text-lg font-bold tracking-tight",
          tone === "dark" ? "text-white" : "text-navy-900",
        )}
      >
        풍현
      </span>
    </span>
  );
}
