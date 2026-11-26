"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Bell, ConciergeBell, CreditCard, Megaphone, Ticket, Car, CalendarDays } from "lucide-react";
import { cn, memberPath } from "@/member/lib/utils";
import type { NotificationType } from "@/member/lib/enums";

const ICONS: Record<NotificationType, typeof Bell> = {
  ANNOUNCEMENT: Megaphone,
  PROGRAMME: CalendarDays,
  TICKET: Ticket,
  CONCIERGE: ConciergeBell,
  TRANSPORT: Car,
  MEMBERSHIP: CreditCard,
  SYSTEM: Bell,
};

export type NotificationItem = { id: string; title: string; body: string; type: NotificationType; url: string | null; at: Date; read: boolean };

export function NotificationCard({ item, onRead }: { item: NotificationItem; onRead?: (id: string) => Promise<unknown> }) {
  const Icon = ICONS[item.type] ?? Bell;
  const [, start] = useTransition();
  const content = (
    <div className={cn("flex gap-4 rounded-2xl border p-4 transition-colors", item.read ? "border-line bg-transparent" : "border-pearl/20 bg-surface")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", item.read ? "bg-surface text-pearl-dim" : "bg-ruby/15 text-ruby")}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className={cn("text-[15px] leading-snug", item.read ? "text-pearl-muted" : "font-medium text-pearl")}>{item.title}</p>
          {!item.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ruby" aria-label="Unread" />}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-pearl-dim">{item.body}</p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-pearl-dim">
          {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(item.at)}
        </p>
      </div>
    </div>
  );
  const markRead = () => !item.read && onRead && start(() => void onRead(item.id));
  return item.url ? (
    <Link href={memberPath(item.url)} onClick={markRead} className="block">
      {content}
    </Link>
  ) : (
    <button type="button" onClick={markRead} className="block w-full text-left">
      {content}
    </button>
  );
}
