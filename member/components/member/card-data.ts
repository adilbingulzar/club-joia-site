import type { MembershipCardData } from "@/member/components/joia/metal-membership-card";
import { MEMBERSHIP_STATUS_LABELS } from "@/member/domain/membership";
import { formatDateOnly } from "@/member/lib/time";
import type { Membership, Settings } from "@/member/lib/types";

/** Shapes service data into the props the membership card renders (non-sensitive only). */
export function membershipCardData(
  m: Membership,
  settings: Settings,
): MembershipCardData {
  const ms = m.membership;
  const memberSince = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(m.member.memberSince);
  const validity =
    ms?.startDate && ms?.endDate
      ? `${formatDateOnly(ms.startDate, { month: "short", year: "numeric" })} – ${formatDateOnly(ms.endDate, { month: "short", year: "numeric" })}`
      : ms?.endDate
        ? `Until ${formatDateOnly(ms.endDate, { day: "numeric", month: "short", year: "numeric" })}`
        : null;
  return {
    name: `${m.member.firstName} ${m.member.lastName}`,
    membershipNumber: ms?.membershipNumber ?? m.member.membershipNumber,
    tierName: ms?.tier.displayName ?? "Member",
    theme: ms?.tier.cardTheme ?? "ruby",
    memberSince,
    status: ms ? MEMBERSHIP_STATUS_LABELS[ms.status] : "Pending",
    statusOk: ms?.status === "ACTIVE",
    validity,
    chapter: ms?.homeChapter?.name ?? null,
    supportContact: settings["support.email"],
    termsUrl: sitePage(settings["legal.termsUrl"]),
  };
}

/** The members app's own legal pages (/legal/terms, /legal/privacy) are this site's /terms and /privacy. */
export function sitePage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url === "/legal/terms") return "/terms";
  if (url === "/legal/privacy") return "/privacy";
  return url;
}
