import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { OfficerInboxItem } from './officer-filing.service';

// ─── Approve / Assignment ───────────────────────────────────────────────────

export interface OfficerApproveResponse {
  applicationId: number;
  applicationNo: string;
  caseId: number;
  caseNo: string;
  message: string;
}

export interface OfficerAssignmentActionResponse {
  applicationId: number;
  processingStage: string;
  currentAssigneeRole: 'CLERK' | 'PRESIDING_OFFICER' | string;
  message: string;
}

// ─── Case inbox ─────────────────────────────────────────────────────────────

export interface OfficerDashboardResponse {
  pendingApplications: OfficerInboxItem[];
  activeCases: OfficerCaseInboxItem[];
  todayHearings: CaseHearingResponse[];
}

// OfficerCaseInboxItem defined below — forward ref satisfied at runtime

export interface OfficerCaseInboxItem {
  caseId: number;
  caseNo: string;
  /** ACTIVE | HEARING_SCHEDULED | DISPOSED */
  status: string;
  /**
   * Finer-grained stage within HEARING_SCHEDULED, returned by backend.
   * NOTICE_PENDING | NOTICE_IN_PROGRESS | ORDER_SHEET_PENDING | ORDER_SHEET_IN_PROGRESS | JUDGMENT_PENDING | JUDGMENT_IN_PROGRESS
   * If absent, all HEARING_SCHEDULED cases fall under PENDING_NOTICE as default.
   */
  proceedingStage?: string | null;
  filingApplicationId: number;
  caseCategoryId: number;
  caseCategoryName: string;
  officeId: number;
  officeName: string;
  approvedAt: string;
  disposedAt: string | null;
}

// ─── Hearing ─────────────────────────────────────────────────────────────────

