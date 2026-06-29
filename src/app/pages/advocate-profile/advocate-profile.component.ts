import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AdvocateProfile, AdvocateProfileUpdateRequest, AdvocateService } from '../../services/advocate.service';
import { LookupsService, PincodeLookupResponse, PincodePostOffice } from '../../services/lookups.service';
import { TokenStorageService } from '../../services/token-storage.service';

@Component({
  selector: 'app-advocate-profile',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './advocate-profile.component.html',
  styleUrl: './advocate-profile.component.css'
})
export class AdvocateProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly advocateService = inject(AdvocateService);
  private readonly lookups = inject(LookupsService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly pincodeLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly postOffices = signal<PincodePostOffice[]>([]);
  protected readonly pincodeHint = signal('');
  /** True after a successful pincode search filled address fields. */
  protected readonly addressFromPincode = signal(false);
  /** `/advocate/profile/edit` — update contact & address when profile is already complete. */
  protected readonly isEditMode = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    middleName: ['', [Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.maxLength(50)]],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    email: ['', [Validators.required, Validators.email]],
    gender: ['', Validators.required],
    pinCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    postOfficeValue: [''],
    stateName: ['', Validators.required],
    districtName: ['', Validators.required],
    talukaName: [''],
    village: [''],
    addressLine1: ['', [Validators.required, Validators.maxLength(200)]]
  });

  ngOnInit(): void {
    this.isEditMode.set(this.router.url.includes('/profile/edit'));
    this.advocateService.getMyProfile().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (profile) => this.patchFromProfile(profile),
      error: (err) => {
        this.errorMessage.set(this.extractApiError(err));
        this.loading.set(false);
      }
    });
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
        next: (resp) => this.applyPincodeResponse(resp),
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

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.addressFromPincode() && !this.form.controls.stateName.getRawValue().trim()) {
      this.pincodeHint.set('Search pincode to fill state, district, and locality before saving.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const v = this.form.getRawValue();
    const payload: AdvocateProfileUpdateRequest = {
      firstName: v.firstName.trim(),
      middleName: v.middleName.trim() || undefined,
      lastName: v.lastName.trim(),
      mobileNumber: v.mobileNumber.trim(),
      email: v.email.trim(),
      gender: v.gender as AdvocateProfileUpdateRequest['gender'],
      pinCode: v.pinCode.trim(),
      stateName: v.stateName.trim(),
      districtName: v.districtName.trim(),
      talukaName: v.talukaName.trim() || undefined,
      village: v.village.trim() || undefined,
      addressLine1: v.addressLine1.trim()
    };

    this.advocateService.updateMyProfile(payload).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (profile) => {
        this.successMessage.set('Profile saved successfully.');
        if (profile.profileComplete) {
          this.tokenStorage.setProfileComplete(true);
          setTimeout(() => void this.router.navigate(['/advocate/my-profile']), 1200);
        }
      },
      error: (err) => this.errorMessage.set(this.extractApiError(err))
    });
  }

  protected isFieldInvalid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }

  protected getFieldError(fieldName: string): string {
    const control = this.form.get(fieldName);
    if (!control?.errors || !control.touched) return '';
    if (control.errors['required']) return 'This field is required.';
    if (control.errors['email']) return 'Please enter a valid email address.';
    if (control.errors['pattern'] && fieldName === 'mobileNumber') {
      return 'Enter a valid 10-digit mobile number.';
    }
    if (control.errors['pattern'] && fieldName === 'pinCode') {
      return 'Enter a valid 6-digit pincode.';
    }
    return 'Invalid input.';
  }

  protected getFieldCharCount(fieldName: string): string {
    const control = this.form.get(fieldName);
    const max = fieldName === 'addressLine1' ? 200 : 200;
    const len = (control?.value as string)?.length ?? 0;
    return `${len}/${max}`;
  }

  private applyPincodeResponse(resp: PincodeLookupResponse): void {
    this.postOffices.set(resp.postOffices || []);
    const stateName = resp.states?.[0] || resp.postOffices?.[0]?.state || '';
    const districtName = resp.districts?.[0] || resp.postOffices?.[0]?.district || '';
    const talukaName = resp.talukas?.[0] || resp.postOffices?.[0]?.block || '';
    const firstOffice = resp.postOffices?.[0];

    this.form.patchValue({
      stateName,
      districtName,
      talukaName: talukaName,
      postOfficeValue: firstOffice?.value || '',
      village: firstOffice?.name || this.form.controls.village.getRawValue()
    });
    this.addressFromPincode.set(!!stateName && !!districtName);
    this.pincodeHint.set(resp.message || 'Select post office and enter address below.');
  }

  private patchFromProfile(profile: AdvocateProfile): void {
    this.form.patchValue({
      firstName: profile.firstName || '',
      middleName: profile.middleName || '',
      lastName: profile.lastName || '',
      mobileNumber: profile.mobileNumber || '',
      email: profile.email || '',
      gender: (profile.gender as string) || '',
      pinCode: profile.pinCode || '',
      stateName: profile.stateName || '',
      districtName: profile.districtName || '',
      talukaName: profile.talukaName || '',
      village: profile.village || '',
      addressLine1: profile.addressLine1 || ''
    });
    if (profile.pinCode && profile.stateName) {
      this.addressFromPincode.set(true);
    }
  }

  private extractApiError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'object' && error.error?.error) return String(error.error.error);
      if (typeof error.error === 'object' && error.error?.message) return String(error.error.message);
      return error.message || 'Request failed.';
    }
    return 'Unexpected error occurred.';
  }
}
