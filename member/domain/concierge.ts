import type { ConciergeCategory, ConciergeStatus } from "@/member/lib/enums";

/** Concierge rules the member sees (staff rules stay in the members app: club-joia-300-backend src/domain/concierge.ts). */

export const OPEN_CONCIERGE_STATUSES: ConciergeStatus[] = ["NEW", "IN_PROGRESS", "WAITING_FOR_MEMBER", "CONFIRMED"];
export const CLOSED_CONCIERGE_STATUSES: ConciergeStatus[] = ["COMPLETED", "CANCELLED"];

/** Members may only cancel their own request while it is still open, and may reply to open requests. */
export function memberCanCancel(status: ConciergeStatus): boolean {
  return status === "NEW" || status === "IN_PROGRESS" || status === "WAITING_FOR_MEMBER";
}

export function memberCanReply(status: ConciergeStatus): boolean {
  return OPEN_CONCIERGE_STATUSES.includes(status);
}

export const CONCIERGE_STATUS_LABELS: Record<ConciergeStatus, string> = {
  NEW: "Received",
  IN_PROGRESS: "In progress",
  WAITING_FOR_MEMBER: "Awaiting your reply",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Staff-facing labels (members see the softer wording above). */
export const CONCIERGE_STATUS_STAFF_LABELS: Record<ConciergeStatus, string> = {
  NEW: "New",
  IN_PROGRESS: "In progress",
  WAITING_FOR_MEMBER: "Waiting for member",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const CONCIERGE_CATEGORY_LABELS = {
  TRANSPORT: "Transport",
  DINING: "Dining",
  HOTEL: "Hotel",
  YACHT: "Yacht",
  NIGHTLIFE: "Nightlife",
  TICKET_SUPPORT: "Ticket support",
  SPECIAL_REQUEST: "Special request",
  OTHER: "Other",
} as const;
