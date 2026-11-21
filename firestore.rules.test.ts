/**
 * Security rules test suite verifying the 12 "Dirty Dozen" adversarial payloads
 * against ScopeNaira's Firestore security rules.
 * Run with Firebase Emulator Suite (`@firebase/rules-unit-testing`) when testing locally.
 */

export interface DirtyDozenScenario {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  authUid: string | null;
  emailVerified: boolean;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const dirtyDozenScenarios: DirtyDozenScenario[] = [
  {
    id: 1,
    name: 'Unauthenticated Gig Read',
    operation: 'get',
    path: 'users/userA/gigs/gig_1',
    authUid: null,
    emailVerified: false,
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-Tenant Gig Read',
    operation: 'get',
    path: 'users/userA/gigs/gig_1',
    authUid: 'userB',
    emailVerified: true,
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Write',
    operation: 'create',
    path: 'users/userA/gigs/gig_1',
    authUid: 'userA',
    emailVerified: false,
    payload: { id: 'gig_1', ownerId: 'userA', title: 'Test Gig' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Identity Spoofing on Create',
    operation: 'create',
    path: 'users/userB/gigs/gig_1',
    authUid: 'userB',
    emailVerified: true,
    payload: { id: 'gig_1', ownerId: 'userA', title: 'Spoofed Gig' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Field Injection',
    operation: 'create',
    path: 'users/userA/gigs/gig_1',
    authUid: 'userA',
    emailVerified: true,
    payload: { id: 'gig_1', ownerId: 'userA', isAdmin: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Path Variable Poisoning',
    operation: 'create',
    path: `users/userA/gigs/${'x'.repeat(180)}`,
    authUid: 'userA',
    emailVerified: true,
    payload: { id: 'x'.repeat(180), ownerId: 'userA' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Denial of Wallet Oversize Transcript',
    operation: 'create',
    path: 'users/userA/gigs/gig_oversize',
    authUid: 'userA',
    emailVerified: true,
    payload: { id: 'gig_oversize', ownerId: 'userA', rawTranscript: 'a'.repeat(55000) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Type Poisoning on Update',
    operation: 'update',
    path: 'users/userA/gigs/gig_1',
    authUid: 'userA',
    emailVerified: true,
    payload: { clientStatedBudgetNgn: '150000' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immutable Timestamp Tampering',
    operation: 'update',
    path: 'users/userA/gigs/gig_1',
    authUid: 'userA',
    emailVerified: true,
    payload: { createdAt: '1999-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Orphaned Message / Mismatched GigId',
    operation: 'create',
    path: 'users/userA/gigs/gig_1/messages/msg_1',
    authUid: 'userA',
    emailVerified: true,
    payload: { id: 'msg_1', ownerId: 'userA', gigId: 'gig_other', role: 'developer', content: 'Hi' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Terminal Agreement Mutation',
    operation: 'update',
    path: 'users/userA/gigs/gig_1/agreements/agr_finalized',
    authUid: 'userA',
    emailVerified: true,
    payload: { status: 'draft', documentMarkdown: 'Tampered contract' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket List Scraping',
    operation: 'list',
    path: 'users',
    authUid: 'userB',
    emailVerified: true,
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