export interface CaseHearingResponse {
  hearingId: number;
  caseId: number;
  caseNo: string;
  hearingNo: number;
  hearingDate: string;
  /** SCHEDULED | COMPLETED (API may also send hearingStatus) */
  status: string;
  hearingStatus?: string;
  noticeServed?: boolean;
  noticeGenerated: boolean;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Notice ──────────────────────────────────────────────────────────────────

export interface CaseNoticeItem {
  noticeId: number;
  caseId: number;
  caseNo?: string;
  hearingId: number | null;
  noticeType: string;
  /** CLERK_DRAFT | PO_SCRUTINY | PO_FINALIZED | PO_SIGNED | SERVED */
  status: string;
  draftContent: string | null;
  previewContent?: string | null;
  finalContent?: string | null;
  revertReason?: string | null;
  message?: string;
  selectedParties: string[];
  digitalSignatureRef: string | null;
  servedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoticeDraftRequest {
  hearingId: number | null;
  noticeType: string;
  draftContent: string;
  selectedParties: string[];
}

export interface NoticeSignRequest {
  digitalSignatureRef: string;
}

export interface NoticeServeRequest {
  hearingId: number;
  draftContent: string;
  selectedParties: string[];
  noticeType?: string;
  finalContent?: string;
  digitalSignatureRef?: string;
}

/** GET /api/cases/officer/notices/pending-serve — full notice backlog (no date filter). */
export interface PendingServeNoticeRow {
  rowNo?: number;
  queueDate: string;
  caseId: number;
  caseNo: string;
  filingApplicationId: number;
  caseCategoryName?: string;
  hearingId: number;
  hearingNo: number;
  hearingDate: string;
  noticeId?: number | null;
  noticeType?: string | null;
  noticeStatus?: string | null;
}

export interface PendingServeNoticeResponse {
  totalRows: number;
  rows: PendingServeNoticeRow[];
}

// ─── Roznama (order sheet) ───────────────────────────────────────────────────

export type RoznamaAttendancePartyType = 'APPLICANT' | 'RESPONDENT' | 'OTHER';

export interface RoznamaAttendanceEntry {
  attendanceId: number | null;
  partyType: RoznamaAttendancePartyType;
  partyRefId: number | null;
  otherPartyKey: string | null;
  partyName: string;
  lineNo: number;
  present: boolean | null;
  mandatory: boolean;
  updatedAt: string | null;
}

export interface RoznamaAttendanceSaveEntry {
  partyType: RoznamaAttendancePartyType;
  partyRefId: number;
  present: boolean;
  partyName?: string;
  otherPartyKey?: string;
}

export interface RoznamaAttendanceResponse {
  caseId: number;
  hearingId: number;
  attendanceRequired: boolean;
  attendanceComplete: boolean;
  entries: RoznamaAttendanceEntry[];
}

export interface RoznamaTableRow {
  lineNo: number;
  hearingId: number;
  hearingNo: number;
  hearingDate: string;
  date: string;
  content: string;
  status: string;
  hearingOutcome: string | null;
  readOnly: boolean;
}

export interface RoznamaResponse {
  id: number | null;
  caseId: number;
  caseNo: string;
  hearingId: number | null;
  content: string;
  draftContent: string | null;
  finalContent: string | null;
  /** CLERK_DRAFT | PO_SCRUTINY | PO_FINALIZED | PO_SIGNED | PO_DRAFT */
  status: string | null;
  canEdit?: boolean;
  digitalSignatureRef: string | null;
  updatedAt: string | null;
  updatedByLoginId?: string | null;
  message?: string | null;
  hearingOutcome?: string | null;
  finalHearing?: boolean | null;
  nextHearingId?: number | null;
  nextHearingDate?: string | null;
  caseStatus?: string | null;
  attendanceRequired?: boolean;
  attendanceComplete?: boolean;
  attendance?: RoznamaAttendanceEntry[];
  /** Preferred source for UI table — includes prior signed rows + current editable row. */
  tableRows?: RoznamaTableRow[];
}

/** @deprecated use RoznamaResponse */
export type CaseOrderSheetResponse = RoznamaResponse & {
  currentHearingId?: number | null;
};

export interface RoznamaHistoryRow {
  historyId: number;
  hearingId: number | null;
  hearingNo: number | null;
  hearingDate: string | null;
  content: string;
  remarks: string | null;
  status?: string;
  createdAt: string;
  createdByLoginId: string;
}

/** @deprecated use RoznamaHistoryRow */
export type CaseOrderSheetHistoryResponse = RoznamaHistoryRow;

export interface OfficerRoznamaTableRow {
  rowNo: number;
  causeDate: string;
  caseId: number;
  caseNo: string;
  caseStatus: string;
  filingApplicationId: number;
  caseCategoryName: string;
  hearingId: number;
  hearingNo: number;
  hearingDate: string;
  hearingStatus: string;
  noticeServed?: boolean;
  proceedingAllowed?: boolean;
  roznamaId: number | null;
  roznamaStatus: string | null;
  proceedingStage: string;
  draftContent: string | null;
  finalContent: string | null;
  roznamaUpdatedAt: string | null;
  roznamaLinkedToHearing?: boolean;
  canEdit: boolean;
}

export interface OfficerRoznamaTableResponse {
  hearingDate: string;
  totalRows: number;
  rows: OfficerRoznamaTableRow[];
}

export interface RoznamaHearingQuery {
  hearingId?: number;
  hearingDate?: string;
}

/** POST /{caseId}/roznama — single complete (save + sign + outcome). */
export interface CompleteRoznamaRequest {
  hearingId: number;
  content: string;
  hearingOutcome: 'ADJOURN' | 'FINAL';
  hearingDate?: string;
  nextHearingDate?: string;
  digitalSignatureRef?: string;
  remarks?: string;
  /** When attendanceRequired and not yet saved via PUT …/attendance */
  attendance?: RoznamaAttendanceSaveEntry[];
}

export interface CompleteRoznamaResponse {
  status: string;
  hearingOutcome: string;
  caseStatus?: string;
  finalHearing?: boolean;
  nextHearingId?: number | null;
  nextHearingDate?: string | null;
  message?: string;
  roznamaFinalized?: boolean;
  roznamaSigned?: boolean;
  id?: number;
  caseId?: number;
  caseNo?: string;
  hearingId?: number | null;
  content?: string;
}

export interface WorkflowArtifactSlice {
  artifact?: string;
  artifactId?: number;
  hearingId?: number | null;
  hearingNo?: number | null;
  status?: string;
  noticeServed?: boolean;
  allowedActions?: string[];
  config?: Record<string, unknown>;
  blueprint?: string;
  workflowStatus?: string;
  message?: string;
}

export interface WorkflowContextHearing {
  hearingId: number;
  hearingNo: number;
  hearingDate?: string;
  hearingStatus?: string;
  status?: string;
  noticeServed?: boolean;
  allowedActions?: string[];
}

export interface JudgmentWorkflowContextSlice extends WorkflowArtifactSlice {
  allowedActions?: string[];
  workflowStatus?: string;
  blueprint?: string;
  message?: string;
  /** Enable judgment text editor (from workflow-context). */
  editable?: boolean;
  /** Clerk may submit to PO (CLERK_DRAFT). */
  submittable?: boolean;
  /** PRESIDING_OFFICER | CLERK — who acts at this step. */
  actorRole?: string;
}

export interface CaseWorkflowContext {
  caseId: number;
  caseNo?: string;
  caseStatus?: string;
  caseCategoryCode?: string;
  blueprintCode?: string;
  filingApplicationId?: number;
  hearingId?: number | null;
  hearingNo?: number | null;
  hearingDate?: string | null;
  noticeServed?: boolean;
  proceedingAllowed?: boolean;
  proceedingStage?: string | null;
  roznamaStatus?: string | null;
  allowedActions?: string[];
  notice?: WorkflowArtifactSlice;
  roznama?: WorkflowArtifactSlice;
  judgment?: JudgmentWorkflowContextSlice;
  hearings?: WorkflowContextHearing[];
  message?: string;
}

/** Latest non-completed hearing from workflow-context.hearings (highest hearingNo). */
export function workflowActiveHearing(
  ctx: CaseWorkflowContext | null | undefined
): WorkflowContextHearing | null {
  const hearings = ctx?.hearings ?? [];
  if (!hearings.length) return null;
  const active = hearings.filter((h) => {
    const st = String(h.hearingStatus ?? h.status ?? '').toUpperCase();
    return st !== 'COMPLETED';
  });
  const pool = active.length ? active : hearings;
  return pool.reduce(
    (best, h) => (!best || h.hearingNo > best.hearingNo ? h : best),
    null as WorkflowContextHearing | null
  );
}

export interface JudgmentHistoryRow {
  id?: number;
  historyId?: number;
  action?: string;
  actionCode?: string;
  status?: string;
  fromStatus?: string;
  toStatus?: string;
  summary?: string;
  summarySnapshot?: string;
  draftSummary?: string;
  remarks?: string;
  actorRole?: string;
  actorLoginId?: string;
  createdAt?: string;
}

export function normalizeJudgmentHistoryRow(raw: JudgmentHistoryRow): JudgmentHistoryRow {
  const from = raw.fromStatus?.trim();
  const to = raw.toStatus?.trim();
  const statusTransition = from && to ? `${from} → ${to}` : raw.status;
  return {
    ...raw,
    historyId: raw.historyId ?? raw.id,
    action: raw.action ?? raw.actionCode,
    status: statusTransition || to || from || raw.status
  };
}

export interface RescheduleHearingRequest {
  nextHearingDate: string;
  noticeGenerate?: boolean;
  remarks?: string;
}

// ─── Judgment ────────────────────────────────────────────────────────────────

export interface CaseJudgmentWorkflowResponse {
  caseId: number;
  caseNo: string;
  caseStatus?: string;
  /** PO_DRAFT | CLERK_DRAFT | PO_SCRUTINY | PO_FINALIZED | PUBLISHED */
  workflowStatus?: string;
  draftSummary?: string | null;
  finalSummary?: string | null;
  publishedSummary?: string | null;
  updatedAt?: string | null;
  allowedActions?: string[];
  editable?: boolean;
  submittable?: boolean;
  actorRole?: string;
  digitalSignatureRef?: string | null;
  /** Normalized / legacy aliases (filled by normalizeJudgmentWorkflow). */
  status?: string;
  draftContent?: string | null;
  finalContent?: string | null;
  judgmentSummary?: string | null;
  publishedAt?: string | null;
  disposedAt?: string | null;
  message?: string | null;
}

/** Response from POST .../judgment/publish or sign-and-publish. */
export interface CaseJudgmentPublishResponse {
  caseId: number;
  caseNo: string;
  status?: string;
  workflowStatus?: string;
  judgmentSummary?: string | null;
  digitalSignatureRef?: string | null;
  disposedAt?: string | null;
  message?: string | null;
}

/** Read workflow stage from API response (workflowStatus or status). */
export function judgmentWorkflowStatus(
  resp: CaseJudgmentWorkflowResponse | null | undefined
): string {
  return String(resp?.workflowStatus ?? resp?.status ?? '').trim().toUpperCase();
}

/** Best available judgment text for display / textarea (fallback). */
export function judgmentTextFromResponse(
  resp: CaseJudgmentWorkflowResponse | null | undefined
): string {
  if (!resp) return '';
  return (
    resp.publishedSummary?.trim() ||
    resp.finalSummary?.trim() ||
    resp.draftSummary?.trim() ||
    resp.judgmentSummary?.trim() ||
    resp.finalContent?.trim() ||
    resp.draftContent?.trim() ||
    ''
  );
}

/** Bind editor to the correct field per workflowStatus (API guide). */
export function judgmentBindingText(
  resp: CaseJudgmentWorkflowResponse | null | undefined
): string {
  if (!resp) return '';
  const st = judgmentWorkflowStatus(resp);
  if (st === 'PUBLISHED') {
    return resp.publishedSummary?.trim() || resp.judgmentSummary?.trim() || '';
  }
  if (st === 'PO_FINALIZED') {
    return resp.finalSummary?.trim() || resp.draftSummary?.trim() || '';
  }
  if (st === 'PO_DRAFT' || st === 'CLERK_DRAFT' || st === 'PO_SCRUTINY' || !st) {
    return (
      resp.draftSummary?.trim() ||
      resp.draftContent?.trim() ||
      resp.judgmentSummary?.trim() ||
      ''
    );
  }
  return judgmentTextFromResponse(resp);
}

export function judgmentFieldLabel(resp: CaseJudgmentWorkflowResponse | null | undefined): string {
  const st = judgmentWorkflowStatus(resp);
  if (st === 'PUBLISHED') return 'Published judgment';
  if (st === 'PO_FINALIZED') return 'Final judgment';
  return 'Judgment draft';
}

export function judgmentWorkflowFromPublish(
  raw: CaseJudgmentPublishResponse
): CaseJudgmentWorkflowResponse {
  const workflowStatus = String(raw.workflowStatus ?? 'PUBLISHED').trim();
  const publishedSummary = raw.judgmentSummary?.trim() || null;
  return normalizeJudgmentWorkflow({
    caseId: raw.caseId,
    caseNo: raw.caseNo,
    caseStatus: raw.status ?? 'DISPOSED',
    workflowStatus,
    publishedSummary,
    judgmentSummary: publishedSummary,
    digitalSignatureRef: raw.digitalSignatureRef ?? null,
    disposedAt: raw.disposedAt ?? null,
    publishedAt: raw.disposedAt ?? null,
    message: raw.message ?? null,
    editable: false,
    submittable: false,
    allowedActions: []
  });
}

/** Infer editable from allowedActions + status when API omits or mis-sets editable. */
export function judgmentInferredEditable(
  resp: CaseJudgmentWorkflowResponse | null | undefined,
  actorRole?: string
): boolean {
  if (!resp) {
    return false;
  }
  const st = judgmentWorkflowStatus(resp);
  if (st === 'PUBLISHED' || st === 'PO_FINALIZED') {
    return false;
  }
  const actions = (resp.allowedActions ?? []).map((a) => String(a).trim().toUpperCase());
  const actor = String(actorRole ?? resp.actorRole ?? '').trim().toUpperCase();
  if (actor === 'PRESIDING_OFFICER') {
    if (
      actions.some(
        (a) =>
          a === 'UPDATE_PO_JUDGMENT' ||
          a === 'PO_DRAFT_JUDGMENT' ||
          a === 'DRAFT_JUDGMENT' ||
          a.includes('UPDATE_PO_JUDGMENT')
      )
    ) {
      return true;
    }
    if (!st || st === 'PO_DRAFT' || st === 'PO_SCRUTINY') {
      return true;
    }
  }
  if (actor === 'CLERK') {
    if (actions.some((a) => a === 'CLERK_UPDATE_JUDGMENT' || a.includes('CLERK_UPDATE'))) {
      return true;
    }
    if (st === 'CLERK_DRAFT') {
      return true;
    }
  }
  return resp.editable === true;
}

/** Map backend judgment JSON to fields the UI expects. */
export function normalizeJudgmentWorkflow(
  raw: CaseJudgmentWorkflowResponse
): CaseJudgmentWorkflowResponse {
  const workflowStatus = String(raw.workflowStatus ?? raw.status ?? '').trim();
  const draftSummary =
    raw.draftSummary ?? raw.draftContent ?? raw.judgmentSummary ?? null;
  const finalSummary = raw.finalSummary ?? raw.finalContent ?? null;
  const publishedSummary = raw.publishedSummary ?? null;
  const normalized: CaseJudgmentWorkflowResponse = {
    ...raw,
    workflowStatus,
    status: workflowStatus,
    draftSummary,
    finalSummary,
    publishedSummary,
    draftContent: draftSummary,
    finalContent: finalSummary,
    judgmentSummary: draftSummary,
    publishedAt: raw.publishedAt ?? null
  };
  if (normalized.editable === undefined || normalized.editable === false) {
    if (judgmentInferredEditable(normalized)) {
      normalized.editable = true;
    }
  }
  return normalized;
}

/** Backend accepts any of these field names for draft save. */
export interface JudgmentDraftRequest {
  summary?: string;
  draftSummary?: string;
  judgmentSummary?: string;
  content?: string;
}

export function buildJudgmentDraftBody(text: string): JudgmentDraftRequest {
  const t = text.trim();
  return { summary: t, draftSummary: t, judgmentSummary: t, content: t };
}

export interface CaseJudgmentSignPublishRequest {
  summary?: string;
  draftSummary?: string;
  judgmentSummary?: string;
  content?: string;
  digitalSignatureRef: string;
  remarks?: string;
}

export function buildJudgmentSignPublishBody(
  summaryText: string,
  digitalSignatureRef: string,
  remarks?: string
): CaseJudgmentSignPublishRequest {
  const body = buildJudgmentDraftBody(summaryText);
  return {
    ...body,
    digitalSignatureRef: digitalSignatureRef.trim(),
    remarks: remarks?.trim() || undefined
  };
}

/** @deprecated use CaseJudgmentWorkflowResponse */
export type CaseJudgmentResponse = CaseJudgmentWorkflowResponse;

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class OfficerCaseStageService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // ── Approve / Assignment ───────────────────────────────────────────────────

