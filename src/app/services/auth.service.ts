import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export type UserRole = 'ADVOCATE' | 'PARTY_IN_PERSON' | 'PARTY_IN_PERSON_REPRESENTATIVE';
export type LoginRole = UserRole | 'OFFICER' | 'ADMIN';

export interface RegistrationRequest {
  role: UserRole;
  fullName: string;
  email: string;
  mobileNumber: string;
  address: string;
  password: string;
  barCouncilNumber?: string;
  enrollmentNumber?: string;
  lawFirmName?: string;
}

export interface RegistrationResponse {
  id: number;
  role: UserRole;
  message: string;
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
}

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

  me(): Observable<unknown> {
    return this.http.get<unknown>(`${this.apiBaseUrl}/api/auth/me`);
  }
}
