import type { DocumentTypeId, RecommendedDocItem } from '../data/documentCatalog';
import { toApiAttachments, type ClientAttachment } from '../utils/fileAttachments';
import type {
  GigAudit,
  ParsedWhatsappMessage,
  PricingVerdict,
  ScopeDiscrepancy,
  ScopeItem,
  VerdictStatus,
} from '../types/scope';

export type FlashModelId = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

export interface AuditResponsePayload {
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
  parsedMessages: ParsedWhatsappMessage[];
  discrepancies: ScopeDiscrepancy[];
  scopeItems: ScopeItem[];
  pricingVerdict: PricingVerdict;
  extractedTranscript?: string;
}

export interface AdvisorChatResponse {
  reply: string;
  discrepancyFlags: string[];
  recommendedDocs?: RecommendedDocItem[];
  suggestedWhatsappReply?: string;
}

export interface DraftAgreementResponse {
  title: string;
  documentType?: DocumentTypeId;
  totalFeeNgn: number;
  milestoneSummary: string;
  documentMarkdown: string;
  whatsappReplySnippet: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      (payload as { error?: string }).error ||
      `Request failed with status ${response.status}`;
    throw new Error(msg);
  }
  return payload as T;
}

async function consumeSseStream<TDone>(
  url: string,
  body: unknown,
  onChunk: (textDelta: string) => void,
  onEvent?: (eventName: string, payload: unknown) => void
): Promise<TDone> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({}));
    const msg = (payload as { error?: string }).error || `Stream failed (${response.status})`;
    throw new Error(msg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let donePayload: TDone | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() || '';

    for (const frame of frames) {
      let eventName = 'message';
      const dataLines: string[] = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        }
      }
      if (!dataLines.length) continue;
      const parsed = JSON.parse(dataLines.join('\n'));
      if (eventName === 'chunk' && typeof parsed.text === 'string') {
        onChunk(parsed.text);
      } else if (eventName === 'error') {
        throw new Error(parsed.error || 'Streaming AI request failed.');
      } else if (eventName === 'done') {
        donePayload = parsed as TDone;
      } else if (onEvent) {
        onEvent(eventName, parsed);
      }
    }
  }

  if (!donePayload) {
    throw new Error('Stream ended before final response payload arrived.');
  }
  return donePayload;
}

export async function auditWhatsappTranscript(
  rawTranscript: string,
  clientNameHint?: string,
  model: FlashModelId = 'gemini-3.1-flash-lite',
  attachments?: ClientAttachment[]
): Promise<AuditResponsePayload> {
  return postJson<AuditResponsePayload>('/api/audit-whatsapp', {
    rawTranscript,
    attachments: attachments && attachments.length > 0 ? toApiAttachments(attachments) : undefined,
    clientNameHint,
    model,
  });
}

export async function streamAdvisorChatMessage(params: {
  gig: GigAudit;
  chatHistory: { role: string; content: string }[];
  userMessage: string;
  attachments?: ClientAttachment[];
  mode: 'advisor_question' | 'client_input';
  model: FlashModelId;
  onChunk: (partialFullText: string) => void;
  onRecommendedDocs?: (docs: RecommendedDocItem[]) => void;
}): Promise<AdvisorChatResponse> {
  const compactGig = {
    title: params.gig.title,
    clientName: params.gig.clientName,
    projectType: params.gig.projectType,
    clientStatedBudgetNgn: params.gig.clientStatedBudgetNgn,
    recommendedMinNgn: params.gig.recommendedMinNgn,
    recommendedMaxNgn: params.gig.recommendedMaxNgn,
    timelineRequestedDays: params.gig.timelineRequestedDays,
    recommendedDays: params.gig.recommendedDays,
    verdictStatus: params.gig.verdictStatus,
    verdictSummary: params.gig.verdictSummary,
    discrepancies: params.gig.discrepancies,
    scopeItems: params.gig.scopeItems,
    pricingVerdict: params.gig.pricingVerdict,
  };

  let accumulated = '';
  return consumeSseStream<AdvisorChatResponse>(
    '/api/advisor-chat/stream',
    {
      gigContext: compactGig,
      chatHistory: params.chatHistory,
      userMessage: params.userMessage,
      attachments:
        params.attachments && params.attachments.length > 0
          ? toApiAttachments(params.attachments)
          : undefined,
      mode: params.mode,
      model: params.model,
    },
    (delta) => {
      accumulated += delta;
      params.onChunk(accumulated);
    },
    (eventName, payload) => {
      if (eventName === 'recommended_docs' && params.onRecommendedDocs) {
        const docs = (payload as { documents?: RecommendedDocItem[] }).documents;
        if (Array.isArray(docs) && docs.length > 0) {
          params.onRecommendedDocs(docs);
        }
      }
    }
  );
}

export async function streamServiceAgreement(params: {
  documentType: DocumentTypeId;
  gig: GigAudit;
  includedItems: ScopeItem[];
  excludedItems: ScopeItem[];
  agreedTotalNgn: number;
  customNotes?: string;
  developerName?: string;
  paymentSplit?: string;
  deliveryDays?: number;
  model: FlashModelId;
  onChunk: (partialMarkdown: string) => void;
}): Promise<DraftAgreementResponse> {
  const compactGig = {
    title: params.gig.title,
    clientName: params.gig.clientName,
    projectType: params.gig.projectType,
    clientStatedBudgetNgn: params.gig.clientStatedBudgetNgn,
    recommendedDays: params.gig.recommendedDays,
    discrepancies: params.gig.discrepancies,
  };

  let accumulated = '';
  return consumeSseStream<DraftAgreementResponse>(
    '/api/draft-agreement/stream',
    {
      documentType: params.documentType,
      gigContext: compactGig,
      includedItems: params.includedItems,
      excludedItems: params.excludedItems,
      agreedTotalNgn: params.agreedTotalNgn,
      customNotes: params.customNotes,
      developerName: params.developerName,
      paymentSplit: params.paymentSplit,
      deliveryDays: params.deliveryDays,
      model: params.model,
    },
    (delta) => {
      accumulated += delta;
      const cleanPreview = accumulated.split('---WHATSAPP_SUMMARY---')[0];
      params.onChunk(cleanPreview);
    }
  );
}
