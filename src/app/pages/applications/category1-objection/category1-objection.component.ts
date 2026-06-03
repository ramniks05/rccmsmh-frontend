import { Component, computed, DestroyRef, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, finalize, forkJoin, map, merge, of, Subject, switchMap } from 'rxjs';
import {
  distinctUntilChanged,
} from 'rxjs';
import { SubjectRecord, SubjectService } from '../../../services/subject.service';
import {
  LookupsService,
  BoundaryMasterResponse,
  OfficeResponse,
  ActLookupResponse,
  SectionLookupResponse,
  PincodePostOffice,
  OccupationLookupResponse
} from '../../../services/lookups.service';
import { environment } from '../../../../environments/environment';
import { AdvocateLookupResponse } from '../../../services/advocate-by-bar-council.service';
import { VakaltnamaPanelComponent } from '../vakaltnama-panel/vakaltnama-panel.component';
import { DisputedLandPanelComponent } from '../disputed-land-panel/disputed-land-panel.component';
import { MappedDocumentsPanelComponent } from '../mapped-documents-panel/mapped-documents-panel.component';
import { ParagraphListEditorComponent } from '../paragraph-list-editor/paragraph-list-editor.component';
import { PartyDialogComponent } from '../party-dialog/party-dialog.component';
import { FilingMappedAttachment } from '../../../services/mapped-documents.service';
import {
  DisputedLandRow,
  RuralDisputedLandContext
} from '../disputed-land-panel/disputed-land-panel.component';
import {
  FILING_AFFIDAVIT_FORMAT_URL,
  FILING_PRAYER_FORMAT_URL
} from '../../../shared/filing-text-templates';
import {
  buildAffidavitTemplateHtml,
  buildFilingDescriptionTemplateContext,
  buildPrayerTemplateHtml,
  openFilingDocumentHtml
} from '../../../shared/filing-affidavit-prayer.util';
import { TokenStorageService } from '../../../services/token-storage.service';
import { ApplicantOption, VakaltnamaAssignment } from '../vakaltnama-panel/vakaltnama-panel.component';
import { formatRuralPinParts } from '../../../shared/land-display.util';
import {
  LandRecordsService,
  NoticeNineViewResponse,
  RuralDistrict,
  RuralSubSurveyRow,
  RuralTaluka,
  RuralVillage,
  UrbanMutationDetailResponse,
  UrbanDistrict,
  UrbanOffice,
  UrbanVillage,
  UrbanCtsRow,
  UrbanMutationListRow,
  UrbanMutationTypeOption
} from '../../../services/land-records.service';
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

interface PartyAddressLookupState {
  postOffices: PincodePostOffice[];
  talukas: string[];
  districts: string[];
  states: string[];
  loading: boolean;
  error: string | null;
}

export interface MutationDetailsView {
  inwardNumber: string;
  inwardDate: string;
  districtName?: string;
  mutationNumber?: string;
  mutationDate?: string;
  mutationType: string;
  applicantName: string;
  village: string;
  status: string;
  notice9DispatchDate?: string;
  notice9DispatchNumber?: string;
  ctsNumber?: string;
  mobileNumber?: string;
  pinCode?: string;
  attachFileUrl: string | null;
  notice9Url: string | null;
}

const CATEGORY1_SESSION_VERSION = 2 as const;

interface Category1FilingSession {
  v: typeof CATEGORY1_SESSION_VERSION;
  caseCategoryId: number;
  clientApplicationRef: string;
  applicationId: number | null;
  applicantIdByClientRowKey: Record<string, number>;
  stepIndex: number;
  /** Preferred restore target when step order changes. */
  activeStepKey?: StepKey;
  form: Record<string, unknown>;
  disputedLands: DisputedLandRow[];
  vakaltnamaAssignments: VakaltnamaAssignment[];
  vakaltnamaCoAdvocates: AdvocateLookupResponse[];
  selectedSubject: SubjectRecord | null;
  selectedOffice: OfficeResponse | null;
  epicsUrbanOfficeSnapshot?: { code: string; name: string } | null;
  mutationDetails: MutationDetailsView | null;
  mutationFound: boolean;
  searchedMutation: boolean;
  rural712Searched?: boolean;
  rural712SubSurveyRows?: RuralSubSurveyRow[];
  selectedRural712Index?: number | null;
  rural712LandDetails?: Record<string, unknown>[];
  rural712SatbaraSigned?: boolean | null;
  rural712SatbaraMessage?: string | null;
  notice9Resolved: NoticeNineResolved;
  notice9InwardRef?: string | null;
  manualAttachFileName: string | null;
  manualNotice9FileName: string | null;
  applicantPincodeLookup?: Record<string, PartyAddressLookupState>;
  respondentPincodeLookup?: Record<string, PartyAddressLookupState>;
  actsSnapshot?: ActLookupResponse[];
  sectionsSnapshot?: SectionLookupResponse[];
  subdistrictsSnapshot?: BoundaryMasterResponse[];
  talukasSnapshot?: BoundaryMasterResponse[];
  officesSnapshot?: OfficeResponse[];
  mappedAttachments?: FilingMappedAttachment[];
  urbanSearchSubCtsRowsSnapshot?: UrbanCtsRow[];
  urbanSearchMutationsSnapshot?: UrbanMutationListRow[];
  mutationSuggestionsSnapshot?: UrbanMutationDetailResponse[];
}

