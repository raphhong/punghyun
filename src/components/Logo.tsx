import { cn } from "@/lib/cn";

// 풍현 로고 심볼 — 간결한 "P" 모노그램.
// 곧게 뻗은 세로 기둥 + 부드러운 보울로 안정감과 신뢰를 담았습니다.
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
        d="M12 24 V8 H16.5 A4.5 4.5 0 0 1 16.5 17 H12"
        fill="none"
        stroke="#57d7a3"
        strokeWidth="3"
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
