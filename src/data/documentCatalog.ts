export type DocumentCategoryId = 'relationships_legal' | 'payments_execution';

export type DocumentTypeId =
  | 'freelance_service_agreement'
  | 'independent_contractor_agreement'
  | 'statement_of_work'
  | 'service_level_agreement'
  | 'non_disclosure_agreement'
  | 'master_service_agreement'
  | 'memorandum_of_understanding'
  | 'memorandum_of_agreement'
  | 'data_processing_agreement'
  | 'ip_assignment_agreement'
  | 'work_for_hire_agreement'
  | 'non_compete_agreement'
  | 'project_proposal'
  | 'quotation_estimate'
  | 'purchase_order'
  | 'invoice'
  | 'payment_agreement'
  | 'change_order'
  | 'work_acceptance_certificate'
  | 'project_completion_certificate';

export interface DocumentCatalogEntry {
  id: DocumentTypeId;
  category: DocumentCategoryId;
  name: string;
  shortCode: string;
  purpose: string;
  whenToUse: string;
}

export const DOCUMENT_CATALOG: DocumentCatalogEntry[] = [
  // 1. Relationships, Governance & Legal Protection
  {
    id: 'freelance_service_agreement',
    category: 'relationships_legal',
    name: 'Freelance Service Agreement',
    shortCode: 'FSA',
    purpose: 'Establishes the overall working relationship between freelancer and client.',
    whenToUse: 'Use before starting any paid build when no overarching contract exists yet.',
  },
  {
    id: 'independent_contractor_agreement',
    category: 'relationships_legal',
    name: 'Independent Contractor Agreement (ICA)',
    shortCode: 'ICA',
    purpose: 'Confirms that the freelancer is an independent contractor, not an employee.',
    whenToUse: 'Use for retainer or multi-month engagements to protect contractor autonomy and tax status.',
  },
  {
    id: 'statement_of_work',
    category: 'relationships_legal',
    name: 'Statement of Work (SOW)',
    shortCode: 'SOW',
    purpose: 'Defines the exact work, deliverables, scope and deadlines.',
    whenToUse: 'Use whenever a client uses vague labels ("simple Jumia app") to lock exact MVP deliverables and exclusions.',
  },
  {
    id: 'service_level_agreement',
    category: 'relationships_legal',
    name: 'Service Level Agreement (SLA)',
    shortCode: 'SLA',
    purpose: 'Defines service standards, response times and performance expectations.',
    whenToUse: 'Use for post-launch maintenance retainers, uptime guarantees, and bug response windows.',
  },
  {
    id: 'non_disclosure_agreement',
    category: 'relationships_legal',
    name: 'Non-Disclosure Agreement (NDA)',
    shortCode: 'NDA',
    purpose: 'Protects confidential information shared between both parties.',
    whenToUse: 'Use before exchanging proprietary business logic, API credentials, or customer datasets.',
  },
  {
    id: 'master_service_agreement',
    category: 'relationships_legal',
    name: 'Master Service Agreement (MSA)',
    shortCode: 'MSA',
    purpose: 'Establishes general terms for ongoing or multiple projects.',
    whenToUse: 'Use with repeat clients or agencies where multiple SOW phases will follow.',
  },
  {
    id: 'memorandum_of_understanding',
    category: 'relationships_legal',
    name: 'Memorandum of Understanding (MOU)',
    shortCode: 'MOU',
    purpose: "Records the parties' mutual understanding before a formal contract.",
    whenToUse: 'Use during early partnership or pilot alignment before pricing and technical discovery finalize.',
  },
  {
    id: 'memorandum_of_agreement',
    category: 'relationships_legal',
    name: 'Memorandum of Agreement (MOA)',
    shortCode: 'MOA',
    purpose: 'Documents agreed responsibilities and commitments.',
    whenToUse: 'Use when joint responsibilities (e.g. client supplies Paystack KYC, dev builds storefront) must be binding.',
  },
  {
    id: 'data_processing_agreement',
    category: 'relationships_legal',
    name: 'Data Processing Agreement (DPA)',
    shortCode: 'DPA',
    purpose: "Defines how the freelancer handles the client's personal data.",
    whenToUse: 'Essential under Nigeria Data Protection Act (NDPA) when handling customer PII, KYC, or payment logs.',
  },
  {
    id: 'ip_assignment_agreement',
    category: 'relationships_legal',
    name: 'Intellectual Property Assignment Agreement (IPAA)',
    shortCode: 'IPAA',
    purpose: 'Establishes ownership or transfer of intellectual property created during the project.',
    whenToUse: 'Use to condition code/IP transfer strictly upon 100% cleared payment while keeping reusable dev tools.',
  },
  {
    id: 'work_for_hire_agreement',
    category: 'relationships_legal',
    name: 'Work-for-Hire Agreement',
    shortCode: 'WFH',
    purpose: 'Establishes whether work created for a client is treated as work made for hire where applicable law permits.',
    whenToUse: 'Use when a client explicitly requests bespoke work-made-for-hire ownership terms.',
  },
  {
    id: 'non_compete_agreement',
    category: 'relationships_legal',
    name: 'Non-Compete Agreement',
    shortCode: 'NCA',
    purpose: 'Sets restrictions on competing activities, subject to applicable law.',
    whenToUse: 'Use only when a client requests narrowly scoped vertical exclusivity (for an added exclusivity premium).',
  },

  // 2. Payments and Project Execution
  {
    id: 'project_proposal',
    category: 'payments_execution',
    name: 'Project Proposal',
    shortCode: 'PROP',
    purpose: 'Presents the proposed solution, approach, cost and timeline.',
    whenToUse: 'Use right after auditing a WhatsApp inquiry to pitch a phased MVP + realistic NGN investment.',
  },
  {
    id: 'quotation_estimate',
    category: 'payments_execution',
    name: 'Quotation / Estimate',
    shortCode: 'QUO',
    purpose: 'Specifies the expected cost of the work.',
    whenToUse: 'Use to counter an underpriced client budget (e.g. ₦150k) with itemized Nigerian market pricing.',
  },
  {
    id: 'purchase_order',
    category: 'payments_execution',
    name: 'Purchase Order (PO)',
    shortCode: 'PO',
    purpose: 'Formal authorization from the client to proceed with a purchase or service.',
    whenToUse: 'Use when dealing with corporate Nigerian businesses requiring procurement sign-off before kickoff.',
  },
  {
    id: 'invoice',
    category: 'payments_execution',
    name: 'Invoice',
    shortCode: 'INV',
    purpose: 'Requests payment for services rendered or agreed milestones.',
    whenToUse: 'Use for the kickoff deposit (40%–50%), staging milestone, or final balance before handover.',
  },
  {
    id: 'payment_agreement',
    category: 'payments_execution',
    name: 'Payment Agreement',
    shortCode: 'PAY',
    purpose: 'Specifies payment schedules, deposits, instalments and outstanding balances.',
    whenToUse: 'Use to prevent "pay on completion" traps by locking non-refundable NGN milestone tranches.',
  },
  {
    id: 'change_order',
    category: 'payments_execution',
    name: 'Change Order',
    shortCode: 'CO',
    purpose: 'Documents changes to the original project scope, cost or timeline.',
    whenToUse: 'Use immediately when a client drops new features in WhatsApp (e.g. live GPS tracking, AI bot) mid-sprint.',
  },
  {
    id: 'work_acceptance_certificate',
    category: 'payments_execution',
    name: 'Work Acceptance Certificate',
    shortCode: 'WAC',
    purpose: 'Confirms that the client has accepted the completed deliverables.',
    whenToUse: 'Use after staging UAT to prevent endless "small tweaks" and trigger milestone payment.',
  },
  {
    id: 'project_completion_certificate',
    category: 'payments_execution',
    name: 'Project Completion Certificate',
    shortCode: 'PCC',
    purpose: 'Documents the formal completion of a project.',
    whenToUse: 'Use at production launch to close the build phase and transition to a separate paid SLA if needed.',
  },
];

