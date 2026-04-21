import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import {
  AuthService,
  RegistrationRequest,
  RegistrationResponse,
  UserRole
} from '../../services/auth.service';

@Component({
  selector: 'app-party-registration',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './party-registration.component.html',
  styleUrl: './party-registration.component.css'
})
export class PartyRegistrationComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  protected submitInProgress = false;
  protected successMessage = '';
  protected errorMessage = '';
  protected selectedRole: UserRole = 'PARTY_IN_PERSON';

  protected readonly form = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    mobileNumber: ['', [Validators.required]],
    address: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitInProgress = true;
    this.successMessage = '';
    this.errorMessage = '';

    const value = this.form.getRawValue();
    const payload: RegistrationRequest = {
      role: this.selectedRole,
      fullName: value.fullName.trim(),
      email: value.email.trim(),
      mobileNumber: value.mobileNumber.trim(),
      address: value.address.trim(),
      password: value.password
    };

    this.authService
      .register(payload)
      .pipe(finalize(() => (this.submitInProgress = false)))
      .subscribe({
        next: (response: RegistrationResponse) => {
          this.successMessage = `${response.message} User ID: ${response.id}`;
          this.form.patchValue({ password: '' });
        },
        error: (error: unknown) => {
          this.errorMessage = this.extractApiError(error);
        }
      });
  }

  private extractApiError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'object' && error.error?.error) {
        return String(error.error.error);
      }
      return error.message || 'Registration failed.';
    }
    return 'Unexpected error occurred.';
  }
}
