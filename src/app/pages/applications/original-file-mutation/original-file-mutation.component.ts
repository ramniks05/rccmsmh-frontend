import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

type StepKey =
  | 'APPLICANTS'
  | 'RESPONDENTS'
  | 'ADVOCATES'
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
  imports: [ReactiveFormsModule],
  templateUrl: './original-file-mutation.component.html',
  styleUrl: './original-file-mutation.component.css'
})
export class OriginalFileMutationComponent {
  private readonly fb = inject(FormBuilder);

  protected readonly steps: Step[] = [
    { key: 'APPLICANTS', title: 'Applicants', hint: 'Add one or more applicants' },
    { key: 'RESPONDENTS', title: 'Respondents', hint: 'Add one or more respondents' },
    { key: 'ADVOCATES', title: 'Advocates', hint: 'Add additional advocates (optional)' },
    { key: 'LAND_DETAILS', title: 'Land details', hint: 'Basic land/case details' },
    { key: 'PO_COURT', title: 'PO Court', hint: 'Select court / officer' },
    { key: 'PREVIEW', title: 'Preview', hint: 'Review before saving' },
    { key: 'SUBMIT', title: 'Save', hint: 'Save draft or final' }
  ];

  protected readonly stepIndex = signal(0);
  protected readonly apiMessage = signal<string | null>(null);
  protected readonly apiError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    applicants: this.fb.array([this.personGroup()]),
    respondents: this.fb.array([this.personGroup()]),
    advocates: this.fb.array([this.advocateGroup()]),
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
  protected get advocates(): FormArray {
    return this.form.controls.advocates;
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

  protected addAdvocate(): void {
    this.advocates.push(this.advocateGroup());
  }
  protected removeAdvocate(index: number): void {
    if (this.advocates.length <= 1) return;
    this.advocates.removeAt(index);
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
    const payload = this.form.getRawValue();
    this.persist('DRAFT', payload);
    this.apiMessage.set('Draft saved locally.');
  }

  protected finalSubmit(): void {
    if (!this.validateAll()) {
      this.apiError.set('Please fix validation errors before final submit.');
      return;
    }
    const payload = this.form.getRawValue();
    this.persist('FINAL', payload);
    this.apiMessage.set('Final submitted locally (dummy).');
  }

  protected previewJson(): string {
    return JSON.stringify(this.form.getRawValue(), null, 2);
  }

  private personGroup() {
    return this.fb.nonNullable.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      fullNameLocal: [''],
      mobile: [''],
      address: ['']
    });
  }

  private advocateGroup() {
    return this.fb.nonNullable.group({
      advocateName: ['', [Validators.required, Validators.minLength(2)]],
      barCouncilNumber: [''],
      mobile: ['']
    });
  }

  private validateStep(step: StepKey): boolean {
    if (step === 'APPLICANTS') return this.markArrayTouched(this.applicants);
    if (step === 'RESPONDENTS') return this.markArrayTouched(this.respondents);
    if (step === 'ADVOCATES') return this.markArrayTouched(this.advocates);
    if (step === 'LAND_DETAILS') return this.markGroupTouched(this.form.controls.land);
    if (step === 'PO_COURT') return this.markGroupTouched(this.form.controls.poCourt);
    return true;
  }

  private validateAll(): boolean {
    const a = this.markArrayTouched(this.applicants);
    const r = this.markArrayTouched(this.respondents);
    const adv = this.markArrayTouched(this.advocates);
    const land = this.markGroupTouched(this.form.controls.land);
    const court = this.markGroupTouched(this.form.controls.poCourt);
    return a && r && adv && land && court;
  }

  private markArrayTouched(arr: FormArray): boolean {
    arr.controls.forEach((c) => c.markAllAsTouched());
    return arr.valid;
  }

  private markGroupTouched(group: { markAllAsTouched: () => void; valid: boolean }): boolean {
    group.markAllAsTouched();
    return group.valid;
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

