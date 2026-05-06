import { Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, finalize, forkJoin, map, merge, Subject } from 'rxjs';

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
import {
  FilingApplicationService,
  FilingApplicationSaveRequest,
  FilingSaveStatus
} from '../../../services/filing-application.service';

type StepKey = 'DISPUTED_ORDER' | 'ACT_SECTION' | 'PARTIES' | 'VAKALTNAMA' | 'DISPUTED_LAND' | 'APPLICATION_DESCRIPTION';

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

const CATEGORY1_SESSION_VERSION = 1 as const;

interface Category1FilingSession {
  v: typeof CATEGORY1_SESSION_VERSION;
  caseCategoryId: number;
  clientApplicationRef: string;
  applicationId: number | null;
  applicantIdByClientRowKey: Record<string, number>;
  stepIndex: number;
  form: Record<string, unknown>;
  disputedLands: DisputedLandRow[];
  vakaltnamaAssignments: VakaltnamaAssignment[];
  vakaltnamaCoAdvocates: AdvocateLookupResponse[];
  selectedSubject: SubjectRecord | null;
  selectedOffice: OfficeResponse | null;
  mutationDetails: MutationDetailsView | null;
  mutationFound: boolean;
  searchedMutation: boolean;
  notice9Resolved: NoticeNineResolved;
  manualAttachFileName: string | null;
  manualNotice9FileName: string | null;
}

@Component({
  selector: 'app-category1-objection',
  imports: [ReactiveFormsModule, VakaltnamaPanelComponent, DisputedLandPanelComponent],
  templateUrl: './category1-objection.component.html'
})
export class Category1ObjectionComponent {
  /** From parent `/applications/new?caseCategoryId=…`; required for save API. */
  caseCategoryId = input.required<number>();

  private readonly fb = inject(FormBuilder);
  private readonly subjectsApi = inject(SubjectService);
  private readonly lookups = inject(LookupsService);
  private readonly landRecords = inject(LandRecordsService);
  private readonly filingApplications = inject(FilingApplicationService);
  private readonly destroyRef = inject(DestroyRef);

  /** True while re-applying session snapshot (blocks valueChange side effects). */
  private hydrating = false;
  private persistenceSetupDone = false;
  private readonly persistPulse$ = new Subject<void>();

