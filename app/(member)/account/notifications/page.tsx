import type { Metadata } from "next";
import { Suspense } from "react";
import { page } from "@/member/server/api";
import type { NotificationItem } from "@/member/lib/types";
import { PageLoading } from "@/member/components/joia/states";
import { NotificationList } from "./notification-list";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Messages from the club</p>
        <h1 className="display mt-2 text-5xl">Notifications</h1>
      </header>
      <Suspense fallback={<PageLoading label="Loading notifications" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const { items } = await page<{ items: NotificationItem[] }>("notifications");
  return (
    <div className="space-y-6">
      <NotificationList items={items} />
    </div>
  );
}