@Component({
  selector: 'app-category1-objection',
  imports: [
    ReactiveFormsModule,
    VakaltnamaPanelComponent,
    DisputedLandPanelComponent,
    MappedDocumentsPanelComponent,
    ParagraphListEditorComponent,
    PartyDialogComponent
  ],
  templateUrl: './category1-objection.component.html',
  styleUrl: './category1-objection.component.css'
})
export class Category1ObjectionComponent {
  caseCategoryId = input.required<number>();

  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly subjectsApi = inject(SubjectService);
  private readonly lookups = inject(LookupsService);
  private readonly landRecords = inject(LandRecordsService);
  private readonly filingApplications = inject(FilingApplicationService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private hydrating = false;
  private persistenceSetupDone = false;
  private readonly persistPulse$ = new Subject<void>();
  private latestMutationSearchToken = 0;

  protected readonly filingClientRef = signal('');
  private clientRefDatePart = '';
  private clientRefUniqueSuffix = '';
  protected readonly serverApplicationId = signal<number | null>(null);
  protected readonly applicantIdByClientRowKeySig = signal<Record<string, number>>({});

  protected readonly steps: Step[] = [
    { key: 'DISPUTED_ORDER', title: 'Disputed document/order', hint: 'Select subject and review order details' },
    {
      key: 'DISPUTED_LAND',
      title: 'Disputed land details',
      hint: 'Add plots and enter disputed area'
    },
    { key: 'ACT_SECTION', title: 'Case act and PO', hint: 'Select act and section' },
    { key: 'PARTIES', title: 'Applicant/Respondent details', hint: 'Add parties with mobile number and address' },
    {
      key: 'VAKALTNAMA',
      title: 'Vakaltnama',
      hint: 'Filing advocate and co-advocates (search by bar council number)'
    },
    {
      key: 'APPLICATION_DESCRIPTION',
      title: 'Application description',
      hint: 'Review all details, add description, save draft or submit'
    }
  ];

  protected readonly stepIndex = signal(0);
  protected readonly activeStep = computed(() => this.steps[this.stepIndex()]);

  protected readonly stepProgressPercent = computed(() => {
    const total = this.steps.length;
    if (total <= 1) return 100;
    return Math.round((this.stepIndex() / (total - 1)) * 100);
  });

  protected readonly vakaltnamaCoAdvocates = signal<AdvocateLookupResponse[]>([]);
  protected readonly vakaltnamaAssignments = signal<VakaltnamaAssignment[]>([]);
  protected readonly disputedLands = signal<DisputedLandRow[]>([]);
  protected readonly mappedAttachments = signal<FilingMappedAttachment[]>([]);
  protected readonly descriptionParagraphs = signal<string[]>(['']);
  protected readonly affidavitFormatUrl = FILING_AFFIDAVIT_FORMAT_URL;
  protected readonly prayerFormatUrl = FILING_PRAYER_FORMAT_URL;
  private readonly mappedDocsPanel = viewChild(MappedDocumentsPanelComponent);

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
  protected readonly isEpicsSubject = computed(() => {
    const subject = this.selectedSubject();
    if (!subject) return false;
    const code = String(subject.subjectCode || '').trim().toUpperCase();
    const name = String(subject.subjectName || '').trim().toUpperCase();
    return code === '002' || name.includes('EPICS') || name.includes('EPCS');
  });

  protected readonly isRural712Subject = computed(() => {
    const subject = this.selectedSubject();
    if (!subject) return false;
    if (this.isEpicsSubject()) return false;
    const code = String(subject.subjectCode || '').trim().toUpperCase();
    const name = String(subject.subjectName || '').trim().toUpperCase();
    return (
      code === '001' ||
      name.includes('7/12') ||
      name.includes('712') ||
      name.includes('ROR') ||
      name.includes('रोखा') ||
      name.includes('EFARFAR') ||
      name.includes('E-FERFAR') ||
      name.includes('FERFAR') ||
      name.includes('ईफेरफार') ||
      name.includes('फेरफार')
    );
  });

  protected readonly activeStepHint = computed(() => {
    const step = this.activeStep();
    if (step.key === 'DISPUTED_ORDER') {
      if (this.isRural712Subject()) {
        return 'Select Eferfar (7/12) subject, search the plot and review order details';
      }
      if (this.isEpicsSubject()) {
        return 'Select ePICS subject, search mutation and review order details';
      }
    }
    if (step.key === 'DISPUTED_LAND') {
      if (this.isRural712Subject()) {
        return 'Add disputed 7/12 plots and enter disputed area';
      }
      if (this.isEpicsSubject()) {
        return 'Confirm property and enter disputed area';
      }
    }
    return step.hint;
  });
  protected readonly selectedOffice = signal<OfficeResponse | null>(null);

  protected readonly mutationDetails = signal<MutationDetailsView | null>(null);
  protected readonly mutationSuggestions = signal<UrbanMutationDetailResponse[]>([]);
  protected readonly mutationFound = signal(false);
  protected readonly searchedMutation = signal(false);
  protected readonly loadingNotice9 = signal(false);
  protected readonly notice9ModalOpen = signal(false);
  protected readonly notice9ModalError = signal<string | null>(null);
  protected readonly notice9Resolved = signal<NoticeNineResolved>({
    available: false,
    sourceKind: null,
    url: null,
    previewKind: 'none'
  });
  protected readonly manualAttachFileName = signal<string | null>(null);
  protected readonly manualNotice9FileName = signal<string | null>(null);

  protected readonly loadingSearch = signal(false);
  protected readonly loadingUrbanSearchChain = signal(false);
  protected readonly apiMessage = signal<string | null>(null);
  protected readonly saveInProgress = signal(false);
  protected readonly occupations = signal<OccupationLookupResponse[]>([]);
  protected readonly applicantPincodeLookup = signal<Record<string, PartyAddressLookupState>>({});
  protected readonly respondentPincodeLookup = signal<Record<string, PartyAddressLookupState>>({});

  protected readonly isPartyDialogOpen = signal(false);
  protected readonly partyDialogRole = signal<'applicant' | 'respondent'>('applicant');
  protected readonly partyDialogMode = signal<'add' | 'edit'>('add');
  protected readonly partyDialogIndex = signal<number>(-1);
  protected readonly dialogError = signal<string | null>(null);
  private partyGroupBackupValue: any = null;

  protected readonly activePartyControl = computed(() => {
    const role = this.partyDialogRole();
    const idx = this.partyDialogIndex();
    if (idx < 0) return null;
    const arr = role === 'applicant' ? this.applicants : this.respondents;
    return (arr.at(idx) as FormGroup) || null;
  });

  protected getPartyFullName(control: AbstractControl): string {
    const v = (control as FormGroup).getRawValue();
    const fullName = [v.firstName || '', v.middleName || '', v.lastName || ''].join(' ').trim();
    return fullName || v.name || '(no name)';
  }

  protected openAddPartyDialog(role: 'applicant' | 'respondent'): void {
    this.partyDialogRole.set(role);
    this.partyDialogMode.set('add');
    this.dialogError.set(null);
    
    if (role === 'applicant') {
      const g = this.createPartyGroup();
      this.applicants.push(g);
      this.ensureLookupState('applicant', g.controls.tempId.getRawValue());
      this.partyDialogIndex.set(this.applicants.length - 1);
    } else {
      const g = this.createPartyGroup();
      this.respondents.push(g);
      this.ensureLookupState('respondent', g.controls.tempId.getRawValue());
      this.partyDialogIndex.set(this.respondents.length - 1);
    }
    
    this.isPartyDialogOpen.set(true);
  }

  protected openEditPartyDialog(role: 'applicant' | 'respondent', index: number): void {
    this.partyDialogRole.set(role);
    this.partyDialogMode.set('edit');
    this.partyDialogIndex.set(index);
    this.dialogError.set(null);
    
    const arr = role === 'applicant' ? this.applicants : this.respondents;
    const group = arr.at(index);
    if (group) {
      this.partyGroupBackupValue = group.getRawValue();
    }
    
    this.isPartyDialogOpen.set(true);
  }

  protected closePartyDialog(save: boolean): void {
    const role = this.partyDialogRole();
    const mode = this.partyDialogMode();
    const idx = this.partyDialogIndex();
    const arr = role === 'applicant' ? this.applicants : this.respondents;
    
    if (!save) {
      if (mode === 'add' && idx >= 0 && idx < arr.length) {
        arr.removeAt(idx);
      } else if (mode === 'edit' && idx >= 0 && idx < arr.length && this.partyGroupBackupValue) {
        arr.at(idx).patchValue(this.partyGroupBackupValue, { emitEvent: false });
      }
      this.isPartyDialogOpen.set(false);
      this.partyDialogIndex.set(-1);
      this.partyGroupBackupValue = null;
      this.dialogError.set(null);
      this.schedulePersist();
    } else {
      if (idx >= 0 && idx < arr.length) {
        const group = arr.at(idx);
        group.markAllAsTouched();
        if (group.invalid) {
          this.dialogError.set('Please fill all required fields in the party form.');
          return;
        }
      }
      this.dialogError.set(null);
      this.isPartyDialogOpen.set(false);
      this.partyDialogIndex.set(-1);
      this.partyGroupBackupValue = null;
      this.schedulePersist();
    }
  }
  protected readonly urbanSearchDistricts = signal<UrbanDistrict[]>([]);
  protected readonly urbanSearchOffices = signal<UrbanOffice[]>([]);
  protected readonly epicsUrbanOfficeSnapshot = signal<{ code: string; name: string } | null>(null);
  protected readonly urbanSearchVillages = signal<UrbanVillage[]>([]);
  protected readonly urbanSearchSubCtsRows = signal<UrbanCtsRow[]>([]);
  protected readonly urbanSearchMutations = signal<UrbanMutationListRow[]>([]);
  protected readonly urbanMutationTypeOptions = signal<UrbanMutationTypeOption[]>([]);
  protected readonly loadingUrbanMutationTypes = signal(false);
  protected readonly filteredUrbanSearchMutations = computed(() => {
    return this.urbanSearchMutations();
  });

  protected readonly ruralSearchDistricts = signal<RuralDistrict[]>([]);
  protected readonly ruralSearchTalukas = signal<RuralTaluka[]>([]);
  protected readonly ruralSearchVillages = signal<RuralVillage[]>([]);
  protected readonly rural712SubSurveyRows = signal<RuralSubSurveyRow[]>([]);
  protected readonly loadingRural712Search = signal(false);
  protected readonly rural712Searched = signal(false);
  protected readonly selectedRural712Index = signal<number | null>(null);
  protected readonly rural712LandDetails = signal<Record<string, unknown>[]>([]);
  protected readonly loadingRural712LandDetail = signal(false);
  protected readonly rural712LandDetailError = signal<string | null>(null);
  protected readonly rural712SatbaraSigned = signal<boolean | null>(null);
  protected readonly rural712SatbaraMessage = signal<string | null>(null);
  protected readonly loadingRural712SatbaraCheck = signal(false);
  protected readonly rural712SatbaraCheckError = signal<string | null>(null);
  protected readonly loadingRural712SatbaraPdf = signal(false);
  protected readonly rural712SatbaraPdfError = signal<string | null>(null);
  protected readonly rural712SatbaraPdfUrl = signal<string | null>(null);

  protected readonly rural712LandDetailColumns = computed(() => {
    const rows = this.rural712LandDetails();
    if (!rows.length) return [] as string[];
    const keys = new Set<string>();
    for (const row of rows.slice(0, 10)) {
      Object.keys(row).forEach((k) => keys.add(k));
    }
    return Array.from(keys);
  });

  protected readonly selectedRural712Row = computed(() => {
    const idx = this.selectedRural712Index();
    const rows = this.rural712SubSurveyRows();
    if (idx == null || idx < 0 || idx >= rows.length) return null;
    return rows[idx];
  });

  protected readonly form = this.fb.nonNullable.group({
    subjectId: [0, [Validators.required, Validators.min(1)]],
    districtId: [0],
    subdistrictId: [0],
    talukaId: [0],
    officeId: [0],
    searchMode: ['INWARD_NUMBER' as 'INWARD_NUMBER' | 'SURVEY_NUMBER' | 'MUTATION_NUMBER'],
    searchValue: ['', [Validators.required, Validators.minLength(2)]],
    mutationYear: [''],
    mutationTypeFilter: [''],
    ruralDistrictCode: [''],
    ruralTalukaCode: [''],
    ruralVillageLgdCode: [''],
    ruralSurveyPin: [''],
    urbanDistrictCode: [''],
    urbanOfficeCode: [''],
    urbanVillageCode: [''],
    ctsNoInput: [''],
    selectedSubCtsNo: [''],
    selectedInwardNumber: [''],
    selectedUrbanMutationTypeCode: [''],
    mutationNumberInput: [''],
    manualInwardNumber: [''],
    manualInwardDate: [''],
    manualMutationType: [''],
    manualApplicantName: [''],
    manualVillage: [''],
    manualStatus: [''],
    actId: [0, [Validators.required, Validators.min(1)]],
    sectionId: [0, [Validators.required, Validators.min(1)]],
    customSectionName: [''],
    applicationDescription: [''],
    affidavitText: [''],
    prayerText: [''],
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
    const group = this.fb.nonNullable.group({
      tempId: [this.makeTempId()],
      name: [''],
      firstName: ['', [Validators.required]],
      firstNameMr: [''],
      middleName: [''],
      middleNameMr: [''],
      lastName: ['', [Validators.required]],
      lastNameMr: [''],
      pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      district: ['', [Validators.required]],
      taluka: ['', [Validators.required]],
      village: ['', [Validators.required]],
      villageValue: [''],
      address: ['', [Validators.required, Validators.minLength(5)]],
      addressMr: [''],
      email: ['', [Validators.email]],
      mobile: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      dob: [''],
      age: [''],
      occupation: [''],
      occupationMr: ['']
    });
    this.setupPartyGroupSubscriptions(group);
    return group;
  }

  private readonly applicantsValue = toSignal(
    merge(
      of(null),
      this.applicants.valueChanges
    )
  );

  protected readonly applicantOptions = computed((): ApplicantOption[] => {
    this.applicantsValue();
    return this.partyOptionsFromFormArray(this.applicants, 'Applicant');
  });

  private readonly respondentsValue = toSignal(
    merge(
      of(null),
      this.respondents.valueChanges
    )
  );

  protected readonly respondentOptions = computed((): ApplicantOption[] => {
    this.respondentsValue();
    return this.partyOptionsFromFormArray(this.respondents, 'Respondent');
  });

  private partyOptionsFromFormArray(arr: FormArray, fallbackLabel: string): ApplicantOption[] {
    return arr.controls.map((c) => {
      const v = (c as any).getRawValue?.() as
        | {
            tempId?: string;
            firstName?: string;
            middleName?: string;
            lastName?: string;
            name?: string;
            mobile?: string;
            email?: string;
            address?: string;
            village?: string;
            taluka?: string;
            district?: string;
          }
        | undefined;
      const id = v?.tempId || this.makeTempId();
      const fullName = [v?.firstName || '', v?.middleName || '', v?.lastName || ''].join(' ').trim();
      const name = fullName || (v?.name || '').trim() || fallbackLabel;
      return {
        id,
        name,
        mobile: v?.mobile,
        email: v?.email,
        address: v?.address,
        village: v?.village,
        taluka: v?.taluka,
        district: v?.district
      };
    });
  }

  protected filingDistrictForVakalatnama(): string {
    if (this.isRural712Subject()) {
      const ruralCode = (this.form.controls.ruralDistrictCode.getRawValue() || '').trim();
      if (ruralCode) {
        const ruralRow = this.ruralSearchDistricts().find((d) => d.district_code === ruralCode);
        if (ruralRow?.district_name?.trim()) return ruralRow.district_name.trim();
      }
    }
    const fromApi = this.mutationDetails()?.districtName?.trim();
    if (fromApi) return fromApi;
    const code = (this.form.controls.urbanDistrictCode.getRawValue() || '').trim();
    if (!code) return '';
    const row = this.urbanSearchDistricts().find((d) => d.district_code === code);
    return (row?.district_name || '').trim();
  }

  protected filingOfficeNameForVakalatnama(): string {
    const urban = this.epicsUrbanOfficeFromStep1();
    if (urban?.office_name?.trim()) return urban.office_name.trim();
    const code = this.form.controls.urbanOfficeCode.getRawValue().trim();
    const snap = this.epicsUrbanOfficeSnapshot();
    if (code && snap?.code === code && snap.name?.trim()) return snap.name.trim();
    const off = this.selectedOffice();
    if (off?.name?.trim()) return off.name.trim();
    return '';
  }

  private makeTempId(): string {
    const cryptoObj = globalThis.crypto as Crypto | undefined;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
    return `app-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  protected addApplicant(): void {
    const g = this.createPartyGroup();
    this.applicants.push(g);
    this.ensureLookupState('applicant', g.controls.tempId.getRawValue());
  }

  protected removeApplicant(index: number): void {
    if (confirm('Are you sure you want to remove this applicant?')) {
      this.applicants.removeAt(index);
      this.schedulePersist();
    }
  }

  protected addRespondent(): void {
    const g = this.createPartyGroup();
    this.respondents.push(g);
    this.ensureLookupState('respondent', g.controls.tempId.getRawValue());
  }

  protected removeRespondent(index: number): void {
    if (confirm('Are you sure you want to remove this respondent?')) {
      this.respondents.removeAt(index);
      this.schedulePersist();
    }
  }

  // ─── Mutation suggestion helpers ───────────────────────────────────────────

  /** Read party fields from mutation API (snake_case or camelCase). */
  private mutationPartyFields(detail: UrbanMutationDetailResponse | Record<string, unknown>): {
    applicantName: string;
    mobile: string;
    email: string;
    pincode: string;
    address: string;
    city: string;
    districtName: string;
    taluka: string;
    stateName: string;
  } {
    const d = detail as Record<string, unknown>;
    const pick = (...keys: string[]): string => {
      for (const k of keys) {
        const v = d[k];
        if (v != null && String(v).trim()) return String(v).trim();
      }
      return '';
    };
    const address = pick('address', 'address_line', 'addressLine');
    const city = pick('city');
    return {
      applicantName: pick('applicant_name', 'applicantName', 'name', 'applicant'),
      mobile: pick('mobile_number', 'mobileNumber', 'mobile'),
      email: pick('email_id', 'emailId', 'email'),
      pincode: pick('pin_code', 'pinCode', 'pincode'),
      address,
      city,
      districtName: pick('district_name', 'districtName', 'district'),
      taluka: pick('taluka', 'taluka_name', 'talukaName'),
      stateName: pick('state_name', 'stateName', 'state')
    };
  }

  protected suggestionDisplayName(detail: UrbanMutationDetailResponse): string {
    return this.mutationPartyFields(detail).applicantName || '(no name)';
  }

  private parseSuggestionName(fullName: string): { firstName: string; middleName: string; lastName: string } {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' };
    if (parts.length === 2) return { firstName: parts[0], middleName: '', lastName: parts[1] };
    return {
      firstName: parts[0],
      middleName: parts.slice(1, -1).join(' '),
      lastName: parts[parts.length - 1]
    };
  }

  protected applySuggestion(detail: UrbanMutationDetailResponse, role: 'applicant' | 'respondent'): void {
    const fields = this.mutationPartyFields(detail);
    if (!fields.applicantName && !fields.mobile) {
      this.apiError.set('No name or mobile found in this search result — run Search on step 1 again.');
      return;
    }

    const arr = role === 'applicant' ? this.applicants : this.respondents;

    let targetIndex = -1;
    let isNewRow = false;
    for (let i = 0; i < arr.length; i++) {
      const g = arr.at(i) as ReturnType<Category1ObjectionComponent['createPartyGroup']>;
      if (!g.controls.firstName.getRawValue().trim()) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) {
      if (role === 'applicant') {
        this.addApplicant();
      } else {
        this.addRespondent();
      }
      targetIndex = arr.length - 1;
      isNewRow = true;
    }

    const group = arr.at(targetIndex) as ReturnType<Category1ObjectionComponent['createPartyGroup']>;
    const backupValue = group.getRawValue();
    const { firstName, middleName, lastName } = this.parseSuggestionName(fields.applicantName);

    const addressParts = [fields.address, fields.city]
      .filter(Boolean)
      .join(', ');

    group.patchValue(
      {
        firstName,
        middleName,
        lastName,
        mobile: fields.mobile,
        email: fields.email,
        address: addressParts,
        pincode: fields.pincode,
        district: fields.districtName,
        taluka: fields.taluka
      },
      { emitEvent: true }
    );

    if (/^\d{6}$/.test(fields.pincode)) {
      this.lookupPincode(role, targetIndex, () => this.prefillPartyAddressFromMutation(role, targetIndex, fields));
    } else {
      this.prefillPartyAddressFromMutation(role, targetIndex, fields);
    }

    this.apiError.set(null);
    this.dialogError.set(null);
    this.schedulePersist();

    // Automatically open the dialog for the prefilled party
    this.partyDialogRole.set(role);
    if (isNewRow) {
      this.partyDialogMode.set('add');
      this.partyGroupBackupValue = null;
    } else {
      this.partyDialogMode.set('edit');
      this.partyGroupBackupValue = backupValue;
    }
    this.partyDialogIndex.set(targetIndex);
    this.isPartyDialogOpen.set(true);
  }

  private prefillPartyAddressFromMutation(
    role: 'applicant' | 'respondent',
    index: number,
    fields: ReturnType<Category1ObjectionComponent['mutationPartyFields']>
  ): void {
    const arr = role === 'applicant' ? this.applicants : this.respondents;
    const group = arr.at(index) as ReturnType<Category1ObjectionComponent['createPartyGroup']> | undefined;
    if (!group) return;

    const tempId = group.controls.tempId.getRawValue();
    const lookup = this.partyLookupState(role, tempId);

    if (fields.districtName && lookup.districts.some((d) => d.toLowerCase() === fields.districtName.toLowerCase())) {
      group.controls.district.setValue(fields.districtName, { emitEvent: false });
    }
    if (fields.taluka && lookup.talukas.some((t) => t.toLowerCase() === fields.taluka.toLowerCase())) {
      group.controls.taluka.setValue(fields.taluka, { emitEvent: false });
    }

    const posts = lookup.postOffices;
    if (!posts.length) return;

    const cityNeedle = (fields.city || fields.address).toLowerCase();
    const distNeedle = fields.districtName.toLowerCase();
    let match =
      posts.find((po) => cityNeedle && po.name.toLowerCase().includes(cityNeedle)) ??
      posts.find((po) => distNeedle && po.district.toLowerCase() === distNeedle) ??
      (posts.length === 1 ? posts[0] : undefined);

    if (match) {
      group.controls.villageValue.setValue(match.value, { emitEvent: false });
      this.onVillageSelectionChange(role, index);
    }

    if (fields.stateName && lookup.states.length === 0) {
      this.setLookupState(role, tempId, { ...lookup, states: [fields.stateName] });
    }
  }

  private ensureMutationSuggestionsForPartiesStep(): void {
    if (!this.isEpicsSubject() || this.mutationSuggestions().length > 0) return;
    const inward =
      this.mutationDetails()?.inwardNumber?.trim() ||
      this.form.controls.selectedInwardNumber.getRawValue().trim() ||
      this.form.controls.searchValue.getRawValue().trim();
    if (inward.length < 2) return;

    this.landRecords
      .getUrbanMutationDetailList(inward)
      .pipe(catchError(() => of([] as UrbanMutationDetailResponse[])))
      .subscribe({
        next: (list) => {
          if (list?.length) {
            this.mutationSuggestions.set(list);
            this.schedulePersist();
          }
        }
      });
  }

  protected suggestionAppliedAs(detail: UrbanMutationDetailResponse): 'applicant' | 'respondent' | null {
    const fields = this.mutationPartyFields(detail);
    const mobile = fields.mobile;
    const name = fields.applicantName.toLowerCase();

    const matchesRow = (arr: ReturnType<Category1ObjectionComponent['createPartyGroup']>[]): boolean => {
      return arr.some((g) => {
        const rowMobile = (g.controls.mobile.getRawValue() || '').trim();
        if (mobile && rowMobile && rowMobile === mobile) return true;
        if (!mobile || !rowMobile) {
          const rowFirst = (g.controls.firstName.getRawValue() || '').trim().toLowerCase();
          const rowLast = (g.controls.lastName.getRawValue() || '').trim().toLowerCase();
          const rowFull = `${rowFirst} ${rowLast}`.trim();
          return !!name && rowFull.length > 0 && name.startsWith(rowFirst) && rowFull.length > 2;
        }
        return false;
      });
    };

    const appGroups = this.applicants.controls as ReturnType<Category1ObjectionComponent['createPartyGroup']>[];
    const respGroups = this.respondents.controls as ReturnType<Category1ObjectionComponent['createPartyGroup']>[];

    if (matchesRow(appGroups)) return 'applicant';
    if (matchesRow(respGroups)) return 'respondent';
    return null;
  }

  protected lookupPincode(
    role: 'applicant' | 'respondent',
    index: number,
    afterLoad?: () => void
  ): void {
    const arr = role === 'applicant' ? this.applicants : this.respondents;
    const group = arr.at(index) as ReturnType<Category1ObjectionComponent['createPartyGroup']> | undefined;
    if (!group) return;
    const tempId = group.controls.tempId.getRawValue();
    const pincode = (group.controls.pincode.getRawValue() || '').trim();
    if (!/^\d{6}$/.test(pincode)) {
      this.setLookupState(role, tempId, {
        postOffices: [],
        talukas: [],
        districts: [],
        states: [],
        loading: false,
        error: 'Pincode must be exactly 6 digits.'
      });
      return;
    }
    this.setLookupState(role, tempId, {
      postOffices: [],
      talukas: [],
      districts: [],
      states: [],
      loading: true,
      error: null
    });
    this.lookups.getPincodeDetails(pincode).subscribe({
      next: (resp) => {
        this.setLookupState(role, tempId, {
          postOffices: resp.postOffices || [],
          talukas: resp.talukas || [],
          districts: resp.districts || [],
          states: resp.states || [],
          loading: false,
          error: null
        });
        afterLoad?.();
      },
      error: (err: unknown) => {
        this.setLookupState(role, tempId, {
          postOffices: [],
          talukas: [],
          districts: [],
          states: [],
          loading: false,
          error: this.formatError(err)
        });
      }
    });
  }

  protected partyRowTempId(control: AbstractControl): string {
    const g = control as FormGroup;
    return String(g.controls['tempId']?.getRawValue?.() ?? '').trim();
  }

  protected partyLookupState(role: 'applicant' | 'respondent', tempId: string): PartyAddressLookupState {
    const map = role === 'applicant' ? this.applicantPincodeLookup() : this.respondentPincodeLookup();
    return (
      map[tempId] || {
        postOffices: [],
        talukas: [],
        districts: [],
        states: [],
        loading: false,
        error: null
      }
    );
  }

  protected onVillageSelectionChange(role: 'applicant' | 'respondent', index: number): void {
    const arr = role === 'applicant' ? this.applicants : this.respondents;
    const group = arr.at(index) as ReturnType<Category1ObjectionComponent['createPartyGroup']> | undefined;
    if (!group) return;
    const value = (group.controls.villageValue.getRawValue() || '').trim();
    if (!value) return;
    const [name = '', block = '', district = '', state = ''] = value.split('#');
    group.patchValue(
      {
        village: name,
        taluka: block,
        district
      },
      { emitEvent: false }
    );
    const lookup = this.partyLookupState(role, group.controls.tempId.getRawValue());
    if (state && lookup.states.length === 0) {
      this.setLookupState(role, group.controls.tempId.getRawValue(), { ...lookup, states: [state] });
    }
  }

  protected partyStateLabel(role: 'applicant' | 'respondent', tempId: string): string {
    return this.partyLookupState(role, tempId).states[0] || '';
  }

  private setupPartyGroupSubscriptions(
  group: ReturnType<Category1ObjectionComponent['createPartyGroup']>
): void {

  // DOB -> Age
  group.controls.dob.valueChanges
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe((value) => {

      const calculated =
        this.calculateAge(value || '');

      if (calculated !== null) {
        group.controls.age.setValue(
          String(calculated),
          { emitEvent: false }
        );
      }
    });

  const translationMappings: [string, string][] = [
    ['firstName', 'firstNameMr'],
    ['middleName', 'middleNameMr'],
    ['lastName', 'lastNameMr'],
    ['address', 'addressMr'],
    ['occupation', 'occupationMr']
  ];

  translationMappings.forEach(
    ([englishField, marathiField]) => {

      const control =
        group.get(englishField);

      if (!control) return;

      // typing trigger
      control.valueChanges
        .pipe(
          debounceTime(1500),
          distinctUntilChanged(),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((value) => {

          this.tryAutoTranslate(value, marathiField, group, englishField);
        });

      // prefilled trigger
      setTimeout(() => {
        const existingValue = control.value?.trim();
        if (existingValue) {
          this.tryAutoTranslate(existingValue, marathiField, group, englishField);
        }
      }, 300);
    }
  );
}

  private partyRowMeta(
    group: ReturnType<Category1ObjectionComponent['createPartyGroup']>
  ): { role: 'applicant' | 'respondent'; index: number } {
    const ai = this.applicants.controls.indexOf(group);
    if (ai >= 0) return { role: 'applicant', index: ai };
    const ri = this.respondents.controls.indexOf(group);
    if (ri >= 0) return { role: 'respondent', index: ri };
    return { role: 'applicant', index: 0 };
  }

  private marathiFieldKey(role: string, index: number, marathiFieldName: string): string {
    return `${role}-${index}-${marathiFieldName}`;
  }

private tryAutoTranslate(
  englishText: string,
  marathiFieldName: string,
  group: ReturnType<Category1ObjectionComponent['createPartyGroup']>,
  fieldName: string
): void {

  const text = (englishText ?? '').trim();
  const { role, index } = this.partyRowMeta(group);
  const marathiKey = this.marathiFieldKey(role, index, marathiFieldName);

  // if English field is cleared, also clear Marathi field to allow re-translation when user adds text again
  if (!text) {
    group.patchValue(
      {
        [marathiFieldName]: ''
      },
      { emitEvent: false }
    );
    this.manuallyEditedMarathiFields.update((s) => {
      const next = new Set(s);
      next.delete(marathiKey);
      return next;
    });
    return;
  }

  const marathiAlready =
    group.get(marathiFieldName)
      ?.value
      ?.trim();

  const wasManuallyEdited = this.manuallyEditedMarathiFields().has(marathiKey);

  if (marathiAlready && wasManuallyEdited) {
    return;
  }

  if (marathiAlready && !wasManuallyEdited) {
    group.patchValue(
      {
        [marathiFieldName]: ''
      },
      { emitEvent: false }
    );
  }

  this.transliterateToMarathi(
    text,
    marathiFieldName,
    group,
    role,
    index,
    fieldName
  );
}

  private calculateAge(dobIso: string): number | null {
    if (!dobIso) return null;
    const dob = new Date(dobIso);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
    return age >= 0 ? age : null;
  }

  private ensureLookupState(role: 'applicant' | 'respondent', tempId: string): void {
    const current = this.partyLookupState(role, tempId);
    this.setLookupState(role, tempId, current);
  }

  private setLookupState(role: 'applicant' | 'respondent', tempId: string, next: PartyAddressLookupState): void {
    if (role === 'applicant') {
      this.applicantPincodeLookup.update((prev) => ({ ...prev, [tempId]: next }));
    } else {
      this.respondentPincodeLookup.update((prev) => ({ ...prev, [tempId]: next }));
    }
  }

  protected readonly acts = signal<ActLookupResponse[]>([]);
  protected readonly sections = signal<SectionLookupResponse[]>([]);

  protected readonly sectionsForSelectedAct = computed((): Array<{ id: number; name: string }> => {
    return this.sections().map((row) => ({
      id: row.id,
      name: row.sectionCode ? `${row.sectionCode} - ${row.sectionName}` : row.sectionName
    }));
  });

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
          this.resetClientRefSeedParts();
          this.filingClientRef.set(this.buildClientApplicationRef());
          this.hydrating = false;
          this.setupPersistencePipeline();
        }
      });

    this.loadActs();
    this.loadOccupations();
    this.loadUrbanSearchDistricts();
    this.loadRuralSearchDistricts();

    effect(() => {
      const stepKey = this.activeStep().key;
      if (stepKey !== 'DISPUTED_ORDER' || this.hydrating) return;
      untracked(() => {
        queueMicrotask(() => this.ensureUrbanInwardChainLoaded());
      });
    });

    this.form.controls.subjectId.valueChanges.subscribe((subjectId) => {
      if (this.hydrating) return;
      this.selectedSubject.set(this.subjects().find((s) => s.id === subjectId) ?? null);
      this.refreshFilingClientRefIfDraft();
      if (!this.isEpicsSubject()) {
        this.resetUrbanSearchChain();
        this.form.patchValue(
          {
            searchMode: 'INWARD_NUMBER',
            searchValue: '',
            mutationYear: '',
            mutationTypeFilter: '',
            manualInwardNumber: '',
            manualInwardDate: '',
            manualMutationType: '',
            manualApplicantName: '',
            manualVillage: '',
            manualStatus: ''
          },
          { emitEvent: false }
        );
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
      }
      if (!this.isRural712Subject()) {
        this.resetRural712SearchChain();
      }
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
      this.refreshFilingClientRefIfDraft();
    });

    this.form.controls.searchValue.valueChanges.subscribe(() => {
      if (this.hydrating) return;
      this.clearSearchResultState();
    });
    this.form.controls.searchMode.valueChanges.subscribe(() => {
      if (this.hydrating) return;
      this.clearSearchResultState();
      this.resetUrbanSearchChain();
    });
    this.form.controls.ruralDistrictCode.valueChanges.subscribe((districtCode) => {
      if (this.hydrating) return;
      this.clearRural712SearchState();
      this.form.patchValue(
        { ruralTalukaCode: '', ruralVillageLgdCode: '', ruralSurveyPin: '' },
        { emitEvent: false }
      );
      this.ruralSearchTalukas.set([]);
      this.ruralSearchVillages.set([]);
      if (!districtCode?.trim()) return;
      this.loadingRural712Search.set(true);
      this.landRecords
        .getRuralTalukas(districtCode.trim())
        .pipe(finalize(() => this.loadingRural712Search.set(false)))
        .subscribe({
          next: (rows) => this.ruralSearchTalukas.set(rows || []),
          error: (err: unknown) => this.apiError.set(this.formatError(err))
        });
    });
    this.form.controls.ruralTalukaCode.valueChanges.subscribe((talukaCode) => {
      if (this.hydrating) return;
      this.clearRural712SearchState();
      this.form.patchValue({ ruralVillageLgdCode: '', ruralSurveyPin: '' }, { emitEvent: false });
      this.ruralSearchVillages.set([]);
      const districtCode = this.form.controls.ruralDistrictCode.getRawValue().trim();
      if (!districtCode || !talukaCode?.trim()) return;
      this.loadingRural712Search.set(true);
      this.landRecords
        .getRuralVillages(districtCode, talukaCode.trim())
        .pipe(finalize(() => this.loadingRural712Search.set(false)))
        .subscribe({
          next: (rows) => this.ruralSearchVillages.set(rows || []),
          error: (err: unknown) => this.apiError.set(this.formatError(err))
        });
    });
    this.form.controls.ruralVillageLgdCode.valueChanges.subscribe(() => {
      if (this.hydrating) return;
      this.clearRural712SearchState();
    });
    this.form.controls.ruralSurveyPin.valueChanges.subscribe(() => {
      if (this.hydrating) return;
      this.clearRural712SearchState();
    });
    this.form.controls.urbanDistrictCode.valueChanges.subscribe((districtCode) => {
      if (this.hydrating) return;
      this.clearSearchResultState();
      this.form.patchValue(
        {
          urbanOfficeCode: '',
          urbanVillageCode: '',
          ctsNoInput: '',
          selectedSubCtsNo: '',
          selectedInwardNumber: '',
          mutationNumberInput: '',
          selectedUrbanMutationTypeCode: ''
        },
        { emitEvent: false }
      );
      this.urbanSearchOffices.set([]);
      this.urbanSearchVillages.set([]);
      this.urbanSearchSubCtsRows.set([]);
      this.urbanSearchMutations.set([]);
      this.urbanMutationTypeOptions.set([]);
      if (districtCode) this.loadUrbanSearchOffices(districtCode);
      this.syncEpicsUrbanOfficeSnapshot();
    });
    this.form.controls.urbanOfficeCode.valueChanges.subscribe((officeCode) => {
      if (this.hydrating) return;
      this.clearSearchResultState();
      this.form.patchValue(
        {
          urbanVillageCode: '',
          ctsNoInput: '',
          selectedSubCtsNo: '',
          selectedInwardNumber: '',
          mutationNumberInput: '',
          selectedUrbanMutationTypeCode: ''
        },
        { emitEvent: false }
      );
      this.urbanSearchVillages.set([]);
      this.urbanSearchSubCtsRows.set([]);
      this.urbanSearchMutations.set([]);
      this.urbanMutationTypeOptions.set([]);
      if (officeCode) this.loadUrbanSearchVillages(officeCode);
      this.syncEpicsUrbanOfficeSnapshot();
      this.refreshFilingClientRefIfDraft();
    });
    this.form.controls.urbanVillageCode.valueChanges.subscribe(() => {
      if (this.hydrating) return;
      this.clearSearchResultState();
      this.form.patchValue(
        {
          ctsNoInput: '',
          selectedSubCtsNo: '',
          selectedInwardNumber: '',
          mutationNumberInput: '',
          selectedUrbanMutationTypeCode: ''
        },
        { emitEvent: false }
      );
      this.urbanSearchSubCtsRows.set([]);
      this.urbanSearchMutations.set([]);
      this.urbanMutationTypeOptions.set([]);
      const villageCode = this.form.controls.urbanVillageCode.getRawValue().trim();
      if (this.form.controls.searchMode.getRawValue() === 'MUTATION_NUMBER' && villageCode) {
        this.loadUrbanMutationTypes();
      }
    });

    this.form.controls.selectedUrbanMutationTypeCode.valueChanges.subscribe(() => {
      if (this.hydrating) return;
      this.form.patchValue({ selectedInwardNumber: '' }, { emitEvent: false });
      this.urbanSearchMutations.set([]);
    });

    this.form.controls.actId.valueChanges.subscribe((actId) => {
      if (this.hydrating) return;
      this.form.controls.sectionId.setValue(0);
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
        'Reset the entire form? All entered data will be cleared and you will start a new filing.'
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

  private buildClientApplicationRef(): string {
    this.ensureClientRefSeedParts();
    const appTypeCode = `C${this.caseCategoryId()}`;
    const subjectCode = this.resolveSubjectCodeForRef();
    const officeCode = this.resolveOfficeCodeForRef();
    return `${this.clientRefDatePart}-${appTypeCode}-${subjectCode}-${officeCode}-${this.clientRefUniqueSuffix}`;
  }

  private ensureClientRefSeedParts(): void {
    if (!this.clientRefDatePart) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      this.clientRefDatePart = `${y}${m}${d}`;
    }
    if (!this.clientRefUniqueSuffix) {
      this.clientRefUniqueSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    }
  }

  private resetClientRefSeedParts(): void {
    this.clientRefDatePart = '';
    this.clientRefUniqueSuffix = '';
  }

  private resolveSubjectCodeForRef(): string {
    const fromSelected = this.selectedSubject()?.subjectCode?.trim();
    if (fromSelected) return this.sanitizeRefSegment(fromSelected);
    const subjectId = Number(this.form.controls.subjectId.getRawValue() || 0);
    if (subjectId > 0) {
      const row = this.subjects().find((s) => s.id === subjectId);
      if (row?.subjectCode?.trim()) return this.sanitizeRefSegment(row.subjectCode);
    }
    return 'NA';
  }

  private resolveOfficeCodeForRef(): string {
    const urbanCode = this.form.controls.urbanOfficeCode.getRawValue().trim();
    if (urbanCode) return this.sanitizeRefSegment(urbanCode);
    const snap = this.epicsUrbanOfficeSnapshot();
    if (snap?.code?.trim()) return this.sanitizeRefSegment(snap.code);
    const officeId = Number(this.form.controls.officeId.getRawValue() || 0);
    if (officeId > 0) {
      const off =
        this.selectedOffice() ?? this.offices().find((o) => o.id === officeId) ?? null;
      if (off?.shortName?.trim()) return this.sanitizeRefSegment(off.shortName);
      return `O${officeId}`;
    }
    return 'NA';
  }

  private sanitizeRefSegment(value: string): string {
    const cleaned = String(value ?? '')
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
    return cleaned.slice(0, 16) || 'NA';
  }

  private refreshFilingClientRefIfDraft(): void {
    if (this.hydrating) return;
    if (this.serverApplicationId() != null && this.serverApplicationId()! > 0) return;
    this.filingClientRef.set(this.buildClientApplicationRef());
    this.schedulePersist();
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
        activeStepKey: this.activeStep().key,
        form: {
          ...(this.form.getRawValue() as Record<string, unknown>),
          descriptionParagraphs: [...this.descriptionParagraphs()]
        },
        disputedLands: this.disputedLands(),
        vakaltnamaAssignments: this.vakaltnamaAssignments(),
        vakaltnamaCoAdvocates: this.vakaltnamaCoAdvocates(),
        selectedSubject: this.selectedSubject(),
        selectedOffice: this.selectedOffice(),
        epicsUrbanOfficeSnapshot: this.epicsUrbanOfficeSnapshot(),
        mutationDetails: this.mutationDetails(),
        mutationFound: this.mutationFound(),
        searchedMutation: this.searchedMutation(),
        notice9Resolved: this.compactNotice9ForSession(this.notice9Resolved()),
        notice9InwardRef:
          this.mutationDetails()?.inwardNumber?.trim() ||
          this.form.controls.searchValue.getRawValue().trim() ||
          null,
        manualAttachFileName: this.manualAttachFileName(),
        manualNotice9FileName: this.manualNotice9FileName(),
        applicantPincodeLookup: { ...this.applicantPincodeLookup() },
        respondentPincodeLookup: { ...this.respondentPincodeLookup() },
        actsSnapshot: [...this.acts()],
        sectionsSnapshot: [...this.sections()],
        subdistrictsSnapshot: [...this.subdistricts()],
        talukasSnapshot: [...this.talukas()],
        officesSnapshot: [...this.offices()],
        rural712Searched: this.rural712Searched(),
        rural712SubSurveyRows: [...this.rural712SubSurveyRows()],
        selectedRural712Index: this.selectedRural712Index(),
        rural712LandDetails: [...this.rural712LandDetails()],
        rural712SatbaraSigned: this.rural712SatbaraSigned(),
        rural712SatbaraMessage: this.rural712SatbaraMessage(),
        mappedAttachments: [...this.mappedAttachments()],
        urbanSearchSubCtsRowsSnapshot: [...this.urbanSearchSubCtsRows()],
        urbanSearchMutationsSnapshot: [...this.urbanSearchMutations()],
        mutationSuggestionsSnapshot: [...this.mutationSuggestions()]
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
      this.resetClientRefSeedParts();
      this.filingClientRef.set(this.buildClientApplicationRef());
      this.serverApplicationId.set(null);
      this.applicantIdByClientRowKeySig.set({});
      this.hydrating = false;
      this.setupPersistencePipeline();
      return;
    }

    this.hydrating = true;
    this.filingClientRef.set(snap.clientApplicationRef);
    this.serverApplicationId.set(snap.applicationId ?? null);
    this.applicantIdByClientRowKeySig.set({ ...(snap.applicantIdByClientRowKey ?? {}) });
    const restoredKey = snap.activeStepKey;
    const keyIndex =
      restoredKey != null ? this.steps.findIndex((s) => s.key === restoredKey) : -1;
    this.stepIndex.set(keyIndex >= 0 ? keyIndex : (snap.stepIndex ?? 0));

    const f = snap.form as {
      applicants?: Array<{ tempId?: string; name?: string; mobile?: string; address?: string }>;
      respondents?: Array<{ tempId?: string; name?: string; mobile?: string; address?: string }>;
      [key: string]: unknown;
    };
    const apps = Array.isArray(f.applicants) ? f.applicants : [];
    const resps = Array.isArray(f.respondents) ? f.respondents : [];
    const { applicants: _a, respondents: _r, ...scalarFields } = f;
    const rawParagraphs = scalarFields['descriptionParagraphs'];
    const legacyDesc = scalarFields['applicationDescription'];
    let paragraphs: string[] = [''];
    if (Array.isArray(rawParagraphs) && rawParagraphs.length) {
      paragraphs = rawParagraphs.map((p) => String(p ?? ''));
    } else if (legacyDesc != null && String(legacyDesc).trim()) {
      paragraphs = [String(legacyDesc)];
    }
    delete scalarFields['descriptionParagraphs'];
    this.descriptionParagraphs.set(paragraphs);
    this.rebuildApplicantsAndRespondents(apps, resps);
    this.form.patchValue(scalarFields as object, { emitEvent: false });
    if (snap.urbanSearchSubCtsRowsSnapshot?.length) {
      this.urbanSearchSubCtsRows.set(snap.urbanSearchSubCtsRowsSnapshot);
    }
    if (snap.urbanSearchMutationsSnapshot?.length) {
      this.urbanSearchMutations.set(snap.urbanSearchMutationsSnapshot);
    }
    if (snap.mutationSuggestionsSnapshot?.length) {
      this.mutationSuggestions.set(snap.mutationSuggestionsSnapshot);
    } else if (this.searchedMutation()) {
      this.ensureMutationSuggestionsForPartiesStep();
    }

    if (snap.applicantPincodeLookup) {
      this.applicantPincodeLookup.set({ ...snap.applicantPincodeLookup });
    }
    if (snap.respondentPincodeLookup) {
      this.respondentPincodeLookup.set({ ...snap.respondentPincodeLookup });
    }
    if (snap.actsSnapshot?.length) {
      this.acts.set(snap.actsSnapshot);
    }
    if (snap.sectionsSnapshot?.length) {
      this.sections.set(snap.sectionsSnapshot);
    }
    if (snap.subdistrictsSnapshot?.length) {
      this.subdistricts.set(snap.subdistrictsSnapshot);
    }
    if (snap.talukasSnapshot?.length) {
      this.talukas.set(snap.talukasSnapshot);
    }
    if (snap.officesSnapshot?.length) {
      this.offices.set(snap.officesSnapshot);
    }

    this.disputedLands.set(snap.disputedLands ?? []);
    this.mappedAttachments.set(snap.mappedAttachments ?? []);
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
    this.epicsUrbanOfficeSnapshot.set(snap.epicsUrbanOfficeSnapshot ?? null);
    this.rural712Searched.set(!!snap.rural712Searched);
    this.rural712SubSurveyRows.set(snap.rural712SubSurveyRows ?? []);
    this.selectedRural712Index.set(
      snap.selectedRural712Index != null && snap.selectedRural712Index >= 0
        ? snap.selectedRural712Index
        : null
    );
    this.rural712LandDetails.set(snap.rural712LandDetails ?? []);
    this.rural712SatbaraSigned.set(snap.rural712SatbaraSigned ?? null);
    this.rural712SatbaraMessage.set(snap.rural712SatbaraMessage ?? null);
    const restoredRuralRow = this.selectedRural712Row();
    if (restoredRuralRow && this.form.controls.ruralVillageLgdCode.getRawValue().trim()) {
      this.fetchRural712RowDetails(restoredRuralRow);
    }


    const officeFallback = snap.selectedOffice ?? null;
    this.restoreLocationOfficeAndActChain(scalarFields, officeFallback);
  }

  private rebuildApplicantsAndRespondents(
    applicants: Array<Record<string, unknown>>,
    respondents: Array<Record<string, unknown>>
  ): void {
    while (this.applicants.length) this.applicants.removeAt(0);
    const appList = applicants;
    for (const r of appList) {
      const g = this.createPartyGroup();
      const tempId = String(r['tempId'] || '').trim() || this.makeTempId();
      g.patchValue({ ...(r as object), tempId }, { emitEvent: false });
      this.applicants.push(g);
      this.ensureLookupState('applicant', tempId);
    }

    while (this.respondents.length) this.respondents.removeAt(0);
    const respList = respondents;
    for (const r of respList) {
      const g = this.createPartyGroup();
      const tempId = String(r['tempId'] || '').trim() || this.makeTempId();
      g.patchValue({ ...(r as object), tempId }, { emitEvent: false });
      this.respondents.push(g);
      this.ensureLookupState('respondent', tempId);
    }
  }

  private restoreLocationOfficeAndActChain(
    scalarFields: Record<string, unknown>,
    officeFallback: OfficeResponse | null
  ): void {
    const districtId = Number(scalarFields['districtId'] ?? 0);
    const deptId = this.selectedSubject()?.departmentId;
    const subPref = Number(scalarFields['subdistrictId'] ?? 0);

    const actIdSaved = Number(scalarFields['actId'] ?? 0);
    const sectionIdSaved = Number(scalarFields['sectionId'] ?? 0);

    const finish = (): void => {
      const officeIdSaved = Number(scalarFields['officeId'] ?? 0);
      this.form.controls.officeId.setValue(officeIdSaved, { emitEvent: false });
      this.selectedOffice.set(
        officeFallback ?? this.offices().find((o) => o.id === officeIdSaved) ?? null
      );
      this.restoreSectionsThenHydrationDone(actIdSaved, sectionIdSaved);
    };

    if (this.talukas().length > 0 && districtId > 0) {
      finish();
      return;
    }

    if (!districtId || districtId < 1) {
      this.restoreSectionsThenHydrationDone(actIdSaved, sectionIdSaved);
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

  private restoreSectionsThenHydrationDone(actId: number, sectionId = 0): void {
    const applySection = (): void => {
      if (sectionId !== 0) {
        this.form.controls.sectionId.setValue(sectionId, { emitEvent: false });
      }
      if (actId > 0) {
        this.form.controls.actId.setValue(actId, { emitEvent: false });
      }
      this.finalizeHydration();
    };

    if (actId > 0 && this.sections().length === 0) {
      this.lookups.getSections(actId).subscribe({
        next: (rows) => {
          this.sections.set(rows);
          applySection();
          this.applyAutoSectionSelection();
        },
        error: () => applySection()
      });
    } else {
      applySection();
      this.applyAutoSectionSelection();
    }
  }

  private onRestoreChainFail(): void {
    this.finalizeHydration();
  }

  private finalizeHydration(): void {
    this.hydrating = false;
    this.setupPersistencePipeline();
    this.schedulePersist();

    const searchMode = this.form.controls.searchMode.getRawValue();
    const urbanDist = this.form.controls.urbanDistrictCode.getRawValue().trim();
    const urbanOffice = this.form.controls.urbanOfficeCode.getRawValue().trim();
    const urbanVillage = this.form.controls.urbanVillageCode.getRawValue().trim();

    if (this.isEpicsSubject() && urbanDist) {
      this.restoreUrbanSearchDropdowns(urbanDist, urbanOffice);
    } else {
      this.syncEpicsUrbanOfficeSnapshot();
      if (this.isEpicsSubject()) {
        this.ensureUrbanInwardChainLoaded();
      }
    }

    if (this.isEpicsSubject() && searchMode === 'MUTATION_NUMBER' && urbanVillage) {
      this.loadUrbanMutationTypes();
    }

    const ruralDist = this.form.controls.ruralDistrictCode.getRawValue().trim();
    const ruralTal = this.form.controls.ruralTalukaCode.getRawValue().trim();
    if (this.isRural712Subject() && ruralDist) {
      this.restoreRuralSearchDropdowns(ruralDist, ruralTal);
    }

    this.applyAutoActSelection();
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
        this.offices.set(rows);
        this.form.controls.officeId.setValue(0, { emitEvent: false });
        this.selectedOffice.set(null);
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.loadingOffices.set(false)
    });
  }

  private loadActs(): void {
    this.lookups.getActs().subscribe({
      next: (rows) => {
        this.acts.set(rows);
        this.applyAutoActSelection();
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err))
    });
  }

  private loadSections(actId: number): void {
    this.lookups.getSections(actId).subscribe({
      next: (rows) => {
        this.sections.set(rows);
        this.applyAutoSectionSelection();
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err))
    });
  }

  /** When only one act exists, select it and load sections automatically. */
  private applyAutoActSelection(): void {
    if (this.hydrating) return;
    const list = this.acts();
    if (list.length !== 1) return;

    const currentActId = Number(this.form.controls.actId.getRawValue() || 0);
    if (currentActId > 0) {
      this.applyAutoSectionSelection();
      return;
    }

    this.form.controls.actId.setValue(list[0].id);
  }

  /** When only one section exists for the selected act, select it automatically. */
  private applyAutoSectionSelection(): void {
    if (this.hydrating) return;
    const list = this.sections();
    if (list.length !== 1) return;

    const currentSectionId = Number(this.form.controls.sectionId.getRawValue() || 0);
    if (currentSectionId > 0) return;

    this.form.controls.sectionId.setValue(list[0].id, { emitEvent: false });
    this.schedulePersist();
  }

  private loadOccupations(): void {
    this.lookups.getOccupations().subscribe({
      next: (rows) => this.occupations.set(rows),
      error: (err: unknown) => this.apiError.set(this.formatError(err))
    });
  }

  private loadUrbanSearchDistricts(): void {
    this.landRecords.getUrbanDistricts().subscribe({
      next: (rows) => this.urbanSearchDistricts.set(rows || []),
      error: (err: unknown) => this.apiError.set(this.formatError(err))
    });
  }

  private loadRuralSearchDistricts(): void {
    this.landRecords.getRuralDistricts().subscribe({
      next: (rows) => this.ruralSearchDistricts.set(rows || []),
      error: (err: unknown) => this.apiError.set(this.formatError(err))
    });
  }

  private restoreRuralSearchDropdowns(districtCode: string, talukaCode: string): void {
    this.loadingRural712Search.set(true);
    const taluka$ = this.landRecords.getRuralTalukas(districtCode);
    const village$ =
      talukaCode.trim().length > 0
        ? this.landRecords.getRuralVillages(districtCode, talukaCode)
        : of([] as RuralVillage[]);
    forkJoin({ talukas: taluka$, villages: village$ })
      .pipe(finalize(() => this.loadingRural712Search.set(false)))
      .subscribe({
        next: ({ talukas, villages }) => {
          this.ruralSearchTalukas.set(talukas || []);
          this.ruralSearchVillages.set(villages || []);
        },
        error: (err: unknown) => this.apiError.set(this.formatError(err))
      });
  }

  protected performRural712Search(): void {
    if (!this.isRural712Subject()) {
      this.apiError.set('7/12 search is available only for rural RoR (7/12) subjects.');
      return;
    }
    const districtCode = this.form.controls.ruralDistrictCode.getRawValue().trim();
    const talukaCode = this.form.controls.ruralTalukaCode.getRawValue().trim();
    const villageLgd = this.form.controls.ruralVillageLgdCode.getRawValue().trim();
    const pin = this.form.controls.ruralSurveyPin.getRawValue().trim();
    if (!districtCode) { this.apiError.set('Please select district.'); return; }
    if (!talukaCode) { this.apiError.set('Please select taluka.'); return; }
    if (!villageLgd) { this.apiError.set('Please select village.'); return; }
    if (!pin) { this.apiError.set('Please enter survey number (pin).'); return; }
    this.apiError.set(null);
    this.loadingRural712Search.set(true);
    this.rural712SubSurveyRows.set([]);
    this.rural712LandDetails.set([]);
    this.rural712LandDetailError.set(null);
    this.clearRural712SatbaraState();
    this.rural712Searched.set(true);
    this.landRecords
      .getRuralSubSurveyList(villageLgd, pin)
      .pipe(finalize(() => this.loadingRural712Search.set(false)))
      .subscribe({
        next: (rows) => {
          const list = rows || [];
          this.rural712SubSurveyRows.set(list);
          this.selectedRural712Index.set(list.length > 0 ? 0 : null);
          if (!list.length) {
            this.rural712LandDetails.set([]);
            this.apiError.set('No 7/12 / Eferfar records found for this survey number.');
          } else {
            this.fetchRural712RowDetails(list[0]);
          }
          this.schedulePersist();
        },
        error: (err: unknown) => {
          this.apiError.set(this.formatError(err));
          this.schedulePersist();
        }
      });
  }

  protected addRural712PlotToDisputedLands(row: RuralSubSurveyRow): void {
    const dist = this.ruralSearchDistricts().find(
      (d) => d.district_code.trim() === this.form.controls.ruralDistrictCode.getRawValue().trim()
    );
    const tal = this.ruralSearchTalukas().find(
      (t) => t.taluka_code.trim() === this.form.controls.ruralTalukaCode.getRawValue().trim()
    );
    const vil = this.ruralSearchVillages().find(
      (v) => v.lgd_village_code.trim() === this.form.controls.ruralVillageLgdCode.getRawValue().trim()
    );
    if (!dist || !tal || !vil) return;
    const key = `RURAL|${vil.lgd_village_code.trim()}|${row.pin}|${row.pin1}|${row.pin2}|${row.pin3}|${row.pin4}|${row.pin5}|${row.pin6}|${row.pin7}|${row.pin8}`;
    const existing = this.disputedLands();
    if (existing.some((x) => this.disputedLandKey(x) === key)) {
      this.apiError.set('This plot is already in disputed land list.');
      return;
    }

    const next: DisputedLandRow = {
      type: 'RURAL_7_12',
      districtCode: dist.district_code.trim(),
      districtName: dist.district_name,
      talukaCode: tal.taluka_code.trim(),
      talukaName: tal.taluka_name,
      villageLgdCode: vil.lgd_village_code.trim(),
      villageName: vil.village_name,
      pin: row.pin,
      pinParts: {
        pin1: row.pin1,
        pin2: row.pin2,
        pin3: row.pin3,
        pin4: row.pin4,
        pin5: row.pin5,
        pin6: row.pin6,
        pin7: row.pin7,
        pin8: row.pin8
      },
      landDetail: undefined
    };
    this.disputedLands.set([...existing, next]);
    this.apiMessage.set('Plot added to disputed land list (step 2).');
    this.schedulePersist();
  }

  protected rural712PinLabel(r: RuralSubSurveyRow): string {
    return formatRuralPinParts(r) || '—';
  }

  protected rural712SubPartsLabel(r: RuralSubSurveyRow): string {
    return formatRuralPinParts(r);
  }

  protected selectRural712OrderRow(index: number): void {
    if (index < 0 || index >= this.rural712SubSurveyRows().length) return;
    this.selectedRural712Index.set(index);
    const row = this.rural712SubSurveyRows()[index];
    if (row) this.fetchRural712RowDetails(row);
    this.schedulePersist();
  }

  protected viewRural712SatbaraPdf(): void {
    const row = this.selectedRural712Row();
    if (!row) { this.rural712SatbaraPdfError.set('Select a 7/12 row from the table below first.'); return; }
    const existing = this.rural712SatbaraPdfUrl();
    if (existing) { this.openRural712SatbaraPdfInNewTab(existing); return; }
    this.fetchRural712SatbaraPdfForRow(row, 'view');
  }

  protected downloadRural712SatbaraPdf(): void {
    const row = this.selectedRural712Row();
    if (!row) { this.rural712SatbaraPdfError.set('Select a 7/12 row from the table below first.'); return; }
    const existing = this.rural712SatbaraPdfUrl();
    if (existing) { this.triggerRural712SatbaraDownload(existing); return; }
    this.fetchRural712SatbaraPdfForRow(row, 'download');
  }

  protected formatRural712LandDetailCell(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'object') {
      try { return JSON.stringify(value); } catch { return String(value); }
    }
    return String(value);
  }

  private rural712LandDetailParams(row: RuralSubSurveyRow) {
    return {
      villageLgdCode: this.form.controls.ruralVillageLgdCode.getRawValue().trim(),
      pin: row.pin, pin1: row.pin1, pin2: row.pin2, pin3: row.pin3, pin4: row.pin4,
      pin5: row.pin5, pin6: row.pin6, pin7: row.pin7, pin8: row.pin8
    };
  }

  private fetchRural712RowDetails(row: RuralSubSurveyRow): void {
    this.fetchRural712SatbaraChainForRow(row);
  }

  private fetchRural712SatbaraChainForRow(row: RuralSubSurveyRow): void {
    const villageLgd = this.form.controls.ruralVillageLgdCode.getRawValue().trim();
    if (!villageLgd) return;
    const params = this.rural712LandDetailParams(row);
    this.clearRural712SatbaraState();
    this.loadingRural712SatbaraCheck.set(true);
    this.landRecords
      .checkRuralSatbaraDigitallySigned(params)
      .pipe(finalize(() => this.loadingRural712SatbaraCheck.set(false)))
      .subscribe({
        next: (result) => {
          this.rural712SatbaraSigned.set(result.digitallySigned);
          this.rural712SatbaraMessage.set(result.message ?? null);
          this.schedulePersist();
        },
        error: (err: unknown) => {
          this.rural712SatbaraCheckError.set(this.formatError(err));
          this.schedulePersist();
        }
      });
  }

  private fetchRural712SatbaraPdfForRow(row: RuralSubSurveyRow, afterLoad: 'view' | 'download' | null = null): void {
    const previous = this.rural712SatbaraPdfUrl();
    if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
    this.rural712SatbaraPdfError.set(null);
    this.rural712SatbaraPdfUrl.set(null);
    this.loadingRural712SatbaraPdf.set(true);
    this.landRecords
      .getRuralDigitallySignedSatbaraPdf(this.rural712LandDetailParams(row))
      .pipe(finalize(() => this.loadingRural712SatbaraPdf.set(false)))
      .subscribe({
        next: (pdf) => {
          this.applyRural712SatbaraPdf(pdf);
          const url = this.rural712SatbaraPdfUrl();
          if (url && afterLoad === 'view') this.openRural712SatbaraPdfInNewTab(url);
          else if (url && afterLoad === 'download') this.triggerRural712SatbaraDownload(url);
          this.schedulePersist();
        },
        error: (err: unknown) => {
          this.rural712SatbaraPdfError.set(this.formatError(err));
          this.schedulePersist();
        }
      });
  }

  private openRural712SatbaraPdfInNewTab(url: string): void {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      this.rural712SatbaraPdfError.set('Pop-up blocked. Allow pop-ups for this site, or use Download Satbara PDF.');
    }
  }

  private triggerRural712SatbaraDownload(url: string): void {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'satbara-7-12.pdf';
    anchor.rel = 'noopener';
    anchor.click();
  }

  private applyRural712SatbaraPdf(pdf: { dataUrl: string; mimeType: string }): void {
    const previous = this.rural712SatbaraPdfUrl();
    if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
    const url = pdf.dataUrl.trim();
    if (!url) { this.rural712SatbaraPdfError.set('Satbara PDF response was empty.'); return; }
    const blobUrl = this.toSatbaraPdfBlobUrl(url) ?? url;
    if (!blobUrl) { this.rural712SatbaraPdfError.set('Could not prepare Satbara PDF for viewing.'); return; }
    this.rural712SatbaraPdfUrl.set(blobUrl);
    this.rural712SatbaraPdfError.set(null);
  }

  private toSatbaraPdfBlobUrl(dataUrl: string): string | null {
    const trimmed = dataUrl.trim();
    if (trimmed.startsWith('blob:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (!trimmed.toLowerCase().startsWith('data:')) return null;
    const comma = trimmed.indexOf(',');
    if (comma < 0) return null;
    const meta = trimmed.slice(0, comma).toLowerCase();
    const payload = trimmed.slice(comma + 1).replace(/\s/g, '');
    if (!meta.includes('application/pdf') && !payload.startsWith('JVBERi')) return null;
    try {
      const binary = atob(payload);
      if (!binary.startsWith('%PDF')) return null;
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    } catch {
      return trimmed;
    }
  }

  private clearRural712SatbaraState(): void {
    const prev = this.rural712SatbaraPdfUrl();
    if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
    this.rural712SatbaraSigned.set(null);
    this.rural712SatbaraMessage.set(null);
    this.rural712SatbaraCheckError.set(null);
    this.rural712SatbaraPdfError.set(null);
    this.rural712SatbaraPdfUrl.set(null);
    this.loadingRural712SatbaraCheck.set(false);
    this.loadingRural712SatbaraPdf.set(false);
  }

  protected rural712LocationSummary(): string {
    const dist = this.ruralSearchDistricts().find((d) => d.district_code === this.form.controls.ruralDistrictCode.getRawValue().trim());
    const tal = this.ruralSearchTalukas().find((t) => t.taluka_code === this.form.controls.ruralTalukaCode.getRawValue().trim());
    const vil = this.ruralSearchVillages().find((v) => v.lgd_village_code === this.form.controls.ruralVillageLgdCode.getRawValue().trim());
    const pin = this.form.controls.ruralSurveyPin.getRawValue().trim();
    return [dist?.district_name, tal?.taluka_name, vil?.village_name, pin ? `Pin ${pin}` : ''].filter(Boolean).join(' / ');
  }

  protected rural712ReadonlyLocationLabel(): string {
    const s = this.rural712LocationSummary();
    return s || '— Complete 7/12 search on step 1 —';
  }

  protected ruralDisputedLandContext(): RuralDisputedLandContext | null {
    if (!this.isRural712Subject()) {
      return null;
    }
    const dist = this.ruralSearchDistricts().find(
      (d) => d.district_code.trim() === this.form.controls.ruralDistrictCode.getRawValue().trim()
    );
    const tal = this.ruralSearchTalukas().find(
      (t) => t.taluka_code.trim() === this.form.controls.ruralTalukaCode.getRawValue().trim()
    );
    const vil = this.ruralSearchVillages().find(
      (v) => v.lgd_village_code.trim() === this.form.controls.ruralVillageLgdCode.getRawValue().trim()
    );
    const pin = this.form.controls.ruralSurveyPin.getRawValue().trim();
    if (!dist || !tal || !vil || !pin) {
      return null;
    }
    return {
      districtCode: dist.district_code.trim(),
      districtName: dist.district_name,
      talukaCode: tal.taluka_code.trim(),
      talukaName: tal.taluka_name,
      villageLgdCode: vil.lgd_village_code.trim(),
      villageName: vil.village_name,
      surveyPin: pin
    };
  }

  private disputedLandKey(x: DisputedLandRow): string {
    if (x.type === 'RURAL_7_12') {
      const p = x.pinParts;
      return `RURAL|${x.villageLgdCode}|${x.pin}|${p.pin1}|${p.pin2}|${p.pin3}|${p.pin4}|${p.pin5}|${p.pin6}|${p.pin7}|${p.pin8}`;
    }
    return `URBAN|${x.villageCode}|${x.ctsNo}|${x.subCtsNo || ''}`;
  }

  private clearRural712SearchState(): void {
    this.rural712Searched.set(false);
    this.rural712SubSurveyRows.set([]);
    this.selectedRural712Index.set(null);
    this.rural712LandDetails.set([]);
    this.rural712LandDetailError.set(null);
    this.loadingRural712LandDetail.set(false);
    this.clearRural712SatbaraState();
  }

  private resetRural712SearchChain(): void {
    this.form.patchValue(
      { ruralDistrictCode: '', ruralTalukaCode: '', ruralVillageLgdCode: '', ruralSurveyPin: '' },
      { emitEvent: false }
    );
    this.ruralSearchTalukas.set([]);
    this.ruralSearchVillages.set([]);
    this.clearRural712SearchState();
  }

  private loadUrbanSearchOffices(districtCode: string): void {
    this.loadingUrbanSearchChain.set(true);
    this.landRecords
      .getUrbanOffices(districtCode)
      .pipe(finalize(() => this.loadingUrbanSearchChain.set(false)))
      .subscribe({
        next: (rows) => {
          this.urbanSearchOffices.set(rows || []);
          this.syncEpicsUrbanOfficeSnapshot();
        },
        error: (err: unknown) => {
          this.apiError.set(this.formatError(err));
          this.syncEpicsUrbanOfficeSnapshot();
        }
      });
  }

  private restoreUrbanSearchDropdowns(districtCode: string, officeCode: string): void {
    this.loadingUrbanSearchChain.set(true);
    const offices$ = this.landRecords.getUrbanOffices(districtCode).pipe(catchError(() => of([])));
    const villages$ = officeCode
      ? this.landRecords.getUrbanVillages(officeCode).pipe(catchError(() => of([])))
      : of([] as UrbanVillage[]);

    forkJoin({ offices: offices$, villages: villages$ })
      .pipe(finalize(() => this.loadingUrbanSearchChain.set(false)))
      .subscribe({
        next: ({ offices, villages }) => {
          this.urbanSearchOffices.set((offices as UrbanOffice[]) || []);
          this.urbanSearchVillages.set((villages as UrbanVillage[]) || []);
          this.syncEpicsUrbanOfficeSnapshot();
          this.ensureUrbanInwardChainLoaded();
        },
        error: () => this.syncEpicsUrbanOfficeSnapshot()
      });
  }

  /** Reload sub-CTS / inward dropdown options when returning to step 1 without clearing selections. */
  private ensureUrbanInwardChainLoaded(): void {
    if (this.hydrating || !this.isEpicsSubject()) return;

    const mode = this.form.controls.searchMode.getRawValue();
    const village = this.form.controls.urbanVillageCode.getRawValue().trim();
    if (!village) return;

    if (mode === 'SURVEY_NUMBER') {
      const parentCts = this.form.controls.ctsNoInput.getRawValue().trim();
      const subCts = this.form.controls.selectedSubCtsNo.getRawValue().trim();

      if (parentCts && this.urbanSearchSubCtsRows().length === 0) {
        this.fetchUrbanSubCtsRows(village, parentCts, true);
        return;
      }
      if (subCts && this.urbanSearchMutations().length === 0) {
        this.fetchUrbanMutationsForSubCts(village, subCts, true);
      }
      return;
    }

    if (mode === 'MUTATION_NUMBER') {
      if (this.urbanMutationTypeOptions().length === 0) {
        this.loadUrbanMutationTypes();
      }
      const typeCode = this.form.controls.selectedUrbanMutationTypeCode.getRawValue().trim();
      if (typeCode && this.urbanSearchMutations().length === 0) {
        this.fetchUrbanMutationsForMutationType(village, typeCode, true);
      }
    }
  }

  private loadUrbanSearchVillages(officeCode: string): void {
    this.loadingUrbanSearchChain.set(true);
    this.landRecords
      .getUrbanVillages(officeCode)
      .pipe(finalize(() => this.loadingUrbanSearchChain.set(false)))
      .subscribe({
        next: (rows) => this.urbanSearchVillages.set(rows || []),
        error: (err: unknown) => this.apiError.set(this.formatError(err))
      });
  }

  protected performSearch(): void {
    if (!this.isEpicsSubject()) {
      this.apiError.set('Mutation search is available only for 002 ePICS subject.');
      return;
    }
    const mode = this.form.controls.searchMode.getRawValue();
    if (mode !== 'INWARD_NUMBER' && mode !== 'SURVEY_NUMBER' && mode !== 'MUTATION_NUMBER') {
      this.apiError.set('Mutation search is not available for this search mode.');
      return;
    }
    this.form.controls.searchValue.markAsTouched();
    const v = this.form.controls.searchValue.getRawValue().trim();
    if (v.length < 2) { this.apiError.set('Please enter a search value.'); return; }
    this.apiError.set(null);
    const searchToken = ++this.latestMutationSearchToken;
    this.clearSearchResultState();
    this.loadingSearch.set(true);
    this.searchedMutation.set(true);
    this.notice9Resolved.set({ available: false, sourceKind: null, url: null, previewKind: 'none' });

    this.landRecords
      .getUrbanMutationDetailList(v)
      .pipe(
        catchError(() => of([] as UrbanMutationDetailResponse[])),
        finalize(() => this.loadingSearch.set(false))
      )
      .subscribe({
        next: (mutations) => {
          if (searchToken !== this.latestMutationSearchToken) return;
          this.mutationSuggestions.set(mutations);
          const first = mutations[0] ?? null;
          const hasDetail = this.hasMeaningfulMutationDetail(first);
          if (!hasDetail) {
            this.mutationFound.set(false);
            this.mutationDetails.set(null);
          } else {
            this.mutationDetails.set(this.toMutationDetailsView(first));
            this.mutationFound.set(true);
          }
          this.schedulePersist();
        },
        error: (err: unknown) => {
          if (searchToken !== this.latestMutationSearchToken) return;
          this.mutationFound.set(false);
          this.mutationDetails.set(null);
          this.mutationSuggestions.set([]);
          this.notice9Resolved.set({ available: false, sourceKind: null, url: null, previewKind: 'none' });
          this.apiError.set(this.formatError(err));
          this.schedulePersist();
        }
      });
  }

  private toMutationDetailsView(detail: UrbanMutationDetailResponse): MutationDetailsView {
    const locationLine = [detail.district_name, detail.taluka, detail.city]
      .map((x) => String(x || '').trim()).filter(Boolean).join(' — ');
    const village = String(detail.village_code || '').trim() || locationLine || String(detail.address || '').trim() || '';
    const statusParts = [detail.status_description, detail.sts_code || detail.its_code]
      .map((x) => String(x || '').trim()).filter(Boolean);
    return {
      inwardNumber: detail.inward_number || this.form.controls.searchValue.getRawValue().trim(),
      inwardDate: detail.inward_date || '',
      districtName: String(detail.district_name || '').trim() || undefined,
      mutationNumber: detail.mutation_number || '',
      mutationDate: detail.mutation_date || '',
      mutationType: detail.mutation_type_description || detail.mutation_type_code || '',
      applicantName: detail.applicant_name || '',
      village,
      status: statusParts.join(' — ') || '',
      notice9DispatchDate: detail.notice9_dispatch_date || '',
      notice9DispatchNumber: detail.notice9_dispatch_number || '',
      ctsNumber: detail.cts_number || '',
      mobileNumber: detail.mobile_number || '',
      pinCode: detail.pin_code || '',
      attachFileUrl: null,
      notice9Url: null
    };
  }

  private hasMeaningfulMutationDetail(detail: UrbanMutationDetailResponse | null | undefined): detail is UrbanMutationDetailResponse {
    if (!detail || typeof detail !== 'object') return false;
    return (
      !!String(detail.mutation_number || '').trim() ||
      !!String(detail.mutation_date || '').trim() ||
      !!String(detail.mutation_type_description || '').trim() ||
      !!String(detail.status_description || '').trim() ||
      !!String(detail.notice9_dispatch_number || '').trim() ||
      !!String(detail.cts_number || '').trim()
    );
  }

  private syncEpicsUrbanOfficeSnapshot(): void {
    const code = this.form.controls.urbanOfficeCode.getRawValue().trim();
    if (!code) { this.epicsUrbanOfficeSnapshot.set(null); this.schedulePersist(); return; }
    const row = this.urbanSearchOffices().find((o) => o.office_code === code);
    if (row) this.epicsUrbanOfficeSnapshot.set({ code: row.office_code, name: row.office_name });
    this.refreshFilingClientRefIfDraft();
    this.schedulePersist();
  }

  private clearSearchResultState(): void {
    this.mutationFound.set(false);
    this.mutationDetails.set(null);
    this.mutationSuggestions.set([]);
    this.notice9Resolved.set({ available: false, sourceKind: null, url: null, previewKind: 'none' });
    this.manualAttachFileName.set(null);
    this.manualNotice9FileName.set(null);
  }

  private resetUrbanSearchChain(): void {
    this.form.patchValue(
      {
        urbanDistrictCode: '', urbanOfficeCode: '', urbanVillageCode: '',
        ctsNoInput: '', selectedSubCtsNo: '', selectedInwardNumber: '',
        mutationNumberInput: '', selectedUrbanMutationTypeCode: ''
      },
      { emitEvent: false }
    );
    this.urbanSearchOffices.set([]);
    this.urbanSearchVillages.set([]);
    this.urbanSearchSubCtsRows.set([]);
    this.urbanSearchMutations.set([]);
    this.urbanMutationTypeOptions.set([]);
    this.syncEpicsUrbanOfficeSnapshot();
  }

  protected isNotice9ImagePreview(url: string): boolean {
    if (this.notice9Resolved().previewKind === 'image') return true;
    const lower = (url || '').toLowerCase();
    return lower.startsWith('data:image/') || /\.(png|jpg|jpeg|webp|gif)(\?|$)/.test(lower);
  }

  protected isNotice9PdfPreview(url: string): boolean {
    if (this.notice9Resolved().previewKind === 'pdf') return true;
    const lower = (url || '').toLowerCase();
    return lower.startsWith('data:application/pdf') || lower.endsWith('.pdf');
  }

  protected canPreviewNotice9(): boolean {
    return this.mutationFound() && !!this.mutationDetails()?.inwardNumber?.trim();
  }

  protected openNotice9Preview(): void {
    if (!this.canPreviewNotice9() || this.loadingNotice9()) return;

    const cached = this.notice9Resolved();
    if (cached.available && cached.url) {
      this.notice9ModalError.set(null);
      this.notice9ModalOpen.set(true);
      return;
    }

    const inward = this.resolveNotice9InwardNumber();
    if (!inward) {
      this.notice9ModalError.set('Inward number is required to load Notice 9.');
      this.notice9ModalOpen.set(true);
      return;
    }

    this.notice9ModalError.set(null);
    this.notice9ModalOpen.set(true);
    this.fetchNoticeNineForInward(inward, true);
  }

  protected closeNotice9Modal(): void {
    this.notice9ModalOpen.set(false);
    this.notice9ModalError.set(null);
  }

  protected onNotice9ModalBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('notice9-modal-backdrop')) {
      this.closeNotice9Modal();
    }
  }

  private resolveNotice9InwardNumber(): string {
    return (
      this.mutationDetails()?.inwardNumber?.trim() ||
      this.form.controls.searchValue.getRawValue().trim() ||
      this.form.controls.selectedInwardNumber.getRawValue().trim() ||
      ''
    );
  }

  private compactNotice9ForSession(n9: NoticeNineResolved): NoticeNineResolved {
    if (n9.url && n9.url.length > 120_000) {
      return { available: true, sourceKind: n9.sourceKind, url: null, previewKind: n9.previewKind };
    }
    return n9;
  }

  private fetchNoticeNineForInward(inwardNumber: string, openInModal = false): void {
    const inward = inwardNumber.trim();
    if (!inward) return;
    this.loadingNotice9.set(true);
    this.notice9ModalError.set(null);
    this.landRecords
      .getUrbanNoticeNineView(inward)
      .pipe(
        catchError((err: unknown) => {
          this.notice9ModalError.set(this.formatError(err));
          return of(null);
        }),
        finalize(() => this.loadingNotice9.set(false))
      )
      .subscribe({
        next: (notice9) => {
          if (notice9) {
            this.applyNoticeNineViewResult(notice9);
            this.schedulePersist();
            if (openInModal && !this.notice9Resolved().available) {
              this.notice9ModalError.set('Notice 9 is not available for this inward number.');
            }
          } else if (openInModal) {
            this.notice9Resolved.set({ available: false, sourceKind: null, url: null, previewKind: 'none' });
            this.notice9ModalError.set('Notice 9 is not available for this inward number.');
          }
        }
      });
  }

  private applyNoticeNineViewResult(response: NoticeNineViewResponse | string | Record<string, unknown>): void {
    const resolved = this.resolveNoticeNine(response);
    this.notice9Resolved.set(resolved);
    const current = this.mutationDetails();
    if (current) this.mutationDetails.set({ ...current, notice9Url: resolved.url });
  }

  private normalizeNoticeNinePayload(
    response: NoticeNineViewResponse | string | Record<string, unknown> | null | undefined
  ): NoticeNineViewResponse | string | Record<string, unknown> {
    if (response == null) return {};
    if (typeof response === 'string') return response;
    if (typeof response !== 'object' || Array.isArray(response)) return {};
    const o = response as Record<string, unknown>;
    if (o['data'] != null) return this.normalizeNoticeNinePayload(o['data'] as typeof response);
    if (o['result'] != null) return this.normalizeNoticeNinePayload(o['result'] as typeof response);
    return o;
  }

  private resolveNoticeNine(response: NoticeNineViewResponse | string | Record<string, unknown>): NoticeNineResolved {
    const empty: NoticeNineResolved = { available: false, sourceKind: null, url: null, previewKind: 'none' };
    const payload = this.normalizeNoticeNinePayload(response);

    if (typeof payload === 'string') {
      const cleaned = this.cleanText(payload);
      if (!cleaned) return empty;
      const isData = cleaned.startsWith('data:');
      return { available: true, sourceKind: isData ? 'data' : 'external', url: cleaned, previewKind: this.detectPreviewKindFromUrl(cleaned) };
    }

    const raw = payload as Record<string, unknown>;
    const type = this.cleanText(String(raw['type'] ?? raw['Type'] ?? '')).toLowerCase();
    const base64 = this.cleanText(String(raw['base64'] ?? raw['Base64'] ?? raw['fileContent'] ?? raw['content'] ?? ''));
    const isBase64Payload = type === 'base64-file' || type === 'base64' || (!type && !!base64);

    if (isBase64Payload) {
      const directDataUrl = this.cleanText(String(raw['dataUrl'] ?? raw['data_url'] ?? raw['dataURL'] ?? ''));
      const mimeType = this.cleanText(String(raw['mimeType'] ?? raw['mime_type'] ?? raw['contentType'] ?? raw['content_type'] ?? 'application/octet-stream'));
      let dataUrl = '';
      if (directDataUrl) {
        dataUrl = directDataUrl;
      } else if (base64) {
        const normalizedB64 = base64.replace(/\\r\\n/g, '').replace(/\\n/g, '').replace(/\\r/g, '').replace(/\s/g, '');
        dataUrl = `data:${mimeType};base64,${normalizedB64}`;
      }
      if (!dataUrl) return empty;
      return { available: true, sourceKind: 'data', url: dataUrl, previewKind: this.detectPreviewKindFromUrl(dataUrl, mimeType) };
    }

    const rawUrl = this.cleanText(String(raw['url'] ?? raw['notice9Url'] ?? raw['notice9_url'] ?? raw['fileUrl'] ?? raw['file_url'] ?? ''));
    if (rawUrl) {
      const isData = rawUrl.startsWith('data:');
      return { available: true, sourceKind: isData ? 'data' : 'external', url: rawUrl, previewKind: this.detectPreviewKindFromUrl(rawUrl) };
    }

    return empty;
  }

  private cleanText(value: string): string {
    let v = String(value ?? '').trim();
    if (!v) return '';
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1).trim();
    v = v.replace(/\\\//g, '/').trim();
    return v;
  }

  private detectPreviewKindFromUrl(url: string, mimeType = ''): 'image' | 'pdf' | 'none' {
    const lower = url.toLowerCase();
    const mime = mimeType.toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf') return 'pdf';
    if (lower.startsWith('data:image/')) return 'image';
    if (lower.startsWith('data:application/pdf')) return 'pdf';
    if (lower.includes('base64,/9j/') || lower.includes('base64,ivborw0kg')) return 'image';
    if (lower.includes('base64,jvberi')) return 'pdf';
    if (lower.endsWith('.pdf')) return 'pdf';
    if (/\.(png|jpg|jpeg|webp|gif)(\?|$)/.test(lower)) return 'image';
    return 'none';
  }

  protected searchFieldLabel(): string {
    const mode = this.form.controls.searchMode.getRawValue();
    if (mode === 'INWARD_NUMBER') return 'Inward number';
    if (mode === 'SURVEY_NUMBER') return 'Survey number';
    return 'Mutation type';
  }

  protected searchPlaceholder(): string {
    const mode = this.form.controls.searchMode.getRawValue();
    if (mode === 'INWARD_NUMBER') return 'e.g. INW/2026/00123';
    if (mode === 'SURVEY_NUMBER') return 'e.g. 112/1';
    return 'e.g. MUT/2026/778';
  }

  protected ctsRowLabel(row: UrbanCtsRow): string {
    return String(row.new_cts_numb_2000 || row.cts_no || '').trim();
  }

  protected epicsUrbanOfficeFromStep1(): UrbanOffice | null {
    const code = this.form.controls.urbanOfficeCode.getRawValue().trim();
    if (!code) return null;
    return this.urbanSearchOffices().find((o) => o.office_code === code) ?? null;
  }

  protected epicsUrbanOfficeReadonlySelectLabel(): string {
    const name = this.filingOfficeNameForVakalatnama();
    if (name) return name;
    return '— Select office in step 1 (District → Office) —';
  }

  protected urbanOfficeOptionLabel(o: UrbanOffice): string {
    return `${o.office_code} — ${o.office_name}`;
  }

  protected urbanMutationInwardOptionLabel(m: UrbanMutationListRow): string {
    const inward = String(m.inward_number || '').trim() || '-';
    const name = String(m.applicant_name || '').trim() || '-';
    const mutationNo = String(m.mutation_number || '').trim() || '-';
    const mutationDate = String(m.mutation_date || '').trim() || '-';
    return `${inward} - ${name} - ${mutationNo} - ${mutationDate}`;
  }

  protected loadUrbanSubCtsRows(): void {
    const villageCode = this.form.controls.urbanVillageCode.getRawValue().trim();
    if (!villageCode) { this.apiError.set('Please select village first.'); return; }
    const parentCts = this.form.controls.ctsNoInput.getRawValue().trim();
    if (!parentCts) { this.apiError.set('Please enter parent CTS number (required for sub CTS list).'); return; }
    this.apiError.set(null);
    this.fetchUrbanSubCtsRows(villageCode, parentCts, false);
  }

  private fetchUrbanSubCtsRows(villageCode: string, parentCts: string, preserveSelections: boolean): void {
    if (!preserveSelections) {
      this.urbanSearchMutations.set([]);
      this.form.controls.selectedSubCtsNo.setValue('', { emitEvent: false });
      this.form.controls.selectedInwardNumber.setValue('', { emitEvent: false });
    }
    this.loadingUrbanSearchChain.set(true);
    this.landRecords
      .getUrbanSubCtsList(villageCode, parentCts)
      .pipe(finalize(() => this.loadingUrbanSearchChain.set(false)))
      .subscribe({
        next: (rows) => {
          this.urbanSearchSubCtsRows.set(rows || []);
          if (preserveSelections) {
            const subCts = this.form.controls.selectedSubCtsNo.getRawValue().trim();
            if (subCts && this.urbanSearchMutations().length === 0) {
              this.fetchUrbanMutationsForSubCts(villageCode, subCts, true);
            }
          }
          this.schedulePersist();
        },
        error: (err: unknown) => this.apiError.set(this.formatError(err))
      });
  }

  protected loadUrbanMutationsBySubCts(): void {
    const villageCode = this.form.controls.urbanVillageCode.getRawValue().trim();
    const ctsNo = this.form.controls.selectedSubCtsNo.getRawValue().trim();
    if (!villageCode || !ctsNo) { this.apiError.set('Please select sub CTS number first.'); return; }
    this.apiError.set(null);
    this.fetchUrbanMutationsForSubCts(villageCode, ctsNo, false);
  }

  private fetchUrbanMutationsForSubCts(
    villageCode: string,
    ctsNo: string,
    preserveSelections: boolean
  ): void {
    if (!preserveSelections) {
      this.form.controls.selectedInwardNumber.setValue('', { emitEvent: false });
      this.urbanSearchMutations.set([]);
    }
    this.loadingUrbanSearchChain.set(true);
    this.landRecords
      .getUrbanMutationsApplicantByCts(villageCode, ctsNo)
      .pipe(finalize(() => this.loadingUrbanSearchChain.set(false)))
      .subscribe({
        next: (rows) => {
          this.urbanSearchMutations.set(rows || []);
          this.schedulePersist();
        },
        error: (err: unknown) => this.apiError.set(this.formatError(err))
      });
  }

  protected loadUrbanMutationTypes(): void {
    const villageCode = this.form.controls.urbanVillageCode.getRawValue().trim();
    if (!villageCode) { this.urbanMutationTypeOptions.set([]); return; }
    this.loadingUrbanMutationTypes.set(true);
    this.apiError.set(null);
    this.landRecords
      .getUrbanMutationTypes(villageCode)
      .pipe(finalize(() => this.loadingUrbanMutationTypes.set(false)))
      .subscribe({
        next: (rows) => this.urbanMutationTypeOptions.set(rows || []),
        error: (err: unknown) => {
          this.apiError.set(this.formatError(err));
          this.urbanMutationTypeOptions.set([]);
        }
      });
  }

  protected loadUrbanMutationsByMutationType(): void {
    const villageCode = this.form.controls.urbanVillageCode.getRawValue().trim();
    const mutationTypeCode = this.form.controls.selectedUrbanMutationTypeCode.getRawValue().trim();
    if (!villageCode || !mutationTypeCode) { this.apiError.set('Please select village and mutation type first.'); return; }
    this.apiError.set(null);
    this.fetchUrbanMutationsForMutationType(villageCode, mutationTypeCode, false);
  }

  private fetchUrbanMutationsForMutationType(
    villageCode: string,
    mutationTypeCode: string,
    preserveSelections: boolean
  ): void {
    if (!preserveSelections) {
      this.form.controls.selectedInwardNumber.setValue('', { emitEvent: false });
      this.urbanSearchMutations.set([]);
    }
    this.loadingUrbanSearchChain.set(true);
    this.landRecords
      .getUrbanMutationsApplicantByMutationType(villageCode, mutationTypeCode)
      .pipe(finalize(() => this.loadingUrbanSearchChain.set(false)))
      .subscribe({
        next: (rows) => {
          this.urbanSearchMutations.set(rows || []);
          this.schedulePersist();
        },
        error: (err: unknown) => this.apiError.set(this.formatError(err))
      });
  }

  protected searchBySelectedInward(): void {
    const inward = this.form.controls.selectedInwardNumber.getRawValue().trim();
    if (!inward) { this.apiError.set('Please select inward number.'); return; }
    this.form.controls.searchValue.setValue(inward, { emitEvent: false });
    this.performSearch();
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

  private resetAfterFinalSubmit(): void {
    try { sessionStorage.removeItem(this.sessionKey()); } catch { /**/ }
    this.hydrating = true;
    this.resetClientRefSeedParts();
    this.filingClientRef.set(this.buildClientApplicationRef());
    this.serverApplicationId.set(null);
    this.applicantIdByClientRowKeySig.set({});
    this.stepIndex.set(0);
    this.disputedLands.set([]);
    this.mappedAttachments.set([]);
    this.vakaltnamaAssignments.set([]);
    this.vakaltnamaCoAdvocates.set([]);
    this.mutationDetails.set(null);
    this.mutationFound.set(false);
    this.searchedMutation.set(false);
    this.loadingSearch.set(false);
    this.loadingNotice9.set(false);
    this.notice9ModalOpen.set(false);
    this.notice9ModalError.set(null);
    this.notice9Resolved.set({ available: false, sourceKind: null, url: null, previewKind: 'none' });
    this.manualAttachFileName.set(null);
    this.manualNotice9FileName.set(null);
    this.selectedSubject.set(null);
    this.selectedOffice.set(null);
    this.epicsUrbanOfficeSnapshot.set(null);
    while (this.applicants.length) this.applicants.removeAt(0);
    while (this.respondents.length) this.respondents.removeAt(0);
    this.form.patchValue(
      {
        subjectId: 0, searchMode: 'INWARD_NUMBER' as const, searchValue: '',
        mutationYear: '', mutationTypeFilter: '', urbanDistrictCode: '',
        urbanOfficeCode: '', urbanVillageCode: '', ctsNoInput: '',
        selectedSubCtsNo: '', selectedInwardNumber: '', mutationNumberInput: '',
        selectedUrbanMutationTypeCode: '', manualInwardNumber: '', manualInwardDate: '',
        manualMutationType: '', manualApplicantName: '', manualVillage: '',
        manualStatus: '', actId: 0, sectionId: 0, customSectionName: '',
        applicationDescription: '', affidavitText: '', prayerText: ''
      },
      { emitEvent: false }
    );
    this.descriptionParagraphs.set(['']);
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
    if (!this.validateCurrentStep(true)) return;
    const nextIndex = Math.min(this.steps.length - 1, this.stepIndex() + 1);
    this.stepIndex.set(nextIndex);
    if (this.steps[nextIndex]?.key === 'PARTIES') {
      this.ensureMutationSuggestionsForPartiesStep();
    }
    this.schedulePersist();
  }

  protected selectStep(targetIndex: number): void {
    this.apiMessage.set(null);
    const current = this.stepIndex();
    if (targetIndex === current) return;
    this.apiError.set(null);
    if (targetIndex < current) {
      this.stepIndex.set(targetIndex);
      if (this.steps[targetIndex]?.key === 'PARTIES') {
        this.ensureMutationSuggestionsForPartiesStep();
      }
      this.schedulePersist();
      return;
    }
    for (let i = current; i < targetIndex; i++) {
      const key = this.steps[i].key;
      if (!this.validateStepByKey(key, true)) {
        this.stepIndex.set(i);
        this.schedulePersist();
        return;
      }
    }
    this.stepIndex.set(targetIndex);
    if (this.steps[targetIndex]?.key === 'PARTIES') {
      this.ensureMutationSuggestionsForPartiesStep();
    }
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
      case 'DISPUTED_ORDER': ok = this.validateDisputedOrderStep(markTouched); break;
      case 'ACT_SECTION': ok = this.validateActSectionStep(markTouched); break;
      case 'PARTIES': ok = this.validatePartiesStep(markTouched); break;
      case 'VAKALTNAMA': ok = this.validateVakaltnamaStep(); break;
      case 'DISPUTED_LAND': ok = this.validateDisputedLandStep(); break;
      case 'APPLICATION_DESCRIPTION': ok = true; break;
      default: ok = true;
    }
    if (!ok && !this.apiError()) this.apiError.set('Please complete this step before continuing.');
    return ok;
  }

  private validateDisputedOrderStep(markTouched: boolean): boolean {
    if (markTouched) {
      this.form.controls.subjectId.markAsTouched();
      this.form.controls.searchValue.markAsTouched();
      this.form.controls.urbanDistrictCode.markAsTouched();
      this.form.controls.urbanOfficeCode.markAsTouched();
      this.form.controls.urbanVillageCode.markAsTouched();
      this.form.controls.ctsNoInput.markAsTouched();
      this.form.controls.selectedSubCtsNo.markAsTouched();
      this.form.controls.selectedInwardNumber.markAsTouched();
      this.form.controls.selectedUrbanMutationTypeCode.markAsTouched();
    }
    const subjectId = this.form.controls.subjectId.getRawValue();
    if (!subjectId || subjectId < 1) { this.apiError.set('Please select subject.'); return false; }
    if (this.isRural712Subject()) {
      if (markTouched) {
        this.form.controls.ruralDistrictCode.markAsTouched();
        this.form.controls.ruralTalukaCode.markAsTouched();
        this.form.controls.ruralVillageLgdCode.markAsTouched();
        this.form.controls.ruralSurveyPin.markAsTouched();
      }
      const districtCode = this.form.controls.ruralDistrictCode.getRawValue().trim();
      const talukaCode = this.form.controls.ruralTalukaCode.getRawValue().trim();
      const villageLgd = this.form.controls.ruralVillageLgdCode.getRawValue().trim();
      const pin = this.form.controls.ruralSurveyPin.getRawValue().trim();
      if (!districtCode || !talukaCode || !villageLgd || !pin) {
        this.apiError.set('Complete district, taluka, village and survey number, then search.');
        return false;
      }
      if (!this.rural712Searched()) { this.apiError.set('Please run Search for 7/12 records before continuing.'); return false; }
      if (this.rural712SubSurveyRows().length === 0) { this.apiError.set('No 7/12 / Eferfar records found — adjust search criteria or verify survey number.'); return false; }
      if (this.selectedRural712Index() == null) { this.apiError.set('Select the 7/12 record that is the disputed order.'); return false; }
      return true;
    }
    if (!this.isEpicsSubject()) return true;
    const mode = this.form.controls.searchMode.getRawValue();
    if (mode === 'INWARD_NUMBER') {
      const searchValue = this.form.controls.searchValue.getRawValue().trim();
      if (searchValue.length < 2) { this.apiError.set('Enter search value (at least 2 characters) and search.'); return false; }
      if (!this.searchedMutation()) { this.apiError.set('Please run Search for mutation details before continuing.'); return false; }
      return true;
    }
    const urbanDistrict = this.form.controls.urbanDistrictCode.getRawValue().trim();
    if (!urbanDistrict) { this.apiError.set('Please select district (ePICS urban).'); return false; }
    const urbanOffice = this.form.controls.urbanOfficeCode.getRawValue().trim();
    if (!urbanOffice) { this.apiError.set('Please select office (ePICS urban).'); return false; }
    const urbanVillage = this.form.controls.urbanVillageCode.getRawValue().trim();
    if (!urbanVillage) { this.apiError.set('Please select village.'); return false; }
    if (mode === 'SURVEY_NUMBER') {
      const subCts = this.form.controls.selectedSubCtsNo.getRawValue().trim();
      if (!subCts) { this.apiError.set('Please load sub CTS and select a sub CTS number.'); return false; }
    }
    if (mode === 'MUTATION_NUMBER') {
      const mt = this.form.controls.selectedUrbanMutationTypeCode.getRawValue().trim();
      if (!mt) { this.apiError.set('Please select mutation type.'); return false; }
    }
    const inward = this.form.controls.selectedInwardNumber.getRawValue().trim();
    if (!inward) { this.apiError.set('Please load inward numbers, select an inward number, then use Search by selected inward.'); return false; }
    const searchValue = this.form.controls.searchValue.getRawValue().trim();
    if (searchValue.length < 2) { this.apiError.set('Use "Search by selected inward" after choosing an inward number.'); return false; }
    if (!this.searchedMutation()) { this.apiError.set('Please run search for mutation details before continuing.'); return false; }
    return true;
  }

  private validateActSectionStep(markTouched: boolean): boolean {
    const c = this.form.controls;
    if (markTouched) { c.actId.markAsTouched(); c.sectionId.markAsTouched(); }
    if (!c.actId.getRawValue() || c.actId.getRawValue() < 1) { this.apiError.set('Please select act.'); return false; }
    const sectionId = c.sectionId.getRawValue();
    if (sectionId === -1) { this.apiError.set('Choose a section from the list, or enter a custom section and click Add section.'); return false; }
    if (!sectionId || sectionId < 1) { this.apiError.set('Please select section.'); return false; }
    return true;
  }

  private validatePartiesStep(markTouched: boolean): boolean {
    if (markTouched) {
      this.applicants.controls.forEach((g) => g.markAllAsTouched());
      this.respondents.controls.forEach((g) => g.markAllAsTouched());
    }

    // Diagnostics: Log validation errors to the browser console
    this.applicants.controls.forEach((c, idx) => {
      const g = c as FormGroup;
      if (g.invalid) {
        console.warn(`Applicant #${idx + 1} is invalid. Form values:`, g.value);
        Object.keys(g.controls).forEach((key) => {
          const ctrl = g.get(key);
          if (ctrl && ctrl.invalid) {
            console.warn(`  Field "${key}" failed validation:`, ctrl.errors);
          }
        });
      }
    });

