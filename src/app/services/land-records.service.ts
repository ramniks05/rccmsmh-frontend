import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';

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

/**
 * Survey-wise params (village LGD + pin + pin1–pin8).
 * Used by land-detail-survey-wise, Satbara signed check, and Satbara PDF proxy.
 */
export interface RuralSurveyWiseParams {
  villageLgdCode: string;
  pin: string;
  pin1?: string;
  pin2?: string;
  pin3?: string;
  pin4?: string;
  pin5?: string;
  pin6?: string;
  pin7?: string;
  pin8?: string;
}

/** @deprecated Alias — same shape as {@link RuralSurveyWiseParams}. */
export type RuralLandDetailSurveyWiseParams = RuralSurveyWiseParams;

/** Normalised result from checkIfSatbaraIsDigitallySigned (via RCCMS proxy). */
export interface RuralSatbaraSignedCheckResult {
  digitallySigned: boolean;
  message?: string;
  raw?: Record<string, unknown>;
}

/** Decrypted Satbara PDF payload from RCCMS (base64-file). */
export interface RuralSatbaraPdfResponse {
  dataUrl: string;
  mimeType: string;
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

/** G2B land-detail-survey-wise — disabled until we wire it back in the Eferfar flow. */
export const RURAL_LAND_DETAIL_SURVEY_WISE_ENABLED = false;

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

  /**
   * Rural 7/12 / Eferfar land area details for a survey (sub-parts).
   * GET /api/land-records/rural/land-detail-survey-wise?villageLgdCode=&pin=&pin1=…
   */
  getRuralLandDetailSurveyWise(params: RuralSurveyWiseParams): Observable<Record<string, unknown>[]> {
    if (!RURAL_LAND_DETAIL_SURVEY_WISE_ENABLED) {
      return of([]);
    }
    return this.http
      .get<unknown>(`${this.apiBaseUrl}/api/land-records/rural/land-detail-survey-wise`, {
        params: this.buildRuralSurveyWiseHttpParams(params)
      })
      .pipe(map((raw) => this.unwrapRuralLandDetailRows(raw)));
  }

  /**
   * Eferfar step VI — upstream POST /eferfar/checkIfSatbaraIsDigitallySigned.
   * RCCMS: GET /api/land-records/rural/check-digitally-signed-satbara
   */
  checkRuralSatbaraDigitallySigned(params: RuralSurveyWiseParams): Observable<RuralSatbaraSignedCheckResult> {
    return this.http
      .get<unknown>(`${this.apiBaseUrl}/api/land-records/rural/check-digitally-signed-satbara`, {
        params: this.buildRuralSurveyWiseHttpParams(params)
      })
      .pipe(map((raw) => this.normalizeSatbaraSignedCheck(raw)));
  }

  /**
   * Eferfar step VII — upstream POST /eferfar/getSatbaraPDF (fallback: getDigitallySignedSatbaraPDF).
   * RCCMS: GET /api/land-records/rural/digitally-signed-satbara-pdf
   */
  getRuralDigitallySignedSatbaraPdf(params: RuralSurveyWiseParams): Observable<RuralSatbaraPdfResponse> {
    return this.http
      .get<unknown>(`${this.apiBaseUrl}/api/land-records/rural/digitally-signed-satbara-pdf`, {
        params: this.buildRuralSurveyWiseHttpParams(params)
      })
      .pipe(
        map((raw) => {
          const parsed = this.normalizeSatbaraPdfResponse(raw);
          if (!parsed) {
            if (this.responseLooksEncrypted(raw)) {
              throw new Error(
                'Satbara PDF is still encrypted. RCCMS backend must decrypt getSatbaraPDF before returning base64-file to the UI.'
              );
            }
            throw new Error('Satbara PDF response did not include a valid PDF (dataUrl or base64).');
          }
          return parsed;
        })
      );
  }

  private buildRuralSurveyWiseHttpParams(params: RuralSurveyWiseParams): HttpParams {
    let httpParams = new HttpParams()
      .set('villageLgdCode', params.villageLgdCode.trim())
      .set('pin', params.pin.trim());
    const pinKeys = ['pin1', 'pin2', 'pin3', 'pin4', 'pin5', 'pin6', 'pin7', 'pin8'] as const;
    for (const k of pinKeys) {
      const v = (params[k] ?? '').trim();
      if (v) httpParams = httpParams.set(k, v);
    }
    return httpParams;
  }

