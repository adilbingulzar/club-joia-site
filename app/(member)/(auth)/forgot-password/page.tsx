"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/member/components/ui/button";
import { FormMessage, TextField } from "@/member/components/ui/form";
import { requestResetAction, type AuthFormState } from "@/member/server/auth-actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState<AuthFormState, FormData>(requestResetAction, undefined);
  return (
    <div className="animate-fade-up">
      <title>Reset password · CLUB JOIA 300</title>
      <p className="eyebrow text-center">Account</p>
      <h1 className="display mt-3 text-center text-5xl">Reset password</h1>
      <p className="mt-4 text-center text-sm text-pearl-muted">Enter your membership email and we will send you a secure link.</p>
      <form action={action} className="mt-10 space-y-5" noValidate>
        <FormMessage error={state?.error} success={state?.success} />
        <TextField label="Email" name="email" type="email" autoComplete="email" inputMode="email" required error={state?.error?.fieldErrors?.email} />
        <SubmitButton size="lg" className="w-full" pendingLabel="Sending">
          Send reset link
        </SubmitButton>
        <p className="text-center text-sm text-pearl-dim">
          <Link href="/login" className="underline-offset-4 hover:text-pearl hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
