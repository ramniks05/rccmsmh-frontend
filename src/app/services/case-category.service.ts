import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface CaseCategoryRecord {
  id: number;
  code: string;
  name: string;
  localName: string | null;
  sequenceNo: number;
  hearingOfficeTypeId: number | null;
  hearingOfficeTypeName: string | null;
  hearingOfficeTypeLocalName: string | null;
  nextCaseCategoryId: number | null;
  nextCaseCategoryCode: string | null;
  nextCaseCategoryName: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class CaseCategoryService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  listCaseCategories(): Observable<CaseCategoryRecord[]> {
    return this.http.get<CaseCategoryRecord[]>(`${this.apiBaseUrl}/api/case-categories`);
  }

  getCaseCategory(id: number): Observable<CaseCategoryRecord> {
    return this.http.get<CaseCategoryRecord>(`${this.apiBaseUrl}/api/case-categories/${id}`);
  }
}

