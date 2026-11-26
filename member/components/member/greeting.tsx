"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

function partOfDay() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  return "Good evening";
}

/** Greeting based on the member's own device time (they may not yet be in Abu Dhabi). */
export function Greeting({ firstName }: { firstName: string }) {
  const salutation = useSyncExternalStore(noop, partOfDay, () => "Welcome");
  return (
    <div>
      <p className="eyebrow">{salutation}</p>
      <h1 className="display mt-2 text-[44px]">{firstName}</h1>
    </div>
  );
}
