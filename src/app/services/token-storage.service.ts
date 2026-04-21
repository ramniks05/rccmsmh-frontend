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
