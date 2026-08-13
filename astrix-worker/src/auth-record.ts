export type Membership = { membershipType: number; membershipId: string; displayName?: string };
export type OAuthTransaction = { kind: "oauth-transaction"; state: string; createdAt: number; returnUrl: string; used: boolean };
export type SessionRecord = { kind: "session"; createdAt: number; lastUsedAt: number; absoluteExpiresAt: number; accessToken: string; refreshToken: string; accessExpiresAt: number; refreshExpiresAt: number | null; bungieMembershipId: string | null; destinyMemberships: Membership[]; primaryMembershipId: string | null; activeDestinyMembership: Membership | null; csrfToken: string };
export type AuthRecordValue = OAuthTransaction | SessionRecord;
