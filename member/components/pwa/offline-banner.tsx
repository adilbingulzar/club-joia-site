"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/** Slim banner shown while the device is offline. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="sticky top-16 z-20 flex items-center justify-center gap-2 bg-warning px-4 py-2 text-xs font-medium text-ink">
      <WifiOff className="size-3.5" aria-hidden />
      Connection lost — showing saved information. Tickets need a connection to refresh.
    </div>
  );
}
