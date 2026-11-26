"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { SubmitButton, Button } from "@/member/components/ui/button";
import { FormMessage } from "@/member/components/ui/form";
import { ConfirmDialog } from "@/member/components/joia/confirm-dialog";
import type { ActionError } from "@/member/lib/errors";
import { removePhotoAction, signOutEverywhereAction, uploadPhotoAction, type FormState } from "@/member/server/actions";

/** A profile section form: renders its fields, a save button and the result message. */
export function SectionForm({
  action,
  children,
  submitLabel = "Save",
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state && (state.ok ? <FormMessage success={state.data ?? "Saved."} /> : <FormMessage error={state.error} />)}
      {children}
      <SubmitButton variant="secondary" pendingLabel="Saving">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

export function PhotoUploader({ hasPhoto }: { hasPhoto: boolean }) {
  const [state, formAction] = useActionState<FormState, FormData>(uploadPhotoAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {state && (state.ok ? <FormMessage success={state.data ?? "Saved."} /> : <FormMessage error={state.error} />)}
      <form ref={formRef} action={formAction} className="flex flex-wrap gap-2">
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-xs font-medium uppercase tracking-[0.14em] text-pearl hover:bg-white/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ruby">
          <Camera className="size-4" aria-hidden />
          {hasPhoto ? "Change photo" : "Add photo"}
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={() => formRef.current?.requestSubmit()}
          />
        </label>
        {hasPhoto && (
          <Button type="button" variant="ghost" size="sm" loading={pending} onClick={() => start(() => void removePhotoAction())}>
            <Trash2 className="size-4" aria-hidden /> Remove
          </Button>
        )}
      </form>
      <p className="text-xs text-pearl-dim">JPG, PNG or WebP up to 5 MB. Used on your profile and to verify you at check-in.</p>
    </div>
  );
}

export function SignOutEverywhere() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <FormMessage error={error} />
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Sign out on all devices
      </Button>
      <ConfirmDialog
        open={open}
        title="Sign out everywhere?"
        description="You will be signed out on every phone, tablet and computer, including this one."
        confirmLabel="Sign out all"
        destructive
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const res = await signOutEverywhereAction();
            if (res && !res.ok) setError(res.error);
            setOpen(false);
          })
        }
      />
    </>
  );
}
