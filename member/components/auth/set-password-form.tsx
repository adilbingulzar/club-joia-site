"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/member/components/ui/button";
import { Checkbox, FormMessage, TextField } from "@/member/components/ui/form";
import { activateAction, resetPasswordAction, type AuthFormState } from "@/member/server/auth-actions";

/** Shared by password reset and account activation. */
export function SetPasswordForm({ token, mode, termsUrl, privacyUrl }: { token: string; mode: "reset" | "activate"; termsUrl?: string; privacyUrl?: string }) {
  const [state, action] = useActionState<AuthFormState, FormData>(mode === "reset" ? resetPasswordAction : activateAction, undefined);
  const fe = state?.error?.fieldErrors;
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage error={state?.error} />
      <input type="hidden" name="token" value={token} />
      <TextField label="New password" name="password" type="password" autoComplete="new-password" required minLength={12} error={fe?.password} />
      <TextField label="Confirm password" name="confirm" type="password" autoComplete="new-password" required error={fe?.confirm} />
      {mode === "activate" && (
        <div className="space-y-1">
          <Checkbox
            name="acceptTerms"
            required
            label={
              <>
                I accept the CLUB JOIA 300{" "}
                <a href={termsUrl ?? "/terms"} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  membership terms
                </a>{" "}
                and{" "}
                <a href={privacyUrl ?? "/privacy"} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  privacy policy
                </a>
                .
              </>
            }
          />
          {fe?.acceptTerms && <p className="text-xs text-ruby">{fe.acceptTerms[0]}</p>}
        </div>
      )}
      <SubmitButton size="lg" className="w-full" pendingLabel="Saving">
        {mode === "reset" ? "Save new password" : "Activate membership"}
      </SubmitButton>
    </form>
  );
}
