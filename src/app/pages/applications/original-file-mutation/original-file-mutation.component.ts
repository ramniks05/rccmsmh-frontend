import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { TokenStorageService } from '../../../services/token-storage.service';
import { AdvocateLookupResponse } from '../../../services/advocate-by-bar-council.service';
import { VakaltnamaPanelComponent } from '../vakaltnama-panel/vakaltnama-panel.component';

type StepKey =
  | 'APPLICANTS'
  | 'RESPONDENTS'
  | 'VAKALTNAMA'
  | 'LAND_DETAILS'
  | 'PO_COURT'
  | 'PREVIEW'
  | 'SUBMIT';

interface Step {
  key: StepKey;
  title: string;
  hint: string;
}

@Component({
  selector: 'app-original-file-mutation',
  imports: [ReactiveFormsModule, VakaltnamaPanelComponent],
  templateUrl: './original-file-mutation.component.html',
  styleUrl: './original-file-mutation.component.css'
})
export class OriginalFileMutationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tokenStorage = inject(TokenStorageService);

  protected readonly steps: Step[] = [
    { key: 'APPLICANTS', title: 'Applicants', hint: 'Add one or more applicants' },
    { key: 'RESPONDENTS', title: 'Respondents', hint: 'Add one or more respondents' },
    {
      key: 'VAKALTNAMA',
      title: 'Vakaltnama',
      hint: 'Filing advocate and co-advocates (search by bar council number)'
    },
    { key: 'LAND_DETAILS', title: 'Land details', hint: 'Basic land/case details' },
    { key: 'PO_COURT', title: 'PO Court', hint: 'Select court / officer' },
    { key: 'PREVIEW', title: 'Preview', hint: 'Review before saving' },
    { key: 'SUBMIT', title: 'Save', hint: 'Save draft or final' }
  ];

  protected readonly stepIndex = signal(0);
  protected readonly apiMessage = signal<string | null>(null);
  protected readonly apiError = signal<string | null>(null);

  protected readonly vakaltnamaCoAdvocates = signal<AdvocateLookupResponse[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    applicants: this.fb.array([this.personGroup()]),
    respondents: this.fb.array([this.personGroup()]),
    land: this.fb.nonNullable.group({
      district: ['Pune', [Validators.required]],
      taluka: ['Haveli', [Validators.required]],
      village: ['Wagholi', [Validators.required]],
      surveyNumber: [''],
      gutNumber: [''],
      remarks: ['']
    }),
    poCourt: this.fb.nonNullable.group({
      courtName: ['Haveli Taluka Office', [Validators.required]],
      officerName: ['Tehsildar', [Validators.required]]
    })
  });

  protected readonly activeStep = computed(() => this.steps[this.stepIndex()]);

  protected get applicants(): FormArray {
    return this.form.controls.applicants;
  }
  protected get respondents(): FormArray {
    return this.form.controls.respondents;
  }

  protected addApplicant(): void {
    this.applicants.push(this.personGroup());
  }
  protected removeApplicant(index: number): void {
    if (this.applicants.length <= 1) return;
    this.applicants.removeAt(index);
  }

  protected addRespondent(): void {
    this.respondents.push(this.personGroup());
  }
  protected removeRespondent(index: number): void {
    if (this.respondents.length <= 1) return;
    this.respondents.removeAt(index);
  }

  protected back(): void {
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.stepIndex.set(Math.max(0, this.stepIndex() - 1));
  }

  protected next(): void {
    this.apiMessage.set(null);
    this.apiError.set(null);

    const step = this.activeStep().key;
    if (!this.validateStep(step)) {
      this.apiError.set('Please fix validation errors in this step.');
      return;
    }

    this.stepIndex.set(Math.min(this.steps.length - 1, this.stepIndex() + 1));
  }

  protected saveDraft(): void {
    if (!this.validateAll()) {
      this.apiError.set('Please fix validation errors before saving.');
      return;
    }
    const payload = this.buildPersistPayload();
    this.persist('DRAFT', payload);
    this.apiMessage.set('Draft saved locally.');
  }

  protected finalSubmit(): void {
    if (!this.validateAll()) {
      this.apiError.set('Please fix validation errors before final submit.');
      return;
    }
    const payload = this.buildPersistPayload();
    this.persist('FINAL', payload);
    this.apiMessage.set('Final submitted locally (dummy).');
  }

  protected previewJson(): string {
    return JSON.stringify(this.buildPersistPayload(), null, 2);
  }

  private personGroup() {
    return this.fb.nonNullable.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      fullNameLocal: [''],
      mobile: [''],
      address: ['']
    });
  }

  private validateStep(step: StepKey): boolean {
    if (step === 'APPLICANTS') return this.markArrayTouched(this.applicants);
    if (step === 'RESPONDENTS') return this.markArrayTouched(this.respondents);
    if (step === 'VAKALTNAMA') return true;
    if (step === 'LAND_DETAILS') return this.markGroupTouched(this.form.controls.land);
    if (step === 'PO_COURT') return this.markGroupTouched(this.form.controls.poCourt);
    return true;
  }

  private validateAll(): boolean {
    const a = this.markArrayTouched(this.applicants);
    const r = this.markArrayTouched(this.respondents);
    const land = this.markGroupTouched(this.form.controls.land);
    const court = this.markGroupTouched(this.form.controls.poCourt);
    return a && r && land && court;
  }

  private markArrayTouched(arr: FormArray): boolean {
    arr.controls.forEach((c) => c.markAllAsTouched());
    return arr.valid;
  }

  private markGroupTouched(group: { markAllAsTouched: () => void; valid: boolean }): boolean {
    group.markAllAsTouched();
    return group.valid;
  }

  private buildPersistPayload(): unknown {
    const base = this.form.getRawValue();
    return {
      ...base,
      vakaltnama: {
        filingAdvocate: {
          displayName: this.tokenStorage.getDisplayName() || '—',
          role: this.tokenStorage.getRole() || '—'
        },
        coAdvocates: this.vakaltnamaCoAdvocates()
      }
    };
  }

  private persist(mode: 'DRAFT' | 'FINAL', payload: unknown): void {
    const record = {
      mode,
      applicationType: 'ORIGINAL_FILE_MUTATION',
      savedAt: new Date().toISOString(),
      payload
    };
    const key = `rccms.application.${mode.toLowerCase()}.original_file_mutation`;
    localStorage.setItem(key, JSON.stringify(record));
  }
}
