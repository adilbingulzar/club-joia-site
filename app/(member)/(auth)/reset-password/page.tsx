import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { memberApi, PASSWORD_MIN } from '@/lib/members';
import { SetPasswordForm } from '@/member/components/auth/set-password-form';

export const metadata: Metadata = { title: 'Choose a new password' };

// The link in the "Reset your password" email (club-joia-300-backend src/app/(auth)/reset-password/page.tsx)
export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="animate-fade-up">
      <p className="eyebrow text-center">Account</p>
      <h1 className="display mt-3 text-center text-5xl">New password</h1>
      <Suspense fallback={<div className="skeleton mt-10 h-56" aria-hidden />}>
        <ResetBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ResetBody({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await searchParams;
  const r = typeof token === 'string' ? await memberApi<{ email: string }>('reset-check', { token: token.slice(0, 200) }, { headers: await headers() }) : null;
  if (!r || !r.ok || typeof token !== 'string') {
    return (
      <div className="mt-8 space-y-6 text-center">
        <p className="text-sm text-pearl-muted">{r && !r.ok && r.error.code === 'UNAVAILABLE' ? r.error.message : 'This reset link is invalid or has expired.'}</p>
        <Link href="/forgot-password" className="text-[11px] uppercase tracking-[0.2em] text-ruby">
          Request a new link
        </Link>
      </div>
    );
  }
  return (
    <div className="mt-10">
      <p className="mb-6 text-center text-sm text-pearl-muted">
        For {r.data.email}. Use at least {PASSWORD_MIN} characters — a short phrase works well.
      </p>
      <SetPasswordForm token={token} mode="reset" />
    </div>
  );
}