  /** Stable client ref for filing API + session; show in UI. */
  protected readonly filingClientRef = signal('');
  protected readonly serverApplicationId = signal<number | null>(null);
  protected readonly applicantIdByClientRowKeySig = signal<Record<string, number>>({});

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
    },
    {
      key: 'APPLICATION_DESCRIPTION',
      title: 'Application description',
      hint: 'Review all details, add description, save draft or submit'
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
  protected readonly apiMessage = signal<string | null>(null);
  protected readonly saveInProgress = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    subjectId: [0, [Validators.required, Validators.min(1)]],
    districtId: [0, [Validators.required, Validators.min(1)]],
    subdistrictId: [0],
    talukaId: [0, [Validators.required, Validators.min(1)]],
    officeId: [0, [Validators.required, Validators.min(1)]],
    searchMode: ['INWARD_NUMBER' as 'INWARD_NUMBER' | 'SURVEY_NUMBER' | 'MUTATION_NUMBER'],
    // Search value is required only when clicking Search (not for moving next).
    searchValue: ['', [Validators.required, Validators.minLength(2)]],
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
    sectionId: [0, [Validators.required, Validators.min(1)]],
    customSectionName: [''],
    applicationDescription: [''],

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
      name: ['', [Validators.required, Validators.minLength(2)]],
      mobile: [''],
      address: ['', [Validators.required, Validators.minLength(5)]]
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
    this.loadingSubjects.set(true);
    this.loadingDistricts.set(true);

    forkJoin({
      subjects: this.subjectsApi.listSubjects(),
      districts: this.lookups.getDistricts(environment.defaultState?.id || 1)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ subjects, districts }) => {
          this.subjects.set(subjects);
          this.districts.set(districts);
          this.tryRestoreSession();
        },
        error: (err: unknown) => {
          this.apiError.set(this.formatError(err));
          this.loadingSubjects.set(false);
          this.loadingDistricts.set(false);
          this.filingClientRef.set(this.newClientRef());
          this.addApplicant();
          this.addRespondent();
          this.hydrating = false;
          this.setupPersistencePipeline();
        }
      });

    this.loadActs();

    this.form.controls.subjectId.valueChanges.subscribe((subjectId) => {
      if (this.hydrating) return;
      this.selectedSubject.set(this.subjects().find((s) => s.id === subjectId) ?? null);
      this.resetLocationChain();
      if (subjectId && subjectId > 0) {
        this.loadDistricts();
      }
    });

    this.form.controls.districtId.valueChanges.subscribe((districtId) => {
      if (this.hydrating) return;
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
      if (this.hydrating) return;
      this.form.controls.officeId.setValue(0);
      this.offices.set([]);
      this.selectedOffice.set(null);
      if (talukaId && talukaId > 0) {
        this.loadTalukaOffices(talukaId);
      }
    });

    this.form.controls.subdistrictId.valueChanges.subscribe((subdistrictId) => {
      if (this.hydrating) return;
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
      if (this.hydrating) return;
      const id = Number(officeId || 0);
      if (!id) {
        this.selectedOffice.set(null);
        return;
      }
      this.selectedOffice.set(this.offices().find((o) => o.id === id) || null);
    });

    this.form.controls.actId.valueChanges.subscribe((actId) => {
      if (this.hydrating) return;
      this.form.controls.sectionId.setValue(0);
      this.form.controls.customSectionName.setValue('');
      this.sections.set([]);
      if (actId && actId > 0) {
        this.loadSections(actId);
      }
    });
  }

  protected onVakaltnamaAssignmentsChange(rows: VakaltnamaAssignment[]): void {
    this.vakaltnamaAssignments.set(rows);
    this.schedulePersist();
  }

  protected onDisputedLandsChange(rows: DisputedLandRow[]): void {
    this.disputedLands.set(rows);
    this.schedulePersist();
  }

  protected hardResetFiling(): void {
    if (
      !confirm(
        'Clear all data for this application and start fresh? Saved session on this browser will be removed.'
      )
    ) {
      return;
    }
    try {
      sessionStorage.removeItem(this.sessionKey());
    } catch {
      //
    }
    window.location.reload();
  }

  private sessionKey(): string {
    return `rccms.category1.filing.v${CATEGORY1_SESSION_VERSION}.case${this.caseCategoryId()}`;
  }

  private newClientRef(): string {
    const cryptoObj = globalThis.crypto as Crypto | undefined;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
    return `fil-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private readSession(): Category1FilingSession | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(this.sessionKey());
      if (!raw) return null;
      return JSON.parse(raw) as Category1FilingSession;
    } catch {
      return null;
    }
  }

  private writeSession(): void {
    if (this.hydrating || typeof sessionStorage === 'undefined') return;
    try {
      const snapshot: Category1FilingSession = {
        v: CATEGORY1_SESSION_VERSION,
        caseCategoryId: this.caseCategoryId(),
        clientApplicationRef: this.filingClientRef(),
        applicationId: this.serverApplicationId(),
        applicantIdByClientRowKey: { ...this.applicantIdByClientRowKeySig() },
        stepIndex: this.stepIndex(),
        form: this.form.getRawValue() as Record<string, unknown>,
        disputedLands: this.disputedLands(),
        vakaltnamaAssignments: this.vakaltnamaAssignments(),
        vakaltnamaCoAdvocates: this.vakaltnamaCoAdvocates(),
        selectedSubject: this.selectedSubject(),
        selectedOffice: this.selectedOffice(),
        mutationDetails: this.mutationDetails(),
        mutationFound: this.mutationFound(),
        searchedMutation: this.searchedMutation(),
        notice9Resolved: this.notice9Resolved(),
        manualAttachFileName: this.manualAttachFileName(),
        manualNotice9FileName: this.manualNotice9FileName()
      };
      sessionStorage.setItem(this.sessionKey(), JSON.stringify(snapshot));
    } catch {
      //
    }
  }

  protected schedulePersist(): void {
    this.persistPulse$.next();
  }

  private setupPersistencePipeline(): void {
    if (this.persistenceSetupDone) return;
    this.persistenceSetupDone = true;
    merge(
      this.form.valueChanges.pipe(map(() => void 0)),
      this.persistPulse$.pipe(map(() => void 0))
    )
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.hydrating) this.writeSession();
      });
  }

  private tryRestoreSession(): void {
    this.loadingSubjects.set(false);
    this.loadingDistricts.set(false);

    const snap = this.readSession();
    if (!snap || snap.v !== CATEGORY1_SESSION_VERSION || snap.caseCategoryId !== this.caseCategoryId()) {
      this.filingClientRef.set(this.newClientRef());
      this.serverApplicationId.set(null);
      this.applicantIdByClientRowKeySig.set({});
      this.addApplicant();
      this.addRespondent();
      this.hydrating = false;
      this.setupPersistencePipeline();
      return;
    }

    this.hydrating = true;
    this.filingClientRef.set(snap.clientApplicationRef);
    this.serverApplicationId.set(snap.applicationId ?? null);
    this.applicantIdByClientRowKeySig.set({ ...(snap.applicantIdByClientRowKey ?? {}) });
    this.stepIndex.set(snap.stepIndex ?? 0);

    const f = snap.form as {
      applicants?: Array<{ tempId?: string; name?: string; mobile?: string; address?: string }>;
      respondents?: Array<{ tempId?: string; name?: string; mobile?: string; address?: string }>;
      [key: string]: unknown;
    };
    const apps = Array.isArray(f.applicants) ? f.applicants : [];
    const resps = Array.isArray(f.respondents) ? f.respondents : [];
    const { applicants: _a, respondents: _r, ...scalarFields } = f;
    this.rebuildApplicantsAndRespondents(apps, resps);
    this.form.patchValue(scalarFields as object, { emitEvent: false });

    this.disputedLands.set(snap.disputedLands ?? []);
    this.vakaltnamaAssignments.set(snap.vakaltnamaAssignments ?? []);
    this.vakaltnamaCoAdvocates.set(snap.vakaltnamaCoAdvocates ?? []);

    const subjMatch =
      snap.selectedSubject ??
      this.subjects().find((s) => s.id === (scalarFields['subjectId'] as number));
    this.selectedSubject.set(subjMatch ?? null);
    this.selectedOffice.set(snap.selectedOffice ?? null);
    this.mutationDetails.set(snap.mutationDetails);
    this.mutationFound.set(!!snap.mutationFound);
    this.searchedMutation.set(!!snap.searchedMutation);
    this.notice9Resolved.set(
      snap.notice9Resolved ?? {
        available: false,
        sourceKind: null,
        url: null,
        previewKind: 'none'
      }
    );
    this.manualAttachFileName.set(snap.manualAttachFileName ?? null);
    this.manualNotice9FileName.set(snap.manualNotice9FileName ?? null);

    const officeFallback = snap.selectedOffice ?? null;
    this.restoreLocationOfficeAndActChain(scalarFields, officeFallback);
  }

  private rebuildApplicantsAndRespondents(
    applicants: Array<{ tempId?: string; name?: string; mobile?: string; address?: string }>,
    respondents: Array<{ tempId?: string; name?: string; mobile?: string; address?: string }>
  ): void {
    while (this.applicants.length) this.applicants.removeAt(0);
    const appList = applicants.length ? applicants : [{ tempId: this.makeTempId(), name: '', mobile: '', address: '' }];
    for (const r of appList) {
      const g = this.createPartyGroup();
      g.patchValue({ ...r, tempId: r.tempId?.trim() || this.makeTempId() }, { emitEvent: false });
      this.applicants.push(g);
    }

    while (this.respondents.length) this.respondents.removeAt(0);
    const respList = respondents.length ? respondents : [{ tempId: this.makeTempId(), name: '', mobile: '', address: '' }];
    for (const r of respList) {
      const g = this.createPartyGroup();
      g.patchValue({ ...r, tempId: r.tempId?.trim() || this.makeTempId() }, { emitEvent: false });
      this.respondents.push(g);
    }
  }

  private restoreLocationOfficeAndActChain(
    scalarFields: Record<string, unknown>,
    officeFallback: OfficeResponse | null
  ): void {
    const districtId = Number(scalarFields['districtId'] ?? 0);
    const deptId = this.selectedSubject()?.departmentId;
    const subPref = Number(scalarFields['subdistrictId'] ?? 0);

    const finish = (): void => {
      const officeIdSaved = Number(scalarFields['officeId'] ?? 0);
      this.form.controls.officeId.setValue(officeIdSaved, { emitEvent: false });
      this.selectedOffice.set(
        officeFallback ?? this.offices().find((o) => o.id === officeIdSaved) ?? null
      );
      this.restoreSectionsThenHydrationDone(Number(scalarFields['actId'] ?? 0));
    };

    if (!districtId || districtId < 1) {
      this.finalizeHydration();
      return;
    }

    this.lookups.getSubdistricts(districtId).subscribe({
      next: (subs) => {
        this.subdistricts.set(subs);
        this.lookups.getTalukas(districtId, subPref > 0 ? subPref : undefined).subscribe({
          next: (talukaRows) => {
            this.talukas.set(talukaRows);
            const talukaIdNow = Number(scalarFields['talukaId'] ?? 0);
            if (talukaIdNow > 0) {
              this.lookups.getTalukaOffices(talukaIdNow, deptId || undefined).subscribe({
                next: (offices) => {
                  this.offices.set(offices);
                  finish();
                },
                error: () => this.onRestoreChainFail()
              });
            } else {
              this.onRestoreChainFail();
            }
          },
          error: () => this.onRestoreChainFail()
        });
      },
      error: () => this.onRestoreChainFail()
    });
  }

  private restoreSectionsThenHydrationDone(actId: number): void {
    if (actId > 0) {
      this.lookups.getSections(actId).subscribe({
        next: (rows) => {
          this.sections.set(rows);
          this.finalizeHydration();
        },
        error: () => this.finalizeHydration()
      });
    } else {
      this.finalizeHydration();
    }
  }

  private onRestoreChainFail(): void {
    this.finalizeHydration();
  }

  private finalizeHydration(): void {
    this.hydrating = false;
    this.setupPersistencePipeline();
    this.schedulePersist();
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
      this.schedulePersist();
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
        this.schedulePersist();
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
    this.schedulePersist();
  }

  protected onManualNotice9FileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.manualNotice9FileName.set(input.files?.[0]?.name || null);
    this.schedulePersist();
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

  /** After successful final submit: clear session + blank form so user can file again (keeps districts master list). */
  private resetAfterFinalSubmit(): void {
    try {
      sessionStorage.removeItem(this.sessionKey());
    } catch {
      //
    }

    this.hydrating = true;

    this.filingClientRef.set(this.newClientRef());
    this.serverApplicationId.set(null);
    this.applicantIdByClientRowKeySig.set({});
    this.stepIndex.set(0);

    this.disputedLands.set([]);
    this.vakaltnamaAssignments.set([]);
    this.vakaltnamaCoAdvocates.set([]);

    this.mutationDetails.set(null);
    this.mutationFound.set(false);
    this.searchedMutation.set(false);
    this.loadingSearch.set(false);
    this.loadingNotice9.set(false);
    this.notice9Resolved.set({
      available: false,
      sourceKind: null,
      url: null,
      previewKind: 'none'
    });
    this.manualAttachFileName.set(null);
    this.manualNotice9FileName.set(null);

    this.selectedSubject.set(null);
    this.selectedOffice.set(null);

    while (this.applicants.length) this.applicants.removeAt(0);
    while (this.respondents.length) this.respondents.removeAt(0);
    this.applicants.push(this.createPartyGroup());
    this.respondents.push(this.createPartyGroup());

    this.form.patchValue(
      {
        subjectId: 0,
        searchMode: 'INWARD_NUMBER' as const,
        searchValue: '',
        mutationYear: '',
        mutationTypeFilter: '',
        manualInwardNumber: '',
        manualInwardDate: '',
        manualMutationType: '',
        manualApplicantName: '',
        manualVillage: '',
        manualStatus: '',
        actId: 0,
        sectionId: 0,
        customSectionName: '',
        applicationDescription: ''
      },
      { emitEvent: false }
    );

    this.form.controls.districtId.setValue(0, { emitEvent: false });
    this.form.controls.subdistrictId.setValue(0, { emitEvent: false });
    this.form.controls.talukaId.setValue(0, { emitEvent: false });
    this.form.controls.officeId.setValue(0, { emitEvent: false });
    this.subdistricts.set([]);
    this.talukas.set([]);
    this.offices.set([]);
    this.sections.set([]);

    this.form.markAsPristine();
    this.form.markAsUntouched();

    this.hydrating = false;
    this.schedulePersist();
  }

  protected back(): void {
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.stepIndex.set(Math.max(0, this.stepIndex() - 1));
    this.schedulePersist();
  }

  protected next(): void {
    this.apiMessage.set(null);
    this.apiError.set(null);
    if (!this.validateCurrentStep(true)) {
      return;
    }
    this.stepIndex.set(Math.min(this.steps.length - 1, this.stepIndex() + 1));
    this.schedulePersist();
  }

  /** Stepper header: go back freely; jump forward only if every step before the target is valid. */
  protected selectStep(targetIndex: number): void {
    this.apiMessage.set(null);
    const current = this.stepIndex();
    if (targetIndex === current) return;
    if (targetIndex < current) {
      this.apiError.set(null);
      this.stepIndex.set(targetIndex);
      this.schedulePersist();
      return;
    }
    for (let s = current; s < targetIndex; s++) {
      if (!this.validateStepByKey(this.steps[s].key, true)) {
        return;
      }
    }
    this.apiError.set(null);
    this.stepIndex.set(targetIndex);
    this.schedulePersist();
  }

  protected isLastStep(): boolean {
    return this.stepIndex() >= this.steps.length - 1;
  }

  protected validateCurrentStep(markTouched: boolean): boolean {
    return this.validateStepByKey(this.activeStep().key, markTouched);
  }

  private validateStepByKey(key: StepKey, markTouched: boolean): boolean {
    let ok = false;
    switch (key) {
      case 'DISPUTED_ORDER':
        ok = this.validateDisputedOrderStep(markTouched);
        break;
      case 'ACT_SECTION':
        ok = this.validateActSectionStep(markTouched);
        break;
      case 'PARTIES':
        ok = this.validatePartiesStep(markTouched);
        break;
      case 'VAKALTNAMA':
        ok = this.validateVakaltnamaStep();
        break;
      case 'DISPUTED_LAND':
        ok = this.validateDisputedLandStep();
        break;
      case 'APPLICATION_DESCRIPTION':
        ok = true;
        break;
      default:
        ok = true;
    }
    if (!ok && !this.apiError()) {
      this.apiError.set('Please complete this step before continuing.');
    }
    return ok;
  }

  private validateDisputedOrderStep(markTouched: boolean): boolean {
    if (markTouched) {
      this.form.controls.subjectId.markAsTouched();
      this.form.controls.searchValue.markAsTouched();
    }
    const subjectId = this.form.controls.subjectId.getRawValue();
    if (!subjectId || subjectId < 1) {
      this.apiError.set('Please select subject.');
      return false;
    }
    const searchValue = this.form.controls.searchValue.getRawValue().trim();
    if (searchValue.length < 2) {
      this.apiError.set('Enter search value (at least 2 characters) and search.');
      return false;
    }
    if (!this.searchedMutation()) {
      this.apiError.set('Please run Search for mutation details before continuing.');
      return false;
    }
    if (this.mutationFound()) {
      if (this.loadingNotice9()) {
        this.apiError.set('Please wait for Notice 9 to finish loading.');
        return false;
      }
      if (!this.mutationDetails()) {
        this.apiError.set('Mutation details are missing. Search again.');
        return false;
      }
      if (!this.notice9Resolved().available && !this.manualNotice9FileName()) {
        this.apiError.set('Notice 9 is not available from API. Please upload Notice 9.');
        return false;
      }
      return true;
    }
    const m = this.form.controls;
    const manualPairs: Array<{ control: AbstractControl; label: string }> = [
      { control: m.manualInwardNumber, label: 'Inward number' },
      { control: m.manualInwardDate, label: 'Inward date' },
      { control: m.manualMutationType, label: 'Mutation type' },
      { control: m.manualApplicantName, label: 'Applicant name' },
      { control: m.manualVillage, label: 'Village' },
      { control: m.manualStatus, label: 'Status' }
    ];
    for (const { control: c, label } of manualPairs) {
      if (markTouched) c.markAsTouched();
      if (!c.getRawValue().toString().trim()) {
        this.apiError.set(`Please enter ${label} (record not found — manual entry).`);
        return false;
      }
    }
    if (!this.manualAttachFileName()) {
      this.apiError.set('Please select attach file (upload) for the disputed order.');
      return false;
    }
    if (!this.manualNotice9FileName()) {
      this.apiError.set('Please upload Notice 9.');
      return false;
    }
    return true;
  }

  private validateActSectionStep(markTouched: boolean): boolean {
    const c = this.form.controls;
    if (markTouched) {
      c.districtId.markAsTouched();
      c.talukaId.markAsTouched();
      c.officeId.markAsTouched();
      c.actId.markAsTouched();
      c.sectionId.markAsTouched();
    }
    if (!c.districtId.getRawValue() || c.districtId.getRawValue() < 1) {
      this.apiError.set('Please select district.');
      return false;
    }
    if (!c.talukaId.getRawValue() || c.talukaId.getRawValue() < 1) {
      this.apiError.set('Please select taluka.');
      return false;
    }
    if (!c.officeId.getRawValue() || c.officeId.getRawValue() < 1) {
      this.apiError.set('Please select office (wait for offices to load after taluka).');
      return false;
    }
    if (!c.actId.getRawValue() || c.actId.getRawValue() < 1) {
      this.apiError.set('Please select act.');
      return false;
    }
    const sectionId = c.sectionId.getRawValue();
    if (sectionId === -1) {
      this.apiError.set('Choose a section from the list, or enter a custom section and click Add section.');
      return false;
    }
    if (!sectionId || sectionId < 1) {
      this.apiError.set('Please select section.');
      return false;
    }
    return true;
  }

  private validatePartiesStep(markTouched: boolean): boolean {
    if (markTouched) {
      this.applicants.controls.forEach((g) => g.markAllAsTouched());
      this.respondents.controls.forEach((g) => g.markAllAsTouched());
    }
    if (!this.applicants.valid) {
      this.apiError.set('Please complete all applicant details (name, 10-digit mobile, address).');
      return false;
    }
    if (!this.respondents.valid) {
      this.apiError.set('Please complete all respondent details (name, 10-digit mobile, address).');
      return false;
    }
    return true;
  }

  private validateVakaltnamaStep(): boolean {
    const assignments = this.vakaltnamaAssignments();
    if (assignments.length < 1) {
      this.apiError.set('Create at least one vakaltnama group with advocate and applicants.');
      return false;
    }
    const applicantIds = this.applicantOptions().map((a) => a.id);
    const covered = new Set<string>();
    for (const g of assignments) {
      for (const id of g.applicantIds) {
        covered.add(id);
      }
    }
    for (const id of applicantIds) {
      if (!covered.has(id)) {
        this.apiError.set('Each applicant must be assigned to exactly one vakaltnama group.');
        return false;
      }
    }
    if (covered.size !== applicantIds.length) {
      this.apiError.set('Vakaltnama groups must cover each applicant once (no duplicate assignments).');
      return false;
    }
    return true;
  }

  private validateDisputedLandStep(): boolean {
    if (this.disputedLands().length < 1) {
      this.apiError.set('Add at least one disputed land record.');
      return false;
    }
    return true;
  }

  /**
   * Backend validates land type with `landType`; keep existing `type` too for UI/session compatibility.
   */
  private buildDisputedLandsPayload(): Array<Record<string, unknown>> {
    return this.disputedLands().map((row, index) => {
      if (row.type === 'RURAL_7_12') {
        return {
          lineNo: index + 1,
          landType: row.type,
          externalSource: 'LAND_RECORDS_API',
          districtCode: row.districtCode,
          districtName: row.districtName,
          talukaCode: row.talukaCode,
          talukaName: row.talukaName,
          villageLgdCode: row.villageLgdCode,
          villageName: row.villageName,
          surveyPin: row.pin,
          pin1: row.pinParts.pin1,
          pin2: row.pinParts.pin2,
          pin3: row.pinParts.pin3,
          pin4: row.pinParts.pin4,
          pin5: row.pinParts.pin5,
          pin6: row.pinParts.pin6,
          pin7: row.pinParts.pin7,
          pin8: row.pinParts.pin8
        };
      }
      return {
        lineNo: index + 1,
        landType: row.type,
        externalSource: 'LAND_RECORDS_API',
        districtCode: row.districtCode,
        districtName: row.districtName,
        officeCode: row.officeCode,
        officeName: row.officeName,
        villageCode: row.villageCode,
        villageName: row.villageName,
        ctsNo: row.ctsNo
      };
    });
  }

  private buildFormPayload(): Record<string, unknown> {
    const raw = this.form.getRawValue() as Record<string, unknown>;
    const applicants = this.applicants.controls.map((ctrl, i) => {
      const row = (ctrl as any).getRawValue?.() as {
        tempId?: string;
        name?: string;
        mobile?: string;
        address?: string;
      };
      const key = (row?.tempId || this.makeTempId()).trim();
      return {
        lineNo: i + 1,
        tempId: key,
        clientRowKey: key,
        name: row?.name || '',
        mobile: row?.mobile || '',
        address: row?.address || ''
      };
    });
    const respondents = this.respondents.controls.map((ctrl, i) => {
      const row = (ctrl as any).getRawValue?.() as {
        tempId?: string;
        name?: string;
        mobile?: string;
        address?: string;
      };
      const key = (row?.tempId || this.makeTempId()).trim();
      return {
        lineNo: i + 1,
        clientRowKey: key,
        name: row?.name || '',
        mobile: row?.mobile || '',
        address: row?.address || ''
      };
    });
    return {
      ...raw,
      sectionCustomText: (raw['customSectionName'] as string) || null,
      applicants,
      respondents,
      vakalatnamaAssignments: this.vakaltnamaAssignments()
    };
  }

  private buildDisputedOrderPayload(): Record<string, unknown> {
    const n9 = this.notice9Resolved();
    return {
      searchMode: this.form.controls.searchMode.getRawValue(),
      searchValue: this.form.controls.searchValue.getRawValue().trim(),
      mutationFound: this.mutationFound(),
      mutationSearched: this.searchedMutation(),
      mutationDetails: this.mutationDetails(),
      manualInwardNumber: this.form.controls.manualInwardNumber.getRawValue() || null,
      manualInwardDate: this.form.controls.manualInwardDate.getRawValue() || null,
      manualMutationType: this.form.controls.manualMutationType.getRawValue() || null,
      manualApplicantName: this.form.controls.manualApplicantName.getRawValue() || null,
      manualVillage: this.form.controls.manualVillage.getRawValue() || null,
      manualStatus: this.form.controls.manualStatus.getRawValue() || null,
      notice9Resolved: {
        available: n9.available,
        sourceKind: n9.sourceKind ? n9.sourceKind.toUpperCase() : null,
        url: n9.url,
        previewKind: n9.previewKind
      }
    };
  }

  private validateApplicationDescriptionStep(markTouched: boolean): boolean {
    const c = this.form.controls.applicationDescription;
    if (markTouched) c.markAsTouched();
    const v = c.getRawValue().trim();
    if (v.length < 10) {
      this.apiError.set('Please enter application description (at least 10 characters).');
      return false;
    }
    return true;
  }

  private validateAllStepsForSubmit(): boolean {
    for (let i = 0; i < this.steps.length; i++) {
      const key = this.steps[i].key;
      const ok = key === 'APPLICATION_DESCRIPTION' ? this.validateApplicationDescriptionStep(true) : this.validateStepByKey(key, true);
      if (!ok) {
        this.stepIndex.set(i);
        return false;
      }
    }
    return true;
  }

  protected selectedSubjectLabel(): string {
    return this.selectedSubject()?.subjectName || '';
  }

  protected selectedDistrictLabel(): string {
    const districtId = this.form.controls.districtId.getRawValue();
    return this.districts().find((d) => d.id === districtId)?.name || '';
  }

  protected selectedTalukaLabel(): string {
    const talukaId = this.form.controls.talukaId.getRawValue();
    return this.talukas().find((t) => t.id === talukaId)?.name || '';
  }

  protected selectedActLabel(): string {
    const actId = this.form.controls.actId.getRawValue();
    return this.acts().find((a) => a.id === actId)?.actName || '';
  }

  protected selectedSectionLabel(): string {
    const sectionId = this.form.controls.sectionId.getRawValue();
    return this.sections().find((s) => s.id === sectionId)?.sectionName || '';
  }

  protected assignmentApplicantsLabel(ids: string[]): string {
    const map = new Map((this.applicantOptions() ?? []).map((a) => [a.id, a.name]));
    const names = ids.map((id) => map.get(id) ?? id).filter(Boolean);
    return names.join(', ');
  }

  protected saveDraft(): void {
    this.apiMessage.set(null);
    this.postSave('DRAFT');
  }

  protected finalSubmit(): void {
    this.apiMessage.set(null);
    this.postSave('FINAL');
  }

  private postSave(mode: 'DRAFT' | 'FINAL'): void {
    const status: FilingSaveStatus = mode === 'FINAL' ? 'SUBMITTED' : 'DRAFT';
    const appId = this.serverApplicationId();
    const body: FilingApplicationSaveRequest = {
      status,
      caseCategoryId: this.caseCategoryId(),
      clientApplicationRef: this.filingClientRef(),
      ...(appId != null && appId > 0 ? { applicationId: appId } : {}),
      form: this.buildFormPayload(),
      disputedOrder: this.buildDisputedOrderPayload(),
      disputedLands: this.buildDisputedLandsPayload(),
      attachments: []
    };
    this.saveInProgress.set(true);
    this.filingApplications
      .save(body)
      .pipe(finalize(() => this.saveInProgress.set(false)))
      .subscribe({
        next: (resp) => {
          this.apiError.set(null);
          this.apiMessage.set(
            status === 'DRAFT'
              ? 'Draft saved successfully.'
              : 'Application submitted successfully. The form has been cleared — you can start a new filing.'
          );

          if (status === 'SUBMITTED') {
            this.resetAfterFinalSubmit();
            return;
          }

          if (resp?.applicationId != null && resp.applicationId > 0) {
            this.serverApplicationId.set(resp.applicationId);
          }
          if (resp?.applicantIdByClientRowKey && typeof resp.applicantIdByClientRowKey === 'object') {
            this.applicantIdByClientRowKeySig.set(resp.applicantIdByClientRowKey as Record<string, number>);
          }
          this.schedulePersist();
        },
        error: (err: unknown) => this.apiError.set(this.formatError(err))
      });
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
    this.schedulePersist();
  }

  private formatError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (typeof body === 'string' && body.trim()) return body.trim();
      if (body && typeof body === 'object') {
        const o = body as Record<string, unknown>;
        const e = o['error'];
        const m = o['message'];
        const detail = o['detail'];
        if (typeof e === 'string') return e;
        if (typeof m === 'string') return m;
        if (typeof detail === 'string') return detail;
        if (Array.isArray(o['errors'])) return JSON.stringify(o['errors']);
        try {
          return JSON.stringify(o);
        } catch {
          //
        }
      }
      return `Request failed (${err.status}).`;
    }
    return 'Request failed.';
  }

}

