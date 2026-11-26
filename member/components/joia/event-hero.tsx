import Link from "next/link";
import { cn } from "@/member/lib/utils";
import { formatDateOnly } from "@/member/lib/time";

/**
 * Event hero. Uses the event's hero image when one is configured; otherwise an atmospheric
 * dusk-over-water gradient composition (no stock imagery is shipped).
 */
export function EventHero({
  city,
  title,
  start,
  end,
  heroImage,
  href,
  children,
  className,
}: {
  city: string;
  title: string;
  start: string;
  end: string;
  heroImage?: string | null;
  href?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const dates = sameMonth
    ? `${formatDateOnly(start, { day: "numeric" })}–${formatDateOnly(end, { day: "numeric", month: "long", year: "numeric" })}`
    : `${formatDateOnly(start, { day: "numeric", month: "short" })} – ${formatDateOnly(end, { day: "numeric", month: "short", year: "numeric" })}`;

  const body = (
    <div className={cn("on-dark relative isolate overflow-hidden rounded-[var(--radius-card)] border border-line text-pearl", className)}>
      {heroImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded image served by /api/files after an auth check
        <img src={heroImage} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-70" />
      ) : (
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#1b0609_0%,#3b0a12_38%,#9c1c2b_58%,#e0703f_66%,#1a1213_67%,#07090c_100%)]" />
          <div className="absolute left-[62%] top-[50%] size-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffb35c]/70 blur-2xl" />
          <div className="absolute inset-x-0 top-[66%] bottom-0 bg-[repeating-linear-gradient(180deg,rgba(255,170,110,0.07)_0px,rgba(255,170,110,0.07)_1px,transparent_1px,transparent_7px)]" />
        </div>
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/20 to-black/10" aria-hidden />
      <div className="flex min-h-[300px] flex-col justify-end p-6">
        <p className="eyebrow text-pearl-muted">{dates}</p>
        <h2 className="display mt-2 text-[44px] uppercase">{city}</h2>
        <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.3em] text-pearl">{title}</p>
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-transform active:scale-[0.99]">
      {body}
    </Link>
  ) : (
    body
  );
}
