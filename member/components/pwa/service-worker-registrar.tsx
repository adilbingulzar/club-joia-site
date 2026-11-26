"use client";

import { useEffect } from "react";

/** Registers /member-sw.js for the member pages (/account: offline page, asset cache). No-op where unsupported. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !window.location.search.includes("sw=1") && !localStorageFlag()) return;
    navigator.serviceWorker.register("/member-sw.js", { scope: "/account", updateViaCache: "none" }).catch((err) => {
      console.warn("Service worker registration failed", err);
    });
  }, []);
  return null;
}

/** In development the SW is opt-in (?sw=1 once) so hot reload isn't fighting a cache. */
function localStorageFlag() {
  try {
    if (window.location.search.includes("sw=1")) window.localStorage.setItem("joia-dev-sw", "1");
    return window.localStorage.getItem("joia-dev-sw") === "1";
  } catch {
    return false;
  }
}
