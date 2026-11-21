import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileSignature,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  DOCUMENT_CATALOG,
  getDocumentEntry,
  type DocumentCategoryId,
  type DocumentTypeId,
  type RecommendedDocItem,
} from '../data/documentCatalog';
import {
  formatNgn,
  formatNgnRange,
  type AgreementDraft,
  type GigAudit,
  type ScopeClassification,
} from '../types/scope';
import { readFilesAsAttachments, type ClientAttachment } from '../utils/fileAttachments';
import { AttachmentStrip } from './AttachmentStrip';
import { FormattedDocumentView } from './FormattedDocumentView';

export type WorkspaceTab = 'discrepancies' | 'pricing' | 'transcript' | 'agreements';

export interface AgreementGeneratorOptions {
  documentType: DocumentTypeId;
  includedIds: string[];
  agreedTotalNgn: number;
  developerName?: string;
  paymentSplit?: string;
  deliveryDays?: number;
  customNotes?: string;
}

interface AuditMainStageProps {
  gig: GigAudit | null;
  developerDisplayName: string;
  activeTab: WorkspaceTab;
  selectedDocType: DocumentTypeId;
  recommendedDocs: RecommendedDocItem[];
  agreements: AgreementDraft[];
  streamingAgreementText: string;
  isLoadingAudit: boolean;
  isDraftingAgreement: boolean;
  onSelectTab: (tab: WorkspaceTab) => void;
  onSelectDocType: (docType: DocumentTypeId) => void;
  onAuditRawText: (
    rawText: string,
    clientNameHint?: string,
    attachments?: ClientAttachment[]
  ) => Promise<void>;
  onLoadJumiaSample: () => void;
  onReauditWithMessage: (newLine: string) => Promise<void>;
  onDraftAgreement: (options: AgreementGeneratorOptions) => Promise<void>;
  onOpenAgreement: (agreement: AgreementDraft) => void;
  onDeleteGig: (gigId: string) => Promise<void>;
}

const CLASSIFICATION_LABEL: Record<ScopeClassification, string> = {
  core: 'Core MVP',
  missing_dependency: 'Omitted Dependency',
  bloat: 'Scope Bloat',
};

const PAYMENT_SPLITS = [
  '40% Kickoff / 40% Staging / 20% Production Handover',
  '50% Upfront / 50% Final Handover',
  '30% Kickoff / 40% Beta Demo / 30% Launch',
];

