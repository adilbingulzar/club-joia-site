/*
 * The members app's data as its API gives it (club-joia-300-backend src/services/member-app.service.ts
 * and the services it calls), dates already Date again (member/server/api.ts). Only what the pages use.
 */
import type { ConciergeCategory, ConciergeStatus, MembershipStatus, NotificationType, ProgramCategory, TicketStatus } from './enums';

export type Settings = { 'support.email': string; 'legal.termsUrl': string; 'legal.privacyUrl': string };

export type Membership = {
  member: { firstName: string; lastName: string; displayName: string | null; membershipNumber: string; memberSince: Date; hasPhoto: boolean };
  membership: {
    membershipNumber: string; status: MembershipStatus; startDate: string | null; endDate: string | null; issueDate: Date | null; kind: string;
    tier: { slug: string; name: string; displayName: string; description: string | null; color: string | null; cardTheme: string };
    homeChapter: { name: string; city: string } | null;
  } | null;
  privileges: { code: string; name: string; description: string | null; value: unknown; category: string }[];
};

export type MemberTicket = {
  id: string; eventId: string; ticketNumber: string; status: TicketStatus; effectiveStatus: TicketStatus; validFrom: Date; validUntil: Date;
  event: { id: string; slug: string; name: string; city: string; venue: string; timezone: string; startDate: Date; endDate: Date };
  ticketType: { id: string; name: string; code: string; zones: { zone: { id: string; name: string; code: string } }[] };
  checkIns: { checkedInAt: Date; zone: { name: string } }[];
};

export type ProgrammeItemView = {
  id: string; date: string; startTime: string; endTime: string | null; title: string; subtitle: string | null; description: string | null;
  location: string | null; category: ProgramCategory; icon: string | null; image: string | null; restricted: boolean; isSample: boolean;
  favorite: boolean; startsAt: string; endsAt: string | null;
};

export type Programme = { timezone: string; days: { date: string; items: ProgrammeItemView[] }[] };

export type EventInfo = { tagline?: string; ticketPrefix?: string; supportEmail?: string; supportPhone?: string; dressCode?: string; infoSections?: { title: string; body: string }[] };

export type MemberEvent = {
  id: string; slug: string; name: string; city: string; venue: string; timezone: string; description: string | null;
  start: string; end: string; days: string[]; info: EventInfo; heroImageUrl: string | null;
};

export type NotificationItem = { id: string; title: string; body: string; type: NotificationType; url: string | null; at: Date; read: boolean };

export type ConciergeSummary = { id: string; reference: string; subject: string; category: ConciergeCategory; status: ConciergeStatus; updatedAt: Date };

export type ConciergeRequest = ConciergeSummary & {
  description: string; notes: string | null; preferredDate: Date | null; preferredTime: string | null; numberOfPeople: number | null; createdAt: Date;
  messages: { id: string; senderType: 'MEMBER' | 'STAFF' | 'SYSTEM'; message: string; createdAt: Date; attachmentKey: string | null; attachmentName: string | null; sender: { name: string } | null }[];
};

export type Profile = {
  firstName: string; lastName: string; displayName: string | null; membershipNumber: string; mobile: string | null; city: string | null; country: string | null;
  nationality: string | null; company: string | null; jobTitle: string | null; industry: string | null; bio: string | null;
  dietaryRequirements: string | null; allergies: string | null; shirtSize: string | null; emergencyContactName: string | null; emergencyContactPhone: string | null;
  deletionRequestedAt: Date | null; profilePhotoKey: string | null; user: { email: string };
  preferences: { hospitality?: { seatingPreference?: string | null; drinksPreference?: string | null; arrivalNotes?: string | null }; notifications?: { push?: boolean; programmeUpdates?: boolean; conciergeUpdates?: boolean } };
  privacySettings: { marketingEmails?: boolean };
};
