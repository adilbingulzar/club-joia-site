"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ConciergeBell, CreditCard, House, UserRound } from "lucide-react";
import { cn } from "@/member/lib/utils";

const ITEMS = [
  { href: "/account", label: "Home", icon: House, match: (p: string) => p === "/account" },
  { href: "/account/events", label: "Events", icon: CalendarDays, match: (p: string) => p.startsWith("/account/events") || p.startsWith("/account/tickets") },
  { href: "/account/card", label: "Card", icon: CreditCard, match: (p: string) => p.startsWith("/account/card") },
  { href: "/account/concierge", label: "Concierge", icon: ConciergeBell, match: (p: string) => p.startsWith("/account/concierge") },
  { href: "/account/profile", label: "Profile", icon: UserRound, match: (p: string) => p.startsWith("/account/profile") },
];

export function BottomNav() {
  return <BottomNavFrame pathname={usePathname()} />;
}

/** Pathname-free render used as the static-shell fallback (no active item). */
export function BottomNavFrame({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Primary" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/85 backdrop-blur-xl">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = pathname !== null && match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 pb-1.5 pt-3 text-[9.5px] font-medium uppercase tracking-[0.16em] transition-colors",
                  active ? "text-pearl" : "text-pearl-dim hover:text-pearl-muted",
                )}
              >
                <span className="relative">
                  <Icon className="size-[21px]" strokeWidth={active ? 1.9 : 1.5} aria-hidden />
                  {active && <span className="absolute -bottom-1.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-ruby" aria-hidden />}
                </span>
                <span className="mt-1">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
