'use client';
import { useActionState } from 'react';
import { login, type LoginState } from '@/app/admin/actions';

export default function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);
  return (
    <form action={action}>
      <img src="/assets/img/logo.png" alt="Club JOIA 300" />
      <h1>Sales dashboard</h1>
      <p className="lead">Sign in with your Club JOIA 300 staff account and the code from your authenticator app.</p>
      {state?.error ? <p className="err" role="alert">{state.error}</p> : notice ? <p className="err" role="status">{notice}</p> : null}
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state?.email || ''} />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      <label htmlFor="code">Authentication code</label>
      <input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} placeholder="123456" required />
      <button className="adm-btn primary" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