  private normalizeSatbaraSignedCheck(raw: unknown, depth = 0): RuralSatbaraSignedCheckResult {
    const empty: RuralSatbaraSignedCheckResult = { digitallySigned: false };
    if (raw == null || depth > 6) return empty;
    if (typeof raw === 'boolean') return { digitallySigned: raw };
    if (typeof raw === 'string') {
      const t = this.cleanLandRecordsText(raw).toLowerCase();
      if (t === 'true' || t === 'yes' || t === 'y' || t === '1') return { digitallySigned: true };
      if (t === 'false' || t === 'no' || t === 'n' || t === '0') return { digitallySigned: false };
      try {
        return this.normalizeSatbaraSignedCheck(JSON.parse(raw) as unknown, depth + 1);
      } catch {
        return empty;
      }
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) return empty;
    const o = raw as Record<string, unknown>;

    if (o['data'] != null) {
      const nested = this.normalizeSatbaraSignedCheck(o['data'], depth + 1);
      if (nested.digitallySigned || nested.message) return nested;
    }
    if (o['result'] != null) {
      const nested = this.normalizeSatbaraSignedCheck(o['result'], depth + 1);
      if (nested.digitallySigned || nested.message) return nested;
    }

    const signedKeys = [
      'digitallySigned',
      'digitally_signed',
      'isDigitallySigned',
      'is_digitally_signed',
      'IsDigitallySigned',
      'signed',
      'isSigned',
      'satbaraDigitallySigned',
      'satbara_digitally_signed',
      'satbara_signed',
      'is_satbara_signed'
    ];
    for (const k of signedKeys) {
      if (o[k] != null) {
        return {
          digitallySigned: this.coerceBoolean(o[k]),
          message: String(o['message'] ?? o['msg'] ?? o['Message'] ?? '').trim() || undefined,
          raw: o
        };
      }
    }
    const status = String(o['status'] ?? o['Status'] ?? '').trim().toLowerCase();
    if (status === 'signed' || status === 'yes' || status === 'true' || status === '200' || status === '1') {
      return { digitallySigned: true, message: String(o['message'] ?? o['Message'] ?? ''), raw: o };
    }
    if (status === 'unsigned' || status === 'no' || status === 'false' || status === '0') {
      return { digitallySigned: false, message: String(o['message'] ?? ''), raw: o };
    }
    return {
      digitallySigned: false,
      message: String(o['message'] ?? o['msg'] ?? o['Message'] ?? '').trim() || undefined,
      raw: o
    };
  }

  private coerceBoolean(v: unknown): boolean {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = String(v ?? '').trim().toLowerCase();
    return s === 'true' || s === 'yes' || s === 'y' || s === '1' || s === 'signed';
  }

  private normalizeSatbaraPdfResponse(raw: unknown, depth = 0): RuralSatbaraPdfResponse | null {
    if (raw == null || depth > 6) return null;

    if (typeof raw === 'string') {
      const text = this.cleanLandRecordsText(raw);
      if (!text) return null;
      if (text.startsWith('data:')) {
        return this.isPdfDataUrl(text) ? { dataUrl: text, mimeType: 'application/pdf' } : null;
      }
      if (this.isPdfBase64(text)) {
        return this.pdfResponseFromBase64(text);
      }
      try {
        const parsed = JSON.parse(text) as unknown;
        return this.normalizeSatbaraPdfResponse(parsed, depth + 1);
      } catch {
        return null;
      }
    }

    if (typeof raw !== 'object' || Array.isArray(raw)) return null;
    const o = raw as Record<string, unknown>;

    const errMsg = String(o['error'] ?? '').trim();
    if (errMsg && !o['base64'] && !o['dataUrl'] && o['data'] == null) {
      throw new Error(errMsg);
    }

    const type = String(o['type'] ?? o['Type'] ?? '').trim().toLowerCase();
    if (type === 'base64-file' || o['dataUrl'] || o['base64']) {
      const direct = this.satbaraPdfFromRecord(o);
      if (direct) return direct;
    }

    if (o['data'] != null) {
      if (typeof o['data'] === 'string') {
        const dataStr = this.cleanLandRecordsText(o['data']);
        if (this.isPdfBase64(dataStr)) {
          return this.pdfResponseFromBase64(dataStr);
        }
      } else {
        const nested = this.normalizeSatbaraPdfResponse(o['data'], depth + 1);
        if (nested) return nested;
      }
    }
    if (o['result'] != null) {
      const nested = this.normalizeSatbaraPdfResponse(o['result'], depth + 1);
      if (nested) return nested;
    }

    return this.satbaraPdfFromRecord(o);
  }

