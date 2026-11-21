import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  FileSignature,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Send,
  Volume2,
} from 'lucide-react';
import {
  ADVISOR_PLAYBOOK_EXAMPLES,
  getDocumentEntry,
  type DocumentTypeId,
  type RecommendedDocItem,
} from '../data/documentCatalog';
import type { FlashModelId } from '../services/apiService';
import type { AdvisorMessage, GigAudit } from '../types/scope';
import { readFilesAsAttachments, type ClientAttachment } from '../utils/fileAttachments';
import { AttachmentStrip } from './AttachmentStrip';
import { FormattedDocumentView } from './FormattedDocumentView';

interface AdvisorChatboxProps {
  gig: GigAudit | null;
  messages: AdvisorMessage[];
  streamingReply: string;
  selectedModel: FlashModelId;
  recommendedDocs: RecommendedDocItem[];
  isSending: boolean;
  isAuditing: boolean;
  isDraftingAgreement: boolean;
  onSelectModel: (model: FlashModelId) => void;
  onAuditFromText: (rawText: string, attachments?: ClientAttachment[]) => Promise<void>;
  onSendMessage: (
    content: string,
    mode: 'advisor_question' | 'client_input',
    attachments?: ClientAttachment[]
  ) => Promise<void>;
  onDraftAgreementFromChat: () => Promise<void>;
  onGenerateRecommendedDoc: (docType: DocumentTypeId) => Promise<void>;
}

const URGENCY_LABEL: Record<RecommendedDocItem['urgency'], { text: string; color: string }> = {
  immediate: { text: 'Send First', color: 'text-[#22C55E]' },
  next_step: { text: 'Next Step', color: 'text-[#FBBF24]' },
  optional: { text: 'If Needed', color: 'text-[#86968C]' },
};

