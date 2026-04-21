import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService, LoginResponse, LoginRole } from '../../services/auth.service';
import { TokenStorageService } from '../../services/token-storage.service';

@Component({
  selector: 'app-home',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);

  protected readonly departments = [
    'Revenue Department',
    'Land Records and Survey',
    'District Administration',
    'Citizen Service Centers'
  ];
  protected loginInProgress = false;
  protected loginErrorMessage = '';
  protected selectedLoginUserType: LoginRole = 'ADVOCATE';

  protected readonly loginForm = this.formBuilder.nonNullable.group({
    loginId: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

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
          void this.router.navigate(['/portal-home']);
        },
        error: (error: unknown) => {
          this.loginErrorMessage = this.extractApiError(error);
        }
      });
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
}
