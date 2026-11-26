"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { AlertTriangle, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import { useOnline } from "@/member/components/pwa/offline-banner";
import { useNow } from "@/member/hooks/use-now";
import { cn } from "@/member/lib/utils";

type State =
  | { kind: "loading" }
  | { kind: "ready"; svg: string; expiresAt: number; refreshAt: number }
  | { kind: "unavailable"; message: string }
  | { kind: "error"; message: string };

/**
 * Live, rotating QR credential. The token is fetched from the server (never cached to disk,
 * never written to storage), held only in memory, and refreshed before it expires. The ticket
 * number is always shown as the accessible / manual fallback.
 */
export function QRCodeDisplay({ ticketNumber, status }: { ticketNumber: string; status: string }) {
  const [state, setState] = useState<State>({ kind: status === "ACTIVE" ? "loading" : "unavailable", message: unavailableMessage(status) });
  const now = useNow(1000) ?? 0;
  const online = useOnline();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const loadRef = useRef<() => void>(() => {});

  const load = useCallback(async () => {
    clearTimeout(timer.current);
    try {
      const res = await fetch("/api/account/qr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketNumber }), cache: "no-store", credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ kind: res.status === 409 || res.status === 404 ? "unavailable" : "error", message: (typeof body?.error === "string" ? body.error : body?.error?.message) ?? "QR code unavailable right now." });
        return;
      }
      const svg = await QRCode.toString(body.token, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#050505", light: "#ffffff" } });
      setState({ kind: "ready", svg, expiresAt: new Date(body.expiresAt).getTime(), refreshAt: Date.now() + body.refreshInSeconds * 1000 });
      timer.current = setTimeout(() => loadRef.current(), body.refreshInSeconds * 1000);
    } catch {
      setState((s) => (s.kind === "ready" ? s : { kind: "error", message: "We couldn’t reach CLUB JOIA. Check your connection." }));
      timer.current = setTimeout(() => loadRef.current(), 10_000);
    }
  }, [ticketNumber]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (status !== "ACTIVE") return;
    // Fetch the first credential after mount (async — state is set when the request resolves).
    const first = setTimeout(() => loadRef.current(), 0);
    const onVisible = () => document.visibilityState === "visible" && loadRef.current();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status]);

  // Keep the screen awake while the QR is shown (best effort; not on every browser).
  useEffect(() => {
    if (state.kind !== "ready" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, [state.kind]);

  const expired = state.kind === "ready" && now > 0 && now > state.expiresAt;
  const secondsLeft = state.kind === "ready" ? Math.max(0, Math.round((state.expiresAt - now) / 1000)) : 0;

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "relative grid aspect-square w-full max-w-[320px] place-items-center overflow-hidden rounded-3xl bg-white p-5 shadow-card",
          state.kind !== "ready" && "bg-surface",
        )}
      >
        {state.kind === "loading" && <div className="skeleton size-full rounded-xl" role="status" aria-label="Preparing your secure QR code" />}
        {state.kind === "ready" && (
          <div
            role="img"
            aria-label={`Secure QR code for ticket ${ticketNumber}`}
            className={cn("size-full transition-opacity [&_svg]:size-full", expired && "opacity-15")}
            dangerouslySetInnerHTML={{ __html: state.svg }}
          />
        )}
        {(state.kind === "unavailable" || state.kind === "error") && (
          <div role="alert" className="flex flex-col items-center gap-3 px-4 text-center">
            <AlertTriangle className="size-8 text-warning" aria-hidden />
            <p className="text-sm text-pearl">{state.message}</p>
          </div>
        )}
        {expired && (
          <button onClick={load} className="absolute inset-0 grid place-items-center text-ink">
            <span className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs uppercase tracking-[0.18em] text-pearl">
              {online ? <RefreshCw className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
              {online ? "Refresh code" : "Offline — reconnect"}
            </span>
          </button>
        )}
      </div>

      {state.kind === "ready" && !expired && (
        <p className="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-pearl-dim" aria-live="off">
          <ShieldCheck className="size-3.5 text-success" aria-hidden />
          Secure code · refreshes automatically · {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
        </p>
      )}
      {state.kind === "error" && (
        <button onClick={load} className="mt-4 text-[11px] uppercase tracking-[0.2em] text-ruby">
          Try again
        </button>
      )}

      <div className="mt-6 text-center">
        <p className="eyebrow">Ticket number</p>
        <p className="mt-1 select-all font-mono text-lg tracking-[0.18em] text-pearl">{ticketNumber}</p>
        <p className="mt-1 text-xs text-pearl-dim">If scanning fails, staff can look up this number.</p>
      </div>
    </div>
  );
}

function unavailableMessage(status: string) {
  switch (status) {
    case "REVOKED":
      return "This ticket has been revoked. Please contact concierge.";
    case "SUSPENDED":
      return "This ticket is temporarily suspended. Please contact concierge.";
    case "EXPIRED":
      return "This ticket has expired.";
    case "USED":
      return "This ticket has been fully used.";
    default:
      return "QR code unavailable.";
  }
}
