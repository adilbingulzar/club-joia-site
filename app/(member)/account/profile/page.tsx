import type { Metadata } from "next";
import { Suspense } from "react";
import { Download, LogOut, Users } from "lucide-react";
import { page } from "@/member/server/api";
import type { Membership, Profile as MemberProfile } from "@/member/lib/types";
import { MemberAvatar } from "@/member/components/joia/member-avatar";
import { TierBadge } from "@/member/components/joia/badges";
import { PageLoading } from "@/member/components/joia/states";
import { Checkbox, Notice, SelectField, TextArea, TextField } from "@/member/components/ui/form";
import { logoutAction } from "@/member/server/auth-actions";
import {
  changePasswordAction,
  requestDeletionAction,
  updateEmergencyAction,
  updateHospitalityAction,
  updateNotificationPrefsAction,
  updatePersonalAction,
  updatePrivacyAction,
} from "@/member/server/actions";
import { PhotoUploader, SectionForm, SignOutEverywhere } from "./section-form";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageLoading label="Loading profile" />}>
      <Profile />
    </Suspense>
  );
}

function Section({ id, title, description, children, defaultOpen }: { id: string; title: string; description?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details id={id} open={defaultOpen} className="group border-b border-line py-1 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4">
        <span>
          <span className="block font-display text-2xl text-pearl">{title}</span>
          {description && <span className="mt-0.5 block text-xs text-pearl-dim">{description}</span>}
        </span>
        <span aria-hidden className="text-xl text-pearl-dim transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="pb-6 pt-1">{children}</div>
    </details>
  );
}

