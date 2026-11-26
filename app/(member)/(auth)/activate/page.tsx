import type { Metadata } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { memberApi, PASSWORD_MIN } from '@/lib/members';
import { SetPasswordForm } from '@/member/components/auth/set-password-form';

export const metadata: Metadata = { title: 'Activate your membership' };

// The link in the invitation email (club-joia-300-backend src/app/(auth)/activate/page.tsx)
export default function ActivatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="animate-fade-up">
      <p className="eyebrow text-center">Your invitation</p>
      <h1 className="display mt-3 text-center text-5xl">Welcome to the club</h1>
      <Suspense fallback={<div className="skeleton mt-10 h-72" aria-hidden />}>
        <ActivateBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ActivateBody({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await searchParams;
  const r = typeof token === 'string' ? await memberApi<{ email: string; name: string }>('activation', { token: token.slice(0, 200) }, { headers: await headers() }) : null;
  if (!r || !r.ok || typeof token !== 'string') {
    return (
      <p className="mt-8 text-center text-sm text-pearl-muted">
        {r && !r.ok && r.error.code === 'UNAVAILABLE' ? r.error.message : 'This invitation link is invalid, has already been used, or has expired. Please contact CLUB JOIA concierge for a new invitation.'}
      </p>
    );
  }
  return (
    <div className="mt-8">
      <p className="mb-8 text-center text-sm text-pearl-muted">
        {r.data.name}, set a password for <span className="text-pearl">{r.data.email}</span> to activate your private account. Use at least {PASSWORD_MIN} characters.
      </p>
      <SetPasswordForm token={token} mode="activate" termsUrl="/terms" privacyUrl="/privacy" />
    </div>
  );
}
