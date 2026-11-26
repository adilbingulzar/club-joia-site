'use server';
/*
 * The member's forms (club-joia-300-backend src/app/(member)/actions.ts, the same names and results),
 * each sent to the members app (member/server/api.ts form()), which checks and saves it.
 */
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MEMBER_COOKIE, cookieOptions } from '@/lib/members';
import type { ActionResult } from '@/member/lib/errors';
import { fieldsOf, form } from './api';

export async function toggleFavoriteAction(programItemId: string) {
  const res = await form<{ favorite: boolean }>('favorite', { itemId: programItemId });
  revalidatePath('/account/events', 'layout');
  return res;
}

export async function markNotificationsReadAction(recipientId?: string) {
  const res = await form<null>('notifications-read', recipientId ? { recipientId: recipientId } : {});
  revalidatePath('/account/notifications');
  revalidatePath('/account', 'layout');
  return res;
}

// ─── Profile ────────────────────────────────────────────────────────────────

export type FormState = ActionResult<string | undefined> | undefined;

async function profileForm(action: string, data: FormData): Promise<FormState> {
  const res = await form<string>(action, fieldsOf(data));
  if (res.ok) revalidatePath('/account/profile');
  return res;
}

export async function updatePersonalAction(_prev: FormState, data: FormData): Promise<FormState> {
  return profileForm('profile-personal', data);
}

export async function updateHospitalityAction(_prev: FormState, data: FormData): Promise<FormState> {
  return profileForm('profile-hospitality', data);
}

export async function updateEmergencyAction(_prev: FormState, data: FormData): Promise<FormState> {
  return profileForm('profile-emergency', data);
}

export async function updateNotificationPrefsAction(_prev: FormState, data: FormData): Promise<FormState> {
  return profileForm('profile-notifications', data);
}

export async function updatePrivacyAction(_prev: FormState, data: FormData): Promise<FormState> {
  return profileForm('profile-privacy', data);
}

export async function uploadPhotoAction(_prev: FormState, data: FormData): Promise<FormState> {
  const f = data.get('photo');
  if (!(f instanceof File) || f.size === 0) return { ok: false, error: { code: 'VALIDATION', message: 'Choose a photo.' } };
  const res = await form<string>('photo-upload', {}, f);
  if (res.ok) revalidatePath('/account', 'layout');
  return res;
}

export async function removePhotoAction() {
  const res = await form<null>('photo-remove');
  revalidatePath('/account', 'layout');
  return res;
}

export async function changePasswordAction(_prev: FormState, data: FormData): Promise<FormState> {
  return form<string>('change-password', fieldsOf(data));
}

export async function signOutEverywhereAction() {
  const res = await form<number>('sign-out-everywhere');
  if (res.ok) {
    (await cookies()).set(MEMBER_COOKIE, '', Object.assign(cookieOptions(new Date(0)), { maxAge: 0 }));
    redirect('/login');
  }
  return res;
}

export async function requestDeletionAction(_prev: FormState, data: FormData): Promise<FormState> {
  return profileForm('request-deletion', data);
}

// ─── Concierge ──────────────────────────────────────────────────────────────

export type ConciergeFormState = ActionResult<{ id: string }> | undefined;

function attachmentOf(data: FormData): File | null {
  const f = data.get('attachment');
  return f instanceof File && f.size > 0 ? f : null;
}

export async function createConciergeAction(_prev: ConciergeFormState, data: FormData): Promise<ConciergeFormState> {
  const res = await form<{ id: string }>('concierge-create', fieldsOf(data), attachmentOf(data));
  if (res.ok) {
    revalidatePath('/account/concierge');
    redirect('/account/concierge/' + encodeURIComponent(res.data.id) + '?created=1');
  }
  return res;
}

export async function sendConciergeMessageAction(_prev: FormState, data: FormData): Promise<FormState> {
  const fields = fieldsOf(data);
  const res = await form<null>('concierge-message', fields, attachmentOf(data));
  if (!res.ok) return res;
  revalidatePath('/account/concierge/' + encodeURIComponent(String(fields.requestId || '')));
  return { ok: true, data: undefined };
}

export async function cancelConciergeAction(requestId: string) {
  const res = await form<null>('concierge-cancel', { requestId: requestId });
  revalidatePath('/account/concierge/' + encodeURIComponent(requestId));
  revalidatePath('/account/concierge');
  return res;
}
