import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { AdvocateProfile } from './advocate.service';

export type UserRole = 'ADVOCATE' | 'PARTY_IN_PERSON' | 'PARTY_IN_PERSON_REPRESENTATIVE';
export type LoginRole = UserRole | 'OFFICER' | 'ADMIN';

export interface AdvocateRegistrationRequest {
  role: 'ADVOCATE';
  firstName: string;
  middleName?: string;
  lastName: string;
  /** State LGD code from master lookup (not display name). */
  barEnrollmentState: string;
  barEnrollmentYear: number;
  barEnrollmentNumber: string;
  /** State LGD code from master lookup (not display name). */
  placeOfPracticeState: string;
  /** District LGD code from master lookup (not display name). */
  placeOfPracticeDistrict: string;
  mobileNumber: string;
  email: string;
  password: string;
  barEnrollmentCertificateStorageKey: string;
  barEnrollmentCertificateFileName: string;
}

export interface PartyRegistrationRequest {
  role: 'PARTY_IN_PERSON' | 'PARTY_IN_PERSON_REPRESENTATIVE';
  fullName: string;
  email: string;
  mobileNumber: string;
  /** Composed from address lines + locality (required by API). */
  address: string;
  password: string;
  pinCode?: string;
  stateId?: number;
  stateName?: string;
  districtId?: number;
  districtName?: string;
  talukaName?: string;
  village?: string;
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  barCouncilNumber?: string;
  enrollmentNumber?: string;
  lawFirmName?: string;
}

export type RegistrationRequest = AdvocateRegistrationRequest | PartyRegistrationRequest;

export interface RegistrationResponse {
  id: number;
  role: UserRole;
  message: string;
  profileComplete?: boolean;
}

/** User-facing registration success text — never includes backend user id. */
export function formatRegistrationSuccessMessage(
  response: RegistrationResponse,
  fallback: string
): string {
  const raw = response.message?.trim();
  if (!raw) return fallback;
  const withoutId = raw.replace(/\s*\.?\s*User\s*ID\s*:\s*\d+\s*/gi, ' ').replace(/\s+/g, ' ').trim();
  const cleaned = withoutId.replace(/\s*\.\s*$/, '').trim();
  return cleaned || fallback;
}

export interface LoginRequest {
  role: LoginRole;
  loginId: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  role: string;
  displayName: string;
  profileComplete?: boolean;
  designationId?: number | null;
  designationName?: string | null;
  officeId?: number | null;
  officeName?: string | null;
  officeCode?: string | null;
}

/** GET /api/auth/me — advocate returns full profile including profileComplete. */
export type AuthMeResponse = AdvocateProfile & {
  role?: string;
  displayName?: string;
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  register(payload: RegistrationRequest): Observable<RegistrationResponse> {
    return this.http.post<RegistrationResponse>(`${this.apiBaseUrl}/api/registrations`, payload);
  }

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiBaseUrl}/api/auth/login`, payload);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiBaseUrl}/api/auth/logout`, {});
  }

  me(): Observable<AuthMeResponse> {
    return this.http.get<AuthMeResponse>(`${this.apiBaseUrl}/api/auth/me`);
  }
}