export function getDocumentEntry(id: string): DocumentCatalogEntry {
  return (
    DOCUMENT_CATALOG.find((d) => d.id === id) ||
    DOCUMENT_CATALOG.find((d) => d.id === 'statement_of_work')!
  );
}

export interface RecommendedDocItem {
  docType: DocumentTypeId;
  reason: string;
  urgency: 'immediate' | 'next_step' | 'optional';
}

export const ADVISOR_PLAYBOOK_EXAMPLES: Array<{
  label: string;
  prompt: string;
}> = [
  {
    label: 'Counter ₦150k Jumia Trap',
    prompt:
      'Client is insisting on ₦150k for a Jumia app with Paystack and live tracking. How do I break this down professionally and which documents should I send first?',
  },
  {
    label: 'Handle Mid-Sprint Scope Creep',
    prompt:
      'Client just messaged on WhatsApp asking to add rider live map tracking and wallet refunds for free mid-sprint. Advise me and tell me what document to generate.',
  },
  {
    label: 'Refuse "Pay After Launch"',
    prompt:
      'Client says they will pay the full ₦800k only after the app is live on Play Store. How do I protect myself and structure milestones?',
  },
  {
    label: 'Free Lifetime Bug Fixes Trap',
    prompt:
      'Client expects free lifetime support, Paystack webhook maintenance, and server monitoring after handover. How should I frame warranty vs SLA?',
  },
  {
    label: 'NDPA & Payment Security Risk',
    prompt:
      'Client wants us to store customer card details, BVN, and addresses directly in our database. What technical and legal advice should I give?',
  },
];