async function Profile() {
  const { profile: p, membership: m } = await page<{ profile: MemberProfile; membership: Membership }>("profile");
  const hosp = p.preferences.hospitality ?? {};
  const notif = p.preferences.notifications ?? {};

  return (
    <div className="animate-fade-up">
      <header className="flex items-center gap-4 pb-6">
        <MemberAvatar firstName={p.firstName} lastName={p.lastName} photoUrl={p.profilePhotoKey ? `/account/files/${p.profilePhotoKey}` : null} size={72} />
        <div>
          <h1 className="display text-4xl">
            {p.firstName} {p.lastName}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            {m.membership && <TierBadge name={m.membership.tier.displayName} theme={m.membership.tier.cardTheme} />}
            <span className="font-mono text-xs tracking-[0.14em] text-pearl-dim">{p.membershipNumber}</span>
          </div>
        </div>
      </header>

      {p.deletionRequestedAt && <Notice title="Deletion requested">CLUB JOIA has received your request to delete your account and will confirm by email.</Notice>}

      <Section id="account" title="Account" description={p.user.email}>
        <div className="space-y-6">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-pearl-dim">Email</dt><dd>{p.user.email}</dd></div>
            <div className="flex justify-between"><dt className="text-pearl-dim">Name on membership</dt><dd>{p.firstName} {p.lastName}</dd></div>
          </dl>
          <p className="text-xs text-pearl-dim">To change your name or email, please contact concierge.</p>
          <SectionForm action={changePasswordAction} submitLabel="Change password">
            <TextField label="Current password" name="current" type="password" autoComplete="current-password" required />
            <TextField label="New password" name="password" type="password" autoComplete="new-password" required hint="At least 12 characters." />
            <TextField label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
          </SectionForm>
          <SignOutEverywhere />
        </div>
      </Section>

      <Section id="photo" title="Profile photo">
        <PhotoUploader hasPhoto={Boolean(p.profilePhotoKey)} />
      </Section>

      <Section id="personal" title="Personal & contact">
        <SectionForm action={updatePersonalAction}>
          <TextField label="Preferred name" name="displayName" defaultValue={p.displayName ?? ""} hint="How we greet you in the app." />
          <TextField label="Mobile" name="mobile" type="tel" autoComplete="tel" defaultValue={p.mobile ?? ""} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="City" name="city" autoComplete="address-level2" defaultValue={p.city ?? ""} />
            <TextField label="Country" name="country" autoComplete="country-name" defaultValue={p.country ?? ""} />
          </div>
          <TextField label="Nationality" name="nationality" defaultValue={p.nationality ?? ""} hint="Optional" />
          <TextField label="Company" name="company" autoComplete="organization" defaultValue={p.company ?? ""} hint="Optional" />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Job title" name="jobTitle" defaultValue={p.jobTitle ?? ""} />
            <TextField label="Industry" name="industry" defaultValue={p.industry ?? ""} />
          </div>
          <TextArea label="Short bio" name="bio" maxLength={600} defaultValue={p.bio ?? ""} hint="Optional · private to CLUB JOIA staff." />
        </SectionForm>
      </Section>

      <Section id="hospitality" title="Hospitality & dietary" description="Helps our team prepare for your arrival.">
        <SectionForm action={updateHospitalityAction}>
          <TextField label="Dietary requirements" name="dietaryRequirements" defaultValue={p.dietaryRequirements ?? ""} placeholder="e.g. Vegetarian, halal" />
          <TextField label="Allergies" name="allergies" defaultValue={p.allergies ?? ""} placeholder="e.g. Shellfish" />
          <TextField label="Drinks preference" name="drinksPreference" defaultValue={hosp.drinksPreference ?? ""} placeholder="e.g. Blanc de blancs, no alcohol" />
          <TextField label="Seating preference" name="seatingPreference" defaultValue={hosp.seatingPreference ?? ""} />
          <SelectField label="Shirt size" name="shirtSize" defaultValue={p.shirtSize ?? ""} placeholder="—" options={["XS", "S", "M", "L", "XL", "XXL"].map((s) => ({ value: s, label: s }))} />
          <TextArea label="Arrival notes" name="arrivalNotes" defaultValue={hosp.arrivalNotes ?? ""} className="[&_textarea]:min-h-20" />
        </SectionForm>
      </Section>

      <Section id="emergency" title="Emergency contact">
        <SectionForm action={updateEmergencyAction}>
          <TextField label="Contact name" name="emergencyContactName" defaultValue={p.emergencyContactName ?? ""} />
          <TextField label="Contact phone" name="emergencyContactPhone" type="tel" defaultValue={p.emergencyContactPhone ?? ""} />
        </SectionForm>
      </Section>

      <Section id="notifications" title="Notifications">
        {/* no push notifications on the website: updates come in the app's Notifications list */}
        <div className="space-y-5">
          <SectionForm action={updateNotificationPrefsAction}>
            <Checkbox name="programmeUpdates" defaultChecked={notif.programmeUpdates !== false} label="Programme updates" description="Timing and venue changes." />
            <Checkbox name="conciergeUpdates" defaultChecked={notif.conciergeUpdates !== false} label="Concierge updates" description="Replies and confirmations." />
          </SectionForm>
        </div>
      </Section>

      <Section id="privacy" title="Privacy" description="Your data, your choice.">
        <div className="space-y-6">
          <SectionForm action={updatePrivacyAction}>
            <Checkbox name="marketingEmails" defaultChecked={Boolean(p.privacySettings.marketingEmails)} label="Club news by email" description="Occasional invitations to future CLUB JOIA experiences." />
          </SectionForm>
          <a href="/account/export" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-pearl-muted hover:text-pearl">
            <Download className="size-4" aria-hidden /> Download my data (JSON)
          </a>
          {!p.deletionRequestedAt && (
            <div className="rounded-2xl border border-line p-4">
              <p className="text-sm text-pearl">Delete my account</p>
              <p className="mt-1 text-xs text-pearl-dim">CLUB JOIA will erase your personal data within 30 days. Tickets will be cancelled.</p>
              <div className="mt-4">
                <SectionForm action={requestDeletionAction} submitLabel="Request deletion">
                  <TextField label="Type DELETE to confirm" name="confirm" autoComplete="off" />
                </SectionForm>
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section id="network" title="Member Network" description="Coming soon">
        <div className="flex items-start gap-3 text-sm text-pearl-muted">
          <Users className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Connect privately with fellow members, arrange meetings and receive introductions. Your profile will never be visible to other members unless you choose to share it.
          </p>
        </div>
      </Section>

      <form action={logoutAction} className="pt-8">
        <button type="submit" className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-pearl-muted hover:text-ruby">
          <LogOut className="size-4" aria-hidden /> Sign out
        </button>
      </form>
    </div>
  );
}