  approveApplication(applicationId: number): Observable<OfficerApproveResponse> {
    return this.http.post<OfficerApproveResponse>(
      `${this.base}/api/filing-applications/officer/${applicationId}/approve`, {}
    );
  }

  forwardToPo(applicationId: number, payload: { remarks: string }): Observable<OfficerAssignmentActionResponse> {
    return this.http.post<OfficerAssignmentActionResponse>(
      `${this.base}/api/filing-applications/officer/${applicationId}/forward-to-po`, payload
    );
  }

  returnToClerk(applicationId: number, payload: { remarks: string }): Observable<OfficerAssignmentActionResponse> {
    return this.http.post<OfficerAssignmentActionResponse>(
      `${this.base}/api/filing-applications/officer/${applicationId}/return-to-clerk`, payload
    );
  }

  rejectApplication(applicationId: number, payload: { remarks: string }): Observable<OfficerAssignmentActionResponse> {
    return this.http.post<OfficerAssignmentActionResponse>(
      `${this.base}/api/filing-applications/officer/${applicationId}/reject`, payload
    );
  }

  // ── Officer dashboard ──────────────────────────────────────────────────────

  getOfficerDashboard(): Observable<OfficerDashboardResponse> {
    return this.http.get<OfficerDashboardResponse>(`${this.base}/api/cases/officer/dashboard`);
  }

