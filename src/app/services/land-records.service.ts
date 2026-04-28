import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
}

