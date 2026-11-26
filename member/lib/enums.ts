/* The members app's enums (club-joia-300-backend src/generated/prisma/enums.ts, a copy): update both together. */
export const Role = {
  MEMBER: 'MEMBER',
  CONCIERGE: 'CONCIERGE',
  CHECK_IN_STAFF: 'CHECK_IN_STAFF',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
  SALES_VIEWER: 'SALES_VIEWER'
} as const

export type Role = (typeof Role)[keyof typeof Role]


export const UserStatus = {
  PENDING_ACTIVATION: 'PENDING_ACTIVATION',
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED'
} as const

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus]


export const AuthTokenType = {
  ACTIVATION: 'ACTIVATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
  MAGIC_LINK: 'MAGIC_LINK',
  EMAIL_CHANGE: 'EMAIL_CHANGE'
} as const

export type AuthTokenType = (typeof AuthTokenType)[keyof typeof AuthTokenType]


export const ConsentType = {
  TERMS: 'TERMS',
  PRIVACY_POLICY: 'PRIVACY_POLICY',
  MARKETING: 'MARKETING',
  PUSH_NOTIFICATIONS: 'PUSH_NOTIFICATIONS',
  DATA_PROCESSING: 'DATA_PROCESSING'
} as const

export type ConsentType = (typeof ConsentType)[keyof typeof ConsentType]


export const MembershipStatus = {
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED'
} as const

export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus]


export const MembershipKind = {
  EVENT: 'EVENT',
  ANNUAL: 'ANNUAL'
} as const

export type MembershipKind = (typeof MembershipKind)[keyof typeof MembershipKind]


export const EntitlementValueType = {
  BOOLEAN: 'BOOLEAN',
  INTEGER: 'INTEGER',
  TEXT: 'TEXT'
} as const

export type EntitlementValueType = (typeof EntitlementValueType)[keyof typeof EntitlementValueType]


export const EventStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  LIVE: 'LIVE',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
  CANCELLED: 'CANCELLED'
} as const

export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus]


export const ProgramCategory = {
  ARRIVAL: 'ARRIVAL',
  HOSPITALITY: 'HOSPITALITY',
  RACING: 'RACING',
  FOOD: 'FOOD',
  ENTERTAINMENT: 'ENTERTAINMENT',
  NETWORKING: 'NETWORKING',
  CONCIERGE: 'CONCIERGE',
  AFTER_PARTY: 'AFTER_PARTY',
  OTHER: 'OTHER'
} as const

export type ProgramCategory = (typeof ProgramCategory)[keyof typeof ProgramCategory]


export const ProgramVisibility = {
  DRAFT: 'DRAFT',
  MEMBERS: 'MEMBERS',
  RESTRICTED: 'RESTRICTED'
} as const

export type ProgramVisibility = (typeof ProgramVisibility)[keyof typeof ProgramVisibility]


export const EntryPolicy = {
  SINGLE_ENTRY: 'SINGLE_ENTRY',
  DAILY_ENTRY: 'DAILY_ENTRY',
  MULTI_ENTRY: 'MULTI_ENTRY'
} as const

export type EntryPolicy = (typeof EntryPolicy)[keyof typeof EntryPolicy]


export const TicketStatus = {
  ACTIVE: 'ACTIVE',
  USED: 'USED',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
  SUSPENDED: 'SUSPENDED'
} as const

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus]


export const ScanAction = {
  VALIDATE: 'VALIDATE',
  CHECK_IN: 'CHECK_IN',
  DENY: 'DENY'
} as const

export type ScanAction = (typeof ScanAction)[keyof typeof ScanAction]


export const ScanMethod = {
  QR: 'QR',
  MANUAL: 'MANUAL'
} as const

export type ScanMethod = (typeof ScanMethod)[keyof typeof ScanMethod]


export const ScanResult = {
  VALID: 'VALID',
  ALREADY_USED: 'ALREADY_USED',
  NOT_VALID_YET: 'NOT_VALID_YET',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  INVALID: 'INVALID',
  WRONG_ACCESS_ZONE: 'WRONG_ACCESS_ZONE',
  SUSPENDED: 'SUSPENDED'
} as const

export type ScanResult = (typeof ScanResult)[keyof typeof ScanResult]


export const ConciergeCategory = {
  TRANSPORT: 'TRANSPORT',
  DINING: 'DINING',
  HOTEL: 'HOTEL',
  YACHT: 'YACHT',
  NIGHTLIFE: 'NIGHTLIFE',
  TICKET_SUPPORT: 'TICKET_SUPPORT',
  SPECIAL_REQUEST: 'SPECIAL_REQUEST',
  OTHER: 'OTHER'
} as const

export type ConciergeCategory = (typeof ConciergeCategory)[keyof typeof ConciergeCategory]


export const ConciergeStatus = {
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_FOR_MEMBER: 'WAITING_FOR_MEMBER',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
} as const

export type ConciergeStatus = (typeof ConciergeStatus)[keyof typeof ConciergeStatus]


export const ConciergePriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
} as const

export type ConciergePriority = (typeof ConciergePriority)[keyof typeof ConciergePriority]


export const ActorType = {
  MEMBER: 'MEMBER',
  STAFF: 'STAFF',
  SYSTEM: 'SYSTEM',
  AI_AGENT: 'AI_AGENT'
} as const

export type ActorType = (typeof ActorType)[keyof typeof ActorType]


export const NotificationType = {
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  PROGRAMME: 'PROGRAMME',
  TICKET: 'TICKET',
  CONCIERGE: 'CONCIERGE',
  TRANSPORT: 'TRANSPORT',
  MEMBERSHIP: 'MEMBERSHIP',
  SYSTEM: 'SYSTEM'
} as const

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType]


export const NotificationTargetType = {
  ALL_MEMBERS: 'ALL_MEMBERS',
  TIER: 'TIER',
  EVENT: 'EVENT',
  MEMBER: 'MEMBER'
} as const

export type NotificationTargetType = (typeof NotificationTargetType)[keyof typeof NotificationTargetType]


export const NotificationStatus = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  SENDING: 'SENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
} as const

export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus]


export const DeliveryChannel = {
  IN_APP: 'IN_APP',
  WEB_PUSH: 'WEB_PUSH',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  WHATSAPP: 'WHATSAPP',
  APPLE_PUSH: 'APPLE_PUSH',
  ANDROID_PUSH: 'ANDROID_PUSH'
} as const

export type DeliveryChannel = (typeof DeliveryChannel)[keyof typeof DeliveryChannel]


export const DeliveryStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED'
} as const

export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus]


export const FilePurpose = {
  PROFILE_PHOTO: 'PROFILE_PHOTO',
  CONCIERGE_ATTACHMENT: 'CONCIERGE_ATTACHMENT',
  EVENT_IMAGE: 'EVENT_IMAGE',
  PROGRAMME_IMAGE: 'PROGRAMME_IMAGE'
} as const

export type FilePurpose = (typeof FilePurpose)[keyof typeof FilePurpose]
