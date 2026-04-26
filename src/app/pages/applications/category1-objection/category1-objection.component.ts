import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { SubjectRecord, SubjectService } from '../../../services/subject.service';
import { LookupsService, BoundaryMasterResponse, OfficeResponse } from '../../../services/lookups.service';
import { environment } from '../../../../environments/environment';

type StepKey = 'DISPUTED_ORDER' | 'ACT_SECTION' | 'PARTIES';

interface Step {
  key: StepKey;
  title: string;
  hint: string;
}

/** One linked PDF (main order, annexure, etc.). */
export interface OrderPdfRef {
  /** Short label shown in tabs and links, e.g. "Main order", "Annexure A". */
  label: string;
  /** Absolute URL to the PDF (or signed URL). */
  url: string;
}

/** Placeholder until the lower-court search API is wired; map backend fields here. */
export interface LowerCourtOrderView {
  orderNo: string;
  orderDate: string;
  office: string;
  summary: string;
  /** Zero or more PDFs returned for this record. */
  orderPdfs: OrderPdfRef[];
  /** Prefill for next step. */
  higherCourtLevel: 'HIGH_COURT' | 'SUPREME_COURT' | 'TRIBUNAL' | 'OTHER';
  higherCourtName: string;
}

@Component({
  selector: 'app-category1-objection',
  imports: [ReactiveFormsModule],
  templateUrl: './category1-objection.component.html'
})
export class Category1ObjectionComponent {
  private readonly fb = inject(FormBuilder);
  private readonly subjectsApi = inject(SubjectService);
  private readonly lookups = inject(LookupsService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly steps: Step[] = [
    { key: 'DISPUTED_ORDER', title: 'Disputed document/order', hint: 'Select subject and review order details' },
    { key: 'ACT_SECTION', title: 'Case act and PO', hint: 'Select act/section and proceed' },
    { key: 'PARTIES', title: 'Applicant/Respondent details', hint: 'Add parties with mobile number and address' }
  ];

  protected readonly stepIndex = signal(0);
  protected readonly activeStep = computed(() => this.steps[this.stepIndex()]);

  protected readonly subjects = signal<SubjectRecord[]>([]);
  protected readonly loadingSubjects = signal(false);
  protected readonly apiError = signal<string | null>(null);

  protected readonly districts = signal<BoundaryMasterResponse[]>([]);
  protected readonly subdistricts = signal<BoundaryMasterResponse[]>([]);
  protected readonly talukas = signal<BoundaryMasterResponse[]>([]);
  protected readonly offices = signal<OfficeResponse[]>([]);

  protected readonly loadingDistricts = signal(false);
  protected readonly loadingSubdistricts = signal(false);
  protected readonly loadingTalukas = signal(false);
  protected readonly loadingOffices = signal(false);

  protected readonly selectedSubject = signal<SubjectRecord | null>(null);

  /** Set after a successful search (or when API returns a match). */
  protected readonly lowerCourtOrder = signal<LowerCourtOrderView | null>(null);

  protected readonly loadingSearch = signal(false);

  /** Which `orderPdfs[]` entry is shown in the iframe preview. */
  protected readonly selectedPdfIndex = signal(0);

  protected readonly safePdfSrc = computed((): SafeResourceUrl | null => {
    const pdfs = this.lowerCourtOrder()?.orderPdfs ?? [];
    if (!pdfs.length) return null;
    const i = Math.min(Math.max(0, this.selectedPdfIndex()), pdfs.length - 1);
    const url = pdfs[i]?.url;
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  protected readonly activePdfUrl = computed((): string | null => {
    const pdfs = this.lowerCourtOrder()?.orderPdfs ?? [];
    if (!pdfs.length) return null;
    const i = Math.min(Math.max(0, this.selectedPdfIndex()), pdfs.length - 1);
    return pdfs[i]?.url ?? null;
  });

  protected selectPdf(index: number): void {
    this.selectedPdfIndex.set(Math.max(0, index));
  }

  protected readonly form = this.fb.nonNullable.group({
    subjectId: [0, [Validators.required, Validators.min(1)]],
    districtId: [0, [Validators.required, Validators.min(1)]],
    subdistrictId: [0],
    talukaId: [0, [Validators.required, Validators.min(1)]],
    officeId: [0, [Validators.required, Validators.min(1)]],
    searchMode: ['PARTY_NAME' as 'PARTY_NAME' | 'CASE_NUMBER' | 'SURVEY_NUMBER' | 'GAT_NUMBER'],
    // Search value is required only when clicking Search (not for moving next).
    searchValue: ['', [Validators.minLength(2)]],

    // Next step (case act / section)
    higherCourtLevel: ['HIGH_COURT' as LowerCourtOrderView['higherCourtLevel'], [Validators.required]],
    higherCourtName: ['', [Validators.required, Validators.minLength(2)]],
    actId: [0, [Validators.required, Validators.min(1)]],
    sectionId: [0, [Validators.required]],
    customSectionName: [''],

    applicants: this.fb.array([] as ReturnType<Category1ObjectionComponent['createPartyGroup']>[]),
    respondents: this.fb.array([] as ReturnType<Category1ObjectionComponent['createPartyGroup']>[])
  });

  protected get applicants(): FormArray {
    return this.form.get('applicants') as FormArray;
  }

  protected get respondents(): FormArray {
    return this.form.get('respondents') as FormArray;
  }

  private createPartyGroup() {
    return this.fb.nonNullable.group({
      name: [''],
      mobile: [''],
      address: ['']
    });
  }

  protected addApplicant(): void {
    this.applicants.push(this.createPartyGroup());
  }

  protected removeApplicant(index: number): void {
    if (this.applicants.length <= 1) return;
    this.applicants.removeAt(index);
  }

  protected addRespondent(): void {
    this.respondents.push(this.createPartyGroup());
  }

  protected removeRespondent(index: number): void {
    if (this.respondents.length <= 1) return;
    this.respondents.removeAt(index);
  }

  // UI-only master data placeholders until you wire APIs.
  protected readonly courtLevels: Array<{ id: LowerCourtOrderView['higherCourtLevel']; label: string }> = [
    { id: 'HIGH_COURT', label: 'High Court' },
    { id: 'SUPREME_COURT', label: 'Supreme Court' },
    { id: 'TRIBUNAL', label: 'Tribunal' },
    { id: 'OTHER', label: 'Other' }
  ];

  protected readonly acts = signal<Array<{ id: number; name: string }>>([
    { id: 1, name: 'Maharashtra Land Revenue Code' },
    { id: 2, name: 'Specific Relief Act' },
    { id: 3, name: 'Indian Evidence Act' }
  ]);

  private readonly sectionsByAct = new Map<number, string[]>([
    [1, ['Section 247', 'Section 257', 'Section 258']],
    [2, ['Section 10', 'Section 14', 'Section 34']],
    [3, ['Section 65B', 'Section 91', 'Section 114']]
  ]);

  protected readonly sectionsForSelectedAct = computed((): Array<{ id: number; name: string }> => {
    const actId = this.form.controls.actId.getRawValue();
    const raw = this.sectionsByAct.get(actId) ?? [];
    const list = raw.map((name, idx) => ({ id: idx + 1, name }));
    // Always allow user to add a section if not found.
    return [...list, { id: -1, name: 'Not in list (Add section)' }];
  });

  protected readonly showCustomSection = computed(() => this.form.controls.sectionId.getRawValue() === -1);

  constructor() {
    // These are prefilled from search and locked.
    this.form.controls.higherCourtLevel.disable({ emitEvent: false });
    this.form.controls.higherCourtName.disable({ emitEvent: false });

    this.loadSubjects();

    // Development defaults so the parties step is never empty.
    this.addApplicant();
    this.addRespondent();

    this.form.controls.subjectId.valueChanges.subscribe((subjectId) => {
      this.selectedSubject.set(this.subjects().find((s) => s.id === subjectId) ?? null);
      this.resetLocationChain();
      if (subjectId && subjectId > 0) {
        this.loadDistricts();
      }
    });

    this.form.controls.districtId.valueChanges.subscribe((districtId) => {
      this.form.controls.subdistrictId.setValue(0);
      this.form.controls.talukaId.setValue(0);
      this.form.controls.officeId.setValue(0);
      this.subdistricts.set([]);
      this.talukas.set([]);
      this.offices.set([]);
      if (districtId && districtId > 0) {
        this.loadSubdistricts(districtId);
        this.loadTalukas(districtId);
      }
    });

    this.form.controls.subdistrictId.valueChanges.subscribe((subdistrictId) => {
      const districtId = this.form.controls.districtId.getRawValue();
      this.form.controls.talukaId.setValue(0);
      this.form.controls.officeId.setValue(0);
      this.talukas.set([]);
      this.offices.set([]);
      if (districtId && districtId > 0) {
        this.loadTalukas(districtId, subdistrictId > 0 ? subdistrictId : undefined);
      }
    });

    this.form.controls.talukaId.valueChanges.subscribe((talukaId) => {
      this.form.controls.officeId.setValue(0);
      this.offices.set([]);
      if (talukaId && talukaId > 0) {
        this.loadTalukaOffices(talukaId);
      }
    });
  }

  protected loadSubjects(): void {
    this.loadingSubjects.set(true);
    this.apiError.set(null);
    this.subjectsApi.listSubjects().subscribe({
      next: (rows) => this.subjects.set(rows),
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.loadingSubjects.set(false)
    });
  }

  private loadDistricts(): void {
    const stateId = environment.defaultState?.id || 1;
    this.loadingDistricts.set(true);
    this.lookups.getDistricts(stateId).subscribe({
      next: (rows) => this.districts.set(rows),
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.loadingDistricts.set(false)
    });
  }

  private loadSubdistricts(districtId: number): void {
    this.loadingSubdistricts.set(true);
    this.lookups.getSubdistricts(districtId).subscribe({
      next: (rows) => this.subdistricts.set(rows),
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.loadingSubdistricts.set(false)
    });
  }

  private loadTalukas(districtId: number, subdistrictId?: number): void {
    this.loadingTalukas.set(true);
    this.lookups.getTalukas(districtId, subdistrictId).subscribe({
      next: (rows) => this.talukas.set(rows),
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.loadingTalukas.set(false)
    });
  }

  private loadTalukaOffices(talukaId: number): void {
    const deptId = this.selectedSubject()?.departmentId;
    this.loadingOffices.set(true);
    this.lookups.getOffices('TALUKA', talukaId, deptId || undefined).subscribe({
      next: (rows) => this.offices.set(rows),
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.loadingOffices.set(false)
    });
  }

  protected performSearch(): void {
    // Replace with HttpClient call; map response `orderPdfs` (or similar) from the API.
    this.form.controls.searchValue.markAsTouched();
    const v = this.form.controls.searchValue.getRawValue().trim();
    if (v.length < 2) {
      this.apiError.set('Please enter a search value.');
      return;
    }
    this.apiError.set(null);
    this.loadingSearch.set(true);
    const raw = this.form.getRawValue();

    // Demo PDF so preview + “Open PDF” can be verified without backend.
    const demoPdf =
      'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

    window.setTimeout(() => {
      this.selectedPdfIndex.set(0);
      this.lowerCourtOrder.set({
        orderNo: `RESULT-${raw.searchMode}`,
        orderDate: '2026-04-20',
        office: 'Loaded from lookup selection (sample)',
        summary: `Search: ${raw.searchMode} = ${raw.searchValue}`,
        orderPdfs: [
          { label: 'Main order', url: demoPdf },
          { label: 'Annexure (sample)', url: demoPdf }
        ],
        higherCourtLevel: 'HIGH_COURT',
        higherCourtName: 'Bombay High Court'
      });

      // Prefill next step from search result.
      const order = this.lowerCourtOrder();
      if (order) {
        this.form.controls.higherCourtLevel.setValue(order.higherCourtLevel, { emitEvent: false });
        this.form.controls.higherCourtName.setValue(order.higherCourtName, { emitEvent: false });
      }
      this.loadingSearch.set(false);
    }, 280);
  }

  protected searchFieldLabel(): string {
    const mode = this.form.controls.searchMode.getRawValue();
    if (mode === 'PARTY_NAME') return 'Party name';
    if (mode === 'CASE_NUMBER') return 'Case number';
    if (mode === 'SURVEY_NUMBER') return 'Survey number';
    return 'Gat number';
  }

  protected searchPlaceholder(): string {
    const mode = this.form.controls.searchMode.getRawValue();
    if (mode === 'PARTY_NAME') return 'e.g. Rahul Patil';
    if (mode === 'CASE_NUMBER') return 'e.g. RCCMS/2026/00123';
    if (mode === 'SURVEY_NUMBER') return 'e.g. 112/1';
    return 'e.g. 778';
  }

  private resetLocationChain(): void {
    this.form.controls.districtId.setValue(0);
    this.form.controls.subdistrictId.setValue(0);
    this.form.controls.talukaId.setValue(0);
    this.form.controls.officeId.setValue(0);
    this.districts.set([]);
    this.subdistricts.set([]);
    this.talukas.set([]);
    this.offices.set([]);
  }

  protected back(): void {
    this.apiError.set(null);
    this.stepIndex.set(Math.max(0, this.stepIndex() - 1));
  }

  protected next(): void {
    // Development mode: do not block stepper navigation on validation.
    this.apiError.set(null);
    this.stepIndex.set(Math.min(this.steps.length - 1, this.stepIndex() + 1));
  }

  protected addCustomSection(): void {
    const actId = this.form.controls.actId.getRawValue();
    const name = this.form.controls.customSectionName.getRawValue().trim();
    if (!actId || actId < 1) {
      this.apiError.set('Please select Act first.');
      return;
    }
    if (name.length < 2) {
      this.apiError.set('Please enter a section name/number.');
      return;
    }
    this.apiError.set(null);
    const existing = this.sectionsByAct.get(actId) ?? [];
    if (!existing.some((s) => s.toLowerCase() === name.toLowerCase())) {
      existing.push(name);
      this.sectionsByAct.set(actId, existing);
    }
    // Select the newly added section (after recompute, it's the last before "Add section").
    const newIndex = (this.sectionsByAct.get(actId)?.length ?? 1);
    this.form.controls.sectionId.setValue(newIndex);
    this.form.controls.customSectionName.setValue('');
  }

  private formatError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const msg =
        err.error && typeof err.error.error === 'string'
          ? err.error.error
          : err.error && typeof err.error.message === 'string'
            ? err.error.message
            : null;
      return msg || `Request failed (${err.status}).`;
    }
    return 'Request failed.';
  }
}

