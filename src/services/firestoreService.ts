import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AdvisorMessage,
  AgreementDraft,
  AgreementStatus,
  GigAudit,
} from '../types/scope';

function clampString(val: unknown, fallback: string, maxLen: number): string {
  const s = typeof val === 'string' && val.trim().length > 0 ? val.trim() : fallback;
  return s.slice(0, maxLen);
}

function clampNonNeg(val: unknown, fallback = 0): number {
  const n = typeof val === 'number' && Number.isFinite(val) ? val : Number(val);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, 10_000_000_000);
}

export function sanitizeGigPayload(gig: GigAudit, uid: string): Record<string, unknown> {
  const safeParsed = (Array.isArray(gig.parsedMessages) ? gig.parsedMessages : [])
    .slice(0, 120)
    .map((m, idx) => ({
      id: clampString(m.id, `msg_${idx}`, 64),
      sender: clampString(m.sender, 'Unknown', 80),
      role: m.role === 'developer' || m.role === 'system' ? m.role : 'client',
      timestamp: clampString(m.timestamp, 'WhatsApp', 40),
      text: clampString(m.text, '—', 2000),
    }));

  const safeDiscrepancies = (Array.isArray(gig.discrepancies) ? gig.discrepancies : [])
    .slice(0, 30)
    .map((d, idx) => ({
      id: clampString(d.id, `disc_${idx}`, 64),
      clientClaim: clampString(d.clientClaim, 'Unspecified claim', 400),
      hiddenReality: clampString(d.hiddenReality, 'Implicit technical requirement', 400),
      severity: d.severity === 'critical' || d.severity === 'high' ? d.severity : 'medium',
      impactNgn: clampNonNeg(d.impactNgn, 0),
      explanation: clampString(d.explanation, 'Requires architectural clarity.', 800),
    }));

  const safeScopeItems = (Array.isArray(gig.scopeItems) ? gig.scopeItems : [])
    .slice(0, 40)
    .map((s, idx) => ({
      id: clampString(s.id, `scope_${idx}`, 64),
      feature: clampString(s.feature, 'Feature Module', 160),
      classification:
        s.classification === 'missing_dependency' || s.classification === 'bloat'
          ? s.classification
          : 'core',
      makesSense: Boolean(s.makesSense),
      minNgn: clampNonNeg(s.minNgn, 0),
      maxNgn: clampNonNeg(s.maxNgn, 0),
      days: Math.max(1, Math.round(clampNonNeg(s.days, 1))),
      rationale: clampString(s.rationale, 'Standard engineering module.', 500),
    }));

  const makesSense = (gig.pricingVerdict?.makesSensePoints || [])
    .slice(0, 15)
    .map((p) => clampString(p, 'Reasonable core expectation', 300));

  const doesNotMakeSense = (gig.pricingVerdict?.doesNotMakeSensePoints || [])
    .slice(0, 15)
    .map((p) => clampString(p, 'Unbudgeted complexity', 300));

  return {
    id: gig.id,
    ownerId: uid,
    title: clampString(gig.title, 'WhatsApp Scope Audit', 140),
    clientName: clampString(gig.clientName, 'WhatsApp Client', 100),
    projectType: clampString(gig.projectType, 'Web / Mobile App', 80),
    clientStatedBudgetNgn: clampNonNeg(gig.clientStatedBudgetNgn, 0),
    recommendedMinNgn: clampNonNeg(gig.recommendedMinNgn, 0),
    recommendedMaxNgn: clampNonNeg(gig.recommendedMaxNgn, 0),
    timelineRequestedDays: clampNonNeg(gig.timelineRequestedDays, 0),
    recommendedDays: Math.max(1, Math.round(clampNonNeg(gig.recommendedDays, 7))),
    verdictStatus:
      gig.verdictStatus === 'fair' || gig.verdictStatus === 'bloated'
        ? gig.verdictStatus
        : 'underpriced',
    verdictSummary: clampString(gig.verdictSummary, 'Scope review completed.', 2000),
    rawTranscript: clampString(gig.rawTranscript, 'No transcript provided', 50000),
    parsedMessages: safeParsed,
    discrepancies: safeDiscrepancies,
    scopeItems: safeScopeItems,
    pricingVerdict: {
      negotiationHeadline: clampString(
        gig.pricingVerdict?.negotiationHeadline,
        'Align scope and NGN milestones before writing code.',
        400
      ),
      makesSensePoints: makesSense,
      doesNotMakeSensePoints: doesNotMakeSense,
    },
  };
}

