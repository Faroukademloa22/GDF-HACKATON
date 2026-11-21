# ScopeNaira Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **User Profile Isolation (PII)**: Only an email-verified authenticated user whose `request.auth.uid == userId` may read, create, or update `/users/{userId}`. No blanket reads or listing of `/users`.
2. **Gig Audit Ownership**: Every document in `/users/{userId}/gigs/{gigId}` must satisfy `ownerId == request.auth.uid == userId`, enforce strict key allowlists (`hasAll` + `hasOnly`), bound all string and array sizes, and validate server timestamps (`request.time`).
3. **Master Gate & Existence Checks**: Every `AdvisorMessage` and `AgreementDraft` under `/users/{userId}/gigs/{gigId}/...` verifies parent gig existence and ownership (`get(.../gigs/$(gigId)).data.ownerId == request.auth.uid`) and matches `gigId == gigId` and `ownerId == request.auth.uid`.
4. **Immutable Ownership & Timestamps**: `ownerId`, `uid`, `id`, `gigId`, and `createdAt` can never be mutated on update.
5. **Terminal State Locking**: Once an `AgreementDraft` reaches `status == 'finalized'`, further updates to its fee, document body, or status are denied.

## 2. The "Dirty Dozen" Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. **Unauthenticated Gig Read**: Unauthenticated client reads `/users/userA/gigs/gig1`.
2. **Cross-Tenant Gig Read**: `userB` reads `/users/userA/gigs/gig1`.
3. **Unverified Email Write**: `userA` with `email_verified: false` attempts to create `/users/userA/gigs/gig1`.
4. **Identity Spoofing on Create**: `userB` creates `/users/userB/gigs/gig1` with `ownerId: "userA"`.
5. **Shadow Field Injection**: `userA` creates `/users/userA/gigs/gig1` with extra field `isAdmin: true`.
6. **Path Variable Poisoning**: `userA` creates `/users/userA/gigs/../../evil` or 200-char invalid ID.
7. **Denial of Wallet Oversize Transcript**: `userA` writes a `rawTranscript` exceeding `50000` characters or `discrepancies` array exceeding `30` items.
8. **Type Poisoning on Update**: `userA` updates `clientStatedBudgetNgn` with a string `"150000"` instead of a number.
9. **Immutable Timestamp Tampering**: `userA` updates a gig and passes a forged `createdAt` or non-server `updatedAt`.
10. **Orphaned Message / Mismatched GigId**: `userA` writes an `AdvisorMessage` to `/users/userA/gigs/gig1/messages/m1` with `gigId: "gig2"` or for a non-existent gig.
11. **Terminal Agreement Mutation**: `userA` attempts to modify `documentMarkdown` or revert `status` on an agreement where existing `status == 'finalized'`.
12. **Blanket List Scraping**: `userB` issues a list query on `/users/userA/gigs` or `/users`.
