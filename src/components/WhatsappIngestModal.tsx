import React, { useRef, useState } from 'react';
import { MessageSquareText, Plus, X } from 'lucide-react';
import { SAMPLE_GIGS } from '../data/sampleChats';
import { readFilesAsAttachments, type ClientAttachment } from '../utils/fileAttachments';
import { AttachmentStrip } from './AttachmentStrip';

interface WhatsappIngestModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (
    rawTranscript: string,
    clientNameHint?: string,
    attachments?: ClientAttachment[]
  ) => Promise<void>;
}

export const WhatsappIngestModal: React.FC<WhatsappIngestModalProps> = ({
  isOpen,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}) => {
  const [clientNameHint, setClientNameHint] = useState('');
  const [transcript, setTranscript] = useState(SAMPLE_GIGS[0].transcript);
  const [attachments, setAttachments] = useState<ClientAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSelectSample = (sampleId: string) => {
    const sample = SAMPLE_GIGS.find((s) => s.id === sampleId);
    if (!sample) return;
    setClientNameHint(sample.clientName);
    setTranscript(sample.transcript);
    setAttachments([]);
    setAttachError(null);
  };

  const handleAttachFiles = async (files: FileList | File[]) => {
    setAttachError(null);
    const { attachments: nextItems, error: fileErr } = await readFilesAsAttachments(
      files,
      attachments.length
    );
    if (fileErr) setAttachError(fileErr);
    if (nextItems.length > 0) {
      setAttachments((prev) => [...prev, ...nextItems]);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!transcript.trim() && attachments.length === 0) || isSubmitting) return;
    await onSubmit(
      transcript,
      clientNameHint.trim() || undefined,
      attachments.length > 0 ? attachments : undefined
    );
  };

  const canSubmit = !isSubmitting && (transcript.trim().length >= 10 || attachments.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingest-modal-title"
    >
      <div className="w-full max-w-2xl bg-[#101512] border border-[#1F2B24] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F2B24]">
          <div>
            <h2 id="ingest-modal-title" className="text-base font-semibold text-[#ECFDF5]">
              Add WhatsApp Chat, Screenshot, or Brief
            </h2>
            <p className="text-xs text-[#86968C] mt-0.5">
              Paste chat text or attach screenshots, PDFs, voice notes, and .txt exports to audit in ₦.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="p-2 text-[#86968C] hover:text-[#ECFDF5] rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,audio/*,.txt,.md,.csv,.json,.ogg,.opus"
            className="hidden"
            onChange={async (e) => {
              if (e.target.files?.length) {
                await handleAttachFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#86968C]">Samples:</span>
              {SAMPLE_GIGS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleSelectSample(sample.id)}
                  className="px-3 py-1.5 text-xs font-medium bg-[#151C18] hover:bg-[#1A241E] text-[#D1FAE5] border border-[#1F2B24] rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  {sample.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#151C18] hover:bg-[#1A241E] text-[#22C55E] border border-[#1F2B24] hover:border-[#22C55E] rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Image / PDF / Audio</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="client-name-hint" className="block text-xs font-medium text-[#A7B8AE]">
              Client Label (Optional)
            </label>
            <input
              id="client-name-hint"
              type="text"
              value={clientNameHint}
              onChange={(e) => setClientNameHint(e.target.value)}
              placeholder="e.g. Chief Emeka — Lagos Retail"
              className="w-full px-3.5 py-2 text-sm bg-[#090C0A] border border-[#1F2B24] rounded-md text-[#ECFDF5] placeholder-[#526258] focus:outline-none focus:border-[#22C55E]"
            />
          </div>

          {attachError && (
            <div className="px-3 py-2 text-xs text-[#FCA5A5] bg-[#1F1212] border border-[#7F1D1D] rounded-md">
              {attachError}
            </div>
          )}

          <AttachmentStrip
            attachments={attachments}
            disabled={isSubmitting}
            onRemove={(id) => setAttachments((prev) => prev.filter((item) => item.id !== id))}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="whatsapp-transcript" className="text-xs font-medium text-[#A7B8AE]">
                WhatsApp Chat Text {attachments.length > 0 ? '(Optional with attachments)' : ''}
              </label>
              <span className="text-xs font-mono tabular-nums text-[#6B7D72]">
                {transcript.length.toLocaleString()} / 48,000 chars
              </span>
            </div>
            <textarea
              id="whatsapp-transcript"
              rows={8}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              onPaste={async (e) => {
                if (e.clipboardData?.files?.length) {
                  e.preventDefault();
                  await handleAttachFiles(e.clipboardData.files);
                }
              }}
              placeholder="[19/11/2026, 09:19] Client: We just want a simple Jumia app for 150k... (or paste screenshot / click +)"
              className="w-full px-3.5 py-2.5 text-xs font-mono leading-relaxed bg-[#090C0A] border border-[#1F2B24] rounded-md text-[#D1FAE5] placeholder-[#526258] focus:outline-none focus:border-[#22C55E] resize-y"
            />
          </div>

          {error && (
            <div className="px-3.5 py-2.5 text-xs text-[#FCA5A5] bg-[#1F1212] border border-[#7F1D1D] rounded-md">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[#1F2B24]">
            <div className="flex items-center gap-2 text-xs text-[#6B7D72]">
              <MessageSquareText className="w-3.5 h-3.5" />
              <span>Benchmarked strictly in Nigerian Naira (₦)</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-[#A7B8AE] hover:text-[#ECFDF5] transition-colors whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-4 py-2 text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {isSubmitting ? 'Auditing Scope...' : 'Analyze Scope & Pricing'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
