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
  /** SCHEDULED | COMPLETED */
  status: string;
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

export interface RoznamaResponse {
  id: number;
  caseId: number;
  caseNo: string;
  hearingId: number | null;
  content: string;
  draftContent: string | null;
  finalContent: string | null;
  /** CLERK_DRAFT | PO_SCRUTINY | PO_FINALIZED | PO_SIGNED */
  status: string;
  canEdit?: boolean;
  digitalSignatureRef: string | null;
  updatedAt: string;
  updatedByLoginId?: string;
  message?: string;
  hearingOutcome?: string | null;
  attendanceRequired?: boolean;
  attendanceComplete?: boolean;
  attendance?: RoznamaAttendanceEntry[];
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

export interface JudgmentWorkflowContextSlice {
  allowedActions?: string[];
  workflowStatus?: string;
  blueprint?: string;
  message?: string;
}

export interface CaseWorkflowContext {
  caseId: number;
  caseNo?: string;
  caseStatus?: string;
  hearingId?: number | null;
  hearingNo?: number | null;
  hearingDate?: string | null;
  noticeServed?: boolean;
  proceedingAllowed?: boolean;
  proceedingStage?: string | null;
  roznamaStatus?: string | null;
  allowedActions?: string[];
  judgment?: JudgmentWorkflowContextSlice;
  message?: string;
}

export interface JudgmentHistoryRow {
  historyId?: number;
  action?: string;
  status?: string;
  summary?: string;
  draftSummary?: string;
  remarks?: string;
  actorRole?: string;
  actorLoginId?: string;
  createdAt?: string;
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
  /** Backend field: CLERK_DRAFT | PO_SCRUTINY | PO_FINALIZED | PUBLISHED */
  workflowStatus?: string;
  draftSummary?: string | null;
  finalSummary?: string | null;
  publishedSummary?: string | null;
  updatedAt?: string | null;
  /** Normalized / legacy aliases (filled by normalizeJudgmentWorkflow). */
  status?: string;
  draftContent?: string | null;
  finalContent?: string | null;
  judgmentSummary?: string | null;
  publishedAt?: string | null;
  disposedAt?: string | null;
  message?: string | null;
}

/** Read workflow stage from API response (workflowStatus or status). */
export function judgmentWorkflowStatus(
  resp: CaseJudgmentWorkflowResponse | null | undefined
): string {
  return String(resp?.workflowStatus ?? resp?.status ?? '').trim().toUpperCase();
}

/** Best available judgment text for display / textarea. */
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

/** Map backend judgment JSON to fields the UI expects. */
export function normalizeJudgmentWorkflow(
  raw: CaseJudgmentWorkflowResponse
): CaseJudgmentWorkflowResponse {
  const workflowStatus = String(raw.workflowStatus ?? raw.status ?? '').trim();
  const draftSummary =
    raw.draftSummary ?? raw.draftContent ?? raw.judgmentSummary ?? null;
  const finalSummary = raw.finalSummary ?? raw.finalContent ?? null;
  const publishedSummary = raw.publishedSummary ?? null;
  return {
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

  /** @deprecated use completeRoznama */
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
      `${this.base}/api/cases/officer/${caseId}/roznama/sign-and-save`,
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
  sendJudgmentToClerk(caseId: number): Observable<CaseJudgmentWorkflowResponse> {
    return this.http
      .post<CaseJudgmentWorkflowResponse>(
        `${this.base}/api/cases/officer/${caseId}/judgment/send-to-clerk`,
        {}
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

  /** PO finalizes after PO_SCRUTINY */
  finalizeJudgment(caseId: number): Observable<CaseJudgmentWorkflowResponse> {
    return this.http
      .post<CaseJudgmentWorkflowResponse>(`${this.base}/api/cases/officer/${caseId}/judgment/finalize`, {})
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
      .post<CaseJudgmentWorkflowResponse>(`${this.base}/api/cases/officer/${caseId}/judgment/publish`, {})
      .pipe(map((r) => normalizeJudgmentWorkflow(r)));
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
    return this.http.get<JudgmentHistoryRow[]>(
      `${this.base}/api/cases/officer/${caseId}/judgment/history`
    );
  }
}
