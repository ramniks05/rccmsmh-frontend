import { Injectable, signal } from '@angular/core';

import { LoginResponse } from './auth.service';

const ACCESS_TOKEN_KEY = 'rccms.access_token';
const ROLE_KEY = 'rccms.role';
const DISPLAY_NAME_KEY = 'rccms.display_name';
const DESIGNATION_NAME_KEY = 'rccms.designation_name';
const DESIGNATION_ID_KEY = 'rccms.designation_id';
const OFFICE_ID_KEY = 'rccms.office_id';
const OFFICE_NAME_KEY = 'rccms.office_name';
const OFFICE_CODE_KEY = 'rccms.office_code';
const PROFILE_COMPLETE_KEY = 'rccms.profile_complete';
/** Treat token as expired slightly before JWT `exp` to avoid race with the server. */
const SESSION_EXPIRY_SKEW_MS = 30_000;

@Injectable({
  providedIn: 'root'
})
export class TokenStorageService {
  private accessToken: string | null = null;
  private role: string | null = null;
  private displayName: string | null = null;
  private designationName: string | null = null;
  private designationId: number | null = null;
  private officeId: number | null = null;
  private officeName: string | null = null;
  private officeCode: string | null = null;
  private profileComplete: boolean | null = null;

  /** Reactive signal — true when a valid session token is present. */
  readonly isLoggedIn = signal(false);
  readonly sessionDisplayName = signal<string | null>(null);
  readonly sessionRole = signal<string | null>(null);
  readonly sessionDesignation = signal<string | null>(null);
  readonly sessionOfficeName = signal<string | null>(null);
  readonly sessionIsAdvocate = signal(false);
  readonly sessionProfileComplete = signal(false);

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      this.role = localStorage.getItem(ROLE_KEY);
      this.displayName = localStorage.getItem(DISPLAY_NAME_KEY);
      this.designationName = localStorage.getItem(DESIGNATION_NAME_KEY);
      this.officeName = localStorage.getItem(OFFICE_NAME_KEY);
      this.officeCode = localStorage.getItem(OFFICE_CODE_KEY);
      const storedDesigId = localStorage.getItem(DESIGNATION_ID_KEY);
      this.designationId = storedDesigId ? Number(storedDesigId) : null;
      const storedOfficeId = localStorage.getItem(OFFICE_ID_KEY);
      this.officeId = storedOfficeId ? Number(storedOfficeId) : null;
      const storedProfile = localStorage.getItem(PROFILE_COMPLETE_KEY);
      this.profileComplete = storedProfile === null ? null : storedProfile === 'true';
    }
    if (this.accessToken) {
      if (this.isSessionExpired()) {
        this.clear();
      } else {
        this.syncClaimsFromJwt();
      }
    }
    this.isLoggedIn.set(!!this.accessToken);
    this.refreshSessionSignals();
  }

  saveSession(response: LoginResponse): void {
    this.accessToken = response.accessToken;
    this.role = response.role;
    this.displayName = response.displayName;
    if (response.profileComplete !== undefined) {
      this.profileComplete = response.profileComplete;
    }
    this.designationName = response.designationName ?? null;
    this.designationId = response.designationId ?? null;
    this.officeId = response.officeId ?? null;
    this.officeName = response.officeName ?? null;
    this.officeCode = response.officeCode ?? null;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
      localStorage.setItem(ROLE_KEY, response.role);
      localStorage.setItem(DISPLAY_NAME_KEY, response.displayName);
      this.setOrRemove(DESIGNATION_NAME_KEY, this.designationName);
      this.setOrRemove(DESIGNATION_ID_KEY, this.designationId != null ? String(this.designationId) : null);
      this.setOrRemove(OFFICE_ID_KEY, this.officeId != null ? String(this.officeId) : null);
      this.setOrRemove(OFFICE_NAME_KEY, this.officeName);
      this.setOrRemove(OFFICE_CODE_KEY, this.officeCode);
      if (this.profileComplete !== null) {
        this.setOrRemove(PROFILE_COMPLETE_KEY, this.profileComplete ? 'true' : 'false');
      }
    }
    this.syncClaimsFromJwt();
    this.isLoggedIn.set(true);
    this.refreshSessionSignals();
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  /** JWT `exp` claim as epoch milliseconds, or null when absent / unreadable. */
  getTokenExpiresAtMs(): number | null {
    const payload = this.decodeTokenPayload();
    if (!payload) return null;

    const exp = payload['exp'];
    if (typeof exp === 'number' && Number.isFinite(exp)) {
      return exp * 1000;
    }
    if (typeof exp === 'string') {
      const parsed = Number(exp);
      return Number.isFinite(parsed) ? parsed * 1000 : null;
    }
    return null;
  }

  isSessionExpired(skewMs = SESSION_EXPIRY_SKEW_MS): boolean {
    if (!this.accessToken) return true;

    const expMs = this.getTokenExpiresAtMs();
    if (expMs === null) return false;

    return Date.now() >= expMs - skewMs;
  }

  hasValidSession(): boolean {
    return !!this.accessToken && !this.isSessionExpired();
  }

  /** JWT `role` claim, else value from login response. */
  getRole(): string | null {
    return this.jwtStringClaim('role') ?? this.role;
  }

  /** JWT `name` claim, else login `displayName`. */
  getDisplayName(): string | null {
    return this.jwtStringClaim('name') ?? this.displayName;
  }

  /** Decodes the JWT payload (no verification — client-side display only). */
  private decodeTokenPayload(): Record<string, unknown> | null {
    const token = this.accessToken;
    if (!token) return null;
    try {
      const base64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/') ?? '';
      return JSON.parse(atob(base64)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private jwtStringClaim(...keys: string[]): string | null {
    const p = this.decodeTokenPayload();
    if (!p) return null;
    for (const key of keys) {
      const raw = p[key];
      if (typeof raw === 'string' && raw.trim()) return raw.trim();
    }
    return null;
  }

  /** JWT `barEnrollmentNumber` claim (e.g. MAH/2026/1234). */
  getBarEnrollmentNumber(): string | null {
    return this.jwtStringClaim('barEnrollmentNumber');
  }

  /** Alias used by advocate lookup (`GET /api/advocates/by-bar-council`). */
  getBarCouncilNumber(): string | null {
    return this.getBarEnrollmentNumber();
  }

  /**
   * Copies JWT session claims into stored role/display name for UI and reload.
   * Expected advocate payload: `{ role, name, barEnrollmentNumber }`.
   */
  private syncClaimsFromJwt(): void {
    const jwtRole = this.jwtStringClaim('role');
    const jwtName = this.jwtStringClaim('name');
    if (jwtRole) {
      this.role = jwtRole;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ROLE_KEY, jwtRole);
      }
    }
    if (jwtName) {
      this.displayName = jwtName;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DISPLAY_NAME_KEY, jwtName);
      }
    }
  }

  getDesignationName(): string | null { return this.designationName; }
  getDesignationId(): number | null { return this.designationId; }
  getOfficeId(): number | null { return this.officeId; }
  getOfficeName(): string | null { return this.officeName; }
  getOfficeCode(): string | null { return this.officeCode; }

  private setOrRemove(key: string, value: string | null): void {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  }

  setProfileComplete(complete: boolean): void {
    this.profileComplete = complete;
    if (typeof localStorage !== 'undefined') {
      this.setOrRemove(PROFILE_COMPLETE_KEY, complete ? 'true' : 'false');
    }
    this.sessionProfileComplete.set(complete);
  }

  /** True when advocate profile is complete; null/unknown treated as incomplete for advocates. */
  isProfileComplete(): boolean {
    return this.profileComplete === true;
  }

  /** True when logged-in role is Advocate (stored role or JWT userType/role claim). */
  isAdvocate(): boolean {
    return this.computeIsAdvocate();
  }

  /** Role from JWT (`role` claim). */
  getRoleFromToken(): string | null {
    return this.jwtStringClaim('role');
  }

  private refreshSessionSignals(): void {
    this.sessionDisplayName.set(this.getDisplayName());
    this.sessionRole.set(this.getRole());
    this.sessionDesignation.set(this.designationName);
    this.sessionOfficeName.set(this.officeName);
    this.sessionIsAdvocate.set(this.computeIsAdvocate());
    this.sessionProfileComplete.set(this.profileComplete === true);
  }

  private computeIsAdvocate(): boolean {
    const r = (this.getRole() || '').trim().toUpperCase();
    return r === 'ADVOCATE';
  }

  /** True when logged-in role is Officer (JWT `role` or stored role). */
  isOfficer(): boolean {
    return (this.getRole() || '').trim().toUpperCase() === 'OFFICER';
  }

  /** PO = designation id 1, or name contains presiding / PO. */
  isPresidingOfficer(): boolean {
    if (this.getDesignationId() === 1) return true;
    const d = String(this.getDesignationName() || '').toLowerCase();
    return d.includes('presid') || d === 'po' || d.includes('presiding');
  }

  isClerkOfficer(): boolean {
    return this.isOfficer() && !this.isPresidingOfficer();
  }

  clear(): void {
    this.accessToken = null;
    this.role = null;
    this.displayName = null;
    this.designationName = null;
    this.designationId = null;
    this.officeId = null;
    this.officeName = null;
    this.officeCode = null;
    this.profileComplete = null;
    if (typeof localStorage !== 'undefined') {
      [ACCESS_TOKEN_KEY, ROLE_KEY, DISPLAY_NAME_KEY,
       DESIGNATION_NAME_KEY, DESIGNATION_ID_KEY,
       OFFICE_ID_KEY, OFFICE_NAME_KEY, OFFICE_CODE_KEY, PROFILE_COMPLETE_KEY
      ].forEach(k => localStorage.removeItem(k));
    }
    this.isLoggedIn.set(false);
    this.sessionDisplayName.set(null);
    this.sessionRole.set(null);
    this.sessionDesignation.set(null);
    this.sessionOfficeName.set(null);
    this.sessionIsAdvocate.set(false);
    this.sessionProfileComplete.set(false);
  }
}
