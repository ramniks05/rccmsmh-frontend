import { Component, inject, NgZone, OnInit, ChangeDetectorRef, signal } from '@angular/core';
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

function passwordMatchValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get('password')?.value;
    const confirm = control.get('confirmPassword')?.value;
    if (!password || !confirm) return null;
    return password === confirm ? null : { passwordMismatch: true };
  };
}
import { Router, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';

import {
  AuthService,
  AdvocateRegistrationRequest,
  formatRegistrationSuccessMessage,
  RegistrationResponse
} from '../../services/auth.service';
import { FileUploadService } from '../../services/file-upload.service';
import { BoundaryMasterResponse, LookupsService } from '../../services/lookups.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-advocate-registration',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './advocate-registration.component.html',
  styleUrl: './advocate-registration.component.css'
})
export class AdvocateRegistrationComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly fileUpload = inject(FileUploadService);
  private readonly lookups = inject(LookupsService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  protected readonly masterStates = signal<BoundaryMasterResponse[]>([]);
  protected readonly practiceDistricts = signal<BoundaryMasterResponse[]>([]);
  protected readonly statesLoading = signal(false);
  protected readonly practiceDistrictsLoading = signal(false);
  protected readonly statesLoadError = signal('');
  protected readonly districtsLoadError = signal('');

  protected readonly enrollmentYears = this.buildYearOptions();

  protected showPassword = false;
  protected submitInProgress = false;
  protected certUploadInProgress = false;
  protected successMessage = '';
  protected errorMessage = '';
  protected certStorageKey = '';
  protected certFileName = '';
  protected selectedCertFile: File | null = null;
  protected readonly selectedCertName = signal('');
  protected readonly certUploadError = signal('');

  protected readonly form = this.formBuilder.group(
    {
    firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    middleName: ['', [Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    barEnrollmentStateId: [null as number | null, Validators.required],
    barEnrollmentYear: [
      new Date().getFullYear(),
      [Validators.required, Validators.min(1950), Validators.max(new Date().getFullYear())]
    ],
    barEnrollmentNumber: ['', [Validators.required, Validators.maxLength(80)]],
    placeOfPracticeStateId: [null as number | null, Validators.required],
    placeOfPracticeDistrictId: [null as number | null, Validators.required],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    email: ['', [Validators.required, Validators.email]],
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

  constructor() {
    this.form.controls.placeOfPracticeStateId.valueChanges.subscribe((stateId) => {
      this.form.patchValue({ placeOfPracticeDistrictId: null });
      this.practiceDistricts.set([]);
      this.districtsLoadError.set('');
      if (stateId != null) {
        this.loadPracticeDistricts(stateId);
      }
    });
  }

  ngOnInit(): void {
    this.loadMasterStates();
  }

  protected stateLabel(state: BoundaryMasterResponse): string {
    return state.localName ? `${state.name} (${state.localName})` : state.name;
  }

  protected togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  protected onCertificateSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.selectedCertFile = null;
      this.selectedCertName.set('');
      this.certStorageKey = '';
      this.certFileName = '';
      return;
    }

    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      this.selectedCertFile = null;
      this.selectedCertName.set('');
      this.certStorageKey = '';
      this.certFileName = '';
      this.certUploadError.set('Please choose a PDF file only.');
      input.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.selectedCertFile = null;
      this.selectedCertName.set('');
      this.certStorageKey = '';
      this.certFileName = '';
      this.certUploadError.set('Certificate file must be 10 MB or smaller.');
      input.value = '';
      return;
    }

    this.selectedCertFile = file;
    this.selectedCertName.set(file.name);
    this.certUploadError.set('');
    this.certStorageKey = '';
    this.certFileName = '';
  }

  private extractCertUploadError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403 || error.status === 404) {
        return 'Certificate could not be uploaded. The server must allow public POST /api/files/upload during registration (ask your backend team).';
      }
      return this.extractApiError(error);
    }
    return 'Certificate upload failed. Please try again.';
  }

  protected submit(): void {
    if (!this.selectedCertFile) {
      this.certUploadError.set('Please choose your bar enrollment certificate (PDF).');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const barState = this.masterStates().find((s) => s.id === value.barEnrollmentStateId);
    const practiceState = this.masterStates().find((s) => s.id === value.placeOfPracticeStateId);
    const practiceDistrict = this.practiceDistricts().find((d) => d.id === value.placeOfPracticeDistrictId);

    if (!barState || !practiceState || !practiceDistrict) {
      this.errorMessage = 'Please select valid state and district from the master lists.';
      return;
    }

    const barEnrollmentStateCode = this.boundaryCode(barState);
    const placeOfPracticeStateCode = this.boundaryCode(practiceState);
    const placeOfPracticeDistrictCode = this.boundaryCode(practiceDistrict);
    if (!barEnrollmentStateCode || !placeOfPracticeStateCode || !placeOfPracticeDistrictCode) {
      this.errorMessage =
        'Selected state or district has no code in master data. Choose another entry or contact support.';
      return;
    }

    this.submitInProgress = true;
    this.successMessage = '';
    this.errorMessage = '';

    const payload: AdvocateRegistrationRequest = {
      role: 'ADVOCATE',
      firstName: value.firstName!.trim(),
      middleName: value.middleName?.trim() || undefined,
      lastName: value.lastName!.trim(),
      barEnrollmentState: barEnrollmentStateCode,
      barEnrollmentYear: Number(value.barEnrollmentYear),
      barEnrollmentNumber: value.barEnrollmentNumber!.trim(),
      placeOfPracticeState: placeOfPracticeStateCode,
      placeOfPracticeDistrict: placeOfPracticeDistrictCode,
      mobileNumber: value.mobileNumber!.trim(),
      email: value.email!.trim(),
      password: value.password!,
      barEnrollmentCertificateStorageKey: '',
      barEnrollmentCertificateFileName: this.selectedCertFile.name
    };

    const certificateFile = this.selectedCertFile;
    this.certUploadInProgress = true;
    this.certUploadError.set('');

    this.fileUpload
      .upload(certificateFile, 'advocate')
      .pipe(
        switchMap((uploadRes) => {
          if (!uploadRes.storageKey) {
            throw new Error('NO_STORAGE_KEY');
          }
          payload.barEnrollmentCertificateStorageKey = uploadRes.storageKey;
          payload.barEnrollmentCertificateFileName = uploadRes.fileName || certificateFile.name;
          return this.authService.register(payload);
        }),
        finalize(() => {
          this.ngZone.run(() => {
            this.submitInProgress = false;
            this.certUploadInProgress = false;
            this.cdr.markForCheck();
          });
        })
      )
      .subscribe({
        next: (response: RegistrationResponse) => {
          this.certStorageKey = payload.barEnrollmentCertificateStorageKey;
          this.certFileName = payload.barEnrollmentCertificateFileName;
          this.successMessage = formatRegistrationSuccessMessage(
            response,
            'Registration successful. Please sign in and complete your profile.'
          );
          this.form.patchValue({ password: '', confirmPassword: '' });
          this.showPassword = false;
          setTimeout(() => void this.router.navigate(['/login'], { queryParams: { registered: 'advocate' } }), 2200);
        },
        error: (error: unknown) => {
          this.ngZone.run(() => {
            this.submitInProgress = false;
            this.certUploadInProgress = false;
            if (error instanceof Error && error.message === 'NO_STORAGE_KEY') {
              this.certUploadError.set('Certificate upload did not return a storage key. Please try again.');
              this.cdr.markForCheck();
              return;
            }
            if (error instanceof HttpErrorResponse && error.url?.includes('/api/files/upload')) {
              this.certUploadError.set(this.extractCertUploadError(error));
              this.cdr.markForCheck();
              return;
            }
            this.errorMessage = this.extractApiError(error);
            this.cdr.markForCheck();
          });
        }
      });
  }

  private loadMasterStates(): void {
    this.statesLoading.set(true);
    this.statesLoadError.set('');
    this.lookups
      .getStates()
      .pipe(finalize(() => this.statesLoading.set(false)))
      .subscribe({
        next: (states) => {
          this.masterStates.set(states);
          if (!states.length) {
            this.statesLoadError.set('No states returned from master lookup.');
            return;
          }
          const defaultId = environment.defaultState?.id;
          const defaultState =
            states.find((s) => s.id === defaultId) ||
            states.find((s) => s.name.toLowerCase() === 'maharashtra') ||
            states[0];
          this.form.patchValue({
            barEnrollmentStateId: defaultState.id,
            placeOfPracticeStateId: defaultState.id
          });
        },
        error: (err) => {
          this.masterStates.set([]);
          this.statesLoadError.set(this.extractApiError(err) || 'Could not load states from master API.');
        }
      });
  }

  private loadPracticeDistricts(stateId: number): void {
    this.practiceDistrictsLoading.set(true);
    this.districtsLoadError.set('');
    this.lookups
      .getDistricts(stateId)
      .pipe(finalize(() => this.practiceDistrictsLoading.set(false)))
      .subscribe({
        next: (districts) => {
          this.practiceDistricts.set(districts);
          if (!districts.length) {
            this.districtsLoadError.set('No districts found for the selected state.');
          }
        },
        error: (err) => {
          this.practiceDistricts.set([]);
          this.districtsLoadError.set(this.extractApiError(err) || 'Could not load districts from master API.');
        }
      });
  }

  /** Master boundary code (LGD) — always sent to registration API instead of name. */
  private boundaryCode(item: BoundaryMasterResponse): string {
    return (item.lgdCode ?? '').trim();
  }

  private buildYearOptions(): number[] {
    const current = new Date().getFullYear();
    const years: number[] = [];
    for (let y = current; y >= 1970; y--) years.push(y);
    return years;
  }

  private extractApiError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'object' && error.error?.error) return String(error.error.error);
      if (typeof error.error === 'object' && error.error?.message) return String(error.error.message);
      return error.message || 'Request failed.';
    }
    return 'Unexpected error occurred.';
  }

  protected getFieldError(fieldName: string): string {
    if (fieldName === 'confirmPassword' && this.form.hasError('passwordMismatch')) {
      return 'Passwords do not match';
    }
    const control = this.form.get(fieldName);
    if (!control?.errors && !control?.touched) return '';
    const errors = control?.errors;
    if (!errors) return '';
    if (errors['required']) return `${this.getFieldLabel(fieldName)} is required`;
    if (errors['email']) return 'Please enter a valid email address';
    if (errors['pattern'] && fieldName === 'mobileNumber') return 'Enter a valid 10-digit mobile number';
    if (errors['pattern'] && fieldName === 'password') {
      return 'Password must include upper, lower, number, and special character';
    }
    return 'Invalid input';
  }

  protected getFieldLabel(fieldName: string): string {
    const labels: Record<string, string> = {
      firstName: 'First name',
      middleName: 'Middle name',
      lastName: 'Last name',
      barEnrollmentStateId: 'Bar enrollment state',
      barEnrollmentYear: 'Bar enrollment year',
      barEnrollmentNumber: 'Bar enrollment number',
      placeOfPracticeStateId: 'Place of practice state',
      placeOfPracticeDistrictId: 'Place of practice district',
      mobileNumber: 'Mobile number',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Re-enter password'
    };
    return labels[fieldName] || fieldName;
  }

  protected isFieldInvalid(fieldName: string): boolean {
    if (fieldName === 'confirmPassword' && this.form.hasError('passwordMismatch')) {
      const c = this.form.get('confirmPassword');
      return !!(c && (c.touched || c.dirty));
    }
    const control = this.form.get(fieldName);
    return !!(control && control.invalid && control.touched);
  }

  protected getPasswordStrength(): { level: 'weak' | 'fair' | 'good' | 'strong'; percentage: number } {
    const password = this.form.get('password')?.value || '';
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[@$!%*?&]/.test(password)) strength++;
    const levels: ('weak' | 'fair' | 'good' | 'strong')[] = ['weak', 'weak', 'fair', 'good', 'strong'];
    const percentages = [0, 25, 50, 75, 100];
    return { level: levels[Math.min(strength, 4)], percentage: percentages[Math.min(strength, 4)] };
  }
}