  // ── Case inbox / detail ────────────────────────────────────────────────────

  getCaseInbox(status?: string): Observable<OfficerCaseInboxItem[]> {
    return this.http.get<OfficerCaseInboxItem[]>(`${this.base}/api/cases/officer/inbox`, {
      params: status ? { status } : {}
    });
  }

  getCaseDetail(caseId: number): Observable<unknown> {
    return this.http.get<unknown>(`${this.base}/api/cases/officer/${caseId}`);
  }

  // ── Hearing ────────────────────────────────────────────────────────────────

  scheduleHearing(caseId: number, payload: { hearingDate: string; noticeGenerate: boolean; remarks: string }): Observable<CaseHearingResponse> {
    return this.http.post<CaseHearingResponse>(`${this.base}/api/cases/officer/${caseId}/hearings`, payload);
  }

  listHearings(caseId: number): Observable<CaseHearingResponse[]> {
    return this.http.get<CaseHearingResponse[]>(`${this.base}/api/cases/officer/${caseId}/hearings`);
  }

  getTodayCauseList(): Observable<CaseHearingResponse[]> {
    return this.http.get<CaseHearingResponse[]>(`${this.base}/api/cases/officer/hearings/today`);
  }

  // ── Notice workflow ────────────────────────────────────────────────────────

