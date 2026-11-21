import 'dotenv/config';
import express, { type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { FunctionDeclaration, GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { DOCUMENT_CATALOG, getDocumentEntry } from './src/data/documentCatalog.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const ALLOWED_MODELS = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
const DOCUMENT_IDS = DOCUMENT_CATALOG.map((d) => d.id);

export type SupportedFlashModel = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

function resolveModel(requested?: string): SupportedFlashModel {
  if (requested && ALLOWED_MODELS.has(requested)) {
    return requested as SupportedFlashModel;
  }
  return 'gemini-3.1-flash-lite';
}

function getThinkingLevel(model: SupportedFlashModel): ThinkingLevel {
  return model === 'gemini-3.1-flash-lite' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getErrorStatus(err: unknown): { status: number; message: string; isQuotaExceeded: boolean } {
  if (err && typeof err === 'object') {
    const anyErr = err as { status?: number; message?: string };
    let status = typeof anyErr.status === 'number' && anyErr.status >= 400 ? anyErr.status : 500;
    let message = anyErr.message || 'Upstream AI request failed.';

    const jsonStart = message.indexOf('{');
    if (jsonStart !== -1) {
      try {
        const parsed = JSON.parse(message.slice(jsonStart));
        if (parsed?.error?.message) {
          message = parsed.error.message;
        }
        if (typeof parsed?.error?.code === 'number') {
          status = parsed.error.code;
        }
      } catch {
        // Keep original message
      }
    }

    const isQuotaExceeded = status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message);
    if (status === 400 || status === 403) {
      message = `${message} Check your GEMINI_API_KEY in Settings > Secrets.`;
    }
    return { status, message, isQuotaExceeded };
  }
  return { status: 500, message: 'Unexpected server error.', isQuotaExceeded: false };
}

async function generateWithRetry<T>(
  model: SupportedFlashModel,
  fn: (activeModel: SupportedFlashModel) => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let currentModel = model;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(currentModel);
    } catch (err) {
      lastError = err;
      const { status, isQuotaExceeded } = getErrorStatus(err);

      if (isQuotaExceeded && currentModel === 'gemini-4-hydrogen') {
        currentModel = 'gemini-3.1-flash-lite';
        continue;
      }

      const isTransient = status === 503 || status === 500 || (status === 429 && !isQuotaExceeded);
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 900));
    }
  }
  throw lastError;
}

function initSse(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

function writeSseEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function extractDiscrepancyFlags(text: string): string[] {
  const flags: string[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      (trimmed.startsWith('- ') || trimmed.startsWith('* ')) &&
      /discrepanc|missing|omitted|bloat|underpriced|tracking|paystack|flutterwave|escrow|change order|ndpa|₦/i.test(
        trimmed
      )
    ) {
      flags.push(trimmed.replace(/^[-*]\s+/, '').slice(0, 260));
    }
    if (flags.length >= 5) break;
  }
  return flags;
}

const recommendDocumentsDeclaration: FunctionDeclaration = {
  name: 'recommend_needed_documents',
  description:
    'Recommends ONLY the 1 to 3 specific legal, governance, or payment/execution documents needed right now based on the developer situation and conversation context. Never select all documents at once.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      documents: {
        type: Type.ARRAY,
        description: '1 to 3 contextually needed documents in priority order.',
        items: {
          type: Type.OBJECT,
          properties: {
            docType: {
              type: Type.STRING,
              enum: DOCUMENT_IDS,
              description: 'Exact document ID from the 20-document catalog.',
            },
            reason: {
              type: Type.STRING,
              description: 'Why this specific document is needed for this exact situation.',
            },
            urgency: {
              type: Type.STRING,
              enum: ['immediate', 'next_step', 'optional'],
            },
          },
          required: ['docType', 'reason', 'urgency'],
        },
      },
    },
    required: ['documents'],
  },
};

