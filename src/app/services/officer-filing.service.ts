import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { RCCMS_API } from '../core/rccms-api.paths';
import { environment } from '../../environments/environment';
import { normalizeApplicationPreviewResponse } from '../shared/application-preview.util';
import { normalizeOfficerInboxResponse } from '../shared/officer-role.util';
import {
  ApplicationHistoryResponse,
  ApplicationPreviewResponse
} from './filing-application.service';
import { DocumentChecklist } from './mapped-documents.service';

export interface OfficerInboxItem {
  applicationId: number;
  applicationNo?: string;
  caseId?: number | null;
  clientApplicationRef: string;
  caseCategoryId: number;
  caseCategoryName: string;
  subjectId: number;
  subjectName: string;
  officeId: number;
  officeName: string;
  status: 'SUBMITTED' | string;
  applicationDescription: string | null;
  filedByName: string;
  filedByRole: string;
  submittedAt: string;
  createdAt: string;
  processingStage?: string;
  currentAssigneeRole?: 'CLERK' | 'PRESIDING_OFFICER' | string;
}

export interface OfficerApplicationDetail {
  applicationId: number;
  applicationNo?: string;
  caseId?: number | null;
  caseNo?: string | null;
  clientApplicationRef: string;
  caseCategoryId: number;
  caseCategoryName: string;
  status: string;
  officeId: number;
  officeName: string;
  subjectId: number;
  subjectName: string;
  applicationDescription: string | null;
  filedByName: string;
  filedByRole: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string;
  form?: Record<string, unknown>;
  disputedOrder?: unknown;
  applicants?: unknown[];
  respondents?: unknown[];
  disputedLands?: unknown[];
  attachments?: unknown[];
  processingStage?: string;
  processingStageLabel?: string;
  currentAssigneeRole?: 'CLERK' | 'PRESIDING_OFFICER' | string;
  applicationHistory?: ApplicationHistoryResponse;
  documentChecklist?: DocumentChecklist | null;
}

@Injectable({
  providedIn: 'root'
})
export class OfficerFilingService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  getInbox(): Observable<OfficerInboxItem[]> {
    return this.http
      .get<unknown>(`${this.apiBaseUrl}${RCCMS_API.filingApplications.officerInbox}`)
      .pipe(map((raw) => normalizeOfficerInboxResponse(raw)));
  }

  /** GET /api/filing-applications/officer/{applicationId} — officer workspace detail */
  getApplicationDetail(applicationId: number): Observable<OfficerApplicationDetail> {
    return this.http.get<OfficerApplicationDetail>(
      `${this.apiBaseUrl}${RCCMS_API.filingApplications.officerDetail(applicationId)}`
    );
  }

  /** GET /api/filing-applications/officer/{applicationId}/preview */
  getApplicationPreview(applicationId: number): Observable<ApplicationPreviewResponse> {
    return this.http
      .get<unknown>(
        `${this.apiBaseUrl}${RCCMS_API.filingApplications.officerPreview(applicationId)}`
      )
      .pipe(map((raw) => normalizeApplicationPreviewResponse(raw)));
  }

  /** GET /api/filing-applications/officer/{applicationId}/history */
  getApplicationHistory(applicationId: number): Observable<ApplicationHistoryResponse> {
    return this.http.get<ApplicationHistoryResponse>(
      `${this.apiBaseUrl}${RCCMS_API.filingApplications.officerHistory(applicationId)}`
    );
  }
}
