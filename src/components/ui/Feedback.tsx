import { cn } from "@/lib/cn";
export type StatusTone = "neutral" | "success" | "warning" | "danger";
export function StatusBadge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: StatusTone; className?: string }) {
  return <span className={cn("ph-status", `ph-status--${tone}`, className)}>{children}</span>;
}
export function Feedback({ children, tone = "neutral", title, urgent = false, className }: { children: React.ReactNode; tone?: StatusTone; title?: string; urgent?: boolean; className?: string }) {
  return <div role={urgent ? "alert" : "status"} className={cn("ph-feedback", `ph-status--${tone}`, className)}>{title && <p className="font-semibold">{title}</p>}<div className={title ? "mt-1" : undefined}>{children}</div></div>;
}
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="ph-empty"><p className="font-medium">{title}</p>{children && <div className="mt-1">{children}</div>}</div>;
}