const ELITE_ADVISOR_PLAYBOOK = `You are ScopeNaira Principal Counsel & Tech Lead — an elite advisor for Nigerian freelance software engineers and boutique studios.

CORE EXPERTISE & REAL-WORLD SCENARIOS YOU ADVISE ON:
1. Underpriced "Clone" Traps: When clients ask for a "simple Jumia/Konga/Uber/Chowdeck/Opay app" for ₦100k–₦250k in 1–2 weeks, break down the 4 hidden systems (Buyer App, Vendor Portal, Dispatch/Rider App, Admin/Settlement Console) and prove why a single-vendor MVP starts around ₦450k–₦850k while full multi-vendor + live tracking is ₦1.8M–₦4.5M+.
2. Omitted Technical Dependencies: Catch unbudgeted essentials like Paystack/Flutterwave webhook idempotency & split settlements, real-time GPS/WebSocket order tracking, Termii SMS/OTP costs, BVN/NIN KYC API fees, Play Store ($25) / Apple Developer ($99/yr) fees, and cloud hosting/Firebase/AWS monthly bills (client-paid!).
3. Payment & Cashflow Protection: Push back firmly against "pay on completion", "pay when investors fund", or equity-only traps. Enforce non-refundable 40%–50% kickoff deposit, private/watermarked staging demos for UAT, and IP transfer strictly conditioned on 100% cleared funds.
4. Mid-Sprint Scope Creep: When a client drops "just add a wallet/referral/AI chatbot" in WhatsApp, instruct the developer to freeze unpriced work and immediately issue a Change Order with exact NGN cost and timeline extension.
5. NDPA Data Privacy & Card Security: Warn developers NEVER to store raw debit card details or unencrypted BVN/NIN; route payments strictly through Paystack/Flutterwave hosted checkout/tokenization and use a Data Processing Agreement (DPA) under the Nigeria Data Protection Act (NDPA).
6. Warranty vs. Lifetime Free Support Trap: Distinguish a 14–30 day bug-fix warranty (covers regressions in delivered MVP only) from post-launch OS updates, server monitoring, and uptime guarantees—which require a separate monthly Service Level Agreement (SLA) retainer (e.g. ₦75k–₦250k/month).
7. Corporate / Enterprise Procurement Sequence: For structured Nigerian companies, explain the clean paper trail: Project Proposal -> Quotation / Estimate -> Purchase Order (PO) -> MSA / ICA + SOW -> Milestone Invoice -> Work Acceptance Certificate -> Project Completion Certificate + IPAA.
8. Client Ghosting / Delayed UAT: Advise adding a 7-business-day feedback timeout clause where silent delays shift launch dates and do not freeze completed milestone payments.

DOCUMENT TOOL PROTOCOL (CRITICAL):
- You have access to the tool \`recommend_needed_documents\`.
- NEVER tell the user to generate all 20 documents in one fell swoop.
- Whenever the developer asks what to do, faces a client trap, or needs paperwork, call \`recommend_needed_documents\` with ONLY the 1 to 3 documents strictly relevant to their immediate situation (e.g., pre-build quote -> \`quotation_estimate\` + \`statement_of_work\`; mid-sprint new feature -> \`change_order\`; payment pushback -> \`payment_agreement\` + \`invoice\`; PII/KYC handling -> \`data_processing_agreement\`; handover -> \`work_acceptance_certificate\` + \`ip_assignment_agreement\`).
- Output clean, readable human prose with bullet points and Nigerian Naira (₦) figures—NEVER output raw JSON in your reply text.`;

