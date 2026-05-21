import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

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
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './party-registration.component.html',
  styleUrl: './party-registration.component.css'
})
export class PartyRegistrationComponent {

  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  protected submitInProgress = false;

  protected successMessage = '';
  protected errorMessage = '';

  protected showPassword = false;

  protected selectedRole: UserRole = 'PARTY_IN_PERSON';

  protected readonly form = this.formBuilder.nonNullable.group({

    fullName: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50)
      ]
    ],

    email: [
      '',
      [
        Validators.required,
        Validators.email
      ]
    ],

    mobileNumber: [
      '',
      [
        Validators.required,
        Validators.pattern(/^[6-9]\d{9}$/)
      ]
    ],

    address: [
      '',
      [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(200)
      ]
    ],

    password: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      ]
    ]
  });

  /* ───────────────────────────────────────────── */
  /* Getters */
  /* ───────────────────────────────────────────── */

  protected get controls() {
    return this.form.controls;
  }

  /* ───────────────────────────────────────────── */
  /* Validation helpers */
  /* ───────────────────────────────────────────── */

  protected getFieldError(fieldName: string): string {
    const control = this.form.get(fieldName);
    if (!control || !control.invalid || !control.touched) return '';

    const errors = control.errors;
    if (!errors) return '';

    switch (fieldName) {
      case 'fullName':
        if (errors['required']) return 'Full name is required';
        if (errors['minlength']) return `Full name must be at least ${errors['minlength'].requiredLength} characters`;
        if (errors['maxlength']) return `Full name cannot exceed ${errors['maxlength'].requiredLength} characters`;
        break;

      case 'email':
        if (errors['required']) return 'Email address is required';
        if (errors['email']) return 'Please enter a valid email address (e.g., user@example.com)';
        break;

      case 'mobileNumber':
        if (errors['required']) return 'Mobile number is required';
        if (errors['pattern']) return 'Enter a valid 10-digit mobile number starting with 6-9';
        break;

      case 'address':
        if (errors['required']) return 'Address is required';
        if (errors['minlength']) return `Address must be at least ${errors['minlength'].requiredLength} characters`;
        if (errors['maxlength']) return `Address cannot exceed ${errors['maxlength'].requiredLength} characters`;
        break;

      case 'password':
        if (errors['required']) return 'Password is required';
        if (errors['minlength']) return `Password must be at least ${errors['minlength'].requiredLength} characters`;
        if (errors['pattern']) return 'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)';
        break;
    }

    return 'Invalid field';
  }

  protected getPasswordStrength(): { level: 'weak' | 'fair' | 'good' | 'strong'; percentage: number } {
    const password = this.form.get('password')?.value || '';

    if (!password) return { level: 'weak', percentage: 0 };

    let strength = 0;
    const maxStrength = 5;

    // Length score
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;

    // Variety score
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[@$!%*?&]/.test(password)) strength++;

    const percentage = (strength / 6) * 100;

    let level: 'weak' | 'fair' | 'good' | 'strong';
    if (percentage <= 33) level = 'weak';
    else if (percentage <= 66) level = 'fair';
    else if (percentage <= 85) level = 'good';
    else level = 'strong';

    return { level, percentage: Math.min(percentage, 100) };
  }

  protected getFieldCharCount(fieldName: string): string {
    const control = this.form.get(fieldName);
    const value = control?.value || '';
    const length = String(value).length;

    switch (fieldName) {
      case 'fullName':
        return `${length}/50`;
      case 'address':
        return `${length}/200`;
      case 'password':
        return `${length} characters`;
      default:
        return '';
    }
  }

  protected isFieldValid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return !!(control && control.valid && control.touched);
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }

  /* ───────────────────────────────────────────── */
  /* Role selection */
  /* ───────────────────────────────────────────── */

  protected selectRole(role: UserRole): void {
    this.selectedRole = role;
  }

  /* ───────────────────────────────────────────── */
  /* Password visibility */
  /* ───────────────────────────────────────────── */

  protected togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  /* ───────────────────────────────────────────── */
  /* Submit */
  /* ───────────────────────────────────────────── */

  protected submit(): void {

    this.successMessage = '';
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitInProgress = true;

    const value = this.form.getRawValue();

    const payload: RegistrationRequest = {
      role: this.selectedRole,

      fullName: value.fullName.trim(),

      email: value.email.trim().toLowerCase(),

      mobileNumber: value.mobileNumber.trim(),

      address: value.address.trim(),

      password: value.password
    };

    this.authService
      .register(payload)
      .pipe(
        finalize(() => {
          this.submitInProgress = false;
        })
      )
      .subscribe({

        next: (response: RegistrationResponse) => {

          this.successMessage =
            `${response.message} User ID: ${response.id}`;

          this.form.reset();

          this.selectedRole = 'PARTY_IN_PERSON';

          this.showPassword = false;
        },

        error: (error: unknown) => {
          this.errorMessage = this.extractApiError(error);
        }
      });
  }

  /* ───────────────────────────────────────────── */
  /* Error handling */
  /* ───────────────────────────────────────────── */

  private extractApiError(error: unknown): string {

    if (error instanceof HttpErrorResponse) {

      if (
        typeof error.error === 'object' &&
        error.error?.error
      ) {
        return String(error.error.error);
      }

      if (typeof error.error === 'string') {
        return error.error;
      }

      return error.message || 'Registration failed.';
    }

    return 'Unexpected error occurred.';
  }
}
