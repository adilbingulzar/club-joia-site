"use client";

import { useTransition } from "react";
import { BellOff } from "lucide-react";
import { NotificationCard, type NotificationItem } from "@/member/components/joia/notification-card";
import { EmptyState } from "@/member/components/joia/states";
import { markNotificationsReadAction } from "@/member/server/actions";

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const [pending, start] = useTransition();
  if (items.length === 0) {
    return <EmptyState icon={<BellOff />} title="All quiet" description="Updates about your tickets, the programme and concierge will appear here." />;
  }
  const unread = items.filter((i) => !i.read).length;
  return (
    <div className="space-y-3">
      {unread > 0 && (
        <div className="flex justify-end">
          <button
            disabled={pending}
            onClick={() => start(() => void markNotificationsReadAction())}
            className="text-[10px] uppercase tracking-[0.2em] text-pearl-muted hover:text-pearl disabled:opacity-50"
          >
            Mark all as read ({unread})
          </button>
        </div>
      )}
      {items.map((n) => (
        <NotificationCard key={n.id} item={n} onRead={markNotificationsReadAction} />
      ))}
    </div>
  );
}
