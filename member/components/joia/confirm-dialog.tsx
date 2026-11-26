"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/member/components/ui/button";
import { cn } from "@/member/lib/utils";

/** Accessible confirmation dialog built on the native <dialog> element (focus trap + Esc). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  pending,
  tone = "dark",
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  tone?: "dark" | "light";
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-labelledby="confirm-title"
      className={cn(
        "m-auto w-[min(92vw,420px)] rounded-3xl border p-6 backdrop:bg-black/70 backdrop:backdrop-blur-sm",
        tone === "dark" ? "border-line bg-surface text-pearl" : "border-black/10 bg-white text-ink",
      )}
    >
      <h2 id="confirm-title" className="font-display text-2xl">
        {title}
      </h2>
      {description && <div className={cn("mt-2 text-sm", tone === "dark" ? "text-pearl-muted" : "text-black/60")}>{description}</div>}
      {children && <div className="mt-4">{children}</div>}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? "danger" : "primary"} size="sm" onClick={onConfirm} loading={pending}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