  /** All hearings with date set and notice not yet served (office backlog). */
  getPendingServeNotices(): Observable<PendingServeNoticeResponse> {
    return this.http
      .get<PendingServeNoticeResponse | PendingServeNoticeRow[]>(
        `${this.base}/api/cases/officer/notices/pending-serve`
      )
      .pipe(
        map((raw) => {
          if (Array.isArray(raw)) {
            return { totalRows: raw.length, rows: raw };
          }
          return raw ?? { totalRows: 0, rows: [] };
        })
      );
  }

  listNotices(caseId: number): Observable<CaseNoticeItem[]> {
    return this.http.get<CaseNoticeItem[]>(`${this.base}/api/cases/officer/${caseId}/notices`);
  }

  draftNotice(caseId: number, payload: NoticeDraftRequest): Observable<CaseNoticeItem> {
    return this.http.post<CaseNoticeItem>(`${this.base}/api/cases/officer/${caseId}/notices/draft`, payload);
  }

  submitNoticeToPO(caseId: number, noticeId: number): Observable<CaseNoticeItem> {
    return this.http.post<CaseNoticeItem>(`${this.base}/api/cases/officer/${caseId}/notices/${noticeId}/submit-to-po`, {});
  }

  finalizeNotice(caseId: number, noticeId: number): Observable<CaseNoticeItem> {
    return this.http.post<CaseNoticeItem>(`${this.base}/api/cases/officer/${caseId}/notices/${noticeId}/finalize`, {});
  }

  signNotice(caseId: number, noticeId: number, payload: NoticeSignRequest): Observable<CaseNoticeItem> {
    return this.http.post<CaseNoticeItem>(`${this.base}/api/cases/officer/${caseId}/notices/${noticeId}/sign`, payload);
  }

