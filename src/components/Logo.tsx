import Image from "next/image";
import { cn } from "@/lib/cn";

// 풍현 로고 심볼 — 딥네이비 "P" 마크(원본 에셋).
// 밝은 배경엔 네이비 P, 어두운 배경엔 화이트 P를 사용합니다.
export function LogoMark({
  size = 32,
  tone = "light",
  className,
}: {
  size?: number;
  tone?: "light" | "dark";
  className?: string;
}) {
  const src = tone === "dark" ? "/logo-mark-white.png" : "/logo-mark.png";
  return (
    <Image
      src={src}
      width={size}
      height={size}
      alt="풍현 로고"
      className={className}
      priority
    />
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