export const AdvisorChatbox: React.FC<AdvisorChatboxProps> = ({
  gig,
  messages,
  streamingReply,
  selectedModel,
  recommendedDocs,
  isSending,
  isAuditing,
  isDraftingAgreement,
  onSelectModel,
  onAuditFromText,
  onSendMessage,
  onDraftAgreementFromChat,
  onGenerateRecommendedDoc,
}) => {
  const [inputMode, setInputMode] = useState<'advisor_question' | 'client_input'>('client_input');
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<ClientAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPlaybook, setShowPlaybook] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingReply, recommendedDocs.length]);

  useEffect(() => {
    if (!showAttachMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAttachMenu]);

  const isBusy = isSending || isAuditing;

  const appendFiles = async (files: FileList | File[]) => {
    setAttachError(null);
    const { attachments: nextItems, error } = await readFilesAsAttachments(
      files,
      attachments.length
    );
    if (error) setAttachError(error);
    if (nextItems.length > 0) {
      setAttachments((prev) => [...prev, ...nextItems]);
    }
  };

  const openPicker = (accept: string) => {
    setShowAttachMenu(false);
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = accept;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if ((!content && attachments.length === 0) || isBusy) return;
    const filesToSend = attachments;
    setText('');
    setAttachments([]);
    setAttachError(null);

    if (!gig) {
      await onAuditFromText(content, filesToSend);
      return;
    }

    await onSendMessage(content, inputMode, filesToSend);
  };

  const handleQuickPrompt = async (prompt: string) => {
    if (isBusy) return;
    setShowPlaybook(false);
    if (!gig) {
      await onAuditFromText(prompt);
      return;
    }
    await onSendMessage(prompt, 'advisor_question');
  };

  const handleCopyBlock = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  return (
    <aside className="flex flex-col h-full bg-[#0C110E] border-l border-[#1F2B24]">
      <div className="px-4 py-3.5 border-b border-[#1F2B24] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#ECFDF5] truncate">
            Scope & Document Advisor
          </h2>
          <p className="text-xs text-[#6B7D72] truncate">
            Elite Nigerian freelance counsel & doc selector
          </p>
        </div>

        <button
          type="button"
          disabled={!gig || isDraftingAgreement}
          onClick={onDraftAgreementFromChat}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#151C18] hover:bg-[#1A241E] disabled:opacity-40 text-[#22C55E] border border-[#1F2B24] rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <FileSignature className="w-3.5 h-3.5" />
          <span>{isDraftingAgreement ? 'Drafting...' : 'Open Generator'}</span>
        </button>
      </div>

      {/* Model switcher & Playbook toggle */}
      <div className="px-4 py-2 border-b border-[#1F2B24] flex items-center justify-between gap-2 bg-[#090C0A]">
        <div className="inline-flex items-center gap-1 p-0.5 bg-[#101512] border border-[#1F2B24] rounded">
          <button
            type="button"
            onClick={() => onSelectModel('gemini-3.1-flash-lite')}
            className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
              selectedModel === 'gemini-3.1-flash-lite'
                ? 'bg-[#16A34A] text-white'
                : 'text-[#86968C] hover:text-[#ECFDF5]'
            }`}
          >
            Flash Lite
          </button>
          <button
            type="button"
            onClick={() => onSelectModel('gemini-4-hydrogen')}
            className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
              selectedModel === 'gemini-4-hydrogen'
                ? 'bg-[#16A34A] text-white'
                : 'text-[#86968C] hover:text-[#ECFDF5]'
            }`}
          >
            Gemini 4 Flash
          </button>
        </div>

        {gig && (
          <button
            type="button"
            onClick={() => setShowPlaybook((v) => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap ${
              showPlaybook
                ? 'bg-[#16A34A]/15 border-[#16A34A] text-[#22C55E]'
                : 'bg-[#101512] border-[#1F2B24] text-[#94A69B] hover:text-[#ECFDF5]'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            <span>Playbook Traps</span>
          </button>
        )}
      </div>

      {/* Expandable Playbook Scenarios */}
      {gig && showPlaybook && (
        <div className="px-4 py-3 border-b border-[#1F2B24] bg-[#0B0F0D] space-y-2">
          <div className="text-[11px] font-semibold text-[#86968C]">
            Ask Advisor About Common Client Traps
          </div>
          <div className="space-y-1.5">
            {ADVISOR_PLAYBOOK_EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                disabled={isBusy}
                onClick={() => handleQuickPrompt(ex.prompt)}
                className="w-full text-left px-2.5 py-1.5 text-xs bg-[#101512] hover:bg-[#151C18] text-[#C7D8CE] hover:text-[#22C55E] border border-[#1F2B24] rounded transition-colors"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!gig ? (
          <div className="space-y-3">
            <div className="text-xs text-[#94A69B] leading-relaxed p-3.5 bg-[#101512] border border-[#1F2B24] rounded-md">
              Paste or type any WhatsApp client brief right into this chatbox below. I will audit
              hidden discrepancies, call out bloat, benchmark NGN pricing, and recommend the exact
              legal/payment documents needed for the situation.
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                handleQuickPrompt(
                  'Client: Good morning bro, we want a simple Jumia app for Lagos and Abuja. Budget is 150k Naira sharp, launch in 2 weeks. Customers must pay securely with card/transfer, track dispatch riders live on map, and vendors upload items.'
                )
              }
              className="w-full text-left px-3 py-2 text-xs bg-[#101512] hover:bg-[#151C18] text-[#22C55E] border border-[#1F2B24] rounded-md transition-colors"
            >
              Try: “Simple Jumia app for ₦150k with live rider tracking & Paystack”
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-3">
            <div className="text-xs text-[#94A69B] leading-relaxed p-3.5 bg-[#101512] border border-[#1F2B24] rounded-md">
              Reviewing <span className="text-[#ECFDF5] font-medium">{gig.title}</span>. Ask about
              pricing traps, paste a follow-up message from {gig.clientName}, or pick a scenario
              below to get situation-specific document recommendations.
            </div>
            <div className="space-y-1.5">
              {ADVISOR_PLAYBOOK_EXAMPLES.slice(0, 3).map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleQuickPrompt(ex.prompt)}
                  className="w-full text-left px-3 py-2 text-xs bg-[#101512] hover:bg-[#151C18] text-[#C7D8CE] hover:text-[#22C55E] border border-[#1F2B24] rounded-md transition-colors"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isAdvisor = msg.role === 'advisor';
            const isClientQuote = msg.role === 'client_input';
            return (
              <div
                key={msg.id}
                className={`space-y-2 p-3.5 rounded-lg border text-xs leading-relaxed ${
                  isAdvisor
                    ? 'bg-[#101512] border-[#1F2B24] text-[#D1FAE5]'
                    : isClientQuote
                    ? 'bg-[#16130E] border-[#3B2E1A] text-[#FDE68A]'
                    : 'bg-[#121D16] border-[#1F3A28] text-[#ECFDF5]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[11px] text-[#86968C]">
                    {isAdvisor
                      ? 'ScopeNaira Advisor'
                      : isClientQuote
                      ? 'Client WhatsApp Message'
                      : 'Developer'}
                  </span>
                  {isAdvisor && (
                    <button
                      type="button"
                      onClick={() => handleCopyBlock(msg.id, msg.content)}
                      className="inline-flex items-center gap-1 text-[11px] text-[#6B7D72] hover:text-[#22C55E]"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-[#22C55E]" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>

                {isAdvisor ? (
                  <FormattedDocumentView markdown={msg.content} />
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}

                {msg.discrepancyFlags && msg.discrepancyFlags.length > 0 && (
                  <div className="pt-2 border-t border-[#1F2B24] space-y-1">
                    <div className="text-[11px] font-semibold text-[#FBBF24]">
                      Discrepancies Flagged
                    </div>
                    <ul className="space-y-1">
                      {msg.discrepancyFlags.map((flag, i) => (
                        <li key={i} className="text-[11px] text-[#FDE68A]">
                          • {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Context-recommended document actions from tool call */}
        {gig && recommendedDocs.length > 0 && !isBusy && (
          <div className="p-3.5 rounded-lg bg-[#0E1511] border border-[#16A34A]/50 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#22C55E]">
                Recommended Documents for This Context
              </span>
              <span className="text-[11px] font-mono tabular-nums text-[#6B7D72]">
                {recommendedDocs.length} selected
              </span>
            </div>
            <div className="space-y-2">
              {recommendedDocs.map((rec) => {
                const entry = getDocumentEntry(rec.docType);
                const urgency = URGENCY_LABEL[rec.urgency] || URGENCY_LABEL.next_step;
                return (
                  <div
                    key={rec.docType}
                    className="p-2.5 rounded bg-[#090C0A] border border-[#1F2B24] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-[#ECFDF5]">{entry.name}</span>
                      </div>
                      <span className={`text-[11px] font-medium whitespace-nowrap ${urgency.color}`}>
                        {urgency.text}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#86968C] leading-relaxed">{rec.reason}</p>
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        disabled={isDraftingAgreement}
                        onClick={() => onGenerateRecommendedDoc(entry.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-white rounded transition-colors whitespace-nowrap"
                      >
                        <FileSignature className="w-3 h-3" />
                        <span>Generate {entry.shortCode}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live streaming response bubble */}
        {streamingReply && (
          <div className="space-y-2 p-3.5 rounded-lg border bg-[#101512] border-[#16A34A]/60 text-[#D1FAE5] text-xs leading-relaxed">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[11px] text-[#22C55E]">
                ScopeNaira Advisor (streaming...)
              </span>
            </div>
            <FormattedDocumentView markdown={streamingReply} />
          </div>
        )}

        {isBusy && !streamingReply && (
          <div className="p-3.5 rounded-lg bg-[#101512] border border-[#1F2B24] text-xs text-[#86968C] animate-pulse">
            {isAuditing ? 'Auditing WhatsApp scope in NGN...' : 'Consulting advisor & checking document tools...'}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Always-editable chatbox input with + upload button, drag-drop, & image paste */}
      <form
        onSubmit={handleSubmit}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isBusy) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setIsDragging(false);
          if (isBusy) return;
          if (e.dataTransfer.files?.length) {
            await appendFiles(e.dataTransfer.files);
          }
        }}
        className={`p-3.5 border-t space-y-2.5 transition-colors ${
          isDragging
            ? 'bg-[#101A14] border-[#22C55E]'
            : 'bg-[#090C0A] border-[#1F2B24]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={async (e) => {
            if (e.target.files?.length) {
              await appendFiles(e.target.files);
            }
          }}
        />

        {gig && (
          <div className="flex items-center gap-1 p-0.5 bg-[#101512] border border-[#1F2B24] rounded-md">
            <button
              type="button"
              onClick={() => setInputMode('client_input')}
              className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                inputMode === 'client_input'
                  ? 'bg-[#1A241E] text-[#FBBF24]'
                  : 'text-[#86968C] hover:text-[#ECFDF5]'
              }`}
            >
              Paste Client Reply
            </button>
            <button
              type="button"
              onClick={() => setInputMode('advisor_question')}
              className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                inputMode === 'advisor_question'
                  ? 'bg-[#1A241E] text-[#22C55E]'
                  : 'text-[#86968C] hover:text-[#ECFDF5]'
              }`}
            >
              Ask Advisor
            </button>
          </div>
        )}

        {attachError && (
          <div className="px-2.5 py-1.5 text-[11px] text-[#FCA5A5] bg-[#1F1212] border border-[#7F1D1D] rounded">
            {attachError}
          </div>
        )}

        <AttachmentStrip
          attachments={attachments}
          disabled={isBusy}
          onRemove={(id) => setAttachments((prev) => prev.filter((item) => item.id !== id))}
        />

        <div className="flex items-end gap-2">
          <div ref={menuContainerRef} className="relative shrink-0">
            {showAttachMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#101512] border border-[#1F2B24] rounded-lg shadow-xl overflow-hidden z-30">
                <div className="px-3 py-2 border-b border-[#1F2B24] text-[11px] font-semibold text-[#86968C]">
                  Upload Context Media
                </div>
                <div className="p-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => openPicker('image/*,.png,.jpg,.jpeg,.webp')}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs text-left text-[#ECFDF5] hover:bg-[#151C18] rounded transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                    <div>
                      <div className="font-medium">Image / Screenshot</div>
                      <div className="text-[10px] text-[#6B7D72]">WhatsApp chat, UI mockup</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => openPicker('.txt,.md,.csv,.json,application/pdf')}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs text-left text-[#ECFDF5] hover:bg-[#151C18] rounded transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                    <div>
                      <div className="font-medium">PDF Brief or .txt Export</div>
                      <div className="text-[10px] text-[#6B7D72]">Client spec, RFP, chat log</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => openPicker('audio/*,.ogg,.opus,.mp3,.wav,.m4a,.webm')}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs text-left text-[#ECFDF5] hover:bg-[#151C18] rounded transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                    <div>
                      <div className="font-medium">Voice Note / Audio</div>
                      <div className="text-[10px] text-[#6B7D72]">WhatsApp .ogg, .mp3, .m4a</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openPicker('image/*,application/pdf,audio/*,.txt,.md,.csv,.json,.ogg,.opus')
                    }
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs text-left text-[#A7B8AE] hover:text-[#ECFDF5] hover:bg-[#151C18] rounded transition-colors border-t border-[#1F2B24] mt-0.5 pt-2"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-[#86968C] shrink-0" />
                    <span>Browse Any Supported File</span>
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={isBusy}
              onClick={() => setShowAttachMenu((v) => !v)}
              aria-label="Attach images, PDFs, audio, or chat export"
              title="Attach image, PDF, voice note, or .txt"
              className={`p-2.5 rounded-md border transition-colors shrink-0 disabled:opacity-40 ${
                showAttachMenu || attachments.length > 0
                  ? 'bg-[#16A34A]/15 border-[#16A34A] text-[#22C55E]'
                  : 'bg-[#101512] border-[#1F2B24] text-[#A7B8AE] hover:text-[#22C55E] hover:border-[#22C55E]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <textarea
            rows={3}
            disabled={isBusy}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={async (e) => {
              const items = e.clipboardData?.files;
              if (items && items.length > 0) {
                e.preventDefault();
                await appendFiles(items);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={
              !gig
                ? 'Type, paste screenshot, or click + to upload chat, PDF, or audio...'
                : inputMode === 'client_input'
                ? 'Paste client text/image, or click + for screenshot, PDF, voice note...'
                : 'Ask advisor, paste screenshot, or click + to attach files...'
            }
            className="flex-1 px-3 py-2 text-xs bg-[#101512] border border-[#1F2B24] rounded-md text-[#ECFDF5] placeholder-[#526258] focus:outline-none focus:border-[#22C55E] resize-none disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={isBusy || (!text.trim() && attachments.length === 0)}
            aria-label="Send message"
            className="p-2.5 bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-40 text-white rounded-md transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </aside>
  );
};
