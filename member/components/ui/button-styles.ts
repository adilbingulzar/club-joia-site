import { cn } from "@/member/lib/utils";

/** Button class recipe — usable from Server Components (e.g. for styled <Link>s). */
export type Variant = "primary" | "secondary" | "ghost" | "danger" | "pearl" | "outline";
export type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-ruby text-white hover:bg-[#ff3a52] active:bg-ruby-deep",
  pearl: "bg-pearl text-ink hover:bg-white",
  secondary: "bg-surface-raised text-pearl border border-line hover:bg-[#202024]",
  outline: "border border-current/25 text-current hover:bg-current/5",
  ghost: "text-current hover:bg-current/5",
  danger: "bg-danger text-white hover:bg-[#f04a4d]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-6 text-[15px]",
};

export const buttonClasses = (variant: Variant = "primary", size: Size = "md", className?: string) =>
  cn(
    "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium uppercase tracking-[0.14em] transition-colors disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
