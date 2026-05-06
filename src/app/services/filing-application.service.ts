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

@Injectable({
  providedIn: 'root'
})
export class FilingApplicationService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  save(request: FilingApplicationSaveRequest): Observable<FilingApplicationSaveResponse> {
    return this.http.post<FilingApplicationSaveResponse>(`${this.apiBaseUrl}/api/filing-applications/save`, request);
  }
}
