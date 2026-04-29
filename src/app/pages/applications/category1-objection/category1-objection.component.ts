import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { SubjectRecord, SubjectService } from '../../../services/subject.service';
import {
  LookupsService,
  BoundaryMasterResponse,
  OfficeResponse,
  ActLookupResponse,
  SectionLookupResponse
} from '../../../services/lookups.service';
import { environment } from '../../../../environments/environment';
import { AdvocateLookupResponse } from '../../../services/advocate-by-bar-council.service';
import { VakaltnamaPanelComponent } from '../vakaltnama-panel/vakaltnama-panel.component';
import { DisputedLandPanelComponent } from '../disputed-land-panel/disputed-land-panel.component';
import { DisputedLandRow } from '../disputed-land-panel/disputed-land-panel.component';
import { ApplicantOption, VakaltnamaAssignment } from '../vakaltnama-panel/vakaltnama-panel.component';
import { LandRecordsService, NoticeNineViewResponse } from '../../../services/land-records.service';

type StepKey = 'DISPUTED_ORDER' | 'ACT_SECTION' | 'PARTIES' | 'VAKALTNAMA' | 'DISPUTED_LAND';

interface Step {
  key: StepKey;
  title: string;
  hint: string;
}

interface NoticeNineResolved {
  available: boolean;
  sourceKind: 'data' | 'external' | null;
  url: string | null;
  previewKind: 'image' | 'pdf' | 'none';
}

export interface MutationDetailsView {
  inwardNumber: string;
  inwardDate: string;
  mutationType: string;
  applicantName: string;
  village: string;
  status: string;
  attachFileUrl: string | null;
  notice9Url: string | null;
}

@Component({
  selector: 'app-category1-objection',
  imports: [ReactiveFormsModule, VakaltnamaPanelComponent, DisputedLandPanelComponent],
  templateUrl: './category1-objection.component.html'
})
export class Category1ObjectionComponent {
  private readonly fb = inject(FormBuilder);
  private readonly subjectsApi = inject(SubjectService);
  private readonly lookups = inject(LookupsService);
  private readonly landRecords = inject(LandRecordsService);

  protected readonly steps: Step[] = [
    { key: 'DISPUTED_ORDER', title: 'Disputed document/order', hint: 'Select subject and review order details' },
    { key: 'ACT_SECTION', title: 'Case act and PO', hint: 'Select act/section and proceed' },
    { key: 'PARTIES', title: 'Applicant/Respondent details', hint: 'Add parties with mobile number and address' },
    {
      key: 'VAKALTNAMA',
      title: 'Vakaltnama',
      hint: 'Filing advocate and co-advocates (search by bar council number)'
    },
    {
      key: 'DISPUTED_LAND',
      title: 'Disputed land details',
      hint: 'Search plots from land records API and add multiple'
    }
  ];

  protected readonly stepIndex = signal(0);
  protected readonly activeStep = computed(() => this.steps[this.stepIndex()]);

  protected readonly vakaltnamaCoAdvocates = signal<AdvocateLookupResponse[]>([]);
  protected readonly vakaltnamaAssignments = signal<VakaltnamaAssignment[]>([]);
  protected readonly disputedLands = signal<DisputedLandRow[]>([]);

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
  protected readonly selectedOffice = signal<OfficeResponse | null>(null);
  protected readonly selectedOfficeName = computed(() => {
    return this.selectedOffice()?.name || '';
  });
  protected readonly selectedOfficeLocalName = computed(() => {
    return this.selectedOffice()?.localName || '';
  });
  protected readonly selectedOfficeTypeName = computed(() => {
    const o = this.selectedOffice();
    if (!o) return '';
    return o.officeTypeLocalName || o.officeTypeName || '';
  });

  /** Set after a successful search (or when API returns a match). */
  protected readonly mutationDetails = signal<MutationDetailsView | null>(null);
  protected readonly mutationFound = signal(false);
  protected readonly searchedMutation = signal(false);
  protected readonly loadingNotice9 = signal(false);
  protected readonly notice9Resolved = signal<NoticeNineResolved>({
    available: false,
    sourceKind: null,
    url: null,
    previewKind: 'none'
  });
  protected readonly manualAttachFileName = signal<string | null>(null);
  protected readonly manualNotice9FileName = signal<string | null>(null);

  protected readonly loadingSearch = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    subjectId: [0, [Validators.required, Validators.min(1)]],
    districtId: [0, [Validators.required, Validators.min(1)]],
    subdistrictId: [0],
    talukaId: [0, [Validators.required, Validators.min(1)]],
    officeId: [0, [Validators.required, Validators.min(1)]],
    searchMode: ['INWARD_NUMBER' as 'INWARD_NUMBER' | 'SURVEY_NUMBER' | 'MUTATION_NUMBER'],
    // Search value is required only when clicking Search (not for moving next).
    searchValue: ['', [Validators.minLength(2)]],
    mutationYear: [''],
    mutationTypeFilter: [''],
    manualInwardNumber: [''],
    manualInwardDate: [''],
    manualMutationType: [''],
    manualApplicantName: [''],
    manualVillage: [''],
    manualStatus: [''],