export async function ensureUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    const displayName = clampString(user.displayName, 'Nigerian Developer', 120);
    const email = clampString(user.email, 'developer@scopenaira.app', 254);
    const photoURL = user.photoURL ? user.photoURL.slice(0, 500) : '';

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName,
        email,
        ...(photoURL ? { photoURL } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName,
        email,
        ...(photoURL ? { photoURL } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createGigAudit(uid: string, gig: GigAudit): Promise<void> {
  const path = `users/${uid}/gigs/${gig.id}`;
  const ref = doc(db, 'users', uid, 'gigs', gig.id);
  try {
    const payload = sanitizeGigPayload(gig, uid);
    await setDoc(ref, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateGigAudit(uid: string, gig: GigAudit): Promise<void> {
  const path = `users/${uid}/gigs/${gig.id}`;
  const ref = doc(db, 'users', uid, 'gigs', gig.id);
  try {
    const payload = sanitizeGigPayload(gig, uid);
    const { id: _id, ownerId: _ownerId, ...mutableFields } = payload;
    await updateDoc(ref, {
      ...mutableFields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteGigAudit(uid: string, gigId: string): Promise<void> {
  const path = `users/${uid}/gigs/${gigId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'gigs', gigId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToUserGigs(
  uid: string,
  onData: (gigs: GigAudit[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/gigs`;
  const q = query(
    collection(db, 'users', uid, 'gigs'),
    where('ownerId', '==', uid),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as GigAudit);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createAdvisorMessage(
  uid: string,
  gigId: string,
  message: AdvisorMessage
): Promise<void> {
  const path = `users/${uid}/gigs/${gigId}/messages/${message.id}`;
  const ref = doc(db, 'users', uid, 'gigs', gigId, 'messages', message.id);
  try {
    await setDoc(ref, {
      id: message.id,
      ownerId: uid,
      gigId,
      role: message.role,
      content: clampString(message.content, '—', 15000),
      discrepancyFlags: (message.discrepancyFlags || [])
        .slice(0, 10)
        .map((f) => clampString(f, 'Flag', 300)),
      ...(message.linkedAgreementId ? { linkedAgreementId: message.linkedAgreementId } : {}),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeToMessages(
  uid: string,
  gigId: string,
  onData: (messages: AdvisorMessage[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/gigs/${gigId}/messages`;
  const q = query(
    collection(db, 'users', uid, 'gigs', gigId, 'messages'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as AdvisorMessage);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createAgreementDraft(
  uid: string,
  gigId: string,
  agreement: AgreementDraft
): Promise<void> {
  const path = `users/${uid}/gigs/${gigId}/agreements/${agreement.id}`;
  const ref = doc(db, 'users', uid, 'gigs', gigId, 'agreements', agreement.id);
  try {
    await setDoc(ref, {
      id: agreement.id,
      ownerId: uid,
      gigId,
      title: clampString(agreement.title, 'Scope & Service Agreement', 180),
      totalFeeNgn: clampNonNeg(agreement.totalFeeNgn, 0),
      milestoneSummary: clampString(agreement.milestoneSummary, '40% / 40% / 20% NGN milestones', 1000),
      documentMarkdown: clampString(agreement.documentMarkdown, '# Service Agreement', 40000),
      whatsappReplySnippet: clampString(agreement.whatsappReplySnippet, 'Here is the formal agreement.', 4000),
      status: agreement.status === 'finalized' ? 'finalized' : 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateAgreementDraft(
  uid: string,
  gigId: string,
  agreementId: string,
  updates: {
    title: string;
    totalFeeNgn: number;
    milestoneSummary: string;
    documentMarkdown: string;
    whatsappReplySnippet: string;
    status?: AgreementStatus;
  }
): Promise<void> {
  const path = `users/${uid}/gigs/${gigId}/agreements/${agreementId}`;
  const ref = doc(db, 'users', uid, 'gigs', gigId, 'agreements', agreementId);
  try {
    await updateDoc(ref, {
      title: clampString(updates.title, 'Scope & Service Agreement', 180),
      totalFeeNgn: clampNonNeg(updates.totalFeeNgn, 0),
      milestoneSummary: clampString(updates.milestoneSummary, '40% / 40% / 20% NGN milestones', 1000),
      documentMarkdown: clampString(updates.documentMarkdown, '# Service Agreement', 40000),
      whatsappReplySnippet: clampString(updates.whatsappReplySnippet, 'Here is the formal agreement.', 4000),
      ...(updates.status === 'finalized' ? { status: 'finalized' } : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeToAgreements(
  uid: string,
  gigId: string,
  onData: (agreements: AgreementDraft[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/gigs/${gigId}/agreements`;
  const q = query(
    collection(db, 'users', uid, 'gigs', gigId, 'agreements'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as AgreementDraft);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}
