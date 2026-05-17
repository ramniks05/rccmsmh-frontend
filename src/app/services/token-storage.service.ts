import { Injectable } from '@angular/core';

import { LoginResponse } from './auth.service';

const ACCESS_TOKEN_KEY = 'rccms.access_token';
const ROLE_KEY = 'rccms.role';
const DISPLAY_NAME_KEY = 'rccms.display_name';

@Injectable({
  providedIn: 'root'
})
export class TokenStorageService {
  private accessToken: string | null = null;
  private role: string | null = null;
  private displayName: string | null = null;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      this.role = localStorage.getItem(ROLE_KEY);
      this.displayName = localStorage.getItem(DISPLAY_NAME_KEY);
    }
  }

  saveSession(response: LoginResponse): void {
    this.accessToken = response.accessToken;
    this.role = response.role;
    this.displayName = response.displayName;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
      localStorage.setItem(ROLE_KEY, response.role);
      localStorage.setItem(DISPLAY_NAME_KEY, response.displayName);
    }
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

  /** True when logged-in role is Advocate (case-insensitive match on stored role string). */
  isAdvocate(): boolean {
    return (this.role || '').trim().toUpperCase() === 'ADVOCATE';
  }

  /** True when logged-in role is Officer (case-insensitive match on stored role string). */
  isOfficer(): boolean {
    return (this.role || '').trim().toUpperCase() === 'OFFICER';
  }

  clear(): void {
    this.accessToken = null;
    this.role = null;
    this.displayName = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(ROLE_KEY);
      localStorage.removeItem(DISPLAY_NAME_KEY);
    }
  }
}
