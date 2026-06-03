import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { normalizeApplicationPreviewResponse } from '../shared/application-preview.util';

import { RCCMS_API } from '../core/rccms-api.paths';
import { environment } from '../../environments/environment';
import { FilingMappedAttachment } from './mapped-documents.service';

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
  attachments?: FilingMappedAttachment[];
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

export interface ApplicationDescriptionPreview {
  paragraphs?: string[];
  affidavitText?: string | null;
  prayerText?: string | null;
}

/** Normalized application block from GET …/preview (advocate / party / officer-aligned). */
export interface ApplicationPreviewApplication {
  applicationId: number;
  applicationNo: string;
  clientApplicationRef?: string;
  caseId?: number | null;
  caseNo?: string | null;
  caseCategoryId?: number;
  caseCategoryName?: string;
  status: string;
  processingStage?: string;
  processingStageLabel?: string;
  currentAssigneeRole?: string | null;
  officeId?: number;
  officeName?: string;
  subjectId?: number;
  subjectName?: string;
  applicationDescription?: string | null;
  filedByName?: string;
  filedByRole?: string;
  createdAt?: string;
  updatedAt?: string;
  submittedAt?: string | null;
  form?: Record<string, unknown>;
  disputedOrder?: Record<string, unknown>;
  applicants?: Record<string, unknown>[];
  respondents?: Record<string, unknown>[];
  disputedLands?: Record<string, unknown>[];
  attachments?: Record<string, unknown>[];
  description?: ApplicationDescriptionPreview;
}

export interface ApplicationPreviewResponse {
  application: ApplicationPreviewApplication;
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
    return this.http.post<FilingApplicationSaveResponse>(
      `${this.apiBaseUrl}${RCCMS_API.filingApplications.save}`,
      request
    );
  }

  /** GET /api/filing-applications/mine — advocate/party application list */
  getMyApplications(): Observable<MyApplicationItem[]> {
    return this.http.get<MyApplicationItem[]>(
      `${this.apiBaseUrl}${RCCMS_API.filingApplications.mine}`
    );
  }

  /** GET /api/filing-applications/{applicationId}/preview — advocate/party */
  getApplicationPreview(applicationId: number): Observable<ApplicationPreviewResponse> {
    return this.http
      .get<unknown>(`${this.apiBaseUrl}${RCCMS_API.filingApplications.preview(applicationId)}`)
      .pipe(map((raw) => normalizeApplicationPreviewResponse(raw)));
  }

  /** GET /api/filing-applications/officer/{applicationId}/preview — officer */
  getOfficerApplicationPreview(applicationId: number): Observable<ApplicationPreviewResponse> {
    return this.http
      .get<unknown>(
        `${this.apiBaseUrl}${RCCMS_API.filingApplications.officerPreview(applicationId)}`
      )
      .pipe(map((raw) => normalizeApplicationPreviewResponse(raw)));
  }

  /** Role-aware preview (advocate/party vs officer). */
  getApplicationPreviewForRole(
    applicationId: number,
    asOfficer: boolean
  ): Observable<ApplicationPreviewResponse> {
    return asOfficer
      ? this.getOfficerApplicationPreview(applicationId)
      : this.getApplicationPreview(applicationId);
  }

  /** GET /api/filing-applications/{applicationId}/history — advocate/party */
  getApplicationHistory(applicationId: number): Observable<ApplicationHistoryResponse> {
    return this.http.get<ApplicationHistoryResponse>(
      `${this.apiBaseUrl}${RCCMS_API.filingApplications.history(applicationId)}`
    );
  }

  /** GET /api/filing-applications/officer/{applicationId}/history — officer */
  getOfficerApplicationHistory(applicationId: number): Observable<ApplicationHistoryResponse> {
    return this.http.get<ApplicationHistoryResponse>(
      `${this.apiBaseUrl}${RCCMS_API.filingApplications.officerHistory(applicationId)}`
    );
  }

  getApplicationHistoryForRole(
    applicationId: number,
    asOfficer: boolean
  ): Observable<ApplicationHistoryResponse> {
    return asOfficer
      ? this.getOfficerApplicationHistory(applicationId)
      : this.getApplicationHistory(applicationId);
  }
}
