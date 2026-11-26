import Link from "next/link";
import { cn } from "@/member/lib/utils";

/** Elegant empty state used across member and admin screens. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "dark",
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: { href: string; label: string };
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-[var(--radius-card)] border border-dashed px-6 py-12 text-center",
        tone === "dark" ? "border-line text-pearl" : "border-black/12 text-ink",
        className,
      )}
    >
      {icon && <div className={cn("mb-4 opacity-60 [&_svg]:size-7", tone === "dark" ? "text-pearl-muted" : "text-black/50")}>{icon}</div>}
      <p className="font-display text-2xl">{title}</p>
      {description && <div className={cn("mt-2 max-w-sm text-sm", tone === "dark" ? "text-pearl-dim" : "text-black/55")}>{description}</div>}
      {action && (
        <Link href={action.href} className="mt-6 text-[11px] font-medium uppercase tracking-[0.2em] text-ruby underline-offset-4 hover:underline">
          {action.label}
        </Link>
      )}
    </div>
  );
}

/** Skeleton loaders. `lines` renders text rows; `card` renders a card-shaped block. */
export function LoadingSkeleton({ variant = "lines", lines = 3, className }: { variant?: "lines" | "card" | "list" | "hero"; lines?: number; className?: string }) {
  if (variant === "card") return <div className={cn("skeleton aspect-[1.586/1] w-full rounded-[18px]", className)} aria-hidden />;
  if (variant === "hero") return <div className={cn("skeleton h-64 w-full rounded-[var(--radius-card)]", className)} aria-hidden />;
  if (variant === "list") {
    return (
      <div className={cn("space-y-3", className)} aria-hidden>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="skeleton h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  return (
    <div className={cn("space-y-2.5", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-3.5" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

/** Screen-reader announcement + skeleton for a whole route segment. */
export function PageLoading({ label = "Loading", variant = "list" }: { label?: string; variant?: "lines" | "card" | "list" | "hero" }) {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">{label}…</span>
      <div className="skeleton h-8 w-1/2" aria-hidden />
      <LoadingSkeleton variant={variant} lines={4} />
    </div>
  );
}
