import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

/**
 * `GET /api/advocates/by-bar-council` success body.
 * Lookup is case-insensitive on the server; multiple matches return the row with smallest `id`.
 */
export interface AdvocateLookupResponse {
  id: number;
  fullName: string;
  email: string;
  mobileNumber: string;
  address: string;
  barCouncilNumber: string;
  enrollmentNumber: string;
  lawFirmName: string | null;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdvocateByBarCouncilService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  private static readonly PATH = '/api/advocates/by-bar-council';

  /**
   * `GET /api/advocates/by-bar-council?barCouncilNumber=...`
   * Requires `Authorization: Bearer <JWT>` (handled by `authInterceptor`).
   */
  searchByBarCouncilNumber(barCouncilNumber: string): Observable<AdvocateLookupResponse> {
    const trimmed = barCouncilNumber.trim();
    const params = new HttpParams().set('barCouncilNumber', trimmed);
    return this.http.get<AdvocateLookupResponse>(`${this.apiBaseUrl}${AdvocateByBarCouncilService.PATH}`, {
      params
    });
  }
}
