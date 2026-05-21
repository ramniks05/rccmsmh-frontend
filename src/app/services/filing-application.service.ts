import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

/** POST /api/filing-applications/save — matches backend contract. Bearer + JSON via interceptor / HttpClient. */
export type FilingSaveStatus = 'DRAFT' | 'SUBMITTED';

export interface FilingApplicationSaveRequest {
  status: FilingSaveStatus;
  caseCategoryId: number;
  clientApplicationRef: string;
  /** Send after first save for updates (optional on first POST). */
  applicationId?: number | null;

  /** Full nested form snapshot (Angular `getRawValue()`). */
  form: Record<string, unknown>;
  disputedOrder?: unknown;
  disputedLands?: unknown;
  attachments?: unknown[];
}

export interface FilingApplicationSaveResponse {
  applicationId?: number;
  applicantIdByClientRowKey?: Record<string, number>;
  [key: string]: unknown;
}

// ── Party / Advocate read-only preview ────────────────────────────────────────

export interface ApplicationPreviewNotice {
  noticeId: number;
  noticeType: string;
  /** PO_FINALIZED | PO_SIGNED | SERVED */
  status: string;
  previewContent: string | null;
  finalContent: string | null;
  createdAt: string;
  updatedAt: string;
  servedAt?: string | null;
}

export interface ApplicationPreviewHearing {
  hearingId: number;
  hearingDate: string;
  remarks?: string | null;
  status?: string;
}

export interface ApplicationPreviewOrderSheetEntry {
  historyId?: number;
  hearingNo?: string | null;
  hearingDate?: string | null;
  remarks?: string | null;
  createdByLoginId?: string;
  stage?: string;
}

export type ApplicationHistoryPhase = 'FILING' | 'PROCEEDING';

export type ApplicationHistoryReferenceType = 'HEARING' | 'NOTICE' | 'ORDER_SHEET' | 'JUDGMENT';

/** GET …/history — unified filing + proceeding timeline entry */
export interface ApplicationHistoryEntry {
  historyId?: number;
  applicationId?: number;
  sequence: number;
  phase: ApplicationHistoryPhase;
  action: string;
  actionLabel?: string;
  remarks?: string | null;
  actorRole?: string;
  actorRoleLabel?: string;
  actorLoginId?: string;
  applicationNo?: string;
  status?: string;
  caseId?: number | null;
  caseNo?: string | null;
  processingStage?: string;
  processingStageLabel?: string;
  createdAt?: string;
  synthetic?: boolean;
  referenceType?: ApplicationHistoryReferenceType;
  referenceId?: number;
  hearingNo?: number;
  hearingDate?: string;
  noticeType?: string;
}

/** GET …/history — full unified timeline (filing through proceedings) */
export interface ApplicationHistoryResponse {
  applicationId: number;
  applicationNo: string;
  caseId?: number | null;
  caseNo?: string | null;
  status?: string;
  processingStage?: string;
  processingStageLabel?: string;
  currentAssigneeRole?: string | null;
  filingCount?: number;
  proceedingCount?: number;
  totalCount: number;
  synthetic?: boolean;
  entries: ApplicationHistoryEntry[];
}

/** Alias used in API docs */
export type ApplicationHistoryListResponse = ApplicationHistoryResponse;

export interface ApplicationPreviewResponse {
  application: {
    applicationId: number;
    applicationNo: string;
    caseId?: number | null;
    caseNo?: string | null;
    status: string;
    form?: Record<string, unknown>;
    applicants?: Record<string, unknown>[];
    respondents?: Record<string, unknown>[];
    disputedOrder?: Record<string, unknown>;
    disputedLands?: Record<string, unknown>[];
    attachments?: Record<string, unknown>[];
  };
  notices: ApplicationPreviewNotice[];
  hearings: ApplicationPreviewHearing[];
  orderSheetHistory: ApplicationPreviewOrderSheetEntry[];
  judgmentWorkflowStatus?: string | null;
  judgmentSummary?: string | null;
  applicationHistory?: ApplicationHistoryResponse;
}

export interface MyApplicationItem {
  applicationId: number;
  applicationNo: string;
  caseId?: number | null;
  caseNo?: string | null;
  caseStatus?: string | null;
  caseCategoryId?: number;
  caseCategoryName?: string;
  subjectId?: number;
  subjectName?: string;
  officeId?: number;
  officeName?: string;
  /** DRAFT | SUBMITTED */
  status: string;
  processingStage?: string;
  processingStageLabel?: string;
  currentAssigneeRole?: string | null;
  filedByRole?: string;
  submittedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FilingApplicationService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  save(request: FilingApplicationSaveRequest): Observable<FilingApplicationSaveResponse> {
    return this.http.post<FilingApplicationSaveResponse>(`${this.apiBaseUrl}/api/filing-applications/save`, request);
  }

  /** GET /api/filing-applications/mine — list of the logged-in advocate/party's own applications */
  getMyApplications(): Observable<MyApplicationItem[]> {
    return this.http.get<MyApplicationItem[]>(`${this.apiBaseUrl}/api/filing-applications/mine`);
  }

  /** GET /api/filing-applications/{id}/preview — full read-only view for party/advocate */
  getApplicationPreview(applicationId: number): Observable<ApplicationPreviewResponse> {
    return this.http.get<ApplicationPreviewResponse>(`${this.apiBaseUrl}/api/filing-applications/${applicationId}/preview`);
  }

  /** GET /api/filing-applications/{applicationId}/history — filer timeline (advocate / party) */
  getApplicationHistory(applicationId: number): Observable<ApplicationHistoryResponse> {
    return this.http.get<ApplicationHistoryResponse>(
      `${this.apiBaseUrl}/api/filing-applications/${applicationId}/history`
    );
  }
}
