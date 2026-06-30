import { OfficerInboxItem } from '../services/officer-filing.service';

/** Designations that act as Presiding Officer in the officer workbench (e.g. DYSLR). */
export function isPresidingOfficerDesignation(
  designationName: string | null | undefined,
  designationId?: number | null
): boolean {
  if (designationId === 1) return true;
  const d = String(designationName || '').trim().toLowerCase();
  if (!d) return false;
  if (d.includes('presid') || d.includes('presiding') || d === 'po') return true;
  if (d.includes('dyslr')) return true;
  if (d.includes('sub divisional') && d.includes('land')) return true;
  return false;
}

export function normalizeAssigneeRole(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
}

export function isClerkProcessingStage(stage: string): boolean {
  const s = String(stage || '').toUpperCase();
  return s === 'CLERK_DRAFT_REVIEW' || s === 'PO_SENT_BACK_TO_CLERK' || s.includes('CLERK');
}

export function isPoProcessingStage(stage: string): boolean {
  const s = String(stage || '').toUpperCase();
  if (!s || isClerkProcessingStage(s)) return false;
  return s === 'PO_UNDER_REVIEW' || s.includes('PO_UNDER') || s.includes('PO_REVIEW') || s.includes('_PO_') || s.startsWith('PO_');
}

/** Pending filing application belongs on the PO approval desk (not yet a case). */
export function isPoDeskInboxItem(
  item: Pick<OfficerInboxItem, 'processingStage' | 'currentAssigneeRole'>,
  hasCase: boolean
): boolean {
  if (hasCase) return false;
  if (isClerkDeskInboxItem(item, false)) return false;
  const assignee = normalizeAssigneeRole(item.currentAssigneeRole);
  if (assignee === 'PRESIDING_OFFICER') return true;
  if (isPoProcessingStage(String(item.processingStage || ''))) return true;
  // Officer inbox rows without explicit metadata — show on PO approval, not clerk desk.
  const stage = String(item.processingStage || '').trim();
  if (!stage && !assignee) return true;
  const statusStage = stage.toUpperCase();
  if (statusStage === 'SUBMITTED' || statusStage === 'PENDING_APPROVAL') return true;
  return false;
}

/** Pending filing application belongs on the clerk scrutiny desk (not yet a case). */
export function isClerkDeskInboxItem(
  item: Pick<OfficerInboxItem, 'processingStage' | 'currentAssigneeRole'>,
  hasCase: boolean
): boolean {
  if (hasCase) return false;
  const assignee = normalizeAssigneeRole(item.currentAssigneeRole);
  if (assignee === 'CLERK') return true;
  return isClerkProcessingStage(String(item.processingStage || ''));
}

export function matchesOfficerDeskAssignee(
  item: Pick<OfficerInboxItem, 'processingStage' | 'currentAssigneeRole'>,
  assignee: 'CLERK' | 'PRESIDING_OFFICER'
): boolean {
  if (assignee === 'PRESIDING_OFFICER') {
    return isPoDeskInboxItem(item, false);
  }
  return isClerkDeskInboxItem(item, false);
}

export function normalizeOfficerInboxItem(raw: unknown): OfficerInboxItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const applicationId = Number(row['applicationId'] ?? row['id'] ?? 0);
  if (!Number.isFinite(applicationId) || applicationId < 1) return null;
  return {
    applicationId,
    applicationNo: row['applicationNo'] == null ? undefined : String(row['applicationNo']),
    caseId: row['caseId'] == null ? undefined : Number(row['caseId']),
    clientApplicationRef: String(row['clientApplicationRef'] ?? row['applicationNo'] ?? ''),
    caseCategoryId: Number(row['caseCategoryId'] ?? 0),
    caseCategoryName: String(row['caseCategoryName'] ?? ''),
    subjectId: Number(row['subjectId'] ?? 0),
    subjectName: String(row['subjectName'] ?? ''),
    officeId: Number(row['officeId'] ?? 0),
    officeName: String(row['officeName'] ?? ''),
    status: String(row['status'] ?? 'SUBMITTED'),
    applicationDescription:
      row['applicationDescription'] == null ? null : String(row['applicationDescription']),
    filedByName: String(row['filedByName'] ?? ''),
    filedByRole: String(row['filedByRole'] ?? ''),
    submittedAt: String(row['submittedAt'] ?? row['createdAt'] ?? ''),
    createdAt: String(row['createdAt'] ?? row['submittedAt'] ?? ''),
    processingStage: row['processingStage'] == null ? undefined : String(row['processingStage']),
    currentAssigneeRole:
      row['currentAssigneeRole'] == null ? undefined : String(row['currentAssigneeRole'])
  };
}

export function normalizeOfficerInboxResponse(raw: unknown): OfficerInboxItem[] {
  if (Array.isArray(raw)) {
    return raw.map(normalizeOfficerInboxItem).filter((row): row is OfficerInboxItem => row !== null);
  }
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    for (const key of ['items', 'content', 'data', 'applications', 'pendingApplications', 'rows']) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value.map(normalizeOfficerInboxItem).filter((row): row is OfficerInboxItem => row !== null);
      }
    }
  }
  return [];
}