    // Next step (case act / section)
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
      tempId: [this.makeTempId()],
      name: [''],
      mobile: [''],
      address: ['']
    });
  }

  protected readonly applicantOptions = computed((): ApplicantOption[] => {
    return this.applicants.controls.map((c) => {
      const v = (c as any).getRawValue?.() as { tempId?: string; name?: string } | undefined;
      const id = v?.tempId || this.makeTempId();
      const name = (v?.name || '').trim() || 'Applicant';
      return { id, name };
    });
  });

  private makeTempId(): string {
    const cryptoObj = globalThis.crypto as Crypto | undefined;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
    return `app-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  protected readonly acts = signal<ActLookupResponse[]>([]);
  protected readonly sections = signal<SectionLookupResponse[]>([]);

  protected readonly sectionsForSelectedAct = computed((): Array<{ id: number; name: string }> => {
    const list = this.sections().map((row) => ({
      id: row.id,
      name: row.sectionCode ? `${row.sectionCode} - ${row.sectionName}` : row.sectionName
    }));
    // Always allow user to add a section if not found.
    return [...list, { id: -1, name: 'Not in list (Add section)' }];
  });

  protected readonly showCustomSection = computed(() => this.form.controls.sectionId.getRawValue() === -1);

  constructor() {
    this.loadSubjects();
    this.loadDistricts();
    this.loadActs();

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
      this.selectedOffice.set(null);
      if (districtId && districtId > 0) {
        this.loadSubdistricts(districtId);
        this.loadTalukas(districtId);
      }
    });

    this.form.controls.talukaId.valueChanges.subscribe((talukaId) => {
      this.form.controls.officeId.setValue(0);
      this.offices.set([]);
      this.selectedOffice.set(null);
      if (talukaId && talukaId > 0) {
        this.loadTalukaOffices(talukaId);
      }
    });

    this.form.controls.subdistrictId.valueChanges.subscribe((subdistrictId) => {
      const districtId = this.form.controls.districtId.getRawValue();
      this.form.controls.talukaId.setValue(0);
      this.form.controls.officeId.setValue(0);
      this.talukas.set([]);
      this.offices.set([]);
      this.selectedOffice.set(null);
      if (districtId && districtId > 0) {
        this.loadTalukas(districtId, subdistrictId > 0 ? subdistrictId : undefined);
      }
    });

    this.form.controls.officeId.valueChanges.subscribe((officeId) => {
      const id = Number(officeId || 0);
      if (!id) {
        this.selectedOffice.set(null);
        return;
      }
      this.selectedOffice.set(this.offices().find((o) => o.id === id) || null);
    });

    this.form.controls.actId.valueChanges.subscribe((actId) => {
      this.form.controls.sectionId.setValue(0);
      this.form.controls.customSectionName.setValue('');
      this.sections.set([]);
      if (actId && actId > 0) {
        this.loadSections(actId);
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
    this.lookups.getTalukaOffices(talukaId, deptId || undefined).subscribe({
      next: (rows) => {
        const first = rows[0] ?? null;
        this.form.controls.officeId.setValue(first?.id ?? 0, { emitEvent: false });
        this.offices.set(rows);
        this.selectedOffice.set(first);
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.loadingOffices.set(false)
    });
  }

  private loadActs(): void {
    this.lookups.getActs().subscribe({
      next: (rows) => this.acts.set(rows),
      error: (err: unknown) => this.apiError.set(this.formatError(err))
    });
  }

  private loadSections(actId: number): void {
    this.lookups.getSections(actId).subscribe({
      next: (rows) => this.sections.set(rows),
      error: (err: unknown) => this.apiError.set(this.formatError(err))
    });
  }

  protected performSearch(): void {
    // Replace with API call to EPCIS / Eferfar mutation search.
    this.form.controls.searchValue.markAsTouched();
    const v = this.form.controls.searchValue.getRawValue().trim();
    if (v.length < 2) {
      this.apiError.set('Please enter a search value.');
      return;
    }
    this.apiError.set(null);
    this.loadingSearch.set(true);
    this.searchedMutation.set(true);
    const raw = this.form.getRawValue();

    window.setTimeout(() => {
      // Temporary behavior: "NF" in query simulates no record found.
      const notFound = raw.searchValue.toUpperCase().includes('NF');
      this.mutationFound.set(!notFound);
      this.notice9Resolved.set({ available: false, sourceKind: null, url: null, previewKind: 'none' });
      if (!notFound) {
        const inwardNumber = `${raw.searchMode}-${raw.searchValue}`;
        this.mutationDetails.set({
          inwardNumber,
          inwardDate: '2026-04-20',
          mutationType: raw.mutationTypeFilter || 'Standard Mutation',
          applicantName: 'Demo Applicant',
          village: 'Demo Village',
          status: 'Pending Verification',
          attachFileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          notice9Url: null
        });
        this.fetchNoticeNineView(inwardNumber);
      } else {
        this.mutationDetails.set(null);
      }
      this.loadingSearch.set(false);
    }, 280);
  }

  private fetchNoticeNineView(inwardNumber: string): void {
    this.loadingNotice9.set(true);
    this.landRecords.getUrbanNoticeNineView(inwardNumber).subscribe({
      next: (response) => {
        const resolved = this.resolveNoticeNine(response);
        this.notice9Resolved.set(resolved);
        const current = this.mutationDetails();
        if (current) {
          this.mutationDetails.set({
            ...current,
            notice9Url: resolved.url
          });
        }
      },
      error: () => {
        // Keep Notice 9 as null to allow manual upload path.
        this.notice9Resolved.set({ available: false, sourceKind: null, url: null, previewKind: 'none' });
      },
      complete: () => this.loadingNotice9.set(false)
    });
  }

  private resolveNoticeNine(response: NoticeNineViewResponse | string | Record<string, unknown>): NoticeNineResolved {
    const empty: NoticeNineResolved = { available: false, sourceKind: null, url: null, previewKind: 'none' };

    if (typeof response === 'string') {
      const cleaned = this.cleanText(response);
      if (!cleaned) return empty;
      if (cleaned.startsWith('data:')) {
        return {
          available: true,
          sourceKind: 'data',
          url: cleaned,
          previewKind: this.detectPreviewKindFromUrl(cleaned)
        };
      }
      return {
        available: true,
        sourceKind: 'external',
        url: cleaned,
        previewKind: this.detectPreviewKindFromUrl(cleaned)
      };
    }

    const raw = response as NoticeNineViewResponse;
    const type = this.cleanText(raw.type || '').toLowerCase();

    // Case 1: base64-file response
    if (type === 'base64-file') {
      const directDataUrl = this.cleanText(raw.dataUrl || '');
      const mimeType = this.cleanText(raw.mimeType || 'application/octet-stream');
      const base64 = this.cleanText(raw.base64 || '');

      let dataUrl = '';
      if (directDataUrl) {
        dataUrl = directDataUrl;
      } else if (base64) {
        dataUrl = `data:${mimeType};base64,${base64}`;
      }
      if (!dataUrl) return empty;

      return {
        available: true,
        sourceKind: 'data',
        url: dataUrl,
        previewKind: mimeType.startsWith('image/')
          ? 'image'
          : mimeType === 'application/pdf'
            ? 'pdf'
            : this.detectPreviewKindFromUrl(dataUrl)
      };
    }

    // Case 2: url response
    const rawUrl = this.cleanText(raw.url || raw.notice9Url || raw.fileUrl || '');
    if (rawUrl) {
      const isData = rawUrl.startsWith('data:');
      return {
        available: true,
        sourceKind: isData ? 'data' : 'external',
        url: rawUrl,
        previewKind: this.detectPreviewKindFromUrl(rawUrl)
      };
    }

    // Case 3: unavailable
    return empty;
  }

  private cleanText(value: string): string {
    let v = String(value ?? '').trim();
    if (!v) return '';
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1).trim();
    }
    v = v.replace(/\\\//g, '/').trim();
    return v;
  }

  private detectPreviewKindFromUrl(url: string): 'image' | 'pdf' | 'none' {
    const lower = url.toLowerCase();
    if (lower.startsWith('data:image/')) return 'image';
    if (lower.startsWith('data:application/pdf')) return 'pdf';
    if (lower.endsWith('.pdf')) return 'pdf';
    if (/\.(png|jpg|jpeg|webp|gif)(\?|$)/.test(lower)) return 'image';
    return 'none';
  }

  protected searchFieldLabel(): string {
    const mode = this.form.controls.searchMode.getRawValue();
    if (mode === 'INWARD_NUMBER') return 'Inward number';
    if (mode === 'SURVEY_NUMBER') return 'Survey number';
    return 'Mutation number';
  }

  protected searchPlaceholder(): string {
    const mode = this.form.controls.searchMode.getRawValue();
    if (mode === 'INWARD_NUMBER') return 'e.g. INW/2026/00123';
    if (mode === 'SURVEY_NUMBER') return 'e.g. 112/1';
    return 'e.g. MUT/2026/778';
  }

  protected onManualAttachFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.manualAttachFileName.set(input.files?.[0]?.name || null);
  }

  protected onManualNotice9FileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.manualNotice9FileName.set(input.files?.[0]?.name || null);
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
    const existing = this.sections();
    if (!existing.some((s) => s.sectionName.toLowerCase() === name.toLowerCase() || s.sectionCode.toLowerCase() === name.toLowerCase())) {
      const nextId = existing.reduce((m, s) => Math.max(m, s.id), 0) + 1;
      const act = this.acts().find((a) => a.id === actId);
      this.sections.set([
        ...existing,
        {
          id: nextId,
          actId,
          actCode: act?.actCode || '',
          actName: act?.actName || '',
          actNameLocal: act?.actNameLocal || null,
          sectionCode: name,
          sectionName: name,
          sectionNameLocal: null
        }
      ]);
      this.form.controls.sectionId.setValue(nextId);
    } else {
      const matched = existing.find((s) => s.sectionName.toLowerCase() === name.toLowerCase() || s.sectionCode.toLowerCase() === name.toLowerCase());
      this.form.controls.sectionId.setValue(matched?.id ?? 0);
    }
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