const DOCUMENT_SPECIFIC_GUIDANCE: Record<string, string> = {
  freelance_service_agreement:
    'Cover scope reference, independent relationship, NGN fee & non-refundable deposit, IP conditional on full payment, 14-day warranty, termination kill-fee, and Nigerian governing law.',
  independent_contractor_agreement:
    'Emphasize non-employee independent contractor status, tax/statutory self-responsibility, right to work for other clients (non-exclusive), tools/equipment, and NGN invoicing terms.',
  statement_of_work:
    'Include itemized MVP Deliverables table, Explicit Exclusions / Out-of-Scope Bloat list (e.g. live GPS tracking or multi-vendor if excluded), Acceptance Criteria, Client Responsibilities (Paystack keys/hosting), and Milestone Schedule in ₦.',
  service_level_agreement:
    'Include a clean Severity & Response Time Matrix table (P1 Critical Outage, P2 Major Feature, P3 Minor Bug, P4 Enhancement), Uptime Target (e.g. 99.5% excluding third-party AWS/Paystack/telco outages), Monthly Retainer Fee in ₦, and Support Hours.',
  non_disclosure_agreement:
    'Define Confidential Information (source code, API keys, customer lists, business model), Permitted Purpose, Mutual Non-Disclosure obligations, Exclusions (public/prior knowledge), Term (2–3 years), and Nigerian jurisdiction.',
  master_service_agreement:
    'Establish umbrella legal terms governing multiple future SOWs: order of precedence, invoicing & late fee terms in ₦, IP framework, confidentiality, limitation of liability capped at fees paid, and termination.',
  memorandum_of_understanding:
    'Record pre-contract intent, discovery objectives, non-binding nature (except confidentiality), target discovery timeline, and next steps toward a binding SOW/FSA.',
  memorandum_of_agreement:
    'Document binding bilateral commitments in a clean Responsibilities Matrix table (Developer deliverables vs Client obligations such as CAC/Paystack KYC, content, and milestone funding in ₦).',
  data_processing_agreement:
    'Align with the Nigeria Data Protection Act (NDPA): define Data Controller (Client) vs Data Processor (Developer), lawful processing instructions, prohibition on storing raw card PAN/CVV (Paystack/Flutterwave tokenization only), encryption, breach notification window (48–72 hours), and data deletion on termination.',
  ip_assignment_agreement:
    'Explicitly condition Assignment of Custom Project IP upon 100% receipt of cleared NGN fees. Carve out Developer Background IP (reusable UI kits, auth/utility libraries) licensed non-exclusively to Client.',
  work_for_hire_agreement:
    'Define bespoke deliverables created as work-for-hire upon full NGN payment under Nigerian Copyright Act principles, with clear carve-outs for open-source dependencies and pre-existing developer frameworks.',
  non_compete_agreement:
    'Keep restraint narrowly tailored by geography, duration (e.g. 6–12 months), and exact direct competitor product scope so it remains reasonable, and link any exclusivity to a dedicated NGN exclusivity premium.',
  project_proposal:
    'Structure persuasively for a Nigerian founder/client: Problem & Context, Recommended Phased Architecture (Phase 1 MVP vs Phase 2 Expansion), Timeline table, Investment Options in ₦, and Why Phasing Protects Budget.',
  quotation_estimate:
    'Render a clean itemized NGN Quotation Table (Module, Description, Estimated Days, Min–Max or Fixed Fee ₦), Subtotal, Excluded Items Note, Quote Validity (14 days), and Assumptions.',
  purchase_order:
    'Format as a formal corporate Purchase Order (PO Number, Vendor/Developer Details, Bill-To Client Details, Line Items Table with Quantity, Unit Price ₦, Total ₦, Delivery Date, and Procurement Authorization Block).',
  invoice:
    'Format as a crisp Nigerian Tax/Service Invoice (Invoice No, Issue Date, Due Date, Milestone Description, Itemized Fee Table in ₦, Total Due ₦, Bank Transfer / Paystack Payment Instructions placeholder, and Late Payment Terms).',
  payment_agreement:
    'Include exact Tranche Schedule Table (Deposit %, Staging %, Handover %, Trigger Condition, Due Amount ₦), Non-Refundable Kickoff Deposit Clause, 7-Day UAT Silence-Equals-Deemed-Acceptance trigger, and Work-Pause right on overdue milestones.',
  change_order:
    'Include Change Request Reference, Original Baseline Scope, Newly Requested WhatsApp Feature(s), Technical Impact Analysis, Additional NGN Cost Table, Timeline Extension (+Days), and Client Approval Sign-off before work begins.',
  work_acceptance_certificate:
    'Include Milestone/Deliverable Inspection Checklist Table (Deliverable, Status, UAT Notes), Formal Client Sign-off declaring deliverables meet SOW acceptance criteria, and Milestone Invoice Release trigger in ₦.',
  project_completion_certificate:
    'Include Project Summary, Delivered Production URLs/Repositories, Final Handover Checklist (code repo, admin credentials, docs), Final Payment Settlement Confirmation in ₦, Warranty Start/End Dates, and Optional SLA Transition note.',
};

interface MediaAttachmentPayload {
  name: string;
  mimeType: string;
  base64Data?: string;
  textContent?: string;
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

function buildMultimodalParts(
  promptText: string,
  attachments?: MediaAttachmentPayload[]
): GeminiPart[] {
  const parts: GeminiPart[] = [{ text: promptText }];
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return parts;
  }

