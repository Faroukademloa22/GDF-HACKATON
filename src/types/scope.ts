export type VerdictStatus = 'underpriced' | 'fair' | 'bloated';
export type ScopeClassification = 'core' | 'missing_dependency' | 'bloat';
export type DiscrepancySeverity = 'critical' | 'high' | 'medium';
export type AdvisorRole = 'developer' | 'client_input' | 'advisor';
export type AgreementStatus = 'draft' | 'finalized';

export interface ParsedWhatsappMessage {
  id: string;
  sender: string;
  role: 'client' | 'developer' | 'system';
  timestamp: string;
  text: string;
}

export interface ScopeDiscrepancy {
  id: string;
  clientClaim: string;
  hiddenReality: string;
  severity: DiscrepancySeverity;
  impactNgn: number;
  explanation: string;
}

export interface ScopeItem {
  id: string;
  feature: string;
  classification: ScopeClassification;
  makesSense: boolean;
  minNgn: number;
  maxNgn: number;
  days: number;
  rationale: string;
}

export interface PricingVerdict {
  negotiationHeadline: string;
  makesSensePoints: string[];
  doesNotMakeSensePoints: string[];
}

export interface GigAudit {
  id: string;
  ownerId: string;
  title: string;
  clientName: string;
  projectType: string;
  clientStatedBudgetNgn: number;
  recommendedMinNgn: number;
  recommendedMaxNgn: number;
  timelineRequestedDays: number;
  recommendedDays: number;
  verdictStatus: VerdictStatus;
  verdictSummary: string;
  rawTranscript: string;
  parsedMessages: ParsedWhatsappMessage[];
  discrepancies: ScopeDiscrepancy[];
  scopeItems: ScopeItem[];
  pricingVerdict: PricingVerdict;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdvisorMessage {
  id: string;
  ownerId: string;
  gigId: string;
  role: AdvisorRole;
  content: string;
  discrepancyFlags: string[];
  linkedAgreementId?: string;
  createdAt?: unknown;
}

export interface AgreementDraft {
  id: string;
  ownerId: string;
  gigId: string;
  title: string;
  totalFeeNgn: number;
  milestoneSummary: string;
  documentMarkdown: string;
  whatsappReplySnippet: string;
  status: AgreementStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const ngnFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

export function formatNgn(amount: number | undefined | null): string {
  const safe = Number.isFinite(amount) ? Number(amount) : 0;
  return ngnFormatter.format(Math.round(safe));
}

export function formatNgnRange(min: number, max: number): string {
  return `${formatNgn(min)} – ${formatNgn(max)}`;
}

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}
