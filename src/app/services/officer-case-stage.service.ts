import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

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

export interface CaseHearingResponse {
  hearingId: number;
  caseId: number;
  caseNo: string;
  hearingNo: number;
  hearingDate: string;
  status: string;
  noticeGenerated: boolean;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseOrderSheetResponse {
  caseId: number;
  caseNo: string;
  content: string;
  updatedAt: string;
  updatedByLoginId: string;
}

export interface CaseOrderSheetHistoryResponse {
  historyId: number;
  hearingId: number | null;
  hearingNo: number | null;
  hearingDate: string | null;
  content: string;
  remarks: string | null;
  createdAt: string;
  createdByLoginId: string;
}

export interface CaseJudgmentResponse {
  caseId: number;
  caseNo: string;
  status: string;
  disposedAt: string;
  message: string;
}

export interface OfficerCaseInboxItem {
  caseId: number;
  caseNo: string;
  status: string;
  filingApplicationId: number;
  caseCategoryId: number;
  caseCategoryName: string;
  officeId: number;
  officeName: string;
  approvedAt: string;
  disposedAt: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class OfficerCaseStageService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  approveApplication(applicationId: number): Observable<OfficerApproveResponse> {
    return this.http.post<OfficerApproveResponse>(
      `${this.apiBaseUrl}/api/filing-applications/officer/${applicationId}/approve`,
      {}
    );
  }

  forwardToPo(applicationId: number, payload: { remarks: string }): Observable<OfficerAssignmentActionResponse> {
    return this.http.post<OfficerAssignmentActionResponse>(
      `${this.apiBaseUrl}/api/filing-applications/officer/${applicationId}/forward-to-po`,
      payload
    );
  }

  returnToClerk(applicationId: number, payload: { remarks: string }): Observable<OfficerAssignmentActionResponse> {
    return this.http.post<OfficerAssignmentActionResponse>(
      `${this.apiBaseUrl}/api/filing-applications/officer/${applicationId}/return-to-clerk`,
      payload
    );
  }

  rejectApplication(applicationId: number, payload: { remarks: string }): Observable<OfficerAssignmentActionResponse> {
    return this.http.post<OfficerAssignmentActionResponse>(
      `${this.apiBaseUrl}/api/filing-applications/officer/${applicationId}/reject`,
      payload
    );
  }

  scheduleHearing(caseId: number, payload: { hearingDate: string; noticeGenerate: boolean; remarks: string }): Observable<CaseHearingResponse> {
    return this.http.post<CaseHearingResponse>(`${this.apiBaseUrl}/api/cases/officer/${caseId}/hearings`, payload);
  }

  listHearings(caseId: number): Observable<CaseHearingResponse[]> {
    return this.http.get<CaseHearingResponse[]>(`${this.apiBaseUrl}/api/cases/officer/${caseId}/hearings`);
  }

  getTodayCauseList(): Observable<CaseHearingResponse[]> {
    return this.http.get<CaseHearingResponse[]>(`${this.apiBaseUrl}/api/cases/officer/hearings/today`);
  }

  upsertOrderSheet(caseId: number, payload: { hearingId?: number | null; content: string; remarks: string }): Observable<CaseOrderSheetResponse> {
    return this.http.put<CaseOrderSheetResponse>(`${this.apiBaseUrl}/api/cases/officer/${caseId}/ordersheet`, payload);
  }

  getCurrentOrderSheet(caseId: number): Observable<CaseOrderSheetResponse> {
    return this.http.get<CaseOrderSheetResponse>(`${this.apiBaseUrl}/api/cases/officer/${caseId}/ordersheet`);
  }

  getOrderSheetHistory(caseId: number): Observable<CaseOrderSheetHistoryResponse[]> {
    return this.http.get<CaseOrderSheetHistoryResponse[]>(`${this.apiBaseUrl}/api/cases/officer/${caseId}/ordersheet/history`);
  }

  passFinalJudgment(caseId: number, payload: { judgmentSummary: string }): Observable<CaseJudgmentResponse> {
    return this.http.post<CaseJudgmentResponse>(`${this.apiBaseUrl}/api/cases/officer/${caseId}/judgment`, payload);
  }

  getCaseInbox(status?: string): Observable<OfficerCaseInboxItem[]> {
    return this.http.get<OfficerCaseInboxItem[]>(`${this.apiBaseUrl}/api/cases/officer/inbox`, {
      params: status ? { status } : {}
    });
  }
}