  private normalizeBase64Payload(value: string): string {
    return value
      .replace(/\\r\\n/g, '')
      .replace(/\\n/g, '')
      .replace(/\\r/g, '')
      .replace(/\s/g, '');
  }

  private isPdfBase64(value: string): boolean {
    const normalized = this.normalizeBase64Payload(value);
    if (!normalized || normalized.length < 16) return false;
    try {
      const sample = normalized.slice(0, Math.min(normalized.length, 128));
      const padLen = sample.length % 4 === 0 ? 0 : 4 - (sample.length % 4);
      const binary = atob(sample + '='.repeat(padLen));
      return binary.startsWith('%PDF');
    } catch {
      return normalized.startsWith('JVBERi');
    }
  }

  private satbaraPdfFromRecord(o: Record<string, unknown>): RuralSatbaraPdfResponse | null {
    const mimeType =
      String(o['mimeType'] ?? o['mime_type'] ?? o['contentType'] ?? 'application/pdf').trim() ||
      'application/pdf';

    const dataUrlDirect = String(o['dataUrl'] ?? o['data_url'] ?? o['dataURL'] ?? '').trim();
    if (dataUrlDirect) {
      if (dataUrlDirect.startsWith('data:') && !this.isPdfDataUrl(dataUrlDirect)) {
        return null;
      }
      return { dataUrl: dataUrlDirect, mimeType: mimeType.includes('pdf') ? mimeType : 'application/pdf' };
    }

    const contentField = String(o['content'] ?? o['Content'] ?? '').trim();
    if (contentField && this.isPdfBase64(contentField)) {
      return this.pdfResponseFromBase64(contentField, mimeType);
    }

    const base64 = String(
      o['base64'] ?? o['Base64'] ?? o['fileContent'] ?? o['file'] ?? ''
    ).trim();
    if (base64 && this.isPdfBase64(base64)) {
      return this.pdfResponseFromBase64(base64, mimeType);
    }

    return null;
  }

  private pdfResponseFromBase64(base64: string, mimeType = 'application/pdf'): RuralSatbaraPdfResponse {
    const normalized = this.normalizeBase64Payload(base64);
    const mime = mimeType.toLowerCase().includes('pdf') ? mimeType : 'application/pdf';
    return { dataUrl: `data:${mime};base64,${normalized}`, mimeType: mime };
  }

  private responseLooksEncrypted(raw: unknown): boolean {
    const candidates: string[] = [];
    const collect = (v: unknown, depth = 0) => {
      if (depth > 4 || v == null) return;
      if (typeof v === 'string') {
        candidates.push(v);
        return;
      }
      if (typeof v !== 'object' || Array.isArray(v)) return;
      const o = v as Record<string, unknown>;
      if (o['content'] != null && typeof o['content'] !== 'object') {
        candidates.push(String(o['content']));
      }
      if (o['data'] != null) collect(o['data'], depth + 1);
      if (o['base64'] != null) candidates.push(String(o['base64']));
      if (o['dataUrl'] != null) candidates.push(String(o['dataUrl']));
    };
    collect(raw);
    return candidates.some((c) => {
      const t = this.cleanLandRecordsText(c);
      if (!t) return false;
      if (t.startsWith('data:application/pdf') || t.startsWith('data:application/pdf;base64,JVBERi')) {
        return false;
      }
      if (t.startsWith('data:') && this.isPdfDataUrl(t)) return false;
      if (this.isPdfBase64(t)) return false;
      return t.length > 80 && !this.isPdfBase64(t);
    });
  }

  private isPdfDataUrl(url: string): boolean {
    const lower = url.toLowerCase();
    if (!lower.startsWith('data:')) return lower.endsWith('.pdf');
    if (!lower.startsWith('data:application/pdf')) {
      return lower.includes('base64,jvberi');
    }
    const comma = url.indexOf(',');
    if (comma < 0) return false;
    return this.isPdfBase64(url.slice(comma + 1));
  }