  /** Serve notice — one shot: draft + finalize + sign + serve. */
  serveNotice(caseId: number, body: NoticeServeRequest): Observable<CaseNoticeItem> {
    return this.http.post<CaseNoticeItem>(
      `${this.base}/api/cases/officer/${caseId}/notices/serve`,
      body
    );
  }

  /** @deprecated use serveNotice — legacy path when noticeId existed */
  serveNoticeById(
    caseId: number,
    noticeId: number,
    body: NoticeServeRequest
  ): Observable<CaseNoticeItem> {
    return this.http.post<CaseNoticeItem>(
      `${this.base}/api/cases/officer/${caseId}/notices/${noticeId}/serve`,
      body
    );
  }

  /** @deprecated alias */
  serveNoticeForHearing(caseId: number, body: NoticeServeRequest): Observable<CaseNoticeItem> {
    return this.serveNotice(caseId, body);
  }

  /** PO reverts notice to Clerk (allowed on PO_FINALIZED or PO_SIGNED → back to CLERK_DRAFT) */
  revertNotice(caseId: number, noticeId: number, remarks: string): Observable<CaseNoticeItem> {
    return this.http.post<CaseNoticeItem>(`${this.base}/api/cases/officer/${caseId}/notices/${noticeId}/revert-to-clerk`, { remarks });
  }

  // ── Roznama / cause list ───────────────────────────────────────────────────

  getRoznamaTable(date?: string): Observable<OfficerRoznamaTableResponse> {
    return this.http.get<OfficerRoznamaTableResponse>(`${this.base}/api/cases/officer/roznama/table`, {
      params: date ? { date } : {}
    });
  }

  getRoznama(caseId: number, query?: RoznamaHearingQuery): Observable<RoznamaResponse> {
    const params: Record<string, string> = {};
    if (query?.hearingId) params['hearingId'] = String(query.hearingId);
    if (query?.hearingDate) params['hearingDate'] = query.hearingDate;
    return this.http.get<RoznamaResponse>(`${this.base}/api/cases/officer/${caseId}/roznama`, { params });
  }

  getHearingAttendance(caseId: number, hearingId: number): Observable<RoznamaAttendanceResponse> {
    return this.http.get<RoznamaAttendanceResponse>(
      `${this.base}/api/cases/officer/${caseId}/hearings/${hearingId}/attendance`
    );
  }

  saveHearingAttendance(
    caseId: number,
    hearingId: number,
    payload: { entries: RoznamaAttendanceSaveEntry[] }
  ): Observable<RoznamaAttendanceResponse> {
    return this.http.put<RoznamaAttendanceResponse>(
      `${this.base}/api/cases/officer/${caseId}/hearings/${hearingId}/attendance`,
      payload
    );
  }

  getWorkflowContext(caseId: number, hearingId?: number): Observable<CaseWorkflowContext> {
    const params: Record<string, string> = {};
    if (hearingId) params['hearingId'] = String(hearingId);
    return this.http.get<CaseWorkflowContext>(
      `${this.base}/api/cases/officer/${caseId}/workflow-context`,
      { params }
    );
  }

  /** Complete roznamma: save, finalize, sign, apply ADJOURN or FINAL (POST). */
  completeRoznama(caseId: number, payload: CompleteRoznamaRequest): Observable<CompleteRoznamaResponse> {
    return this.http.post<CompleteRoznamaResponse>(
      `${this.base}/api/cases/officer/${caseId}/roznama`,
      payload
    );
  }

  rescheduleHearing(
    caseId: number,
    hearingId: number,
    payload: RescheduleHearingRequest
  ): Observable<CaseHearingResponse> {
    return this.http.post<CaseHearingResponse>(
      `${this.base}/api/cases/officer/${caseId}/hearings/${hearingId}/reschedule`,
      payload
    );
  }

  /** @deprecated use completeRoznama — legacy draft-only PUT */
  draftRoznama(
    caseId: number,
    payload: { hearingId?: number; hearingDate?: string; content: string; remarks?: string }
  ): Observable<RoznamaResponse> {
    return this.http.put<RoznamaResponse>(`${this.base}/api/cases/officer/${caseId}/roznama`, payload);
  }

  submitRoznamaToPO(caseId: number, query?: RoznamaHearingQuery): Observable<RoznamaResponse> {
    const params: Record<string, string> = {};
    if (query?.hearingId) params['hearingId'] = String(query.hearingId);
    if (query?.hearingDate) params['hearingDate'] = query.hearingDate;
    return this.http.post<RoznamaResponse>(`${this.base}/api/cases/officer/${caseId}/roznama/submit-to-po`, {}, { params });
  }

