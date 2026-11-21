import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { LogOut, MessageSquarePlus, Plus } from 'lucide-react';
import { auth, googleProvider, testFirestoreConnection } from './firebase';
import { SAMPLE_GIGS } from './data/sampleChats';
import type { DocumentTypeId, RecommendedDocItem } from './data/documentCatalog';
import type { ClientAttachment } from './utils/fileAttachments';
import {
  auditWhatsappTranscript,
  streamAdvisorChatMessage,
  streamServiceAgreement,
  type FlashModelId,
} from './services/apiService';
import {
  createAdvisorMessage,
  createAgreementDraft,
  createGigAudit,
  deleteGigAudit,
  ensureUserProfile,
  subscribeToAgreements,
  subscribeToMessages,
  subscribeToUserGigs,
  updateAgreementDraft,
  updateGigAudit,
} from './services/firestoreService';
import {
  formatNgn,
  generateSafeId,
  type AdvisorMessage,
  type AgreementDraft,
  type GigAudit,
} from './types/scope';
import {
  AuditMainStage,
  type AgreementGeneratorOptions,
  type WorkspaceTab,
} from './components/AuditMainStage';
import { AdvisorChatbox } from './components/AdvisorChatbox';
import { WhatsappIngestModal } from './components/WhatsappIngestModal';
import { AgreementModal } from './components/AgreementModal';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dbOfflineWarning, setDbOfflineWarning] = useState(false);

  const [gigs, setGigs] = useState<GigAudit[]>([]);
  const [selectedGigId, setSelectedGigId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [agreements, setAgreements] = useState<AgreementDraft[]>([]);

  const [selectedModel, setSelectedModel] = useState<FlashModelId>('gemini-3.1-flash-lite');
  const [selectedDocType, setSelectedDocType] = useState<DocumentTypeId>('statement_of_work');
  const [recommendedDocsByGig, setRecommendedDocsByGig] = useState<
    Record<string, RecommendedDocItem[]>
  >({});
  const [streamingReply, setStreamingReply] = useState('');
  const [streamingAgreementText, setStreamingAgreementText] = useState('');

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('discrepancies');
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isDraftingAgreement, setIsDraftingAgreement] = useState(false);
  const [activeAgreement, setActiveAgreement] = useState<AgreementDraft | null>(null);
  const [isSavingAgreement, setIsSavingAgreement] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    testFirestoreConnection().then((ok) => {
      if (!ok) setDbOfflineWarning(true);
    });

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        try {
          await ensureUserProfile(nextUser);
        } catch (err) {
          setGlobalError(err instanceof Error ? err.message : 'Failed to initialize profile.');
        }
      } else {
        setGigs([]);
        setSelectedGigId(null);
        setMessages([]);
        setAgreements([]);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;
    const unsub = subscribeToUserGigs(
      user.uid,
      (list) => {
        setGigs(list);
        setSelectedGigId((curr) => {
          if (curr && list.some((g) => g.id === curr)) return curr;
          return list[0]?.id ?? null;
        });
      },
      (err) => setGlobalError(err.message)
    );
    return () => unsub();
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady || !user || !selectedGigId) {
      setMessages([]);
      setAgreements([]);
      return;
    }

    const unsubMessages = subscribeToMessages(
      user.uid,
      selectedGigId,
      setMessages,
      (err) => setGlobalError(err.message)
    );
    const unsubAgreements = subscribeToAgreements(
      user.uid,
      selectedGigId,
      (list) => {
        setAgreements(list);
        setActiveAgreement((curr) =>
          curr ? list.find((a) => a.id === curr.id) ?? curr : null
        );
      },
      (err) => setGlobalError(err.message)
    );

    return () => {
      unsubMessages();
      unsubAgreements();
    };
  }, [authReady, user, selectedGigId]);

  const activeGig = useMemo(
    () => gigs.find((g) => g.id === selectedGigId) ?? null,
    [gigs, selectedGigId]
  );

  const activeRecommendedDocs = useMemo(
    () => (activeGig ? recommendedDocsByGig[activeGig.id] ?? [] : []),
    [activeGig, recommendedDocsByGig]
  );

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const runNewAudit = async (
    rawTranscript: string,
    clientNameHint?: string,
    attachments?: ClientAttachment[]
  ) => {
    if (!user) return;
    setIsAuditing(true);
    setAuditError(null);
    setGlobalError(null);
    try {
      const result = await auditWhatsappTranscript(
        rawTranscript,
        clientNameHint,
        selectedModel,
        attachments
      );
      const newGigId = generateSafeId('gig');
      const storedTranscript =
        rawTranscript.trim() ||
        result.extractedTranscript?.trim() ||
        (attachments && attachments.length > 0
          ? `[Uploaded files: ${attachments.map((a) => a.name).join(', ')}]`
          : 'WhatsApp audit transcript');

      const gigPayload: GigAudit = {
        id: newGigId,
        ownerId: user.uid,
        title: result.title,
        clientName: result.clientName,
        projectType: result.projectType,
        clientStatedBudgetNgn: result.clientStatedBudgetNgn,
        recommendedMinNgn: result.recommendedMinNgn,
        recommendedMaxNgn: result.recommendedMaxNgn,
        timelineRequestedDays: result.timelineRequestedDays,
        recommendedDays: result.recommendedDays,
        verdictStatus: result.verdictStatus,
        verdictSummary: result.verdictSummary,
        rawTranscript: storedTranscript,
        parsedMessages: result.parsedMessages,
        discrepancies: result.discrepancies,
        scopeItems: result.scopeItems,
        pricingVerdict: result.pricingVerdict,
      };

      await createGigAudit(user.uid, gigPayload);

      const topFlags = result.discrepancies
        .slice(0, 4)
        .map((d) => `${d.hiddenReality} (+${formatNgn(d.impactNgn)})`);

      await createAdvisorMessage(user.uid, newGigId, {
        id: generateSafeId('msg'),
        ownerId: user.uid,
        gigId: newGigId,
        role: 'advisor',
        content: `${result.pricingVerdict.negotiationHeadline}\n\n${result.verdictSummary}`,
        discrepancyFlags: topFlags,
      });

      setSelectedGigId(newGigId);
      setActiveTab('discrepancies');
      setIsIngestOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to audit WhatsApp transcript.';
      setAuditError(msg);
      setGlobalError(msg);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleLoadJumiaSample = async () => {
    const sample = SAMPLE_GIGS[0];
    await runNewAudit(sample.transcript, sample.clientName);
  };

  const handleReauditWithMessage = async (newLine: string) => {
    if (!user || !activeGig) return;
    setGlobalError(null);
    const updatedTranscript = `${activeGig.rawTranscript}\n[Follow-up] ${activeGig.clientName}: ${newLine}`;
    const result = await auditWhatsappTranscript(
      updatedTranscript,
      activeGig.clientName,
      selectedModel
    );
    await updateGigAudit(user.uid, {
      ...activeGig,
      title: result.title,
      projectType: result.projectType,
      clientStatedBudgetNgn: result.clientStatedBudgetNgn,
      recommendedMinNgn: result.recommendedMinNgn,
      recommendedMaxNgn: result.recommendedMaxNgn,
      timelineRequestedDays: result.timelineRequestedDays,
      recommendedDays: result.recommendedDays,
      verdictStatus: result.verdictStatus,
      verdictSummary: result.verdictSummary,
      rawTranscript: updatedTranscript,
      parsedMessages: result.parsedMessages,
      discrepancies: result.discrepancies,
      scopeItems: result.scopeItems,
      pricingVerdict: result.pricingVerdict,
    });
  };

  const handleSendAdvisorMessage = async (
    content: string,
    mode: 'advisor_question' | 'client_input',
    attachments?: ClientAttachment[]
  ) => {
    if (!user || !activeGig) return;
    setIsSendingChat(true);
    setStreamingReply('');
    setGlobalError(null);
    try {
      const attachmentNote =
        attachments && attachments.length > 0
          ? `[Attached: ${attachments.map((a) => a.name).join(', ')}]`
          : '';
      const storedContent = [content.trim(), attachmentNote].filter(Boolean).join('\n');

      await createAdvisorMessage(user.uid, activeGig.id, {
        id: generateSafeId('msg'),
        ownerId: user.uid,
        gigId: activeGig.id,
        role: mode === 'client_input' ? 'client_input' : 'developer',
        content: storedContent || 'Shared attachment',
        discrepancyFlags: [],
      });

      const response = await streamAdvisorChatMessage({
        gig: activeGig,
        chatHistory: messages.map((m) => ({ role: m.role, content: m.content })),
        userMessage: content,
        attachments,
        mode,
        model: selectedModel,
        onChunk: (partial) => setStreamingReply(partial),
        onRecommendedDocs: (docs) => {
          setRecommendedDocsByGig((prev) => ({ ...prev, [activeGig.id]: docs }));
          if (docs[0]?.docType) {
            setSelectedDocType(docs[0].docType);
          }
        },
      });

      setStreamingReply('');

      if (response.recommendedDocs && response.recommendedDocs.length > 0) {
        setRecommendedDocsByGig((prev) => ({
          ...prev,
          [activeGig.id]: response.recommendedDocs!,
        }));
      }

      await createAdvisorMessage(user.uid, activeGig.id, {
        id: generateSafeId('msg'),
        ownerId: user.uid,
        gigId: activeGig.id,
        role: 'advisor',
        content: response.reply,
        discrepancyFlags: response.discrepancyFlags || [],
      });
    } catch (err) {
      setStreamingReply('');
      setGlobalError(err instanceof Error ? err.message : 'Advisor stream failed.');
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleDraftAgreement = async (options?: Partial<AgreementGeneratorOptions>) => {
    if (!user || !activeGig) return;
    const docTypeToUse = options?.documentType || selectedDocType;
    setSelectedDocType(docTypeToUse);
    setIsDraftingAgreement(true);
    setStreamingAgreementText('');
    setActiveTab('agreements');
    setGlobalError(null);
    try {
      const includedItems = options?.includedIds
        ? activeGig.scopeItems.filter((s) => options.includedIds!.includes(s.id))
        : activeGig.scopeItems.filter((s) => s.classification !== 'bloat');

      const excludedItems = activeGig.scopeItems.filter(
        (s) => !includedItems.some((inc) => inc.id === s.id)
      );

      const defaultTotal =
        options?.agreedTotalNgn ||
        includedItems.reduce((sum, item) => sum + Math.round((item.minNgn + item.maxNgn) / 2), 0) ||
        activeGig.recommendedMinNgn;

      const drafted = await streamServiceAgreement({
        documentType: docTypeToUse,
        gig: activeGig,
        includedItems,
        excludedItems,
        agreedTotalNgn: defaultTotal,
        developerName: options?.developerName || user.displayName || 'Independent Developer',
        paymentSplit: options?.paymentSplit,
        deliveryDays: options?.deliveryDays || activeGig.recommendedDays,
        customNotes: options?.customNotes,
        model: selectedModel,
        onChunk: (partial) => setStreamingAgreementText(partial),
      });

      setStreamingAgreementText('');

      const newAgreement: AgreementDraft = {
        id: generateSafeId('agr'),
        ownerId: user.uid,
        gigId: activeGig.id,
        title: drafted.title,
        totalFeeNgn: drafted.totalFeeNgn,
        milestoneSummary: drafted.milestoneSummary,
        documentMarkdown: drafted.documentMarkdown,
        whatsappReplySnippet: drafted.whatsappReplySnippet,
        status: 'draft',
      };

      await createAgreementDraft(user.uid, activeGig.id, newAgreement);
    } catch (err) {
      setStreamingAgreementText('');
      setGlobalError(err instanceof Error ? err.message : 'Failed to stream document draft.');
    } finally {
      setIsDraftingAgreement(false);
    }
  };

  const handleSaveAgreementEdits = async (
    agreementId: string,
    updates: {
      title: string;
      totalFeeNgn: number;
      milestoneSummary: string;
      documentMarkdown: string;
      whatsappReplySnippet: string;
      status?: 'draft' | 'finalized';
    }
  ) => {
    if (!user || !activeGig) return;
    setIsSavingAgreement(true);
    try {
      await updateAgreementDraft(user.uid, activeGig.id, agreementId, updates);
      if (updates.status === 'finalized') {
        setActiveAgreement((prev) => (prev ? { ...prev, ...updates, status: 'finalized' } : null));
      }
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to save agreement.');
    } finally {
      setIsSavingAgreement(false);
    }
  };

  const handleDeleteGig = async (gigId: string) => {
    if (!user) return;
    try {
      await deleteGigAudit(user.uid, gigId);
      if (selectedGigId === gigId) {
        setSelectedGigId(null);
      }
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to delete gig audit.');
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#090C0A] flex items-center justify-center">
        <div className="text-xs text-[#86968C]">Loading ScopeNaira workspace...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#090C0A] text-[#ECFDF5]">
      {/* Strictly 3-zone Top Bar Contract */}
      <header className="h-14 px-6 border-b border-[#1F2B24] flex items-center justify-between gap-8 shrink-0 bg-[#090C0A]">
        <a
          href="/"
          className="text-base font-bold tracking-tight text-[#ECFDF5] whitespace-nowrap shrink-0"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          ScopeNaira
        </a>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#86968C]">
          {(
            [
              { id: 'discrepancies', label: 'Discrepancies' },
              { id: 'pricing', label: 'NGN Pricing' },
              { id: 'transcript', label: 'WhatsApp Log' },
              { id: 'agreements', label: 'Doc Generator' },
            ] as const
          ).map((nav) => (
            <button
              key={nav.id}
              type="button"
              onClick={() => setActiveTab(nav.id)}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                activeTab === nav.id ? 'text-[#22C55E]' : 'hover:text-[#ECFDF5]'
              }`}
            >
              {nav.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={() => {
                setAuditError(null);
                setIsIngestOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Paste Chat</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              className="px-4 py-2 text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              Sign In with Google
            </button>
          )}
        </div>
      </header>

      {(globalError || dbOfflineWarning) && (
        <div className="px-6 py-2.5 bg-[#1F1212] border-b border-[#7F1D1D] flex items-center justify-between gap-4 text-xs text-[#FCA5A5]">
          <span>
            {dbOfflineWarning
              ? 'Firestore appears offline. Please verify your network or Firebase project configuration.'
              : globalError}
          </span>
          <button
            type="button"
            onClick={() => {
              setGlobalError(null);
              setDbOfflineWarning(false);
            }}
            className="text-xs font-medium text-[#FCA5A5] hover:text-white whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      )}

      {!user ? (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-[#101512] border border-[#1F2B24] rounded-lg p-8 space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-[#ECFDF5] leading-snug">
                Expose WhatsApp Scope Traps Before You Write Code
              </h1>
              <p className="text-sm text-[#94A69B] leading-relaxed">
                Built for Nigerian developers evaluating client WhatsApp briefs—spot when a “simple
                Jumia app” silently demands real-time order tracking and Paystack split payments,
                benchmark fair Naira pricing, and generate formal client agreements.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#1F2B24]">
              <div className="space-y-1 pt-2">
                <div className="text-xs font-semibold text-[#22C55E]">01. Discrepancy Audit</div>
                <p className="text-xs text-[#86968C] leading-relaxed">
                  Flags omitted dependencies and unrealistic timeline claims.
                </p>
              </div>
              <div className="space-y-1 pt-2">
                <div className="text-xs font-semibold text-[#22C55E]">02. NGN Benchmarks</div>
                <p className="text-xs text-[#86968C] leading-relaxed">
                  Separates viable MVP modules from unbudgeted scope bloat in ₦.
                </p>
              </div>
              <div className="space-y-1 pt-2">
                <div className="text-xs font-semibold text-[#22C55E]">03. Doc Generator</div>
                <p className="text-xs text-[#86968C] leading-relaxed">
                  Streams Nigerian milestone SOWs and WhatsApp counter-replies.
                </p>
              </div>
            </div>

            {authError && (
              <div className="px-3.5 py-2.5 text-xs text-[#FCA5A5] bg-[#1F1212] border border-[#7F1D1D] rounded-md">
                {authError}
              </div>
            )}

            <button
              type="button"
              onClick={handleSignIn}
              className="w-full py-2.5 px-4 text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white rounded-md transition-colors"
            >
              Continue with Google to Open Workspace
            </button>
          </div>
        </main>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_390px] min-h-0">
          {/* Left Sidebar: Saved Gig Audits */}
          <aside className="bg-[#0C110E] border-b lg:border-b-0 lg:border-r border-[#1F2B24] flex flex-col justify-between">
            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#86968C]">Saved Gig Audits</span>
                <button
                  type="button"
                  onClick={() => setIsIngestOpen(true)}
                  className="text-xs text-[#22C55E] hover:text-[#4ADE80] transition-colors"
                >
                  + New Text
                </button>
              </div>

              {gigs.length === 0 ? (
                <div className="p-3.5 bg-[#101512] border border-[#1F2B24] rounded-md space-y-2.5">
                  <p className="text-xs text-[#86968C] leading-relaxed">
                    No WhatsApp audits saved yet. Type directly into the chatbox or load the sample
                    Jumia gig.
                  </p>
                  <button
                    type="button"
                    disabled={isAuditing}
                    onClick={handleLoadJumiaSample}
                    className="w-full py-1.5 px-3 text-xs font-medium bg-[#151C18] hover:bg-[#1A241E] text-[#22C55E] border border-[#1F2B24] rounded transition-colors"
                  >
                    {isAuditing ? 'Analyzing...' : 'Load Jumia Sample'}
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {gigs.map((g) => {
                    const isActive = g.id === selectedGigId;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedGigId(g.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors ${
                          isActive
                            ? 'bg-[#131C16] border-[#16A34A] text-[#ECFDF5]'
                            : 'bg-transparent border-transparent hover:bg-[#101512] text-[#94A69B]'
                        }`}
                      >
                        <div className="text-xs font-medium truncate">{g.title}</div>
                        <div className="text-[11px] text-[#6B7D72] mt-0.5 flex items-center gap-1.5 font-mono tabular-nums truncate">
                          <span>
                            {g.clientStatedBudgetNgn > 0 ? formatNgn(g.clientStatedBudgetNgn) : 'No budget'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{g.discrepancies.length} flags</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#1F2B24] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#ECFDF5] truncate">
                  {user.displayName || 'Developer'}
                </div>
                <div className="text-[11px] text-[#6B7D72] truncate">{user.email}</div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="p-2 text-[#86968C] hover:text-[#ECFDF5] rounded-md transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </aside>

          {/* Center Main Stage */}
          <main className="overflow-y-auto bg-[#090C0A]">
            <AuditMainStage
              gig={activeGig}
              developerDisplayName={user.displayName || 'Independent Developer'}
              activeTab={activeTab}
              selectedDocType={selectedDocType}
              recommendedDocs={activeRecommendedDocs}
              agreements={agreements}
              streamingAgreementText={streamingAgreementText}
              isLoadingAudit={isAuditing}
              isDraftingAgreement={isDraftingAgreement}
              onSelectTab={setActiveTab}
              onSelectDocType={setSelectedDocType}
              onAuditRawText={(rawText, hint, atts) => runNewAudit(rawText, hint, atts)}
              onLoadJumiaSample={handleLoadJumiaSample}
              onReauditWithMessage={handleReauditWithMessage}
              onDraftAgreement={(options) => handleDraftAgreement(options)}
              onOpenAgreement={(agr) => setActiveAgreement(agr)}
              onDeleteGig={handleDeleteGig}
            />
          </main>

          {/* Right Panel: Always-editable Streaming Advisor & Document Chatbox */}
          <div className="h-[520px] lg:h-[calc(100vh-3.5rem)] lg:sticky lg:top-14">
            <AdvisorChatbox
              gig={activeGig}
              messages={messages}
              streamingReply={streamingReply}
              selectedModel={selectedModel}
              recommendedDocs={activeRecommendedDocs}
              isSending={isSendingChat}
              isAuditing={isAuditing}
              isDraftingAgreement={isDraftingAgreement}
              onSelectModel={setSelectedModel}
              onAuditFromText={(rawText, atts) => runNewAudit(rawText, undefined, atts)}
              onSendMessage={handleSendAdvisorMessage}
              onDraftAgreementFromChat={() => {
                setActiveTab('agreements');
                return Promise.resolve();
              }}
              onGenerateRecommendedDoc={(docType) => handleDraftAgreement({ documentType: docType })}
            />
          </div>
        </div>
      )}

      <WhatsappIngestModal
        isOpen={isIngestOpen}
        isSubmitting={isAuditing}
        error={auditError}
        onClose={() => setIsIngestOpen(false)}
        onSubmit={runNewAudit}
      />

      <AgreementModal
        agreement={activeAgreement}
        isSaving={isSavingAgreement}
        onClose={() => setActiveAgreement(null)}
        onSaveEdits={handleSaveAgreementEdits}
      />

      {/* Mobile quick paste affordance */}
      {user && (
        <button
          type="button"
          onClick={() => setIsIngestOpen(true)}
          aria-label="Paste WhatsApp chat"
          className="md:hidden fixed bottom-4 right-4 p-3.5 bg-[#16A34A] text-white rounded-full shadow-lg"
        >
          <MessageSquarePlus className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
