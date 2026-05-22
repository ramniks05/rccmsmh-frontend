import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';

import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

function passwordMatchValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password')?.value;
    const confirm = control.get('confirmPassword')?.value;
    if (!password || !confirm) return null;
    return password === confirm ? null : { passwordMismatch: true };
  };
}

import {
  AuthService,
  formatRegistrationSuccessMessage,
  PartyRegistrationRequest,
  RegistrationResponse,
  UserRole
} from '../../services/auth.service';
import {
  BoundaryMasterResponse,
  LookupsService,
  PincodePostOffice
} from '../../services/lookups.service';

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
  private readonly lookups = inject(LookupsService);

  protected submitInProgress = false;
  protected successMessage = '';
  protected errorMessage = '';
  protected showPassword = false;
  protected selectedRole: UserRole = 'PARTY_IN_PERSON';

  protected readonly pincodeLoading = signal(false);
  protected readonly pincodeHint = signal('');
  protected readonly postOffices = signal<PincodePostOffice[]>([]);
  protected readonly districts = signal<BoundaryMasterResponse[]>([]);
  protected readonly subdistricts = signal<BoundaryMasterResponse[]>([]);

  protected readonly form = this.formBuilder.nonNullable.group(
    {
    fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email]],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    pinCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    postOfficeValue: [''],
    stateId: [null as number | null],
    stateName: ['', Validators.required],
    districtId: [null as number | null],
    districtName: ['', Validators.required],
    subdistrictId: [null as number | null],
    subdistrictName: [''],
    village: [''],
    addressLine1: ['', [Validators.required, Validators.maxLength(120)]],
    addressLine2: ['', Validators.maxLength(120)],
    addressLine3: ['', Validators.maxLength(120)],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      ]
    ],
    confirmPassword: ['', Validators.required]
    },
    { validators: passwordMatchValidator() }
  );

  protected get controls() {
    return this.form.controls;
  }

  protected lookupPincode(): void {
    const pin = this.form.controls.pinCode.getRawValue().trim();
    if (!/^\d{6}$/.test(pin)) {
      this.pincodeHint.set('Enter a valid 6-digit pincode.');
      return;
    }
    this.pincodeLoading.set(true);
    this.pincodeHint.set('');
    this.postOffices.set([]);
    this.form.patchValue({ postOfficeValue: '' });
    this.lookups
      .getPincodeDetails(pin)
      .pipe(finalize(() => this.pincodeLoading.set(false)))
      .subscribe({
        next: (resp) => {
          this.postOffices.set(resp.postOffices || []);
          const stateName = resp.states?.[0] || resp.postOffices?.[0]?.state || '';
          const districtName = resp.districts?.[0] || resp.postOffices?.[0]?.district || '';
          const subdistrictName = resp.talukas?.[0] || resp.postOffices?.[0]?.block || '';
          const village = resp.postOffices?.[0]?.name || '';
          const talukaName = resp.talukas?.[0] || resp.postOffices?.[0]?.block || '';
          const firstOffice = resp.postOffices?.[0];
          this.form.patchValue({
            stateName,
            districtName,
            subdistrictName: talukaName,
            postOfficeValue: firstOffice?.value || '',
            village: firstOffice?.name || village || this.form.controls.village.getRawValue()
          });
          this.pincodeHint.set(resp.message || 'Select post office and enter address below.');
        },
        error: (err) => this.pincodeHint.set(this.extractApiError(err))
      });
  }

  protected onPostOfficeSelected(): void {
    const value = this.form.controls.postOfficeValue.getRawValue();
    if (!value) return;
    const po = this.postOffices().find((p) => p.value === value);
    if (po) this.applyPostOffice(po);
  }

  protected applyPostOffice(po: PincodePostOffice): void {
    this.form.patchValue({ village: po.name || '' });
  }

  protected onDistrictChange(): void {
    const districtId = this.form.controls.districtId.getRawValue();
    const district = this.districts().find((d) => d.id === districtId);
    if (district) {
      this.form.patchValue({ districtName: district.name });
      this.loadSubdistricts(district.id);
    }
  }

  protected onSubdistrictChange(): void {
    const subId = this.form.controls.subdistrictId.getRawValue();
    const sub = this.subdistricts().find((s) => s.id === subId);
    if (sub) this.form.patchValue({ subdistrictName: sub.name });
  }

  protected selectRole(role: UserRole): void {
    this.selectedRole = role;
  }

  protected togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  protected submit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitInProgress = true;
    const value = this.form.getRawValue();
    const address = this.buildAddress(value);

    const payload: PartyRegistrationRequest = {
      role: this.selectedRole as PartyRegistrationRequest['role'],
      fullName: value.fullName.trim(),
      email: value.email.trim().toLowerCase(),
      mobileNumber: value.mobileNumber.trim(),
      address,
      password: value.password,
      pinCode: value.pinCode.trim(),
      stateId: value.stateId ?? undefined,
      stateName: value.stateName.trim(),
      districtId: value.districtId ?? undefined,
      districtName: value.districtName.trim(),
      subdistrictId: value.subdistrictId ?? undefined,
      subdistrictName: value.subdistrictName.trim() || undefined,
      village: value.village.trim() || undefined,
      addressLine1: value.addressLine1.trim(),
      addressLine2: value.addressLine2.trim() || undefined,
      addressLine3: value.addressLine3.trim() || undefined
    };

    this.authService
      .register(payload)
      .pipe(finalize(() => (this.submitInProgress = false)))
      .subscribe({
        next: (response: RegistrationResponse) => {
          this.successMessage = formatRegistrationSuccessMessage(
            response,
            'Registration successful. Please sign in with your email and password.'
          );
          this.form.reset();
          this.selectedRole = 'PARTY_IN_PERSON';
          this.showPassword = false;
          this.postOffices.set([]);
          this.districts.set([]);
          this.subdistricts.set([]);
          this.pincodeHint.set('');
        },
        error: (error: unknown) => {
          this.errorMessage = this.extractApiError(error);
        }
      });
  }

  private buildAddress(value: ReturnType<typeof this.form.getRawValue>): string {
    const parts = [
      value.addressLine1.trim(),
      value.addressLine2.trim(),
      value.addressLine3.trim(),
      value.village.trim(),
      value.subdistrictName.trim(),
      value.districtName.trim(),
      value.stateName.trim(),
      value.pinCode.trim()
    ].filter(Boolean);
    return parts.join(', ');
  }

  private resolveDistricts(stateName: string, districtName: string): void {
    this.lookups.getStates().subscribe({
      next: (states) => {
        const state = states.find((s) => s.name.toLowerCase() === stateName.trim().toLowerCase());
        if (!state) return;
        this.form.patchValue({ stateId: state.id });
        this.lookups.getDistricts(state.id).subscribe({
          next: (districts) => {
            this.districts.set(districts);
            const district = districts.find(
              (d) => d.name.toLowerCase() === districtName.trim().toLowerCase()
            );
            if (district) {
              this.form.patchValue({ districtId: district.id, districtName: district.name });
              this.loadSubdistricts(district.id);
            }
          }
        });
      }
    });
  }

  private loadSubdistricts(districtId: number): void {
    this.lookups.getSubdistricts(districtId).subscribe({
      next: (list) => this.subdistricts.set(list),
      error: () => this.subdistricts.set([])
    });
  }

  protected getFieldError(fieldName: string): string {
    if (fieldName === 'confirmPassword' && this.form.hasError('passwordMismatch')) {
      return 'Passwords do not match';
    }
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
        if (errors['email']) return 'Please enter a valid email address';
        break;
      case 'mobileNumber':
        if (errors['required']) return 'Mobile number is required';
        if (errors['pattern']) return 'Enter a valid 10-digit mobile number starting with 6-9';
        break;
      case 'pinCode':
        if (errors['required']) return 'Pincode is required';
        if (errors['pattern']) return 'Pincode must be exactly 6 digits';
        break;
      case 'stateName':
        if (errors['required']) return 'State is required — search pincode first';
        break;
      case 'districtName':
        if (errors['required']) return 'District is required';
        break;
      case 'addressLine1':
        if (errors['required']) return 'Address line 1 is required';
        if (errors['maxlength']) return `Maximum ${errors['maxlength'].requiredLength} characters`;
        break;
      case 'password':
        if (errors['required']) return 'Password is required';
        if (errors['minlength']) return `Password must be at least ${errors['minlength'].requiredLength} characters`;
        if (errors['pattern']) return 'Password must contain uppercase, lowercase, number, and special character';
        break;
      case 'confirmPassword':
        if (errors['required']) return 'Please re-enter your password';
        break;
    }
    return 'Invalid field';
  }

  protected getPasswordStrength(): { level: 'weak' | 'fair' | 'good' | 'strong'; percentage: number } {
    const password = this.form.get('password')?.value || '';
    if (!password) return { level: 'weak', percentage: 0 };

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
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
    const length = String(control?.value || '').length;
    if (fieldName === 'fullName') return `${length}/50`;
    if (fieldName === 'addressLine1') return `${length}/120`;
    return '';
  }

  protected isFieldValid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return !!(control && control.valid && control.touched);
  }

  protected isFieldInvalid(fieldName: string): boolean {
    if (fieldName === 'confirmPassword' && this.form.hasError('passwordMismatch')) {
      const c = this.form.get('confirmPassword');
      return !!(c && (c.touched || c.dirty));
    }
    const control = this.form.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }

  private extractApiError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'object' && error.error?.error) return String(error.error.error);
      if (typeof error.error === 'string') return error.error;
      return error.message || 'Registration failed.';
    }
    return 'Unexpected error occurred.';
  }
}
