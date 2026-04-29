import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface BoundaryMasterResponse {
  id: number;
  name: string;
  localName: string | null;
  lgdCode: string | null;
  stateId: number | null;
  divisionId: number | null;
  districtId: number | null;
  subdistrictId?: number | null;
  talukaId: number | null;
}

export type OfficeLevel = 'STATE' | 'DIVISION' | 'DISTRICT' | 'SUBDISTRICT' | 'TALUKA' | 'VILLAGE';

export interface OfficeResponse {
  id: number;
  departmentId: number;
  departmentName?: string | null;
  departmentLocalName?: string | null;
  officeTypeId: number;
  officeTypeName?: string | null;
  officeTypeLocalName?: string | null;
  level: OfficeLevel;
  locationId: number;
  name: string;
  localName: string | null;
  shortName: string | null;
  shortNameLocal: string | null;
}

export interface ActLookupResponse {
  id: number;
  actCode: string;
  actName: string;
  actNameLocal: string | null;
}

export interface SectionLookupResponse {
  id: number;
  actId: number;
  actCode: string;
  actName: string;
  actNameLocal: string | null;
  sectionCode: string;
  sectionName: string;
  sectionNameLocal: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class LookupsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  getDistricts(stateId: number, divisionId?: number): Observable<BoundaryMasterResponse[]> {
    return this.http.get<BoundaryMasterResponse[]>(`${this.apiBaseUrl}/api/lookups/districts`, {
      params: divisionId ? { stateId, divisionId } : { stateId }
    });
  }

  getSubdistricts(districtId: number): Observable<BoundaryMasterResponse[]> {
    return this.http.get<BoundaryMasterResponse[]>(`${this.apiBaseUrl}/api/lookups/subdistricts`, {
      params: { districtId }
    });
  }

  getTalukas(districtId: number, subdistrictId?: number): Observable<BoundaryMasterResponse[]> {
    return this.http.get<BoundaryMasterResponse[]>(`${this.apiBaseUrl}/api/lookups/talukas`, {
      params: subdistrictId ? { districtId, subdistrictId } : { districtId }
    });
  }

  getOffices(level: OfficeLevel, locationId: number, departmentId?: number): Observable<OfficeResponse[]> {
    return this.http.get<OfficeResponse[]>(`${this.apiBaseUrl}/api/lookups/offices`, {
      params: departmentId ? { level, locationId, departmentId } : { level, locationId }
    });
  }

  getTalukaOffices(talukaId: number, departmentId?: number): Observable<OfficeResponse[]> {
    return this.http.get<OfficeResponse[]>(`${this.apiBaseUrl}/api/lookups/offices/by-taluka`, {
      params: departmentId ? { talukaId, departmentId } : { talukaId }
    });
  }

  getActs(): Observable<ActLookupResponse[]> {
    return this.http.get<ActLookupResponse[]>(`${this.apiBaseUrl}/api/lookups/acts`);
  }

  getSections(actId?: number): Observable<SectionLookupResponse[]> {
    return this.http.get<SectionLookupResponse[]>(`${this.apiBaseUrl}/api/lookups/sections`, {
      params: actId ? { actId } : {}
    });
  }
}

