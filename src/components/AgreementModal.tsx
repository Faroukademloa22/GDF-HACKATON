import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Lock, Printer, X } from 'lucide-react';
import { formatNgn, type AgreementDraft } from '../types/scope';
import { FormattedDocumentView } from './FormattedDocumentView';

interface AgreementModalProps {
  agreement: AgreementDraft | null;
  isSaving: boolean;
  onClose: () => void;
  onSaveEdits: (
    agreementId: string,
    updates: {
      title: string;
      totalFeeNgn: number;
      milestoneSummary: string;
      documentMarkdown: string;
      whatsappReplySnippet: string;
      status?: 'draft' | 'finalized';
    }
  ) => Promise<void>;
}

export const AgreementModal: React.FC<AgreementModalProps> = ({
  agreement,
  isSaving,
  onClose,
  onSaveEdits,
}) => {
  const [title, setTitle] = useState('');
  const [totalFeeNgn, setTotalFeeNgn] = useState(0);
  const [milestoneSummary, setMilestoneSummary] = useState('');
  const [documentMarkdown, setDocumentMarkdown] = useState('');
  const [whatsappSnippet, setWhatsappSnippet] = useState('');
  const [viewMode, setViewMode] = useState<'formatted' | 'edit'>('formatted');
  const [copiedDoc, setCopiedDoc] = useState(false);
  const [copiedWa, setCopiedWa] = useState(false);

  useEffect(() => {
    if (agreement) {
      setTitle(agreement.title);
      setTotalFeeNgn(agreement.totalFeeNgn);
      setMilestoneSummary(agreement.milestoneSummary);
      setDocumentMarkdown(agreement.documentMarkdown);
      setWhatsappSnippet(agreement.whatsappReplySnippet);
      setViewMode('formatted');
    }
  }, [agreement]);

  if (!agreement) return null;

  const isFinalized = agreement.status === 'finalized';

  const handleCopy = async (text: string, which: 'doc' | 'wa') => {
    await navigator.clipboard.writeText(text);
    if (which === 'doc') {
      setCopiedDoc(true);
      setTimeout(() => setCopiedDoc(false), 1800);
    } else {
      setCopiedWa(true);
      setTimeout(() => setCopiedWa(false), 1800);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([documentMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agreement-modal-title"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#101512] border border-[#1F2B24] rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#1F2B24]">
          <div className="min-w-0">
            <h2 id="agreement-modal-title" className="text-base font-semibold text-[#ECFDF5] truncate">
              {title || 'Freelance Service Agreement'}
            </h2>
            <p className="text-xs text-[#86968C] mt-0.5 font-mono tabular-nums">
              {formatNgn(totalFeeNgn)} · {isFinalized ? 'Finalized (Locked)' : 'Editable Draft'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleCopy(documentMarkdown, 'doc')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#151C18] hover:bg-[#1A241E] text-[#ECFDF5] border border-[#1F2B24] rounded-md transition-colors whitespace-nowrap"
            >
              {copiedDoc ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedDoc ? 'Copied' : 'Copy Text'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#151C18] hover:bg-[#1A241E] text-[#ECFDF5] border border-[#1F2B24] rounded-md transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .md</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#151C18] hover:bg-[#1A241E] text-[#ECFDF5] border border-[#1F2B24] rounded-md transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close agreement modal"
              className="p-2 text-[#86968C] hover:text-[#ECFDF5] rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-medium text-[#A7B8AE]">Document Title</label>
              <input
                type="text"
                disabled={isFinalized}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#090C0A] border border-[#1F2B24] rounded-md text-[#ECFDF5] disabled:opacity-60 focus:outline-none focus:border-[#22C55E]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#A7B8AE]">Agreed Fee (NGN)</label>
              <input
                type="number"
                disabled={isFinalized}
                value={totalFeeNgn}
                onChange={(e) => setTotalFeeNgn(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#090C0A] border border-[#1F2B24] rounded-md text-[#ECFDF5] disabled:opacity-60 focus:outline-none focus:border-[#22C55E]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#A7B8AE]">Milestone / Reference Summary</label>
            <input
              type="text"
              disabled={isFinalized}
              value={milestoneSummary}
              onChange={(e) => setMilestoneSummary(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#090C0A] border border-[#1F2B24] rounded-md text-[#D1FAE5] disabled:opacity-60 focus:outline-none focus:border-[#22C55E]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[#A7B8AE]">
                WhatsApp Client Summary Message
              </label>
              <button
                type="button"
                onClick={() => handleCopy(whatsappSnippet, 'wa')}
                className="inline-flex items-center gap-1 text-xs text-[#22C55E] hover:text-[#4ADE80] transition-colors"
              >
                {copiedWa ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedWa ? 'Copied' : 'Copy for WhatsApp'}</span>
              </button>
            </div>
            <textarea
              rows={3}
              disabled={isFinalized}
              value={whatsappSnippet}
              onChange={(e) => setWhatsappSnippet(e.target.value)}
              className="w-full px-3 py-2 text-xs leading-relaxed bg-[#090C0A] border border-[#1F2B24] rounded-md text-[#D1FAE5] disabled:opacity-60 focus:outline-none focus:border-[#22C55E]"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-medium text-[#A7B8AE]">
                Document Body
              </label>
              <div className="inline-flex items-center gap-1 p-0.5 bg-[#090C0A] border border-[#1F2B24] rounded">
                <button
                  type="button"
                  onClick={() => setViewMode('formatted')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                    viewMode === 'formatted'
                      ? 'bg-[#16A34A] text-white'
                      : 'text-[#86968C] hover:text-[#ECFDF5]'
                  }`}
                >
                  Formatted Sheet
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('edit')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                    viewMode === 'edit'
                      ? 'bg-[#16A34A] text-white'
                      : 'text-[#86968C] hover:text-[#ECFDF5]'
                  }`}
                >
                  {isFinalized ? 'Markdown Source' : 'Edit Source'}
                </button>
              </div>
            </div>

            {viewMode === 'formatted' ? (
              <div className="p-5 bg-[#090C0A] border border-[#1F2B24] rounded-md max-h-[26rem] overflow-y-auto">
                <FormattedDocumentView markdown={documentMarkdown} />
              </div>
            ) : (
              <textarea
                rows={15}
                disabled={isFinalized}
                value={documentMarkdown}
                onChange={(e) => setDocumentMarkdown(e.target.value)}
                className="w-full px-3.5 py-3 text-xs font-mono leading-relaxed bg-[#090C0A] border border-[#1F2B24] rounded-md text-[#D1FAE5] disabled:opacity-70 focus:outline-none focus:border-[#22C55E]"
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1F2B24] bg-[#0D120F]">
          <span className="text-xs text-[#6B7D72]">
            {isFinalized
              ? 'This agreement is locked in Firestore to preserve an immutable record.'
              : 'Save edits as draft or finalize to lock the fee and scope.'}
          </span>

          {!isFinalized && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isSaving}
                onClick={() =>
                  onSaveEdits(agreement.id, {
                    title,
                    totalFeeNgn,
                    milestoneSummary,
                    documentMarkdown,
                    whatsappReplySnippet: whatsappSnippet,
                    status: 'draft',
                  })
                }
                className="px-4 py-2 text-xs font-medium bg-[#151C18] hover:bg-[#1A241E] text-[#ECFDF5] border border-[#1F2B24] rounded-md transition-colors whitespace-nowrap"
              >
                {isSaving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() =>
                  onSaveEdits(agreement.id, {
                    title,
                    totalFeeNgn,
                    milestoneSummary,
                    documentMarkdown,
                    whatsappReplySnippet: whatsappSnippet,
                    status: 'finalized',
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#16A34A] hover:bg-[#15803D] text-white rounded-md transition-colors whitespace-nowrap"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Finalize & Lock</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
