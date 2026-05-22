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
    const jwtRole = this.getRoleFromToken();
    if (jwtRole) {
      this.role = jwtRole;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ROLE_KEY, jwtRole);
      }
    }
    this.isLoggedIn.set(true);
    this.refreshSessionSignals();
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRole(): string | null {
    return this.role;
  }

  getDisplayName(): string | null {
    return this.displayName;
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

  /** Bar council number from the JWT payload claim (null if not present or not an advocate). */
  getBarCouncilNumber(): string | null {
    const p = this.decodeTokenPayload();
    if (!p) return null;
    return (p['barCouncilNumber'] as string | undefined) ?? null;
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

  /** Role from JWT when login response omits or mislabels role. */
  getRoleFromToken(): string | null {
    const p = this.decodeTokenPayload();
    if (!p) return null;
    const raw =
      (p['role'] as string | undefined) ??
      (p['userType'] as string | undefined) ??
      (p['authorities'] as string[] | undefined)?.find((a) =>
        String(a).toUpperCase().includes('ADVOCATE')
      );
    return raw ? String(raw).trim() : null;
  }

  private refreshSessionSignals(): void {
    this.sessionDisplayName.set(this.displayName);
    this.sessionRole.set(this.role);
    this.sessionDesignation.set(this.designationName);
    this.sessionOfficeName.set(this.officeName);
    this.sessionIsAdvocate.set(this.computeIsAdvocate());
    this.sessionProfileComplete.set(this.profileComplete === true);
  }

  private computeIsAdvocate(): boolean {
    const stored = (this.role || '').trim().toUpperCase();
    if (stored === 'ADVOCATE') return true;
    const fromToken = (this.getRoleFromToken() || '').trim().toUpperCase();
    return fromToken === 'ADVOCATE' || fromToken.includes('ADVOCATE');
  }

  /** True when logged-in role is Officer (case-insensitive match on stored role string). */
  isOfficer(): boolean {
    return (this.role || '').trim().toUpperCase() === 'OFFICER';
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