  finalizeRoznama(caseId: number, query?: RoznamaHearingQuery): Observable<RoznamaResponse> {
    const params: Record<string, string> = {};
    if (query?.hearingId) params['hearingId'] = String(query.hearingId);
    if (query?.hearingDate) params['hearingDate'] = query.hearingDate;
    return this.http.post<RoznamaResponse>(`${this.base}/api/cases/officer/${caseId}/roznama/finalize`, {}, { params });
  }

  /** @deprecated use completeRoznama — same POST /roznama endpoint */
  signAndSaveRoznama(
    caseId: number,
    payload: {
      hearingId?: number;
      hearingDate?: string;
      content: string;
      remarks?: string;
      digitalSignatureRef: string;
    }
  ): Observable<RoznamaResponse> {
    return this.http.post<RoznamaResponse>(
      `${this.base}/api/cases/officer/${caseId}/roznama`,
      payload
    );
  }

  signRoznama(caseId: number, payload: { digitalSignatureRef: string } & RoznamaHearingQuery): Observable<RoznamaResponse> {
    const { digitalSignatureRef, hearingId, hearingDate } = payload;
    const params: Record<string, string> = {};
    if (hearingId) params['hearingId'] = String(hearingId);
    if (hearingDate) params['hearingDate'] = hearingDate;
    return this.http.post<RoznamaResponse>(
      `${this.base}/api/cases/officer/${caseId}/roznama/sign`,
      { digitalSignatureRef },
      { params }
    );
  }

  revertRoznamaToClerk(caseId: number, remarks: string, query?: RoznamaHearingQuery): Observable<RoznamaResponse> {
    const params: Record<string, string> = {};
    if (query?.hearingId) params['hearingId'] = String(query.hearingId);
    if (query?.hearingDate) params['hearingDate'] = query.hearingDate;
    return this.http.post<RoznamaResponse>(
      `${this.base}/api/cases/officer/${caseId}/roznama/revert-to-clerk`,
      { remarks },
      { params }
    );
  }

  /** Audit trail for the single case roznamah (optional hearingId filter). */
  getRoznamaHistory(caseId: number, query?: { hearingId?: number }): Observable<RoznamaHistoryRow[]> {
    const params: Record<string, string> = {};
    if (query?.hearingId) params['hearingId'] = String(query.hearingId);
    return this.http.get<RoznamaHistoryRow[]>(`${this.base}/api/cases/officer/${caseId}/roznama/history`, {
      params
    });
  }

  /** @deprecated use getRoznama */
  getCurrentOrderSheet(caseId: number): Observable<CaseOrderSheetResponse> {
    return this.getRoznama(caseId) as Observable<CaseOrderSheetResponse>;
  }

  /** @deprecated use draftRoznama */
  upsertOrderSheet(caseId: number, payload: { hearingId?: number | null; content: string; remarks: string }): Observable<CaseOrderSheetResponse> {
    return this.draftRoznama(caseId, {
      hearingId: payload.hearingId ?? undefined,
      content: payload.content,
      remarks: payload.remarks
    }) as Observable<CaseOrderSheetResponse>;
  }

  /** @deprecated use submitRoznamaToPO */
  submitOrderSheetToPO(caseId: number): Observable<CaseOrderSheetResponse> {
    return this.submitRoznamaToPO(caseId) as Observable<CaseOrderSheetResponse>;
  }

  /** @deprecated use finalizeRoznama */
  finalizeOrderSheet(caseId: number): Observable<CaseOrderSheetResponse> {
    return this.finalizeRoznama(caseId) as Observable<CaseOrderSheetResponse>;
  }

  /** @deprecated use signRoznama */
  signOrderSheet(caseId: number, payload: { digitalSignatureRef: string }): Observable<CaseOrderSheetResponse> {
    return this.signRoznama(caseId, payload) as Observable<CaseOrderSheetResponse>;
  }

  /** @deprecated use revertRoznamaToClerk */
  revertOrderSheet(caseId: number, remarks: string): Observable<CaseOrderSheetResponse> {
    return this.revertRoznamaToClerk(caseId, remarks) as Observable<CaseOrderSheetResponse>;
  }

  /** @deprecated use getRoznamaHistory */
  getOrderSheetHistory(caseId: number): Observable<CaseOrderSheetHistoryResponse[]> {
    return this.http.get<CaseOrderSheetHistoryResponse[]>(`${this.base}/api/cases/officer/${caseId}/roznama/history`);
  }

  // ── Judgment workflow ──────────────────────────────────────────────────────

  getJudgmentWorkflow(caseId: number): Observable<CaseJudgmentWorkflowResponse> {
    return this.http
      .get<CaseJudgmentWorkflowResponse>(`${this.base}/api/cases/officer/${caseId}/judgment/workflow`)
      .pipe(map((r) => normalizeJudgmentWorkflow(r)));
  }

