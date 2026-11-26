"use client";

import { useSyncExternalStore } from "react";

/**
 * Current time, re-rendering every `intervalMs`. Returns null during SSR/hydration so
 * time-dependent UI never mismatches the server render.
 */
export function useNow(intervalMs = 1000): number | null {
  return useSyncExternalStore(
    (onChange) => {
      const id = setInterval(onChange, intervalMs);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null,
  );
}