  for (const att of attachments.slice(0, 4)) {
    const safeName = (att.name || 'attachment').slice(0, 120);
    if (att.textContent && typeof att.textContent === 'string') {
      parts.push({
        text: `\n\n--- Attached Text File (${safeName}) ---\n${att.textContent.slice(0, 40000)}`,
      });
      continue;
    }

    if (
      att.base64Data &&
      typeof att.base64Data === 'string' &&
      typeof att.mimeType === 'string' &&
      (/^(image|audio)\//.test(att.mimeType) || att.mimeType === 'application/pdf')
    ) {
      parts.push({
        text: `\n[Attached Media: ${safeName} (${att.mimeType})]`,
      });
      parts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.base64Data,
        },
      });
    }
  }

  return parts;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, keyConfigured: Boolean(process.env.GEMINI_API_KEY) });
  });

  app.post('/api/audit-whatsapp', async (req, res) => {
    try {
      const { rawTranscript, attachments, clientNameHint, model: requestedModel } = req.body as {
        rawTranscript?: string;
        attachments?: MediaAttachmentPayload[];
        clientNameHint?: string;
        model?: string;
      };

      const cleanText = typeof rawTranscript === 'string' ? rawTranscript.trim() : '';
      const validAttachments = Array.isArray(attachments) ? attachments : [];

      if (cleanText.length < 10 && validAttachments.length === 0) {
        res.status(400).json({
          error:
            'Please paste WhatsApp chat text or attach an image/screenshot, PDF, audio voice note, or .txt export.',
        });
        return;
      }

      const model = resolveModel(requestedModel);
      const trimmedTranscript = cleanText.slice(0, 48000);
      const ai = getAiClient();

      const systemInstruction = `You are a senior Nigerian software engineering tech lead and freelance project estimator.
Analyze the WhatsApp gig conversation between a client and a Nigerian developer.
Your job is to:
1. Extract the conversation turns cleanly.
2. Uncover hidden discrepancies — specifically what the client casually calls the project (e.g. "simple Jumia app", "small website") versus what is omitted, implied, or explicitly required in the context (such as real-time order tracking, GPS/dispatch updates, secure payment gateway integration with Paystack/Flutterwave + webhook verification, split settlements, multi-vendor dashboards, wallet/escrow, or admin KYC).
3. Classify every feature or implied system requirement as:
   - "core": essential MVP feature
   - "missing_dependency": critical technical capability left out of the client's framing or omitted in their mental model (e.g. real-time tracking, secure payment gateway integration, webhook reconciliation, auth/roles)
   - "bloat": scope creep or unnecessary complexity for a first release
4. Price everything strictly in Nigerian Naira (NGN) using realistic current Nigerian freelance & boutique agency benchmarks (for example: MVP e-commerce storefront ₦350k–₦650k; Paystack/Flutterwave + webhook + escrow/split verification ₦150k–₦300k; real-time order tracking & dispatch WebSockets/map updates ₦350k–₦700k; multi-vendor portal ₦400k–₦850k; mobile apps iOS/Android ₦900k–₦2.5M).
5. Explicitly tell the developer what makes sense financially/technically and what does NOT make sense in the client's offer (budget vs scope, timeline vs complexity).
Keep all strings concise and crisp. Never invent USD amounts—use Nigerian Naira (₦) only.`;

      const auditPrompt = `Client name hint: ${clientNameHint || 'Unknown Client'}

WhatsApp Transcript / Notes:
${trimmedTranscript || '(See attached screenshots, PDFs, voice notes, or chat export files below. Transcribe/read all text and requirements from the attached media into parsedMessages and extractedTranscript.)'}`;

      const auditParts = buildMultimodalParts(auditPrompt, validAttachments);

      const response = await generateWithRetry(model, (activeModel) =>
        ai.models.generateContent({
          model: activeModel,
          contents: { parts: auditParts },
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: getThinkingLevel(activeModel) },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Short 3-7 word gig title.' },
                clientName: { type: Type.STRING, description: 'Detected client name or label.' },
                projectType: { type: Type.STRING, description: 'e.g. Multi-Vendor Marketplace, E-Commerce MVP, Logistics App.' },
                clientStatedBudgetNgn: { type: Type.NUMBER, description: 'Client stated budget in NGN (0 if not mentioned).' },
                recommendedMinNgn: { type: Type.NUMBER, description: 'Realistic minimum fair NGN quote for full requested + implied scope.' },
                recommendedMaxNgn: { type: Type.NUMBER, description: 'Realistic upper NGN quote for full requested + implied scope.' },
                timelineRequestedDays: { type: Type.NUMBER, description: 'Days requested by client (0 if unstated).' },
                recommendedDays: { type: Type.NUMBER, description: 'Realistic engineering delivery days (minimum 1).' },
                verdictStatus: { type: Type.STRING, enum: ['underpriced', 'fair', 'bloated'] },
                verdictSummary: { type: Type.STRING, description: '2-3 sentence executive audit summary for the developer.' },
                parsedMessages: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      sender: { type: Type.STRING },
                      role: { type: Type.STRING, enum: ['client', 'developer', 'system'] },
                      timestamp: { type: Type.STRING },
                      text: { type: Type.STRING },
                    },
                    required: ['id', 'sender', 'role', 'timestamp', 'text'],
                  },
                },
                discrepancies: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      clientClaim: { type: Type.STRING },
                      hiddenReality: { type: Type.STRING },
                      severity: { type: Type.STRING, enum: ['critical', 'high', 'medium'] },
                      impactNgn: { type: Type.NUMBER },
                      explanation: { type: Type.STRING },
                    },
                    required: ['id', 'clientClaim', 'hiddenReality', 'severity', 'impactNgn', 'explanation'],
                  },
                },
                scopeItems: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      feature: { type: Type.STRING },
                      classification: { type: Type.STRING, enum: ['core', 'missing_dependency', 'bloat'] },
                      makesSense: { type: Type.BOOLEAN },
                      minNgn: { type: Type.NUMBER },
                      maxNgn: { type: Type.NUMBER },
                      days: { type: Type.NUMBER },
                      rationale: { type: Type.STRING },
                    },
                    required: ['id', 'feature', 'classification', 'makesSense', 'minNgn', 'maxNgn', 'days', 'rationale'],
                  },
                },
                pricingVerdict: {
                  type: Type.OBJECT,
                  properties: {
                    negotiationHeadline: { type: Type.STRING },
                    makesSensePoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                    doesNotMakeSensePoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['negotiationHeadline', 'makesSensePoints', 'doesNotMakeSensePoints'],
                },
                extractedTranscript: {
                  type: Type.STRING,
                  description: 'Clean readable text transcript extracted from any uploaded screenshot, PDF, voice note, or text export.',
                },
              },
              required: [
                'title',
                'clientName',
                'projectType',
                'clientStatedBudgetNgn',
                'recommendedMinNgn',
                'recommendedMaxNgn',
                'timelineRequestedDays',
                'recommendedDays',
                'verdictStatus',
                'verdictSummary',
                'parsedMessages',
                'discrepancies',
                'scopeItems',
                'pricingVerdict',
              ],
            },
          },
        })
      );

      const parsed = JSON.parse(response.text || '{}');
      res.json(parsed);
    } catch (err) {
      const { status, message } = getErrorStatus(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/advisor-chat/stream', async (req, res) => {
    initSse(res);
    try {
      const { gigContext, chatHistory, userMessage, attachments, mode, model: requestedModel } =
        req.body as {
          gigContext?: Record<string, unknown>;
          chatHistory?: { role: string; content: string }[];
          userMessage?: string;
          attachments?: MediaAttachmentPayload[];
          mode?: 'advisor_question' | 'client_input';
          model?: string;
        };

      const cleanMessage = typeof userMessage === 'string' ? userMessage.trim() : '';
      const validAttachments = Array.isArray(attachments) ? attachments : [];

      if (!cleanMessage && validAttachments.length === 0) {
        writeSseEvent(res, 'error', {
          status: 400,
          error: 'Please enter a message or attach an image, PDF, audio, or text file.',
        });
        res.end();
        return;
      }

      const model = resolveModel(requestedModel);
      const ai = getAiClient();
      const historyLines = (chatHistory || [])
        .slice(-10)
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');

      const prompt = `Mode: ${mode || 'advisor_question'}
${
  mode === 'client_input'
    ? 'The developer just shared a NEW WhatsApp message, screenshot, voice note, or brief from the client. Inspect any attached images/PDFs/audio carefully, identify hidden discrepancies, omitted technical dependencies, scope bloat, NGN cost delta, suggest a short WhatsApp counter-reply, and call recommend_needed_documents for the 1-3 documents needed right now.'
    : 'Advise the developer on their question and any attached screenshots/UI mockups/PDFs/voice notes with elite Nigerian engineering & contract guidance, NGN pricing benchmarks, and call recommend_needed_documents ONLY if documents are relevant to this exact step (1-3 max).'
}

Audited Gig Context:
${JSON.stringify(gigContext || {}, null, 2).slice(0, 12000)}

Recent Chat History:
${historyLines}

New Input:
${cleanMessage.slice(0, 6000) || '(Analyze the attached image, PDF, audio, or text file(s) below.)'}`;

      const userParts = buildMultimodalParts(prompt, validAttachments);
      const tools = [{ functionDeclarations: [recommendDocumentsDeclaration] }];
      let fullText = '';
      let recommendedDocs: Array<{ docType: string; reason: string; urgency: string }> = [];
      let capturedFunctionCall: { id?: string; name?: string; args?: unknown } | null = null;
      let capturedModelParts: unknown[] = [];

      const stream1 = await generateWithRetry(model, (activeModel) =>
        ai.models.generateContentStream({
          model: activeModel,
          contents: [{ role: 'user', parts: userParts }],
          config: {
            systemInstruction: ELITE_ADVISOR_PLAYBOOK,
            thinkingConfig: { thinkingLevel: getThinkingLevel(activeModel) },
            tools,
          },
        })
      );

      for await (const chunk of stream1) {
        const piece = chunk.text;
        if (piece) {
          fullText += piece;
          writeSseEvent(res, 'chunk', { text: piece });
        }
        const calls = chunk.functionCalls;
        if (calls && calls.length > 0) {
          for (const call of calls) {
            if (call.name === 'recommend_needed_documents') {
              capturedFunctionCall = call;
              const args = call.args as {
                documents?: Array<{ docType: string; reason: string; urgency: string }>;
              };
              if (Array.isArray(args?.documents)) {
                recommendedDocs = args.documents.slice(0, 3);
              }
            }
          }
        }
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (parts && parts.length > 0) {
          capturedModelParts.push(...parts);
        }
      }

      if (recommendedDocs.length > 0) {
        writeSseEvent(res, 'recommended_docs', { documents: recommendedDocs });
      }

      // If model emitted a tool call without prose text yet, run Turn 2 functionResponse stream
      if (capturedFunctionCall && fullText.trim().length < 25) {
        const stream2 = await generateWithRetry(model, (activeModel) =>
          ai.models.generateContentStream({
            model: activeModel,
            contents: [
              { role: 'user', parts: userParts },
              { role: 'model', parts: capturedModelParts as never[] },
              {
                role: 'user',
                parts: [
                  {
                    functionResponse: {
                      id: capturedFunctionCall?.id,
                      name: 'recommend_needed_documents',
                      response: {
                        surfacedInUi: true,
                        recommendedCount: recommendedDocs.length,
                      },
                    },
                  },
                ],
              },
            ],
            config: {
              systemInstruction: ELITE_ADVISOR_PLAYBOOK,
              thinkingConfig: { thinkingLevel: getThinkingLevel(activeModel) },
              tools,
            },
          })
        );

        for await (const chunk of stream2) {
          const piece = chunk.text;
          if (piece) {
            fullText += piece;
            writeSseEvent(res, 'chunk', { text: piece });
          }
        }
      }

      const discrepancyFlags = extractDiscrepancyFlags(fullText);
      writeSseEvent(res, 'done', {
        reply: fullText.trim() || 'Review the recommended documents below to protect your scope and NGN fees.',
        discrepancyFlags,
        recommendedDocs,
        model,
      });
      res.end();
    } catch (err) {
      const { status, message } = getErrorStatus(err);
      writeSseEvent(res, 'error', { status, error: message });
      res.end();
    }
  });

  app.post('/api/draft-agreement/stream', async (req, res) => {
    initSse(res);
    try {
      const {
        documentType,
        gigContext,
        includedItems,
        excludedItems,
        agreedTotalNgn,
        customNotes,
        developerName,
        paymentSplit,
        deliveryDays,
        model: requestedModel,
      } = req.body as {
        documentType?: string;
        gigContext?: Record<string, unknown>;
        includedItems?: Array<Record<string, unknown>>;
        excludedItems?: Array<Record<string, unknown>>;
        agreedTotalNgn?: number;
        customNotes?: string;
        developerName?: string;
        paymentSplit?: string;
        deliveryDays?: number;
        model?: string;
      };

      if (!gigContext) {
        writeSseEvent(res, 'error', { status: 400, error: 'Gig context is required to draft a document.' });
        res.end();
        return;
      }

      const docEntry = getDocumentEntry(documentType || 'statement_of_work');
      const specificRules =
        DOCUMENT_SPECIFIC_GUIDANCE[docEntry.id] ||
        'Draft clean, binding Nigerian freelance commercial and legal sections.';
      const model = resolveModel(requestedModel);
      const ai = getAiClient();
      const splitLabel = paymentSplit || '40% Kickoff / 40% Staging / 20% Production Handover';
      const totalNgn = Math.max(0, Math.round(Number(agreedTotalNgn) || 0));
      const gigTitle = typeof gigContext.title === 'string' ? gigContext.title : 'Software Project';
      const clientName = typeof gigContext.clientName === 'string' ? gigContext.clientName : 'Client';
      const todayDate = new Date().toLocaleDateString('en-NG', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const systemInstruction = `You are a senior Nigerian tech legal & commercial document drafter.
Generate ONLY the single requested document: **${docEntry.name} (${docEntry.shortCode})**.
Purpose: ${docEntry.purpose}
Specific Structure Requirements: ${specificRules}

FORMATTING RULES (STRICT):
- Output clean, properly formatted Markdown suitable for executive rendering and PDF printing.
- NEVER output raw JSON, code fences (\`\`\`), or placeholder gibberish.
- Start with \`# ${docEntry.name}\` followed by a clean 2-column Metadata Pipe Table (Reference Code, Date: ${todayDate}, Project, Developer, Client, Governing Law: Federal Republic of Nigeria, Total Value: ₦${totalNgn.toLocaleString('en-NG')}).
- Include clean Markdown pipe tables (\`| Column | ... |\`) for line items, deliverables, milestones, or acceptance checklists wherever appropriate.
- Every single monetary amount MUST be in Nigerian Naira (₦).
- End with a formal Sign-off / Acceptance block for both ${developerName || 'Developer'} and ${clientName}.
- After the Sign-off block, output this exact separator on its own line:
---WHATSAPP_SUMMARY---
followed by a concise 3-4 sentence WhatsApp message the developer can send when sharing this ${docEntry.name}.`;

      const prompt = `Document Requested: ${docEntry.name} (${docEntry.shortCode})
Date: ${todayDate}
Developer / Studio Name: ${developerName || 'Independent Developer'}
Client Name: ${clientName}
Delivery Timeline: ${deliveryDays || 30} days
Payment Milestone Split: ${splitLabel}
Agreed Total Fee (NGN): ₦${totalNgn.toLocaleString('en-NG')}

Gig Context:
${JSON.stringify(gigContext, null, 2).slice(0, 10000)}

Confirmed / Included Scope Items:
${JSON.stringify(includedItems || [], null, 2).slice(0, 5000)}

Excluded / Out-of-Scope Bloat Items:
${JSON.stringify(excludedItems || [], null, 2).slice(0, 5000)}

Custom Clauses / Notes: ${customNotes || 'Standard Nigerian commercial & freelance terms.'}`;

      const stream = await generateWithRetry(model, (activeModel) =>
        ai.models.generateContentStream({
          model: activeModel,
          contents: prompt,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: getThinkingLevel(activeModel) },
          },
        })
      );

      let fullText = '';
      for await (const chunk of stream) {
        const piece = chunk.text;
        if (piece) {
          fullText += piece;
          writeSseEvent(res, 'chunk', { text: piece });
        }
      }

      const [rawDoc, rawSnippet] = fullText.split('---WHATSAPP_SUMMARY---');
      const documentMarkdown = (rawDoc || fullText).trim();
      const whatsappReplySnippet = (
        rawSnippet ||
        `Hi ${clientName}, I have prepared the ${docEntry.name} for ${gigTitle} (₦${totalNgn.toLocaleString('en-NG')}). Please review and confirm so we can proceed.`
      ).trim();

      writeSseEvent(res, 'done', {
        title: `${docEntry.name} — ${gigTitle}`,
        documentType: docEntry.id,
        totalFeeNgn: totalNgn,
        milestoneSummary: `${docEntry.shortCode} · ${splitLabel}`,
        documentMarkdown,
        whatsappReplySnippet,
        model,
      });
      res.end();
    } catch (err) {
      const { status, message } = getErrorStatus(err);
      writeSseEvent(res, 'error', { status, error: message });
      res.end();
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ScopeNaira server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
