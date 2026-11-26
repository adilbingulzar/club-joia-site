import type { MembershipStatus } from "@/member/lib/enums";

/** Allowed manual status transitions for a membership (admin actions). */
const TRANSITIONS: Record<MembershipStatus, MembershipStatus[]> = {
  INVITED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["SUSPENDED", "EXPIRED", "CANCELLED"],
  SUSPENDED: ["ACTIVE", "CANCELLED", "EXPIRED"],
  EXPIRED: ["ACTIVE"],
  CANCELLED: [],
};

export function canTransitionMembership(from: MembershipStatus, to: MembershipStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function isMembershipUsable(status: MembershipStatus | null | undefined): boolean {
  return status === "ACTIVE";
}

type MembershipLike = { status: MembershipStatus; issueDate: Date; endDate: Date | null };

/**
 * The membership that represents a member "now": the most recently issued ACTIVE one,
 * otherwise the most recently issued of any status (so suspended members still see their card).
 */
export function pickCurrentMembership<T extends MembershipLike>(memberships: T[]): T | null {
  if (memberships.length === 0) return null;
  const sorted = [...memberships].sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
  return sorted.find((m) => m.status === "ACTIVE") ?? sorted[0];
}

/** Effective status, treating an ACTIVE membership past its end date as EXPIRED. */
export function effectiveMembershipStatus(m: MembershipLike, today: string): MembershipStatus {
  if (m.status === "ACTIVE" && m.endDate && m.endDate.toISOString().slice(0, 10) < today) return "EXPIRED";
  return m.status;
}

export const MEMBERSHIP_STATUS_LABELS: Record<MembershipStatus, string> = {
  INVITED: "Invited",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};