    this.respondents.controls.forEach((c, idx) => {
      const g = c as FormGroup;
      if (g.invalid) {
        console.warn(`Respondent #${idx + 1} is invalid. Form values:`, g.value);
        Object.keys(g.controls).forEach((key) => {
          const ctrl = g.get(key);
          if (ctrl && ctrl.invalid) {
            console.warn(`  Field "${key}" failed validation:`, ctrl.errors);
          }
        });
      }
    });

    if (this.applicants.length < 1) { this.apiError.set('At least one applicant is required. Please add applicant details.'); return false; }
    if (this.respondents.length < 1) { this.apiError.set('At least one respondent is required. Please add respondent details.'); return false; }
    if (!this.applicants.valid) { this.apiError.set('Please complete all mandatory applicant details (name, mobile, pincode, address).'); return false; }
    if (!this.respondents.valid) { this.apiError.set('Please complete all mandatory respondent details (name, mobile, pincode, address).'); return false; }
    return true;
  }

  private validateVakaltnamaStep(): boolean {
    const assignments = this.vakaltnamaAssignments();
    if (assignments.length < 1) { this.apiError.set('Create at least one vakaltnama group with advocate and applicants.'); return false; }
    const applicantIds = this.applicantOptions().map((a) => a.id);
    const covered = new Set<string>();
    for (const g of assignments) for (const id of g.applicantIds) covered.add(id);
    for (const id of applicantIds) {
      if (!covered.has(id)) { this.apiError.set('Every applicant must be included in at least one vakaltnama group.'); return false; }
    }
    return true;
  }

  private validateDisputedLandStep(): boolean {
    if (this.disputedLands().length < 1) { this.apiError.set('Add at least one disputed land record.'); return false; }
    return true;
  }

  private buildDisputedLandsPayload(): Array<Record<string, unknown>> {
    return this.disputedLands().map((row, index) => {
      if (row.type === 'RURAL_7_12') {
        return {
          lineNo: index + 1, landType: row.type, externalSource: 'LAND_RECORDS_API',
          districtCode: row.districtCode, districtName: row.districtName,
          talukaCode: row.talukaCode, talukaName: row.talukaName,
          villageLgdCode: row.villageLgdCode, villageName: row.villageName,
          surveyPin: row.pin, pin1: row.pinParts.pin1, pin2: row.pinParts.pin2,
          pin3: row.pinParts.pin3, pin4: row.pinParts.pin4, pin5: row.pinParts.pin5,
          pin6: row.pinParts.pin6, pin7: row.pinParts.pin7, pin8: row.pinParts.pin8,
          landDetail: row.landDetail?.length ? row.landDetail : null
        };
      }
      return {
        lineNo: index + 1, landType: row.type, externalSource: 'LAND_RECORDS_API',
        districtCode: row.districtCode, districtName: row.districtName,
        officeCode: row.officeCode, officeName: row.officeName,
        villageCode: row.villageCode, villageName: row.villageName,
        parentCtsNo: row.parentCtsNo || row.ctsNo, subCtsNo: row.subCtsNo || null,
        ctsNo: row.ctsNo, propertyDetail: row.propertyDetail ?? null
      };
    });
  }

  private buildFormPayload(): Record<string, unknown> {
    const raw = this.form.getRawValue() as Record<string, unknown>;
    const {
      urbanDistrictCode: _udc, urbanOfficeCode: _uoc, urbanVillageCode: _uvc,
      ctsNoInput: _cni, selectedSubCtsNo: _ssc, selectedInwardNumber: _sin,
      selectedUrbanMutationTypeCode: _sumt, mutationNumberInput: _mni,
      ...rawForPayload
    } = raw;
    const applicants = this.applicants.controls.map((ctrl, i) => {
      const row = (ctrl as any).getRawValue?.() as Record<string, string | undefined>;
      const key = (row['tempId'] || this.makeTempId()).trim();
      const firstName = row['firstName'] || '';
      const middleName = row['middleName'] || '';
      const lastName = row['lastName'] || '';
      return {
        lineNo: i + 1, tempId: key, clientRowKey: key,
        firstName, middleName, lastName,
        name: [firstName, middleName, lastName].join(' ').trim() || row['name'] || '',
        pincode: row['pincode'] || '', district: row['district'] || '',
        taluka: row['taluka'] || '', village: row['village'] || '',
        villageValue: row['villageValue'] || '', mobile: row['mobile'] || '',
        address: row['address'] || '', email: row['email'] || '',
        dob: row['dob'] || '', age: row['age'] || '', occupation: row['occupation'] || ''
      };
    });
    const respondents = this.respondents.controls.map((ctrl, i) => {
      const row = (ctrl as any).getRawValue?.() as Record<string, string | undefined>;
      const key = (row['tempId'] || this.makeTempId()).trim();
      const firstName = row['firstName'] || '';
      const middleName = row['middleName'] || '';
      const lastName = row['lastName'] || '';
      return {
        lineNo: i + 1, clientRowKey: key,
        firstName, middleName, lastName,
        name: [firstName, middleName, lastName].join(' ').trim() || row['name'] || '',
        pincode: row['pincode'] || '', district: row['district'] || '',
        taluka: row['taluka'] || '', village: row['village'] || '',
        villageValue: row['villageValue'] || '', mobile: row['mobile'] || '',
        address: row['address'] || '', email: row['email'] || '',
        dob: row['dob'] || '', age: row['age'] || '', occupation: row['occupation'] || ''
      };
    });
    const descriptionParagraphs = this.normalizedDescriptionParagraphs();
    return {
      ...rawForPayload,
      sectionCustomText: (raw['customSectionName'] as string) || null,
      descriptionParagraphs,
      applicationDescription: descriptionParagraphs.join('\n\n'),
      affidavitText: String(raw['affidavitText'] ?? '').trim(),
      prayerText: String(raw['prayerText'] ?? '').trim(),
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
        url: n9.url, previewKind: n9.previewKind
      }
    };
  }

  protected onDescriptionParagraphsChange(paragraphs: string[]): void {
    this.descriptionParagraphs.set(paragraphs.length ? paragraphs : ['']);
    this.schedulePersist();
  }

  protected loadAffidavitTemplate(): void {
    try {
      const html = buildAffidavitTemplateHtml(this.buildDescriptionTemplateContext());
      this.form.controls.affidavitText.setValue(html, { emitEvent: true });
      this.form.controls.affidavitText.markAsDirty();
      this.apiError.set(null);
      this.apiMessage.set('Affidavit (शपथपत्र) template loaded. Use View for full document.');
      this.schedulePersist();
    } catch (err) {
      console.error('Affidavit template load failed', err);
      this.apiError.set('Could not load affidavit template. Please try again.');
    }
  }

  protected loadPrayerTemplate(): void {
    try {
      const html = buildPrayerTemplateHtml(this.buildDescriptionTemplateContext());
      this.form.controls.prayerText.setValue(html, { emitEvent: true });
      this.form.controls.prayerText.markAsDirty();
      this.apiError.set(null);
      this.apiMessage.set('Prayer (सत्यापन नमुना) template loaded. Use View for full document.');
      this.schedulePersist();
    } catch (err) {
      console.error('Prayer template load failed', err);
      this.apiError.set('Could not load prayer template. Please try again.');
    }
  }

  protected viewAffidavitDocument(): void {
    const raw = this.form.controls.affidavitText.getRawValue().trim();
    const html = raw || buildAffidavitTemplateHtml(this.buildDescriptionTemplateContext());
    if (!openFilingDocumentHtml(html)) {
      this.apiError.set('Pop-up blocked. Allow pop-ups to view the affidavit.');
    }
  }

  protected viewPrayerDocument(): void {
    const raw = this.form.controls.prayerText.getRawValue().trim();
    const html = raw || buildPrayerTemplateHtml(this.buildDescriptionTemplateContext());
    if (!openFilingDocumentHtml(html)) {
      this.apiError.set('Pop-up blocked. Allow pop-ups to view the prayer.');
    }
  }

  private buildDescriptionTemplateContext() {
    const first = this.applicants.length > 0 ? this.applicants.at(0) : null;
    const row = (first?.getRawValue() ?? {}) as Record<string, unknown>;
    const assignment = this.vakaltnamaAssignments()[0];
    const advocate = assignment?.advocate;
    const districtName = this.districts().find(
      (d) => d.id === this.form.controls.districtId.getRawValue()
    )?.name;

    return buildFilingDescriptionTemplateContext({
      applicantRow: row,
      advocateFullName:
        advocate?.fullName?.trim() || this.tokenStorage.getDisplayName()?.trim() || '',
      advocateRegistrationNo: advocate?.barCouncilNumber?.trim() || '',
      descriptionParagraphCount: this.normalizedDescriptionParagraphs().length,
      hearingDistrictName: districtName
    });
  }

  private normalizedDescriptionParagraphs(): string[] {
    return this.descriptionParagraphs()
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  private validateApplicationDescriptionStep(markTouched: boolean): boolean {
    if (markTouched) {
      this.form.controls.affidavitText.markAsTouched();
      this.form.controls.prayerText.markAsTouched();
    }
    const paragraphs = this.normalizedDescriptionParagraphs();
    const totalLen = paragraphs.join('\n\n').length;
    if (!paragraphs.length || totalLen < 10) {
      this.apiError.set('Please enter application description (at least one paragraph, 10 characters total).');
      return false;
    }
    const affidavit = this.form.controls.affidavitText.getRawValue().trim();
    if (affidavit.length < 10) {
      this.apiError.set('Please enter affidavit text (at least 10 characters).');
      return false;
    }
    const prayer = this.form.controls.prayerText.getRawValue().trim();
    if (prayer.length < 10) {
      this.apiError.set('Please enter prayer text (at least 10 characters).');
      return false;
    }
    return true;
  }

  protected previewApplication(): void {
    const appId = this.serverApplicationId();
    if (appId != null && appId > 0) {
      void this.router.navigate(['/applications', appId]);
      return;
    }
    if (!this.validateApplicationDescriptionStep(true)) return;
    this.apiMessage.set(null);
    this.apiError.set(null);
    const body: FilingApplicationSaveRequest = {
      status: 'DRAFT',
      caseCategoryId: this.caseCategoryId(),
      clientApplicationRef: this.filingClientRef(),
      form: this.buildFormPayload(),
      disputedOrder: this.buildDisputedOrderPayload(),
      disputedLands: this.buildDisputedLandsPayload(),
      attachments: [...this.mappedAttachments()]
    };
    this.saveInProgress.set(true);
    this.filingApplications
      .save(body)
      .pipe(finalize(() => this.saveInProgress.set(false)))
      .subscribe({
        next: (resp) => {
          if (resp?.applicationId != null && resp.applicationId > 0) {
            this.serverApplicationId.set(resp.applicationId);
            this.schedulePersist();
            void this.router.navigate(['/applications', resp.applicationId]);
            return;
          }
          this.apiError.set('Draft saved but application ID was not returned — cannot open preview.');
        },
        error: (err: unknown) => this.apiError.set(this.formatError(err))
      });
  }

  private validateAllStepsForSubmit(): boolean {
    for (let i = 0; i < this.steps.length; i++) {
      const key = this.steps[i].key;
      const ok = key === 'APPLICATION_DESCRIPTION' ? this.validateApplicationDescriptionStep(true) : this.validateStepByKey(key, true);
      if (!ok) { this.stepIndex.set(i); return false; }
    }
    const docErr = this.mappedDocsPanel()?.validateApplicantForSubmit();
    if (docErr) {
      this.apiError.set(docErr);
      this.stepIndex.set(this.steps.findIndex((s) => s.key === 'APPLICATION_DESCRIPTION'));
      return false;
    }
    return true;
  }

  protected onMappedAttachmentsChange(attachments: FilingMappedAttachment[]): void {
    this.mappedAttachments.set(attachments);
    this.schedulePersist();
  }

  protected readonly filingSubjectId = computed(
    () => this.selectedSubject()?.id ?? Number(this.form.controls.subjectId.getRawValue() || 0)
  );

  protected selectedSubjectLabel(): string { return this.selectedSubject()?.subjectName || ''; }
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
    return ids.map((id) => map.get(id) ?? id).filter(Boolean).join(', ');
  }

  protected saveDraft(): void { this.apiMessage.set(null); this.postSave('DRAFT'); }
  protected finalSubmit(): void { this.apiMessage.set(null); this.postSave('FINAL'); }

  private postSave(mode: 'DRAFT' | 'FINAL'): void {
    if (mode === 'FINAL' && !this.validateAllStepsForSubmit()) return;
    const status: FilingSaveStatus = mode === 'FINAL' ? 'SUBMITTED' : 'DRAFT';
    const appId = this.serverApplicationId();
    const body: FilingApplicationSaveRequest = {
      status, caseCategoryId: this.caseCategoryId(),
      clientApplicationRef: this.filingClientRef(),
      ...(appId != null && appId > 0 ? { applicationId: appId } : {}),
      form: this.buildFormPayload(),
      disputedOrder: this.buildDisputedOrderPayload(),
      disputedLands: this.buildDisputedLandsPayload(),
      attachments: [...this.mappedAttachments()]
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
          if (status === 'SUBMITTED') { this.resetAfterFinalSubmit(); return; }
          if (resp?.applicationId != null && resp.applicationId > 0) this.serverApplicationId.set(resp.applicationId);
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
    if (!actId || actId < 1) { this.apiError.set('Please select Act first.'); return; }
    if (name.length < 2) { this.apiError.set('Please enter a section name/number.'); return; }
    this.apiError.set(null);
    const existing = this.sections();
    if (!existing.some((s) => s.sectionName.toLowerCase() === name.toLowerCase() || s.sectionCode.toLowerCase() === name.toLowerCase())) {
      const nextId = existing.reduce((m, s) => Math.max(m, s.id), 0) + 1;
      const act = this.acts().find((a) => a.id === actId);
      this.sections.set([
        ...existing,
        {
          id: nextId, actId, actCode: act?.actCode || '', actName: act?.actName || '',
          actNameLocal: act?.actNameLocal || null, sectionCode: name, sectionName: name, sectionNameLocal: null
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

  // ─── Translation helpers ────────────────────────────────────────────────────

  /** Maps English control names → paired Marathi control names. */
  private readonly marathiFieldMap: Record<string, string> = {
    firstName:  'firstNameMr',
    middleName: 'middleNameMr',
    lastName:   'lastNameMr',
    address:    'addressMr',
    occupation: 'occupationMr',
  };

  /**
   * Static map for occupation dropdown values — known at build time,
   * no HTTP request needed. Keys are lowercase substrings; first match wins.
   */
  private readonly occupationMarathiMap: Record<string, string> = {
    'doctor':        'डॉक्टर',
    'engineer':      'अभियंता',
    'farmer':        'शेतकरी',
    'teacher':       'शिक्षक',
    'business':      'व्यापारी',
    'student':       'विद्यार्थी',
    'retired':       'निवृत्त',
    'unemployed':    'बेरोजगार',
    'self employed': 'स्वयंरोजगार',
    'self-employed': 'स्वयंरोजगार',
    'lawyer':        'वकील',
    'advocate':      'अधिवक्ता',
    'accountant':    'लेखापाल',
    'clerk':         'लिपिक',
    'officer':       'अधिकारी',
    'government':    'सरकारी कर्मचारी',
    'housewife':     'गृहिणी',
    'labour':        'मजूर',
    'laborer':       'मजूर',
    'labourer':      'मजूर',
    'police':        'पोलीस',
    'army':          'सैनिक',
    'nurse':         'परिचारिका',
    'driver':        'चालक',
    'carpenter':     'सुतार',
    'electrician':   'विद्युत तंत्रज्ञ',
    'plumber':       'नलसाज',
    'tailor':        'शिंपी',
    'shopkeeper':    'दुकानदार',
    'contractor':    'कंत्राटदार',
    'professor':     'प्राध्यापक',
    'principal':     'मुख्याध्यापक',
    'journalist':    'पत्रकार',
    'artist':        'कलाकार',
    'architect':     'वास्तुविशारद',
    'banker':        'बँकर',
    'manager':       'व्यवस्थापक',
    'director':      'संचालक',
    'trader':        'व्यापारी',
    'agriculture':   'शेतकरी',
  };

  /**
   * Set of field keys currently awaiting a translation API response.
   * Public so the template can call `.has()` directly without going through a
   * method (passing $index into a method triggers the strict template checker).
   *
   * Key format: `{role}-{index}-{fieldName}`  e.g. `applicant-0-firstName`
   * Template: `translatingFields().has('applicant-' + i + '-firstName')`
   */
  public readonly translatingFields = signal<Set<string>>(new Set());

  /**
   * Tracks which Marathi fields have been manually edited by the user.
   * Format: `{role}-{index}-{marathiFieldName}` e.g. `applicant-0-firstNameMr`
   * When a Marathi field is manually edited, we don't auto-overwrite it unless
   * the English field changes to a different value.
   */
  public readonly manuallyEditedMarathiFields = signal<Set<string>>(new Set());

  /**
   * Called when user manually edits a Marathi field.
   * Marks the field as manually edited so we don't auto-overwrite it.
   */
  protected onMarathiFieldManualEdit(role: 'applicant' | 'respondent', index: number, marathiFieldName: string): void {
    const key = `${role}-${index}-${marathiFieldName}`;
    this.manuallyEditedMarathiFields.update((s) => {
      const next = new Set(s);
      next.add(key);
      return next;
    });
  }

  private saveTranslation(
  role: string,
  index: number,
  fieldName: string
): void {

  const array =
    role === 'applicant'
      ? this.applicants
      : this.respondents;

  const group = array.at(index);

  const marathiMap: Record<string, string> = {
    firstName: 'firstNameMr',
    middleName: 'middleNameMr',
    lastName: 'lastNameMr',
    address: 'addressMr',
    occupation: 'occupationMr'
  };

  const marathiFieldName = marathiMap[fieldName];

  if (!marathiFieldName) return;

  const englishText =
    group.get(fieldName)?.value ?? '';

  this.transliterateToMarathi(
    englishText,
    marathiFieldName,
    group as any,
    role,
    index,
    fieldName
  );
}

  private lookupOccupationMarathi(text: string): string {
    const lower = text.toLowerCase();
    for (const [key, mr] of Object.entries(this.occupationMarathiMap)) {
      if (lower.includes(key)) return mr;
    }
    return '';
  }

private transliterateToMarathi(
  englishText: string,
  marathiFieldName: string,
  group: ReturnType<Category1ObjectionComponent['createPartyGroup']>,
  role: string,
  index: number,
  fieldName: string
): void {

  const text = englishText?.trim();

  if (!text) {
    return;
  }

  const key = `${role}-${index}-${fieldName}`;

  // loading state
  this.translatingFields.update((s) => {
    const next = new Set(s);
    next.add(key);
    return next;
  });

  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=en&tl=mr&dt=t&q=${encodeURIComponent(text)}`;

  this.http
    .get<any>(url)
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.translatingFields.update((s) => {
          const next = new Set(s);
          next.delete(key);
          return next;
        });
      })
    )
    .subscribe({
      next: (resp) => {
        try {

          const translated =
            resp?.[0]
              ?.map((x: any) => x[0])
              ?.join('')
              ?.trim() ?? '';

          if (!translated) return;

          const currentMr =
            group.get(marathiFieldName)?.value?.trim();

          // don't overwrite manually entered Marathi
          if (currentMr) return;

          group.patchValue(
            {
              [marathiFieldName]: translated
            },
            { emitEvent: false }
          );

          this.schedulePersist();

        } catch (e) {
          console.error('Translation parse failed', e);
        }
      },

      error: (err) => {
        console.error('Translation failed', err);
      }
    });
}
private setupAutoTranslation(
  role: 'applicant' | 'respondent',
  index: number,
  group: ReturnType<Category1ObjectionComponent['createPartyGroup']>
): void {

  Object.entries(this.marathiFieldMap).forEach(
    ([englishField, marathiField]) => {

      const englishControl = group.get(englishField);
      if (!englishControl) return;

      englishControl.valueChanges
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          debounceTime(1500),
          distinctUntilChanged()
        )
        .subscribe((value) => {

          const englishValue = String(value || '').trim();
          const key = `${role}-${index}-${marathiField}`;

          if (!englishValue) {
            // Clear Marathi field when English is cleared to allow re-translation
            group.patchValue(
              { [marathiField]: '' },
              { emitEvent: false }
            );
            // Also clear the "manually edited" flag
            this.manuallyEditedMarathiFields.update((s) => {
              const next = new Set(s);
              next.delete(key);
              return next;
            });
            return;
          }

          // Check if Marathi field was manually edited
          const wasManuallyEdited = this.manuallyEditedMarathiFields().has(key);
          const marathiValue = group.get(marathiField)?.value?.trim() || '';

          // Skip if manually edited, but allow re-translation if Marathi is empty or auto-generated
          if (marathiValue && wasManuallyEdited) {
            return;
          }

          // If Marathi has auto-generated value, clear it before re-translating
          if (marathiValue && !wasManuallyEdited) {
            group.patchValue(
              { [marathiField]: '' },
              { emitEvent: false }
            );
          }

          // Occupation → static map
          if (englishField === 'occupation') {
            const translated =
              this.lookupOccupationMarathi(englishValue);

            if (translated) {
              group.patchValue(
                { [marathiField]: translated },
                { emitEvent: false }
              );
            }

            return;
          }

          this.transliterateToMarathi(
            englishValue,
            marathiField,
            group,
            role,
            index,
            englishField
          );
        });

      // AUTO TRANSLATE PREFILLED VALUE
      const existingValue = String(
        englishControl.getRawValue() || ''
      ).trim();

      const marathiExisting = String(
        group.get(marathiField)?.getRawValue() || ''
      ).trim();

      if (existingValue && !marathiExisting) {

        if (englishField === 'occupation') {
          const translated =
            this.lookupOccupationMarathi(existingValue);

          if (translated) {
            group.patchValue(
              { [marathiField]: translated },
              { emitEvent: false }
            );
          }
        } else {
          this.transliterateToMarathi(
            existingValue,
            marathiField,
            group,
            role,
            index,
            englishField
          );
        }
      }
    }
  );
}

  private formatError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (typeof body === 'string' && body.trim()) return body.trim();
      if (body && typeof body === 'object') {
        const o = body as Record<string, unknown>;
        const e = o['error']; const m = o['message']; const detail = o['detail'];
        if (typeof e === 'string') return e;
        if (typeof m === 'string') return m;
        if (typeof detail === 'string') return detail;
        if (Array.isArray(o['errors'])) return JSON.stringify(o['errors']);
        try { return JSON.stringify(o); } catch { /**/ }
      }
      return `Request failed (${err.status}).`;
    }
    return 'Request failed.';
  }
}