  private cleanLandRecordsText(value: string): string {
    let v = String(value ?? '').trim();
    if (!v) return '';
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1).trim();
    }
    return v.replace(/\\\//g, '/').trim();
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
    return this.http
      .get<unknown>(`${this.apiBaseUrl}/api/land-records/urban/cts-list`, {
        params: ctsNo ? { villageCode, ctsNo } : { villageCode }
      })
      .pipe(map((raw) => this.normalizeUrbanCtsRows(raw)));
  }

  /** Sub-CTS options under a parent CTS (ePICS survey / CTS hierarchy). */
  getUrbanSubCtsList(villageCode: string, ctsNo: string): Observable<UrbanCtsRow[]> {
    return this.http
      .get<unknown>(`${this.apiBaseUrl}/api/land-records/urban/sub-cts-list`, {
        params: { villageCode, ctsNo }
      })
      .pipe(map((raw) => this.normalizeUrbanCtsRows(raw)));
  }

  /**
   * Urban property / area details for a village + CTS (or sub-CTS).
   * GET /api/land-records/urban/property-details?village_code=&cts_no=
   */
  getUrbanPropertyDetails(villageCode: string, ctsNo: string): Observable<Record<string, unknown>[]> {
    return this.http
      .get<unknown>(`${this.apiBaseUrl}/api/land-records/urban/property-details`, {
        params: { village_code: villageCode, cts_no: ctsNo }
      })
      .pipe(map((raw) => this.unwrapUrbanPropertyDetailsRows(raw)));
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

  /** API may return `cts_no` and/or `new_cts_numb_2000` only — unify for dropdowns. */
  private normalizeUrbanCtsRows(raw: unknown): UrbanCtsRow[] {
    let list: unknown[] = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown[] }).data)) {
      list = (raw as { data: unknown[] }).data;
    }
    const out: UrbanCtsRow[] = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const newCts = String(r['new_cts_numb_2000'] ?? r['newCtsNumb2000'] ?? '').trim();
      const legacy = String(r['cts_no'] ?? r['ctsNo'] ?? '').trim();
      const value = newCts || legacy;
      if (!value) continue;
      out.push({
        cts_no: value,
        new_cts_numb_2000: newCts || legacy || undefined
      });
    }
    return out;
  }

  private unwrapRuralLandDetailRows(raw: unknown): Record<string, unknown>[] {
    if (Array.isArray(raw)) {
      return raw
        .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object' && !Array.isArray(item))
        .map((item) => item);
    }
    if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      if (Array.isArray(o['data'])) {
        return this.unwrapRuralLandDetailRows(o['data']);
      }
      if (Array.isArray(o['Land_Detail'])) {
        return this.unwrapRuralLandDetailRows(o['Land_Detail']);
      }
    }
    return [];
  }

  private unwrapUrbanPropertyDetailsRows(raw: unknown): Record<string, unknown>[] {
    let list: unknown[] = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      if (Array.isArray(o['data'])) list = o['data'] as unknown[];
      else if (Array.isArray(o['rows'])) list = o['rows'] as unknown[];
      else if (Array.isArray(o['propertyDetails'])) list = o['propertyDetails'] as unknown[];
    }
    return list
      .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object' && !Array.isArray(item))
      .map((item) => item);
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
    return this.getUrbanMutationDetailList(inwardNumber).pipe(map((list) => list[0] ?? null));
  }

  /** Returns ALL applicant rows from the mutation API response (may be more than one). */
  getUrbanMutationDetailList(inwardNumber: string): Observable<UrbanMutationDetailResponse[]> {
    return this.http
      .get<UrbanMutationDetailResponse | UrbanMutationDetailEnvelope | UrbanMutationDetailResponse[]>(
        `${this.apiBaseUrl}/api/land-records/urban/mutation-detail`,
        { params: { inwardNumber } }
      )
      .pipe(map((raw) => this.unwrapUrbanMutationDetailList(raw)));
  }

  private unwrapUrbanMutationDetailList(
    raw: UrbanMutationDetailResponse | UrbanMutationDetailEnvelope | UrbanMutationDetailResponse[] | null | undefined
  ): UrbanMutationDetailResponse[] {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw !== 'object') return [];
    const envelope = raw as UrbanMutationDetailEnvelope;
    if (Array.isArray(envelope.data)) return envelope.data.filter(Boolean);
    const direct = raw as UrbanMutationDetailResponse;
    if (
      direct.inward_number != null ||
      direct.mutation_number != null ||
      direct.mutation_type_description != null
    ) {
      return [direct];
    }
    return [];
  }
}

