import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService, LoginResponse, LoginRole } from '../../services/auth.service';
import { TokenStorageService } from '../../services/token-storage.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);

  protected loginInProgress = false;
  protected loginErrorMessage = '';
  protected showPassword = false;
  protected selectedLoginUserType: LoginRole = 'ADVOCATE';

  constructor() {
    // If already logged in, redirect to the correct dashboard immediately.
    if (this.tokenStorage.getAccessToken()) {
      void this.router.navigate([this.dashboardRoute(this.tokenStorage.getRole())]);
    }
  }

  protected readonly loginForm = this.fb.nonNullable.group({
    loginId: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  protected readonly roles: { value: LoginRole; label: string; labelMr: string; icon: string }[] = [
    { value: 'ADVOCATE', label: 'Advocate', labelMr: 'वकील', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z' },
    { value: 'PARTY_IN_PERSON', label: 'Party / Representative', labelMr: 'पक्षकार', icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
    { value: 'OFFICER', label: 'Officer', labelMr: 'अधिकारी', icon: 'M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.05 15.96 0 13.36 0c-1.46 0-2.75.63-3.64 1.63L8 3.5 6.28 1.63C5.39.63 4.1 0 2.64 0 1.06 0 0 1.06 0 2.64 0 3.12.11 3.56.18 4H0v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-9-1.75c.44-.61 1.12-1 1.89-1C14 3.25 15 4.25 15 5.5c0 .31-.06.6-.16.88L11 6.25c-.28-.47-.58-.93-.63-1.4-.01-.21.02-.41.08-.6zm9 15.75H2V8h16v12z' },
    { value: 'ADMIN', label: 'Admin', labelMr: 'प्रशासक', icon: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z' }
  ];

  protected selectRole(role: LoginRole): void {
    this.selectedLoginUserType = role;
    this.loginErrorMessage = '';
  }

  protected togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  protected loginUser(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loginInProgress = true;
    this.loginErrorMessage = '';

    const payload = {
      role: this.selectedLoginUserType,
      ...this.loginForm.getRawValue()
    };

    this.authService
      .login(payload)
      .pipe(finalize(() => (this.loginInProgress = false)))
      .subscribe({
        next: (response: LoginResponse) => {
          this.tokenStorage.saveSession(response);
          this.navigateAfterLogin(response);
        },
        error: (error: unknown) => {
          this.loginErrorMessage = this.extractApiError(error);
        }
      });
  }

  private navigateAfterLogin(response: LoginResponse): void {
    const role = (response.role || '').toUpperCase();
    if (role !== 'ADVOCATE') {
      void this.router.navigate([this.dashboardRoute(response.role)]);
      return;
    }
    if (response.profileComplete === true) {
      this.tokenStorage.setProfileComplete(true);
      void this.router.navigate(['/portal-home']);
      return;
    }
    if (response.profileComplete === false) {
      this.tokenStorage.setProfileComplete(false);
      void this.router.navigate(['/advocate/profile']);
      return;
    }
    this.authService.me().subscribe({
      next: (me) => {
        const complete = me.profileComplete === true;
        this.tokenStorage.setProfileComplete(complete);
        void this.router.navigate(complete ? ['/portal-home'] : ['/advocate/profile']);
      },
      error: () => {
        this.tokenStorage.setProfileComplete(false);
        void this.router.navigate(['/advocate/profile']);
      }
    });
  }

  /** Returns the correct landing route based on role. */
  private dashboardRoute(role: string | null): string {
    switch ((role || '').toUpperCase()) {
      case 'OFFICER':
        return '/officer/dashboard';
      case 'ADMIN':
        return '/admin/masters';
      default:
        return '/portal-home';
    }
  }

  private extractApiError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'object' && error.error?.error) {
        return String(error.error.error);
      }
      return error.message || 'Request failed.';
    }
    return 'Unexpected error occurred.';
  }

  protected getFieldError(fieldName: string): string {
    const control = this.loginForm.get(fieldName);
    if (!control || !control.errors) {
      return '';
    }

    const errors = control.errors;
    if (errors['required']) {
      return fieldName === 'loginId' ? 'Login ID is required' : 'Password is required';
    }
    return 'Invalid input';
  }

  protected isFieldValid(fieldName: string): boolean {
    const control = this.loginForm.get(fieldName);
    return !!(control && control.valid && control.touched);
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const control = this.loginForm.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }
}