  /** Clerk or PO saves judgment draft (CLERK_DRAFT only). */
  draftJudgment(caseId: number, summaryText: string): Observable<CaseJudgmentWorkflowResponse> {
    const body = buildJudgmentDraftBody(summaryText);
    return this.http
      .put<CaseJudgmentWorkflowResponse>(`${this.base}/api/cases/officer/${caseId}/judgment/draft`, body)
      .pipe(map((r) => normalizeJudgmentWorkflow(r)));
  }

  /** POST alias for draft save (same body as PUT). */
  draftJudgmentPost(caseId: number, summaryText: string): Observable<CaseJudgmentWorkflowResponse> {
    const body = buildJudgmentDraftBody(summaryText);
    return this.http
      .post<CaseJudgmentWorkflowResponse>(`${this.base}/api/cases/officer/${caseId}/judgment/draft`, body)
      .pipe(map((r) => normalizeJudgmentWorkflow(r)));
  }

  /** PO sends judgment draft to clerk (PO_THEN_CLERK blueprint). */
  sendJudgmentToClerk(caseId: number, remarks?: string): Observable<CaseJudgmentWorkflowResponse> {
    return this.http
      .post<CaseJudgmentWorkflowResponse>(
        `${this.base}/api/cases/officer/${caseId}/judgment/send-to-clerk`,
        remarks?.trim() ? { remarks: remarks.trim() } : {}
      )
      .pipe(map((r) => normalizeJudgmentWorkflow(r)));
  }

  /** Clerk submits judgment to PO for scrutiny. */
  submitJudgmentToPO(caseId: number): Observable<CaseJudgmentWorkflowResponse> {
    return this.http
      .post<CaseJudgmentWorkflowResponse>(
        `${this.base}/api/cases/officer/${caseId}/judgment/submit-to-po`,
        {}
      )
      .pipe(map((r) => normalizeJudgmentWorkflow(r)));
  }

  /** PO finalizes after PO_SCRUTINY (optional draft body). */
  finalizeJudgment(caseId: number, summaryText?: string): Observable<CaseJudgmentWorkflowResponse> {
    const body = summaryText?.trim() ? buildJudgmentDraftBody(summaryText) : {};
    return this.http
      .post<CaseJudgmentWorkflowResponse>(`${this.base}/api/cases/officer/${caseId}/judgment/finalize`, body)
      .pipe(map((r) => normalizeJudgmentWorkflow(r)));
  }

  /** PO reverts judgment to Clerk (allowed on PO_FINALIZED → back to CLERK_DRAFT) */
  revertJudgment(caseId: number, remarks: string): Observable<CaseJudgmentWorkflowResponse> {
    return this.http
      .post<CaseJudgmentWorkflowResponse>(
        `${this.base}/api/cases/officer/${caseId}/judgment/revert-to-clerk`,
        { remarks }
      )
      .pipe(map((r) => normalizeJudgmentWorkflow(r)));
  }

  /** PO publishes judgment → case DISPOSED */
  publishJudgment(caseId: number): Observable<CaseJudgmentWorkflowResponse> {
    return this.http
      .post<CaseJudgmentPublishResponse>(`${this.base}/api/cases/officer/${caseId}/judgment/publish`, {})
      .pipe(map((r) => judgmentWorkflowFromPublish(r)));
  }

  /** PO signs and publishes judgment (from PO_SCRUTINY or PO_FINALIZED). */
  signAndPublishJudgment(
    caseId: number,
    payload: CaseJudgmentSignPublishRequest
  ): Observable<CaseJudgmentWorkflowResponse> {
    return this.http
      .post<CaseJudgmentPublishResponse>(
        `${this.base}/api/cases/officer/${caseId}/judgment/sign-and-publish`,
        payload
      )
      .pipe(map((r) => judgmentWorkflowFromPublish(r)));
  }

  /** Pass / record final judgment body (when blueprint uses direct pass). */
  passFinalJudgment(
    caseId: number,
    summaryText: string
  ): Observable<CaseJudgmentWorkflowResponse> {
    const body = buildJudgmentDraftBody(summaryText);
    return this.http
      .post<CaseJudgmentWorkflowResponse>(`${this.base}/api/cases/officer/${caseId}/judgment`, body)
      .pipe(map((r) => normalizeJudgmentWorkflow(r)));
  }

  getJudgmentHistory(caseId: number): Observable<JudgmentHistoryRow[]> {
    return this.http
      .get<JudgmentHistoryRow[]>(`${this.base}/api/cases/officer/${caseId}/judgment/history`)
      .pipe(map((rows) => (rows || []).map((r) => normalizeJudgmentHistoryRow(r))));
  }
}
