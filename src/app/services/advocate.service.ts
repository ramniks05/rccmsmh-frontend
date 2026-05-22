import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export type AdvocateGender = 'MALE' | 'FEMALE' | 'OTHER';

/** GET /api/advocates/me/profile */
export interface AdvocateProfile {
  id?: number;
  userType?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fullName?: string;
  mobileNumber?: string;
  email?: string;
  gender?: AdvocateGender | string;
  pinCode?: string;
  stateId?: number | null;
  stateName?: string | null;
  districtId?: number | null;
  districtName?: string | null;
  subdistrictId?: number | null;
  subdistrictName?: string | null;
  village?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressLine3?: string | null;
  address?: string | null;
  profileComplete?: boolean;
  barEnrollmentState?: string;
  barEnrollmentStateName?: string;
  barEnrollmentYear?: number;
  barEnrollmentNumber?: string;
  placeOfPracticeState?: string;
  placeOfPracticeStateName?: string;
  placeOfPracticeDistrict?: string;
  placeOfPracticeDistrictName?: string;
  barEnrollmentCertificateStorageKey?: string;
  barEnrollmentCertificateFileName?: string;
  barEnrollmentCertificateUploaded?: boolean;
  lawFirmName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type AdvocateProfileUpdateRequest = Omit<
  AdvocateProfile,
  'id' | 'fullName' | 'profileComplete' | 'userType' | 'address' | 'createdAt' | 'updatedAt'
>;

@Injectable({
  providedIn: 'root'
})
export class AdvocateService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  getMyProfile(): Observable<AdvocateProfile> {
    return this.http.get<AdvocateProfile>(`${this.apiBaseUrl}/api/advocates/me/profile`);
  }

  updateMyProfile(payload: AdvocateProfileUpdateRequest): Observable<AdvocateProfile> {
    return this.http.put<AdvocateProfile>(`${this.apiBaseUrl}/api/advocates/me/profile`, payload);
  }
}
