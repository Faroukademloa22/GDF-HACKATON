import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  FileSignature,
  FileText,
  Paperclip,
  Send,
  X,
} from 'lucide-react';
import { SAMPLE_GIGS } from '../data/sampleChats';
import {
  formatNgn,
  formatNgnRange,
  type AdvisorMessage,
  type AgreementDraft,
  type GigAudit,
} from '../types/scope';

interface ChatWorkspaceProps {
  gig: GigAudit | null;
  messages: AdvisorMessage[];
  agreements: AgreementDraft[];
  isSending: boolean;
  onSendTurn: (text: string, attachmentTranscript?: string, attachmentName?: string) => Promise<void>;
  onOpenScopeView: () => void;
  onOpenAgreement: (agreement: AgreementDraft) => void;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  gig,
  messages,
  agreements,
  isSending,
  onSendTurn,
  onOpenScopeView,
  onOpenAgreement,
}) => {
  const [input, setInput] = useState('');
  const [attachmentText, setAttachmentText] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSending]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setAttachmentName(file.name);
    setAttachmentText(text.slice(0, 48000));
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;
    if (!input.trim() && !attachmentText) return;

    const textToSend =
      input.trim() || `Audit this WhatsApp export (${attachmentName || 'chat.txt'}) for discrepancies, bloat, and NGN pricing.`;
    const attText = attachmentText || undefined;
    const attName = attachmentName || undefined;

    setInput('');
    setAttachmentText(null);
    setAttachmentName(null);
    await onSendTurn(textToSend, attText, attName);
  };

  const handleCopy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const handleQuickSample = async () => {
    if (isSending) return;
    const sample = SAMPLE_GIGS[0];
    await onSendTurn(
      'Audit this WhatsApp gig chat. Point out every discrepancy, bloat, and realistic NGN pricing.',
      sample.transcript,
      'jumia_whatsapp_export.txt'
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#090C0A]">
      {/* Compact context bar when an audit exists */}
      {gig && (
        <div className="border-b border-[#1F2B24] bg-[#0C110E] px-6 py-3 shrink-0">
          <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#ECFDF5] truncate">{gig.title}</div>
              <div className="text-[11px] text-[#86968C] font-mono tabular-nums flex flex-wrap items-center gap-2 mt-0.5">
                <span>
                  Offer: {gig.clientStatedBudgetNgn > 0 ? formatNgn(gig.clientStatedBudgetNgn) : 'Unstated'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-[#22C55E]">
                  Fair NGN: {formatNgnRange(gig.recommendedMinNgn, gig.recommendedMaxNgn)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-[#FBBF24]">{gig.discrepancies.length} discrepancies</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenScopeView}
              className="px-3 py-1.5 text-xs font-medium bg-[#151C18] hover:bg-[#1A241E] text-[#D1FAE5] border border-[#1F2B24] rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              View NGN Matrix
            </button>
          </div>
        </div>
      )}

      {/* Chat message stream */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {messages.length === 0 ? (
            <div className="py-12 space-y-6">
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-[#ECFDF5]">
                  ScopeNaira WhatsApp & Contract Advisor
                </h1>
                <p className="text-sm text-[#86968C] leading-relaxed">
                  Paste a client WhatsApp chat or attach an exported <span className="font-mono text-[#D1FAE5]">.txt</span> file.
                  Ask what is left out, check Naira pricing, or tell me to draft a contract anytime.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isSending}
                  onClick={handleQuickSample}
                  className="text-left p-4 bg-[#101512] hover:bg-[#141C17] border border-[#1F2B24] rounded-lg transition-colors space-y-1"
                >
                  <div className="text-xs font-semibold text-[#22C55E]">
                    Audit Sample: “Simple Jumia App” (₦150k)
                  </div>
                  <p className="text-xs text-[#86968C] leading-relaxed">
                    Exposes omitted real-time tracking, Paystack escrow, and 2-week trap.
                  </p>
                </button>

                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => fileInputRef.current?.click()}
                  className="text-left p-4 bg-[#101512] hover:bg-[#141C17] border border-[#1F2B24] rounded-lg transition-colors space-y-1"
                >
                  <div className="text-xs font-semibold text-[#ECFDF5]">
                    Upload WhatsApp .txt Export
                  </div>
                  <p className="text-xs text-[#86968C] leading-relaxed">
                    Attach an exported client thread to audit discrepancies & bloat in NGN.
                  </p>
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isAdvisor = msg.role === 'advisor';
              const linkedAgreement = msg.linkedAgreementId
                ? agreements.find((a) => a.id === msg.linkedAgreementId)
                : undefined;

              return (
                <div
                  key={msg.id}
                  className={`p-4 sm:p-5 rounded-lg border text-sm leading-relaxed space-y-3 ${
                    isAdvisor
                      ? 'bg-[#101512] border-[#1F2B24] text-[#D1FAE5]'
                      : 'bg-[#0F1812] border-[#1B3123] text-[#ECFDF5] ml-4 sm:ml-10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#86968C]">
                      {isAdvisor ? 'ScopeNaira' : 'You'}
                    </span>
                    {isAdvisor && (
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="inline-flex items-center gap-1 text-xs text-[#6B7D72] hover:text-[#22C55E] transition-colors"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>

                  <div className="text-[13.5px] whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>

                  {msg.discrepancyFlags && msg.discrepancyFlags.length > 0 && (
                    <div className="pt-3 border-t border-[#1F2B24] space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#FBBF24]">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Discrepancies & Bloat Detected</span>
                      </div>
                      <ul className="space-y-1">
                        {msg.discrepancyFlags.map((flag, i) => (
                          <li key={i} className="text-xs text-[#E5E7EB] leading-relaxed">
                            • {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {linkedAgreement && (
                    <div className="pt-3 border-t border-[#1F2B24] flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#22C55E]">
                          <FileSignature className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{linkedAgreement.title}</span>
                        </div>
                        <div className="text-xs text-[#86968C] font-mono tabular-nums">
                          {formatNgn(linkedAgreement.totalFeeNgn)} · {linkedAgreement.milestoneSummary}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenAgreement(linkedAgreement)}
                          className="px-3 py-1.5 text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white rounded-md transition-colors whitespace-nowrap"
                        >
                          Open & Edit Contract
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {isSending && (
            <div className="p-4 rounded-lg bg-[#101512] border border-[#1F2B24] text-xs text-[#86968C] animate-pulse">
              Analyzing WhatsApp context with Gemini...
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Bottom Sticky Chatbox Composer */}
      <div className="border-t border-[#1F2B24] bg-[#0C110E] px-4 sm:px-6 py-3.5 shrink-0">
        <div className="max-w-3xl mx-auto space-y-2.5">
          {gig && (
            <div className="flex flex-wrap items-center gap-2">
              {[
                {
                  label: 'Flag Discrepancies',
                  prompt: 'List every discrepancy between what the client claimed and what is actually required technically.',
                },
                {
                  label: 'NGN Sense Check',
                  prompt: 'Tell me clearly in NGN what makes sense and what does not make sense in this budget.',
                },
                {
                  label: 'Draft Contract',
                  prompt: 'Draft a formal Nigerian Scope & Service Agreement contract for the viable MVP scope, explicitly excluding bloat.',
                },
                {
                  label: 'WhatsApp Counter-Reply',
                  prompt: 'Write a firm, polite WhatsApp reply I can send the client explaining the realistic NGN price.',
                },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  disabled={isSending}
                  onClick={() => onSendTurn(chip.prompt)}
                  className="px-2.5 py-1 text-xs font-medium bg-[#101512] hover:bg-[#151C18] text-[#A7B8AE] hover:text-[#22C55E] border border-[#1F2B24] rounded transition-colors whitespace-nowrap"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {attachmentName && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#151C18] border border-[#1F2B24] rounded-md text-xs text-[#D1FAE5]">
              <FileText className="w-3.5 h-3.5 text-[#22C55E]" />
              <span className="truncate max-w-xs">{attachmentName}</span>
              <button
                type="button"
                onClick={() => {
                  setAttachmentName(null);
                  setAttachmentText(null);
                }}
                aria-label="Remove attachment"
                className="text-[#86968C] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={isSending}
              onClick={() => fileInputRef.current?.click()}
              title="Attach WhatsApp .txt export"
              aria-label="Attach WhatsApp .txt export"
              className="p-2.5 bg-[#101512] hover:bg-[#151C18] border border-[#1F2B24] text-[#86968C] hover:text-[#22C55E] rounded-md transition-colors shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <textarea
              rows={2}
              disabled={isSending}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={
                gig
                  ? 'Ask about discrepancies, paste a new client WhatsApp message, or say "Draft a contract"...'
                  : 'Paste a WhatsApp chat here, attach .txt, or describe the gig...'
              }
              className="flex-1 px-3.5 py-2 text-sm bg-[#090C0A] border border-[#1F2B24] rounded-md text-[#ECFDF5] placeholder-[#526258] focus:outline-none focus:border-[#22C55E] resize-none disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={isSending || (!input.trim() && !attachmentText)}
              aria-label="Send message"
              className="px-4 py-2.5 bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-40 text-white rounded-md transition-colors inline-flex items-center gap-1.5 text-xs font-semibold shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
