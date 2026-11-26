import { cn } from "@/member/lib/utils";
import { cardTheme } from "@/member/styles/design-tokens";

type Tone = "neutral" | "success" | "warning" | "danger" | "ruby" | "info";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-current/8 text-current/80 ring-current/15",
  success: "bg-success/12 text-success ring-success/30",
  warning: "bg-warning/14 text-[#b77714] ring-warning/35",
  danger: "bg-danger/12 text-danger ring-danger/30",
  ruby: "bg-ruby/12 text-ruby ring-ruby/30",
  info: "bg-sky-500/12 text-sky-600 ring-sky-500/30",
};

/** Maps any status enum value to a semantic tone. */
const STATUS_TONES: Record<string, Tone> = {
  ACTIVE: "success", VALID: "success", SENT: "success", CONFIRMED: "success", COMPLETED: "neutral", PUBLISHED: "success", LIVE: "ruby", MEMBERS: "success",
  INVITED: "info", PENDING_ACTIVATION: "info", NEW: "ruby", IN_PROGRESS: "info", SCHEDULED: "info", DRAFT: "neutral", SENDING: "info", RESTRICTED: "warning",
  WAITING_FOR_MEMBER: "warning", USED: "neutral", NOT_VALID_YET: "warning", ALREADY_USED: "warning", WRONG_ACCESS_ZONE: "warning", SUSPENDED: "warning",
  EXPIRED: "neutral", CANCELLED: "neutral", ARCHIVED: "neutral",
  REVOKED: "danger", INVALID: "danger", DISABLED: "danger", FAILED: "danger",
  URGENT: "danger", HIGH: "warning", NORMAL: "neutral", LOW: "neutral",
};

export function StatusBadge({ status, label, className, tone }: { status: string; label?: string; className?: string; tone?: Tone }) {
  const t = tone ?? STATUS_TONES[status] ?? "neutral";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ring-1 ring-inset", toneClasses[t], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label ?? status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}

export function TierBadge({ name, theme, className }: { name: string; theme: string | null | undefined; className?: string }) {
  const t = cardTheme(theme);
  return (
    <span
      className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]", className)}
      style={{ background: t.base, color: t.text, boxShadow: `inset 0 0 0 1px ${t.edge}` }}
    >
      {name}
    </span>
  );
}