export const AuditMainStage: React.FC<AuditMainStageProps> = ({
  gig,
  developerDisplayName,
  activeTab,
  selectedDocType,
  recommendedDocs,
  agreements,
  streamingAgreementText,
  isLoadingAudit,
  isDraftingAgreement,
  onSelectTab,
  onSelectDocType,
  onAuditRawText,
  onLoadJumiaSample,
  onReauditWithMessage,
  onDraftAgreement,
  onOpenAgreement,
  onDeleteGig,
}) => {
  const [scopeFilter, setScopeFilter] = useState<'all' | ScopeClassification>('all');
  const [excludedIds, setExcludedIds] = useState<Record<string, boolean>>({});
  const [appendMessageText, setAppendMessageText] = useState('');
  const [isReauditing, setIsReauditing] = useState(false);
  const [inlinePasteText, setInlinePasteText] = useState('');
  const [inlineAttachments, setInlineAttachments] = useState<ClientAttachment[]>([]);
  const [inlineAttachError, setInlineAttachError] = useState<string | null>(null);
  const inlineFileInputRef = useRef<HTMLInputElement>(null);

  // Document Generator state
  const [catalogCategory, setCatalogCategory] = useState<DocumentCategoryId>('payments_execution');
  const [docPreviewMode, setDocPreviewMode] = useState<'formatted' | 'markdown'>('formatted');
  const [devName, setDevName] = useState(developerDisplayName || 'Independent Developer');
  const [customFeeNgn, setCustomFeeNgn] = useState<number>(0);
  const [paymentSplit, setPaymentSplit] = useState(PAYMENT_SPLITS[0]);
  const [deliveryDays, setDeliveryDays] = useState<number>(30);
  const [customNotes, setCustomNotes] = useState(
    'Client provides verified Paystack/Flutterwave keys, domain, and hosting credentials before Sprint 1.'
  );
  const [copiedInlineDoc, setCopiedInlineDoc] = useState(false);

  const scopeTotals = useMemo(() => {
    if (!gig) {
      return { min: 0, max: 0, days: 0, excludedCount: 0, includedIds: [] as string[] };
    }
    let min = 0;
    let max = 0;
    let days = 0;
    let excludedCount = 0;
    const includedIds: string[] = [];

    for (const item of gig.scopeItems) {
      const isExcluded = excludedIds[item.id] ?? item.classification === 'bloat';
      if (isExcluded) {
        excludedCount += 1;
      } else {
        min += item.minNgn;
        max += item.maxNgn;
        days += item.days;
        includedIds.push(item.id);
      }
    }

    return {
      min,
      max,
      days: Math.max(1, days),
      excludedCount,
      includedIds,
    };
  }, [gig, excludedIds]);

  useEffect(() => {
    if (gig) {
      const mid = Math.round((scopeTotals.min + scopeTotals.max) / 2) || gig.recommendedMinNgn;
      setCustomFeeNgn(mid);
      setDeliveryDays(scopeTotals.days || gig.recommendedDays);
    }
  }, [gig?.id, scopeTotals.min, scopeTotals.max, scopeTotals.days]);

  const selectedDocEntry = getDocumentEntry(selectedDocType);

  useEffect(() => {
    setCatalogCategory(selectedDocEntry.category);
  }, [selectedDocEntry.category]);

  const contextRecommendations = useMemo<RecommendedDocItem[]>(() => {
    if (recommendedDocs.length > 0) return recommendedDocs;
    if (!gig) return [];
    if (gig.verdictStatus === 'underpriced') {
      return [
        {
          docType: 'quotation_estimate',
          reason: 'Counter the underpriced offer with itemized Nigerian Naira benchmarks.',
          urgency: 'immediate',
        },
        {
          docType: 'statement_of_work',
          reason: 'Lock Phase 1 MVP modules and isolate omitted dependencies explicitly.',
          urgency: 'next_step',
        },
        {
          docType: 'payment_agreement',
          reason: 'Enforce 40/40/20 NGN tranches before writing production code.',
          urgency: 'next_step',
        },
      ];
    }
    if (gig.verdictStatus === 'bloated') {
      return [
        {
          docType: 'project_proposal',
          reason: 'Re-frame bloated scope into a clean Phase 1 MVP vs Phase 2 roadmap.',
          urgency: 'immediate',
        },
        {
          docType: 'statement_of_work',
          reason: 'Define exact acceptance criteria and out-of-scope exclusions.',
          urgency: 'next_step',
        },
        {
          docType: 'change_order',
          reason: 'Price deferred extras as paid add-ons if client insists on adding them.',
          urgency: 'optional',
        },
      ];
    }
    return [
      {
        docType: 'freelance_service_agreement',
        reason: 'Establish overall working relationship, IP rights, and Nigerian governing terms.',
        urgency: 'immediate',
      },
      {
        docType: 'statement_of_work',
        reason: 'Lock deliverables, timeline, and client dependencies.',
        urgency: 'immediate',
      },
      {
        docType: 'invoice',
        reason: 'Bill the kickoff deposit before starting Sprint 1.',
        urgency: 'next_step',
      },
    ];
  }, [recommendedDocs, gig]);

  const categoryDocuments = useMemo(
    () => DOCUMENT_CATALOG.filter((doc) => doc.category === catalogCategory),
    [catalogCategory]
  );

  const toggleItemInclusion = (itemId: string, defaultIncluded: boolean) => {
    setExcludedIds((prev) => {
      const currentlyExcluded = prev[itemId] ?? !defaultIncluded;
      return { ...prev, [itemId]: !currentlyExcluded };
    });
  };

  const handleAppendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appendMessageText.trim() || isReauditing) return;
    setIsReauditing(true);
    try {
      await onReauditWithMessage(appendMessageText.trim());
      setAppendMessageText('');
    } finally {
      setIsReauditing(false);
    }
  };

  const handleInlineFiles = async (files: FileList | File[]) => {
    setInlineAttachError(null);
    const { attachments: nextItems, error } = await readFilesAsAttachments(
      files,
      inlineAttachments.length
    );
    if (error) setInlineAttachError(error);
    if (nextItems.length > 0) {
      setInlineAttachments((prev) => [...prev, ...nextItems]);
    }
  };

  const handleInlineAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((inlinePasteText.trim().length < 10 && inlineAttachments.length === 0) || isLoadingAudit) {
      return;
    }
    const textToSend = inlinePasteText.trim();
    const filesToSend = inlineAttachments.length > 0 ? inlineAttachments : undefined;
    setInlinePasteText('');
    setInlineAttachments([]);
    setInlineAttachError(null);
    await onAuditRawText(textToSend, undefined, filesToSend);
  };

  const handleCopyInlineDoc = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedInlineDoc(true);
    setTimeout(() => setCopiedInlineDoc(false), 1800);
  };

  const handleDownloadMarkdown = (title: string, markdown: string) => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoadingAudit) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-20 bg-[#101512] border border-[#1F2B24] rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-10 w-80 bg-[#101512] border border-[#1F2B24] rounded-md animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 bg-[#101512] border border-[#1F2B24] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
        <div className="bg-[#101512] border border-[#1F2B24] rounded-lg p-6 space-y-5">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-[#ECFDF5]">
              Paste WhatsApp Chat to Audit Scope & NGN Pricing
            </h1>
            <p className="text-sm text-[#94A69B] leading-relaxed">
              Drop in the client’s WhatsApp messages below (or type directly into the advisor chatbox on
              the right). ScopeNaira uncovers omitted dependencies like real-time order tracking and
              Paystack integration, isolates bloat, and prepares your Nigerian Naira agreement.
            </p>
          </div>

          <form onSubmit={handleInlineAudit} className="space-y-3">
            <input
              ref={inlineFileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,audio/*,.txt,.md,.csv,.json,.ogg,.opus"
              className="hidden"
              onChange={async (e) => {
                if (e.target.files?.length) {
                  await handleInlineFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />

            {inlineAttachError && (
              <div className="px-3 py-2 text-xs text-[#FCA5A5] bg-[#1F1212] border border-[#7F1D1D] rounded-md">
                {inlineAttachError}
              </div>
            )}

            <AttachmentStrip
              attachments={inlineAttachments}
              disabled={isLoadingAudit}
              onRemove={(id) =>
                setInlineAttachments((prev) => prev.filter((item) => item.id !== id))
              }
            />

            <textarea
              rows={7}
              value={inlinePasteText}
              onChange={(e) => setInlinePasteText(e.target.value)}
              onPaste={async (e) => {
                if (e.clipboardData?.files?.length) {
                  e.preventDefault();
                  await handleInlineFiles(e.clipboardData.files);
                }
              }}
              placeholder="[19/11/2026, 09:19] Chief Emeka: We want a simple Jumia app for Lagos. Budget is 150k Naira, 2 weeks... (or paste screenshot / click +)"
              className="w-full px-3.5 py-3 text-xs font-mono leading-relaxed bg-[#090C0A] border border-[#1F2B24] rounded-md text-[#ECFDF5] placeholder-[#526258] focus:outline-none focus:border-[#22C55E] resize-y"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => inlineFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#151C18] hover:bg-[#1A241E] text-[#ECFDF5] border border-[#1F2B24] hover:border-[#22C55E] rounded-md transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span>Upload Image / PDF / Audio</span>
                </button>
                <button
                  type="button"
                  onClick={onLoadJumiaSample}
                  className="px-4 py-2 text-xs font-medium bg-[#151C18] hover:bg-[#1A241E] text-[#22C55E] border border-[#1F2B24] rounded-md transition-colors whitespace-nowrap"
                >
                  Load Sample: Simple Jumia App (₦150k Trap)
                </button>
              </div>
              <button
                type="submit"
                disabled={inlinePasteText.trim().length < 10 && inlineAttachments.length === 0}
                className="px-4 py-2 text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-40 text-white rounded-md transition-colors whitespace-nowrap"
              >
                Analyze Scope & Pricing
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const filteredScope =
    scopeFilter === 'all'
      ? gig.scopeItems
      : gig.scopeItems.filter((item) => item.classification === scopeFilter);

  const verdictLabel =
    gig.verdictStatus === 'underpriced'
      ? 'Severely Underpriced'
      : gig.verdictStatus === 'bloated'
      ? 'Heavy Scope Bloat'
      : 'Reasonably Aligned';

  const verdictColor =
    gig.verdictStatus === 'underpriced'
      ? 'text-[#F87171]'
      : gig.verdictStatus === 'bloated'
      ? 'text-[#FBBF24]'
      : 'text-[#22C55E]';

  const latestAgreement = agreements[0] ?? null;

  return (
    <div className="p-6 space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-[#86968C]">
            <span>{gig.clientName}</span>
            <span aria-hidden="true">·</span>
            <span>{gig.projectType}</span>
            <span aria-hidden="true">·</span>
            <span className={`font-medium ${verdictColor}`}>{verdictLabel}</span>
          </div>
          <h1 className="text-xl font-semibold text-[#ECFDF5] tracking-tight">{gig.title}</h1>
          <p className="text-sm text-[#94A69B] max-w-3xl leading-relaxed">{gig.verdictSummary}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onSelectTab('agreements')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white rounded-md transition-colors whitespace-nowrap"
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>Document Generator</span>
          </button>
          <button
            type="button"
            onClick={() => onDeleteGig(gig.id)}
            title="Delete audit"
            aria-label="Delete audit"
            className="p-2 text-[#6B7D72] hover:text-[#F87171] bg-[#101512] border border-[#1F2B24] rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4-column KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-[#101512] border border-[#1F2B24] rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-[#1F2B24]">
        <div className="p-4 space-y-1">
          <div className="text-xs text-[#86968C]">Client Stated Budget</div>
          <div className="text-lg font-semibold font-mono tabular-nums text-[#ECFDF5]">
            {gig.clientStatedBudgetNgn > 0 ? formatNgn(gig.clientStatedBudgetNgn) : 'Unstated'}
          </div>
          <div className="text-xs text-[#6B7D72] font-mono tabular-nums">
            {gig.timelineRequestedDays > 0
              ? `Wants in ${gig.timelineRequestedDays} days`
              : 'No timeline stated'}
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-xs text-[#86968C]">Realistic Full-Scope NGN</div>
          <div className="text-lg font-semibold font-mono tabular-nums text-[#22C55E]">
            {formatNgnRange(gig.recommendedMinNgn, gig.recommendedMaxNgn)}
          </div>
          <div className="text-xs text-[#6B7D72] font-mono tabular-nums">
            {gig.recommendedDays} engineering days
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-xs text-[#86968C]">Selected MVP Estimate</div>
          <div className="text-lg font-semibold font-mono tabular-nums text-[#ECFDF5]">
            {formatNgnRange(scopeTotals.min, scopeTotals.max)}
          </div>
          <div className="text-xs text-[#6B7D72] font-mono tabular-nums">
            {scopeTotals.days} days · {scopeTotals.excludedCount} bloat deferred
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-xs text-[#86968C]">Hidden Discrepancies</div>
          <div className="text-lg font-semibold font-mono tabular-nums text-[#FBBF24]">
            {gig.discrepancies.length}
          </div>
          <div className="text-xs text-[#6B7D72]">
            {gig.scopeItems.filter((s) => s.classification === 'missing_dependency').length} omitted dependencies
          </div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2B24] pb-3">
        <div className="inline-flex items-center gap-1 p-1 bg-[#101512] border border-[#1F2B24] rounded-md overflow-x-auto">
          {(
            [
              { id: 'discrepancies', label: `Discrepancies (${gig.discrepancies.length})` },
              { id: 'pricing', label: `NGN Pricing (${gig.scopeItems.length})` },
              { id: 'transcript', label: `WhatsApp Log (${gig.parsedMessages.length})` },
              { id: 'agreements', label: `Doc Generator (${agreements.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-[#16A34A] text-white'
                  : 'text-[#86968C] hover:text-[#ECFDF5]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: Discrepancies & What Makes Sense */}
      {activeTab === 'discrepancies' && (
        <div className="space-y-6">
          <div className="bg-[#101512] border border-[#1F2B24] rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#1F2B24]">
              <h2 className="text-sm font-semibold text-[#ECFDF5]">
                {gig.pricingVerdict.negotiationHeadline}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#1F2B24]">
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#22C55E]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>What Makes Sense</span>
                </div>
                <ul className="space-y-2.5">
                  {gig.pricingVerdict.makesSensePoints.map((point, idx) => (
                    <li key={idx} className="text-xs text-[#C7D8CE] leading-relaxed flex gap-2">
                      <span className="text-[#22C55E] font-mono tabular-nums">{idx + 1}.</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#F87171]">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>What Does Not Make Sense (Scope Traps)</span>
                </div>
                <ul className="space-y-2.5">
                  {gig.pricingVerdict.doesNotMakeSensePoints.map((point, idx) => (
                    <li key={idx} className="text-xs text-[#C7D8CE] leading-relaxed flex gap-2">
                      <span className="text-[#F87171] font-mono tabular-nums">{idx + 1}.</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#ECFDF5]">
              Context Discrepancies & Omitted Requirements
            </h3>
            <div className="bg-[#101512] border border-[#1F2B24] rounded-lg divide-y divide-[#1F2B24]">
              {gig.discrepancies.map((item) => {
                const sevColor =
                  item.severity === 'critical'
                    ? 'text-[#F87171]'
                    : item.severity === 'high'
                    ? 'text-[#FBBF24]'
                    : 'text-[#A7B8AE]';
                return (
                  <div key={item.id} className="p-5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`font-semibold capitalize ${sevColor}`}>
                          {item.severity} discrepancy
                        </span>
                        <span aria-hidden="true" className="text-[#526258]">·</span>
                        <span className="font-mono tabular-nums text-[#22C55E]">
                          +{formatNgn(item.impactNgn)} omitted value
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="text-[#6B7D72]">Client Framing</div>
                        <p className="text-[#D1FAE5] leading-relaxed">“{item.clientClaim}”</p>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[#6B7D72]">Technical Reality Left Out</div>
                        <p className="text-[#ECFDF5] font-medium leading-relaxed">
                          {item.hiddenReality}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-[#94A69B] leading-relaxed">{item.explanation}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NGN Pricing Matrix */}
      {activeTab === 'pricing' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-[#101512] border border-[#1F2B24] rounded-md">
              {(
                [
                  { id: 'all', label: 'All Modules' },
                  { id: 'core', label: 'Core MVP' },
                  { id: 'missing_dependency', label: 'Omitted Dependencies' },
                  { id: 'bloat', label: 'Scope Bloat' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setScopeFilter(f.id)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    scopeFilter === f.id
                      ? 'bg-[#1A241E] text-[#22C55E]'
                      : 'text-[#86968C] hover:text-[#ECFDF5]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-[#94A69B] font-mono tabular-nums">
              Selected MVP: <span className="text-[#22C55E] font-semibold">{formatNgnRange(scopeTotals.min, scopeTotals.max)}</span>
            </div>
          </div>

          <div className="bg-[#101512] border border-[#1F2B24] rounded-lg overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1F2B24] text-xs text-[#6B7D72]">
                  <th className="py-3 px-4 font-medium">Module / Requirement</th>
                  <th className="py-3 px-4 font-medium">Classification</th>
                  <th className="py-3 px-4 font-medium">Sense Check</th>
                  <th className="py-3 px-4 font-medium text-right">Days</th>
                  <th className="py-3 px-4 font-medium text-right">NGN Benchmark</th>
                  <th className="py-3 px-4 font-medium text-right">Phase 1 MVP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2B24] text-xs">
                {filteredScope.map((item) => {
                  const defaultIncluded = item.classification !== 'bloat';
                  const isIncluded = !(excludedIds[item.id] ?? !defaultIncluded);
                  const classColor =
                    item.classification === 'bloat'
                      ? 'text-[#F87171]'
                      : item.classification === 'missing_dependency'
                      ? 'text-[#FBBF24]'
                      : 'text-[#22C55E]';

                  return (
                    <tr key={item.id} className="hover:bg-[#131A16] transition-colors">
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="font-medium text-[#ECFDF5]">{item.feature}</div>
                        <div className="text-[#86968C] mt-0.5 leading-relaxed">{item.rationale}</div>
                      </td>
                      <td className={`py-3.5 px-4 font-medium whitespace-nowrap ${classColor}`}>
                        {CLASSIFICATION_LABEL[item.classification]}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-[#94A69B]">
                        {item.makesSense ? 'Reasonable' : 'Unrealistic for offer'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#D1FAE5]">
                        {item.days}d
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#ECFDF5] whitespace-nowrap">
                        {formatNgnRange(item.minNgn, item.maxNgn)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleItemInclusion(item.id, defaultIncluded)}
                          className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                            isIncluded
                              ? 'bg-[#16A34A]/15 border-[#16A34A] text-[#22C55E]'
                              : 'bg-[#090C0A] border-[#1F2B24] text-[#6B7D72] hover:text-[#ECFDF5]'
                          }`}
                        >
                          {isIncluded ? 'Included' : 'Deferred'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Parsed WhatsApp Context */}
      {activeTab === 'transcript' && (
        <div className="space-y-4">
          <div className="bg-[#101512] border border-[#1F2B24] rounded-lg divide-y divide-[#1F2B24]">
            {gig.parsedMessages.map((msg) => (
              <div key={msg.id} className="px-4 py-3 flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`font-semibold ${
                        msg.role === 'developer' ? 'text-[#22C55E]' : 'text-[#ECFDF5]'
                      }`}
                    >
                      {msg.sender}
                    </span>
                    <span aria-hidden="true" className="text-[#526258]">·</span>
                    <span className="font-mono text-[#6B7D72]">{msg.timestamp}</span>
                  </div>
                  <p className="text-xs text-[#C7D8CE] leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleAppendSubmit}
            className="bg-[#101512] border border-[#1F2B24] rounded-lg p-4 space-y-3"
          >
            <label htmlFor="append-whatsapp-msg" className="block text-xs font-medium text-[#A7B8AE]">
              Append New WhatsApp Client Message & Re-Run Scope Audit
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="append-whatsapp-msg"
                type="text"
                value={appendMessageText}
                onChange={(e) => setAppendMessageText(e.target.value)}
                placeholder="e.g. Client: Actually add referral bonus wallet and iOS app too..."
                className="flex-1 px-3 py-2 text-xs bg-[#090C0A] border border-[#1F2B24] rounded-md text-[#ECFDF5] placeholder-[#526258] focus:outline-none focus:border-[#22C55E]"
              />
              <button
                type="submit"
                disabled={isReauditing || !appendMessageText.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReauditing ? 'animate-spin' : ''}`} />
                <span>{isReauditing ? 'Re-Auditing...' : 'Append & Re-Audit'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: Context-Relative Single Document Generator & Saved Drafts */}
      {activeTab === 'agreements' && (
        <div className="space-y-6">
          {/* Step 1: Context-Recommended Documents */}
          <div className="bg-[#101512] border border-[#1F2B24] rounded-lg p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#ECFDF5]">
                  1. Recommended for This Context
                </h2>
                <p className="text-xs text-[#86968C] mt-0.5">
                  Select one relevant document to generate—never generate all 20 contracts at once.
                </p>
              </div>
              <span className="text-[11px] font-mono text-[#22C55E]">
                Selected: {selectedDocEntry.name} ({selectedDocEntry.shortCode})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {contextRecommendations.map((rec) => {
                const entry = getDocumentEntry(rec.docType);
                const isSelected = selectedDocType === entry.id;
                return (
                  <div
                    key={rec.docType}
                    className={`p-3.5 rounded-md border flex flex-col justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-[#121D16] border-[#16A34A]'
                        : 'bg-[#090C0A] border-[#1F2B24] hover:border-[#2C3F33]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#ECFDF5]">{entry.name}</span>
                        <span className="text-[11px] font-mono text-[#22C55E]">
                          {entry.shortCode}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#86968C] leading-relaxed">{rec.reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectDocType(entry.id)}
                        className={`flex-1 py-1.5 text-[11px] font-medium rounded border transition-colors ${
                          isSelected
                            ? 'bg-[#16A34A]/15 border-[#16A34A] text-[#22C55E]'
                            : 'bg-[#101512] border-[#1F2B24] text-[#C7D8CE] hover:text-[#ECFDF5]'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </button>
                      <button
                        type="button"
                        disabled={isDraftingAgreement}
                        onClick={() => {
                          onSelectDocType(entry.id);
                          onDraftAgreement({
                            documentType: entry.id,
                            includedIds: scopeTotals.includedIds,
                            agreedTotalNgn: customFeeNgn || gig.recommendedMinNgn,
                            developerName: devName,
                            paymentSplit,
                            deliveryDays,
                            customNotes,
                          });
                        }}
                        className="px-2.5 py-1.5 text-[11px] font-semibold bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-white rounded transition-colors whitespace-nowrap"
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Browse Full 20-Document Catalog by Category */}
          <div className="bg-[#101512] border border-[#1F2B24] rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2B24] pb-3">
              <div>
                <h2 className="text-sm font-semibold text-[#ECFDF5]">
                  2. Full Document Catalog (Pick One Type)
                </h2>
                <p className="text-xs text-[#86968C] mt-0.5">
                  Covers all 12 legal/governance agreements and 8 payment/execution documents.
                </p>
              </div>
              <div className="inline-flex items-center gap-1 p-1 bg-[#090C0A] border border-[#1F2B24] rounded-md">
                <button
                  type="button"
                  onClick={() => setCatalogCategory('relationships_legal')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    catalogCategory === 'relationships_legal'
                      ? 'bg-[#16A34A] text-white'
                      : 'text-[#86968C] hover:text-[#ECFDF5]'
                  }`}
                >
                  Legal & Governance (12)
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogCategory('payments_execution')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    catalogCategory === 'payments_execution'
                      ? 'bg-[#16A34A] text-white'
                      : 'text-[#86968C] hover:text-[#ECFDF5]'
                  }`}
                >
                  Payments & Execution (8)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {categoryDocuments.map((doc) => {
                const isSelected = selectedDocType === doc.id;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => onSelectDocType(doc.id)}
                    className={`text-left p-3 rounded-md border transition-colors space-y-1 ${
                      isSelected
                        ? 'bg-[#121D16] border-[#16A34A]'
                        : 'bg-[#090C0A] border-[#1F2B24] hover:border-[#2C3F33]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          isSelected ? 'text-[#22C55E]' : 'text-[#ECFDF5]'
                        }`}
                      >
                        {doc.name}
                      </span>
                      <span className="text-[11px] font-mono text-[#6B7D72] shrink-0">
                        {doc.shortCode}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#94A69B] leading-relaxed">{doc.purpose}</p>
                    <p className="text-[11px] text-[#6B7D72] leading-relaxed">{doc.whenToUse}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Commercial Terms & Single-Document Generation */}
          <div className="bg-[#101512] border border-[#1F2B24] rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F2B24] pb-3">
              <div>
                <h2 className="text-sm font-semibold text-[#ECFDF5]">
                  3. Configure & Generate: {selectedDocEntry.name}
                </h2>
                <p className="text-xs text-[#86968C] mt-0.5">
                  {selectedDocEntry.purpose} ({scopeTotals.includedIds.length} MVP modules included,{' '}
                  {scopeTotals.excludedCount} bloat excluded).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#A7B8AE]">Developer / Studio</label>
                <input
                  type="text"
                  value={devName}
                  onChange={(e) => setDevName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#090C0A] border border-[#1F2B24] rounded-md text-[#ECFDF5] focus:outline-none focus:border-[#22C55E]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#A7B8AE]">Agreed Fee (NGN)</label>
                <input
                  type="number"
                  min={0}
                  value={customFeeNgn}
                  onChange={(e) => setCustomFeeNgn(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#090C0A] border border-[#1F2B24] rounded-md text-[#ECFDF5] focus:outline-none focus:border-[#22C55E]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#A7B8AE]">Delivery Days</label>
                <input
                  type="number"
                  min={1}
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#090C0A] border border-[#1F2B24] rounded-md text-[#ECFDF5] focus:outline-none focus:border-[#22C55E]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#A7B8AE]">Payment Split</label>
                <select
                  value={paymentSplit}
                  onChange={(e) => setPaymentSplit(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#090C0A] border border-[#1F2B24] rounded-md text-[#ECFDF5] focus:outline-none focus:border-[#22C55E]"
                >
                  {PAYMENT_SPLITS.map((split) => (
                    <option key={split} value={split}>
                      {split}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#A7B8AE]">
                Custom Contract Clauses / Context Notes
              </label>
              <textarea
                rows={2}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#090C0A] border border-[#1F2B24] rounded-md text-[#D1FAE5] focus:outline-none focus:border-[#22C55E]"
              />
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                disabled={isDraftingAgreement}
                onClick={() =>
                  onDraftAgreement({
                    documentType: selectedDocType,
                    includedIds: scopeTotals.includedIds,
                    agreedTotalNgn: customFeeNgn || gig.recommendedMinNgn,
                    developerName: devName,
                    paymentSplit,
                    deliveryDays,
                    customNotes,
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-white rounded-md transition-colors whitespace-nowrap"
              >
                <FileSignature className="w-3.5 h-3.5" />
                <span>
                  {isDraftingAgreement
                    ? `Generating ${selectedDocEntry.shortCode}...`
                    : `Generate ${selectedDocEntry.name}`}
                </span>
              </button>
            </div>
          </div>

          {/* Step 4: Formatted Executive Document Sheet */}
          {streamingAgreementText ? (
            <div className="bg-[#101512] border border-[#16A34A]/60 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1F2B24]">
                <div className="text-xs font-semibold text-[#22C55E]">
                  Streaming {selectedDocEntry.name}...
                </div>
              </div>
              <div className="p-6 max-h-[34rem] overflow-y-auto bg-[#090C0A]">
                <FormattedDocumentView markdown={streamingAgreementText} />
              </div>
            </div>
          ) : (
            latestAgreement && (
              <div className="bg-[#101512] border border-[#1F2B24] rounded-lg overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#1F2B24] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[#ECFDF5]">{latestAgreement.title}</div>
                    <div className="text-[11px] font-mono tabular-nums text-[#22C55E]">
                      {formatNgn(latestAgreement.totalFeeNgn)} · {latestAgreement.milestoneSummary}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1 p-0.5 bg-[#090C0A] border border-[#1F2B24] rounded">
                      <button
                        type="button"
                        onClick={() => setDocPreviewMode('formatted')}
                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                          docPreviewMode === 'formatted'
                            ? 'bg-[#16A34A] text-white'
                            : 'text-[#86968C] hover:text-[#ECFDF5]'
                        }`}
                      >
                        Formatted View
                      </button>
                      <button
                        type="button"
                        onClick={() => setDocPreviewMode('markdown')}
                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                          docPreviewMode === 'markdown'
                            ? 'bg-[#16A34A] text-white'
                            : 'text-[#86968C] hover:text-[#ECFDF5]'
                        }`}
                      >
                        Markdown
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyInlineDoc(latestAgreement.documentMarkdown)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#151C18] hover:bg-[#1A241E] text-[#ECFDF5] border border-[#1F2B24] rounded-md transition-colors"
                    >
                      {copiedInlineDoc ? (
                        <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedInlineDoc ? 'Copied' : 'Copy Text'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadMarkdown(latestAgreement.title, latestAgreement.documentMarkdown)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#151C18] hover:bg-[#1A241E] text-[#ECFDF5] border border-[#1F2B24] rounded-md transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .md</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#151C18] hover:bg-[#1A241E] text-[#ECFDF5] border border-[#1F2B24] rounded-md transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print / PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAgreement(latestAgreement)}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white rounded-md transition-colors"
                    >
                      Edit / Finalize
                    </button>
                  </div>
                </div>

                {docPreviewMode === 'formatted' ? (
                  <div className="p-6 max-h-[36rem] overflow-y-auto bg-[#090C0A]">
                    <FormattedDocumentView markdown={latestAgreement.documentMarkdown} />
                  </div>
                ) : (
                  <pre className="p-5 text-xs font-mono text-[#D1FAE5] leading-relaxed whitespace-pre-wrap max-h-[36rem] overflow-y-auto bg-[#090C0A]">
                    {latestAgreement.documentMarkdown}
                  </pre>
                )}
              </div>
            )
          )}

          {agreements.length > 1 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[#86968C]">Previous Document Drafts</h3>
              <div className="bg-[#101512] border border-[#1F2B24] rounded-lg divide-y divide-[#1F2B24]">
                {agreements.slice(1).map((agr) => (
                  <div
                    key={agr.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-[#131A16] transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-[#ECFDF5]">{agr.title}</span>
                        <span aria-hidden="true" className="text-[#526258]">·</span>
                        <span
                          className={
                            agr.status === 'finalized'
                              ? 'text-[#22C55E] font-medium'
                              : 'text-[#FBBF24]'
                          }
                        >
                          {agr.status === 'finalized' ? 'Finalized' : 'Draft'}
                        </span>
                      </div>
                      <p className="text-xs text-[#86968C] font-mono tabular-nums">
                        {formatNgn(agr.totalFeeNgn)} · {agr.milestoneSummary}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenAgreement(agr)}
                      className="px-3 py-1.5 text-xs font-medium bg-[#151C18] hover:bg-[#1A241E] text-[#ECFDF5] border border-[#1F2B24] rounded-md transition-colors whitespace-nowrap"
                    >
                      Open Document
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
