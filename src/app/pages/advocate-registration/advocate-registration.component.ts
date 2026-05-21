import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService, RegistrationRequest, RegistrationResponse } from '../../services/auth.service';

@Component({
  selector: 'app-advocate-registration',
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './advocate-registration.component.html',
  styleUrl: './advocate-registration.component.css'
})
export class AdvocateRegistrationComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  protected submitInProgress = false;
  protected successMessage = '';
  protected errorMessage = '';

  protected readonly form = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email]],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    address: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(200)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)]],
    barCouncilNumber: ['', [Validators.required]],
    enrollmentNumber: ['', [Validators.required]],
    lawFirmName: ['']
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
      role: 'ADVOCATE',
      fullName: value.fullName.trim(),
      email: value.email.trim(),
      mobileNumber: value.mobileNumber.trim(),
      address: value.address.trim(),
      password: value.password,
      barCouncilNumber: value.barCouncilNumber.trim(),
      enrollmentNumber: value.enrollmentNumber.trim()
    };

    if (value.lawFirmName.trim()) {
      payload.lawFirmName = value.lawFirmName.trim();
    }

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

  protected getFieldError(fieldName: string): string {
    const control = this.form.get(fieldName);
    if (!control || !control.errors) {
      return '';
    }

    const errors = control.errors;
    if (errors['required']) return `${this.getFieldLabel(fieldName)} is required`;
    if (errors['minlength']) return `Minimum ${errors['minlength'].requiredLength} characters required`;
    if (errors['maxlength']) return `Maximum ${errors['maxlength'].requiredLength} characters allowed`;
    if (errors['email']) return 'Please enter a valid email address';
    if (errors['pattern']) {
      if (fieldName === 'mobileNumber') return 'Please enter a valid 10-digit mobile number';
      if (fieldName === 'password') return 'Password must contain uppercase, lowercase, number, and special character';
    }
    return 'Invalid input';
  }

  protected getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      fullName: 'Full name',
      email: 'Email',
      mobileNumber: 'Mobile number',
      address: 'Address',
      password: 'Password',
      barCouncilNumber: 'Bar council number',
      enrollmentNumber: 'Enrollment number',
      lawFirmName: 'Law firm name'
    };
    return labels[fieldName] || fieldName;
  }

  protected getPasswordStrength(): { level: 'weak' | 'fair' | 'good' | 'strong'; percentage: number } {
    const password = this.form.get('password')?.value || '';
    let strength = 0;

    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[@$!%*?&]/.test(password)) strength++;
    if (password.length >= 12) strength++;

    const levels: ('weak' | 'fair' | 'good' | 'strong')[] = ['weak', 'weak', 'fair', 'good', 'good', 'strong', 'strong'];
    const percentages = [0, 20, 40, 60, 75, 90, 100];

    return {
      level: levels[strength],
      percentage: percentages[strength]
    };
  }

  protected getFieldCharCount(fieldName: string): string {
    const control = this.form.get(fieldName);
    const value = control?.value || '';
    const maxLength = control?.validator ? this.getMaxLength(control) : 0;
    return maxLength ? `${value.length}/${maxLength}` : '';
  }

  private getMaxLength(control: any): number {
    const validator = control.validator ? control.validator({} as any) : null;
    if (!validator || !validator['maxlength']) {
      return 0;
    }
    return validator['maxlength'].requiredLength;
  }

  protected isFieldValid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return !!(control && control.valid && control.touched);
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }
}
