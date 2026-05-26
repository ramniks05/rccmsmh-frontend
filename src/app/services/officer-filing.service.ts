import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { ApplicationHistoryResponse } from './filing-application.service';
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
    return this.http.get<OfficerInboxItem[]>(`${this.apiBaseUrl}/api/filing-applications/officer/inbox`);
  }

  getApplicationDetail(applicationId: number): Observable<OfficerApplicationDetail> {
    return this.http.get<OfficerApplicationDetail>(
      `${this.apiBaseUrl}/api/filing-applications/officer/${applicationId}`
    );
  }

  /** GET /api/filing-applications/officer/{applicationId}/history */
  getApplicationHistory(applicationId: number): Observable<ApplicationHistoryResponse> {
    return this.http.get<ApplicationHistoryResponse>(
      `${this.apiBaseUrl}/api/filing-applications/officer/${applicationId}/history`
    );
  }
}
