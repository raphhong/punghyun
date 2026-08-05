import { cn } from "@/lib/cn";
import { Container } from "./Container";

export function Section({
  className,
  children,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-16 sm:py-20 lg:py-24", className)}>
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  invert = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  invert?: boolean;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
      )}
    >
      {eyebrow && (
        <p
          className={cn(
            "text-sm font-semibold uppercase tracking-wide",
            invert ? "text-brand-300" : "text-brand-600",
          )}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={cn(
          "mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl",
          invert ? "text-white" : "text-navy-900",
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-4 text-pretty text-lg leading-relaxed",
            invert ? "text-navy-300" : "text-navy-600",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
