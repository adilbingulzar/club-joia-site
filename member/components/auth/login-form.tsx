"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/member/components/ui/button";
import { FormMessage, TextField } from "@/member/components/ui/form";
import { loginAction, type AuthFormState } from "@/member/server/auth-actions";

export function LoginForm({ next, resetDone }: { next?: string; resetDone?: boolean }) {
  const [state, action] = useActionState<AuthFormState, FormData>(loginAction, undefined);
  return (
    <form action={action} className="space-y-5" noValidate>
      {resetDone && !state && <FormMessage success="Your password has been updated. Please sign in." />}
      <FormMessage error={state?.error} />
      <input type="hidden" name="next" value={next ?? ""} />
      
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        required
        defaultValue={state?.values?.email}
        error={state?.error?.fieldErrors?.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state?.error?.fieldErrors?.password}
      />
      <SubmitButton size="lg" className="w-full" pendingLabel="Signing in">
        Sign in
      </SubmitButton>
    </form>
  );
}
