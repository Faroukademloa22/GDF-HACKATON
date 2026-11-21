import React from 'react';
import { FileText, Volume2, X } from 'lucide-react';
import { formatFileSize, type ClientAttachment } from '../utils/fileAttachments';

interface AttachmentStripProps {
  attachments: ClientAttachment[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export const AttachmentStrip: React.FC<AttachmentStripProps> = ({
  attachments,
  onRemove,
  disabled = false,
}) => {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((att) => (
        <div
          key={att.id}
          className="inline-flex items-center gap-2 px-2 py-1.5 bg-[#101512] border border-[#1F2B24] rounded-md max-w-full"
        >
          {att.kind === 'image' && att.previewUrl ? (
            <img
              src={att.previewUrl}
              alt={att.name}
              className="w-8 h-8 rounded object-cover border border-[#1F2B24] shrink-0"
            />
          ) : att.kind === 'audio' ? (
            <div className="w-8 h-8 rounded bg-[#151C18] border border-[#1F2B24] flex items-center justify-center shrink-0">
              <Volume2 className="w-3.5 h-3.5 text-[#22C55E]" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded bg-[#151C18] border border-[#1F2B24] flex items-center justify-center shrink-0">
              <FileText className="w-3.5 h-3.5 text-[#22C55E]" />
            </div>
          )}

          <div className="min-w-0">
            <div className="text-[11px] font-medium text-[#ECFDF5] truncate max-w-[140px]">
              {att.name}
            </div>
            <div className="text-[10px] font-mono tabular-nums text-[#6B7D72]">
              {formatFileSize(att.sizeBytes)}
            </div>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(att.id)}
            aria-label={`Remove ${att.name}`}
            className="p-1 text-[#6B7D72] hover:text-[#F87171] disabled:opacity-40 transition-colors shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};
