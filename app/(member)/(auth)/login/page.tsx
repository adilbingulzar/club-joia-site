import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/member/components/auth/login-form';
import { sessionToken } from '@/lib/members';

export const metadata: Metadata = { title: 'Sign in' };

// club-joia-300-backend src/app/(auth)/login/page.tsx
export default function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="animate-fade-up">
      <p className="eyebrow text-center">Members</p>
      <h1 className="display mt-3 text-center text-5xl">Welcome back</h1>
      <div className="mt-10">
        <Suspense fallback={<div className="skeleton h-64" aria-hidden />}>
          <LoginFormWithParams searchParams={searchParams} />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-sm text-pearl-dim">
        <a href="/forgot-password" className="underline-offset-4 hover:text-pearl hover:underline">Forgot your password?</a>
      </p>
    </div>
  );
}

async function LoginFormWithParams({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // already signed in: the account (an ended session is sent back here by the account's pages)
  if ((await sessionToken()) && !(await searchParams).reset) {
    const { call } = await import('@/member/server/api');
    if ((await call('header')).ok) redirect('/account');
  }
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : undefined;
  return <LoginForm next={next} resetDone={sp.reset === '1'} />;
}
