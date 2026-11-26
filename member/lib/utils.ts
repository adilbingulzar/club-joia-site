import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(first?: string | null, last?: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "CJ";
}

export function formatDateTime(d: Date | string, timeZone = "Asia/Dubai") {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export function formatDate(d: Date | string, timeZone = "UTC") {
  return new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}

/** A link the members app stores (a notification's "/tickets/…") on this site: its pages are under /account. */
export function memberPath(url: string): string {
  if (!url.startsWith("/") || url.startsWith("//") || url.startsWith("/account")) return url;
  return url === "/" ? "/account" : "/account" + url;
}
