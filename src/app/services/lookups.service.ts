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
  divisionCode: string | null;
  districtId: number | null;
  talukaId: number | null;
}

export type OfficeLevel = 'STATE' | 'DIVISION' | 'DISTRICT' | 'TALUKA' | 'VILLAGE';

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

export interface PincodePostOffice {
  name: string;
  block: string;
  district: string;
  state: string;
  value: string;
}

export interface PincodeLookupResponse {
  pincode: string;
  status: string;
  message: string;
  postOffices: PincodePostOffice[];
  talukas: string[];
  districts: string[];
  states: string[];
}

export interface OccupationLookupResponse {
  id: number;
  name: string;
  localName: string | null;
  shortName: string | null;
  shortNameLocal: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class LookupsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  getStates(): Observable<BoundaryMasterResponse[]> {
    return this.http.get<BoundaryMasterResponse[]>(`${this.apiBaseUrl}/api/lookups/states`);
  }

  getDivisions(stateId: number): Observable<BoundaryMasterResponse[]> {
    return this.http.get<BoundaryMasterResponse[]>(`${this.apiBaseUrl}/api/lookups/divisions`, {
      params: { stateId }
    });
  }

  getDistricts(stateId: number, divisionCode?: string): Observable<BoundaryMasterResponse[]> {
    const params: Record<string, string | number> = { stateId };
    if (divisionCode?.trim()) {
      params['divisionCode'] = divisionCode.trim();
    }
    return this.http.get<BoundaryMasterResponse[]>(`${this.apiBaseUrl}/api/lookups/districts`, {
      params
    });
  }

  getTalukas(districtId: number): Observable<BoundaryMasterResponse[]> {
    return this.http.get<BoundaryMasterResponse[]>(`${this.apiBaseUrl}/api/lookups/talukas`, {
      params: { districtId }
    });
  }

  getVillages(talukaId: number): Observable<BoundaryMasterResponse[]> {
    return this.http.get<BoundaryMasterResponse[]>(`${this.apiBaseUrl}/api/lookups/villages`, {
      params: { talukaId }
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

  getPincodeDetails(pincode: string): Observable<PincodeLookupResponse> {
    return this.http.get<PincodeLookupResponse>(`${this.apiBaseUrl}/api/lookups/pincode-details`, {
      params: { pincode }
    });
  }

  getOccupations(): Observable<OccupationLookupResponse[]> {
    return this.http.get<OccupationLookupResponse[]>(`${this.apiBaseUrl}/api/lookups/occupations`);
  }
}
