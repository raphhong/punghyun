import { cn } from "@/lib/cn";
export function Field({ id, label, hint, error, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; hint?: string; error?: string }) {
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : "", props["aria-describedby"]].filter(Boolean).join(" ") || undefined;
  return <div><label htmlFor={id} className="ph-field-label">{label}{props.required && <span> (필수)</span>}</label><input {...props} id={id} className={cn("ph-input mt-2", className)} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={describedBy} />{hint && <p id={`${id}-hint`} className="ph-field-hint">{hint}</p>}{error && <p id={`${id}-error`} className="ph-input-error">{error}</p>}</div>;
}
