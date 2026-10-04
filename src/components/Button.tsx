import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";
type CommonProps = {
  variant?: Variant;
  size?: Size;
  context?: "marketing" | "workspace";
  className?: string;
  children: React.ReactNode;
};
function classes(variant: Variant, size: Size, context: "marketing" | "workspace", className?: string) {
  return cn("ph-button", `ph-button--${variant}`, context === "marketing" && "ph-button--marketing", size === "lg" && "ph-button--large", className);
}
export function ButtonLink({ href, variant = "primary", size = "md", context = "marketing", className, children, ...props }: CommonProps & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string }) {
  const external = /^(https?:|tel:|mailto:)/.test(href);
  const style = classes(variant, size, context, className);
  return external ? <a href={href} className={style} {...props}>{children}</a> : <Link href={href} className={style} {...props}>{children}</Link>;
}
export function Button({ variant = "primary", size = "md", context = "marketing", className, children, loading = false, disabled, ...props }: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return <button className={classes(variant, size, context, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{children}</button>;
}
