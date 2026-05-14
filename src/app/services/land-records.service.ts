import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';

export interface RuralDistrict {
  district_code: string;
  district_name: string;
  lgd_dist_code?: string;
}

export interface RuralTaluka {
  taluka_code: string;
  taluka_name: string;
  lgd_taluka_code?: string;
}

export interface RuralVillage {
  ccode?: string;
  district_code: string;
  taluka_code: string;
  village_name: string;
  lgd_village_code: string;
}

export interface RuralSubSurveyRow {
  pin: string;
  pin1: string;
  pin2: string;
  pin3: string;
  pin4: string;
  pin5: string;
  pin6: string;
  pin7: string;
  pin8: string;
}

export interface UrbanDistrict {
  district_code: string;
  district_name: string;
}

export interface UrbanOffice {
  office_code: string;
  office_name: string;
  office_english_name: string;
}

export interface UrbanVillage {
  village_lgd_code: string;
  village_code: string;
  village_name: string;
  village_english_name: string;
  zone_code?: number;
  amount?: string;
}

export interface UrbanCtsRow {
  cts_no: string;
  new_cts_numb_2000?: string;
}

export interface NoticeNineViewResponse {
  type?: string;
  /** URL to view/download Notice 9. */
  notice9Url?: string;
  url?: string;
  fileUrl?: string;
  dataUrl?: string;
  mimeType?: string;
  base64?: string;
}

export interface UrbanMutationDetailResponse {
  inward_number?: string;
  inward_date?: string;
  mutation_number?: string;
  mutation_date?: string;
  mutation_type_code?: string;
  mutation_type_description?: string;
  /** Some backends use `its_code`, others `sts_code`. */
  its_code?: string;
  sts_code?: string;
  status_description?: string;
  notice9_dispatch_date?: string;
  notice9_dispatch_number?: string;
  village_code?: string;
  tenure?: string;
  tenure_naz?: string;
  tenure_area?: string;
  applicant_name?: string;
  mobile_number?: string;
  email_id?: string;
  cts_number?: string;
  state_name?: string;
  district_name?: string;
  taluka?: string;
  city?: string;
  address?: string;
  pin_code?: string;
}

/** Wrapped mutation-detail payload from backend gateway. */
export interface UrbanMutationDetailEnvelope {
  status?: number;
  httpStatus?: number;
  data?: UrbanMutationDetailResponse[];
  service_request_inputs?: unknown[];
}

export interface UrbanMutationListRow {
  inward_number: string;
  mutation_number?: string;
  mutation_date?: string;
  applicant_name?: string;
}

/** Mutation type master row for a village (ePICS mutation-type search path). */
export interface UrbanMutationTypeOption {
  code: string;
  name: string;
}

/**
 * Frontend must NOT call Mahabhumi APIs directly (secrets + decryption).
 * This service targets backend-proxy endpoints under our own API.
 */
@Injectable({ providedIn: 'root' })
export class LandRecordsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  getRuralDistricts(): Observable<RuralDistrict[]> {
    return this.http.get<RuralDistrict[]>(`${this.apiBaseUrl}/api/land-records/rural/districts`);
  }

  getRuralTalukas(districtCode: string): Observable<RuralTaluka[]> {
    return this.http.get<RuralTaluka[]>(`${this.apiBaseUrl}/api/land-records/rural/talukas`, {
      params: { districtCode }
    });
  }

  getRuralVillages(districtCode: string, talukaCode: string): Observable<RuralVillage[]> {
    return this.http.get<RuralVillage[]>(`${this.apiBaseUrl}/api/land-records/rural/villages`, {
      params: { districtCode, talukaCode }
    });
  }

  getRuralSubSurveyList(villageLgdCode: string, pin: string): Observable<RuralSubSurveyRow[]> {
    return this.http.get<RuralSubSurveyRow[]>(`${this.apiBaseUrl}/api/land-records/rural/sub-survey-list`, {
      params: { villageLgdCode, pin }
    });
  }

  getUrbanDistricts(): Observable<UrbanDistrict[]> {
    return this.http.get<UrbanDistrict[]>(`${this.apiBaseUrl}/api/land-records/urban/districts`);
  }

  getUrbanOffices(districtCode: string): Observable<UrbanOffice[]> {
    return this.http.get<UrbanOffice[]>(`${this.apiBaseUrl}/api/land-records/urban/offices`, {
      params: { districtCode }
    });
  }

  getUrbanVillages(officeCode: string): Observable<UrbanVillage[]> {
    return this.http.get<UrbanVillage[]>(`${this.apiBaseUrl}/api/land-records/urban/villages`, {
      params: { officeCode }
    });
  }

  getUrbanCtsList(villageCode: string, ctsNo?: string): Observable<UrbanCtsRow[]> {
    return this.http.get<UrbanCtsRow[]>(`${this.apiBaseUrl}/api/land-records/urban/cts-list`, {
      params: ctsNo ? { villageCode, ctsNo } : { villageCode }
    });
  }

  /** Sub-CTS options under a parent CTS (ePICS survey / CTS hierarchy). */
  getUrbanSubCtsList(villageCode: string, ctsNo: string): Observable<UrbanCtsRow[]> {
    return this.http.get<UrbanCtsRow[]>(`${this.apiBaseUrl}/api/land-records/urban/sub-cts-list`, {
      params: { villageCode, ctsNo }
    });
  }

  /**
   * Inward numbers (and related applicant/mutation fields) for a village + CTS.
   * GET /api/land-records/urban/mutations/applicant-by-cts?villageCode=&ctsNo=
   */
  getUrbanMutationsApplicantByCts(villageCode: string, ctsNo: string): Observable<UrbanMutationListRow[]> {
    return this.http
      .get<unknown>(`${this.apiBaseUrl}/api/land-records/urban/mutations/applicant-by-cts`, {
        params: { villageCode, ctsNo }
      })
      .pipe(map((raw) => this.unwrapUrbanMutationListRows(raw)));
  }

  /**
   * Mutation types for a village (ePICS “Mutation type” search).
   *
   * **Request:** `GET {apiBaseUrl}/api/land-records/urban/mutation-types?villageCode=…`
   * (e.g. dev: `GET http://localhost:8080/api/land-records/urban/mutation-types?villageCode=…`).
   * Uses the app `HttpClient`; `authInterceptor` adds `Authorization: Bearer …` when a token exists.
   *
   * Response may be a bare array or `{ data: [...] }`; rows are normalised to `{ code, name }`.
   */
  getUrbanMutationTypes(villageCode: string): Observable<UrbanMutationTypeOption[]> {
    return this.http
      .get<unknown>(`${this.apiBaseUrl}/api/land-records/urban/mutation-types`, { params: { villageCode } })
      .pipe(map((raw) => this.normalizeUrbanMutationTypesList(raw)));
  }

  /**
   * Inward list for village + mutation type (ePICS “Mutation type” path).
   * GET /api/land-records/urban/mutations/applicant-by-type?villageCode=&mutationTypeCode=
   */
  getUrbanMutationsApplicantByMutationType(
    villageCode: string,
    mutationTypeCode: string
  ): Observable<UrbanMutationListRow[]> {
    return this.http
      .get<unknown>(`${this.apiBaseUrl}/api/land-records/urban/mutations/applicant-by-type`, {
        params: { villageCode, mutationTypeCode }
      })
      .pipe(map((raw) => this.unwrapUrbanMutationListRows(raw)));
  }

  private unwrapUrbanMutationListRows(raw: unknown): UrbanMutationListRow[] {
    let list: unknown[] = [];
    if (Array.isArray(raw)) list = raw;
    else if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown[] }).data)) {
      list = (raw as { data: unknown[] }).data;
    }
    return list
      .map((item) => this.normalizeUrbanMutationListRow(item))
      .filter((r): r is UrbanMutationListRow => r != null);
  }

  private normalizeUrbanMutationListRow(item: unknown): UrbanMutationListRow | null {
    if (!item || typeof item !== 'object') return null;
    const r = item as Record<string, unknown>;
    const inward = String(r['inward_number'] ?? r['inwardNumber'] ?? '').trim();
    if (!inward) return null;
    const applicant_name = String(r['applicant_name'] ?? r['applicantName'] ?? r['name'] ?? '').trim() || undefined;
    const mutation_number = String(r['mutation_number'] ?? r['mutationNumber'] ?? '').trim() || undefined;
    const mutation_date = String(r['mutation_date'] ?? r['mutationDate'] ?? '').trim() || undefined;
    return { inward_number: inward, applicant_name, mutation_number, mutation_date };
  }

  private normalizeUrbanMutationTypesList(raw: unknown): UrbanMutationTypeOption[] {
    let rows: unknown[] = [];
    if (Array.isArray(raw)) rows = raw;
    else if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown[] }).data)) {
      rows = (raw as { data: unknown[] }).data;
    }
    const out: UrbanMutationTypeOption[] = [];
    for (const item of rows) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const code = String(
        r['code'] ?? r['mutation_type_code'] ?? r['mutationTypeCode'] ?? r['id'] ?? ''
      ).trim();
      const name = String(
        r['name'] ??
          r['mutation_type_description'] ??
          r['mutationTypeDescription'] ??
          r['label'] ??
          ''
      ).trim();
      if (!code) continue;
      out.push({ code, name: name || code });
    }
    return out;
  }

  getUrbanNoticeNineView(inwardNumber: string): Observable<NoticeNineViewResponse | string | Record<string, unknown>> {
    return this.http.get<NoticeNineViewResponse | string | Record<string, unknown>>(`${this.apiBaseUrl}/api/land-records/urban/notice-nine-view`, {
      params: { inwardNumber }
    });
  }

  getUrbanMutationDetail(inwardNumber: string): Observable<UrbanMutationDetailResponse | null> {
    return this.http
      .get<UrbanMutationDetailResponse | UrbanMutationDetailEnvelope | UrbanMutationDetailResponse[]>(
        `${this.apiBaseUrl}/api/land-records/urban/mutation-detail`,
        { params: { inwardNumber } }
      )
      .pipe(map((raw) => this.unwrapUrbanMutationDetail(raw)));
  }

  private unwrapUrbanMutationDetail(
    raw: UrbanMutationDetailResponse | UrbanMutationDetailEnvelope | UrbanMutationDetailResponse[] | null | undefined
  ): UrbanMutationDetailResponse | null {
    if (raw == null) return null;
    if (Array.isArray(raw)) {
      return raw[0] ?? null;
    }
    if (typeof raw !== 'object') return null;
    const envelope = raw as UrbanMutationDetailEnvelope;
    if (Array.isArray(envelope.data) && envelope.data.length > 0) {
      return envelope.data[0] ?? null;
    }
    const direct = raw as UrbanMutationDetailResponse;
    if (
      direct.inward_number != null ||
      direct.mutation_number != null ||
      direct.mutation_type_description != null
    ) {
      return direct;
    }
    return null;
  }
}

