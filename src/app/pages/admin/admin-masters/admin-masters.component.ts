import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  AdminMastersService,
  ActRecord,
  SectionRecord,
  DepartmentRecord,
  AdminCaseCategoryRecord,
  ConfiguredSubjectSummary,
  CreateOrUpdateDocumentTypeRequest,
  DocumentTypeMappingItemRecord,
  DocumentTypeRecord,
  MasterRecord,
  DesignationRecord,
  OccupationRecord,
  EmployeePostingRecord,
  EmployeeRecord,
  OfficeRecord,
  OfficeBranchRecord,
  OfficeTypeRecord,
  SubjectRecord,
  type CreateOrUpdateActRequest,
  type CreateOrUpdateDesignationRequest,
  type ClosePostingRequest,
  type CreateEmployeePostingRequest,
  type CreateEmployeeRequest,
  type UpdateEmployeeRequest,
  type CreateOrUpdateOfficeRequest,
  type CreateOrUpdateOfficeTypeRequest,
  type CreateOrUpdateSubjectRequest,
  type CreateOrUpdateDepartmentRequest,
  type CreateOrUpdateOccupationRequest,
  type CreateSubdistrictRequest,
  type CreateTalukaRequest,
  type CreateVillageRequest
} from '../../../services/admin-masters.service';
import { environment } from '../../../../environments/environment';

type MasterKind =
  | 'STATE'
  | 'DIVISION'
  | 'DISTRICT'
  | 'SUBDISTRICT'
  | 'TALUKA'
  | 'VILLAGE'
  | 'DEPARTMENT'
  | 'ACT'
  | 'SECTION'
  | 'SUBJECT'
  | 'OFFICE_TYPE'
  | 'OFFICE'
  | 'DESIGNATION'
  | 'OCCUPATION'
  | 'EMPLOYEE'
  | 'DOCUMENT_TYPE'
  | 'DOCUMENT_TYPE_MAPPING';

@Component({
  selector: 'app-admin-masters',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './admin-masters.component.html',
  styleUrl: './admin-masters.component.css'
})
export class AdminMastersComponent {
  private readonly fb = inject(FormBuilder);
  private readonly masters = inject(AdminMastersService);

  protected readonly selected = signal<MasterKind>('STATE');
  protected readonly busy = signal(false);
  protected readonly apiMessage = signal<string | null>(null);
  protected readonly apiError = signal<string | null>(null);

  protected readonly defaultState = environment.defaultState;
  protected readonly hasFixedState = !!environment.defaultState?.id;

  protected readonly states = signal<MasterRecord[]>([]);
  protected readonly divisions = signal<MasterRecord[]>([]);
  protected readonly districts = signal<MasterRecord[]>([]);
  protected readonly subdistricts = signal<MasterRecord[]>([]);
  protected readonly talukas = signal<MasterRecord[]>([]);
  protected readonly villages = signal<MasterRecord[]>([]);
  protected readonly departments = signal<DepartmentRecord[]>([]);
  protected readonly acts = signal<ActRecord[]>([]);
  protected readonly sections = signal<SectionRecord[]>([]);
  protected readonly subjects = signal<SubjectRecord[]>([]);
  protected readonly officeTypes = signal<OfficeTypeRecord[]>([]);
  protected readonly offices = signal<OfficeRecord[]>([]);
  protected readonly officeBranches = signal<OfficeBranchRecord[]>([]);
  protected readonly designations = signal<DesignationRecord[]>([]);
  protected readonly employees = signal<EmployeeRecord[]>([]);
  protected readonly occupations = signal<OccupationRecord[]>([]);
  protected readonly employeePostings = signal<EmployeePostingRecord[]>([]);
  protected readonly documentTypes = signal<DocumentTypeRecord[]>([]);
  protected readonly caseCategories = signal<AdminCaseCategoryRecord[]>([]);
  protected readonly documentTypeMappings = signal<DocumentTypeMappingItemRecord[]>([]);
  protected readonly mappingSubjects = signal<SubjectRecord[]>([]);
  protected readonly mappingSubjectsLoading = signal(false);
  protected readonly configuredMappingSubjects = signal<ConfiguredSubjectSummary[]>([]);
  protected readonly configuredSubjectDocumentsBySubjectId = signal<
    Map<number, DocumentTypeMappingItemRecord[]>
  >(new Map());
  protected readonly mappingContextLabel = signal<string | null>(null);

  protected readonly editingDepartmentId = signal<number | null>(null);
  protected readonly editingActId = signal<number | null>(null);
  protected readonly editingSectionId = signal<number | null>(null);
  protected readonly editingSubjectId = signal<number | null>(null);
  protected readonly editingOfficeTypeId = signal<number | null>(null);
  protected readonly editingOfficeId = signal<number | null>(null);
  protected readonly editingDesignationId = signal<number | null>(null);
  protected readonly editingOccupationId = signal<number | null>(null);
  protected readonly editingEmployeeId = signal<number | null>(null);
  protected readonly editingDocumentTypeId = signal<number | null>(null);
  protected readonly selectedEmployeeForPostingsId = signal<number | null>(null);

  protected readonly selectedSectionActId = signal<number>(0);
  protected readonly selectedOfficeTypeDepartmentId = signal<number>(0);
  protected readonly selectedSubjectDepartmentId = signal<number>(0);
  protected readonly districtFilter = signal<{ stateId: number; divisionId: number }>({ stateId: 0, divisionId: 0 });
  protected readonly designationDeptFilter = signal<number>(0);
  protected readonly employeeActiveFilter = signal<'' | 'true' | 'false'>('');
  protected readonly officeListFilter = signal<{
    departmentId: number;
    officeTypeId: number;
  }>({ departmentId: 0, officeTypeId: 0 });
  protected readonly officeTypeOptions = signal<OfficeTypeRecord[]>([]);

  protected readonly officeDivisions = signal<MasterRecord[]>([]);
  protected readonly officeDistricts = signal<MasterRecord[]>([]);
  protected readonly officeSubdistricts = signal<MasterRecord[]>([]);
  protected readonly officeTalukas = signal<MasterRecord[]>([]);

  protected readonly pageSize = signal(10);
  protected readonly page = signal(1);

  protected readonly isDepartment = computed(() => this.selected() === 'DEPARTMENT');
  protected readonly isAct = computed(() => this.selected() === 'ACT');
  protected readonly isSection = computed(() => this.selected() === 'SECTION');
  protected readonly isSubject = computed(() => this.selected() === 'SUBJECT');
  protected readonly isOfficeType = computed(() => this.selected() === 'OFFICE_TYPE');
  protected readonly isOffice = computed(() => this.selected() === 'OFFICE');
  protected readonly isDesignation = computed(() => this.selected() === 'DESIGNATION');
  protected readonly isOccupation = computed(() => this.selected() === 'OCCUPATION');
  protected readonly isEmployee = computed(() => this.selected() === 'EMPLOYEE');
  protected readonly isDocumentType = computed(() => this.selected() === 'DOCUMENT_TYPE');
  protected readonly isDocumentTypeMapping = computed(() => this.selected() === 'DOCUMENT_TYPE_MAPPING');

  protected readonly activeMasterList = computed<MasterRecord[]>(() => {
    const kind = this.selected();
    switch (kind) {
      case 'STATE':
        return this.states();
      case 'DIVISION':
        return this.divisions();
      case 'DISTRICT':
        return this.filteredDistricts();
      case 'SUBDISTRICT':
        return this.subdistricts();
      case 'TALUKA':
        return this.talukas();
      case 'VILLAGE':
        return this.villages();
      default:
        return [];
    }
  });

  protected readonly filteredDistricts = computed<MasterRecord[]>(() => {
    const f = this.districtFilter();
    return this.districts().filter((d) => {
      if (f.stateId > 0 && d.stateId !== f.stateId) return false;
      if (f.divisionId > 0 && d.divisionId !== f.divisionId) return false;
      return true;
    });
  });

  protected readonly filteredSections = computed<SectionRecord[]>(() =>
    this.selectedSectionActId() > 0
      ? this.sections().filter((s) => s.actId === this.selectedSectionActId())
      : this.sections()
  );

  protected readonly filteredSubjects = computed<SubjectRecord[]>(() =>
    this.selectedSubjectDepartmentId() > 0
      ? this.subjects().filter((s) => s.departmentId === this.selectedSubjectDepartmentId())
      : this.subjects()
  );

  protected readonly filteredOfficeTypes = computed<OfficeTypeRecord[]>(() =>
    this.selectedOfficeTypeDepartmentId() > 0
      ? this.officeTypes().filter((o) => o.departmentId === this.selectedOfficeTypeDepartmentId())
      : this.officeTypes()
  );

  protected readonly filteredDesignations = computed<DesignationRecord[]>(() =>
    this.designationDeptFilter() > 0
      ? this.designations().filter((d) => d.departmentId === this.designationDeptFilter())
      : this.designations()
  );

  protected readonly filteredEmployees = computed<EmployeeRecord[]>(() => {
    const f = this.employeeActiveFilter();
    if (f === '') return this.employees();
    const active = f === 'true';
    return this.employees().filter((e) => e.isActive === active);
  });

  protected readonly filteredOffices = computed<OfficeRecord[]>(() => {
    const f = this.officeListFilter();
    return this.offices().filter((o) => {
      if (f.departmentId > 0 && o.departmentId !== f.departmentId) return false;
      if (f.officeTypeId > 0 && o.officeTypeId !== f.officeTypeId) return false;
      return true;
    });
  });

  protected readonly total = computed(() =>
    this.isDepartment()
      ? this.departments().length
      : this.isAct()
        ? this.acts().length
        : this.isSection()
          ? this.filteredSections().length
          : this.isSubject()
            ? this.filteredSubjects().length
            : this.isOfficeType()
              ? this.filteredOfficeTypes().length
                : this.isOffice()
                  ? this.filteredOffices().length
                  : this.isDesignation()
                    ? this.filteredDesignations().length
                    : this.isOccupation()
                      ? this.occupations().length
                    : this.isEmployee()
                      ? this.filteredEmployees().length
                      : this.isDocumentType()
                        ? this.documentTypes().length
          : this.activeMasterList().length
  );
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  protected readonly pagedMasterList = computed<MasterRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.activeMasterList().slice(start, start + size);
  });

  protected readonly pagedDepartmentList = computed<DepartmentRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.departments().slice(start, start + size);
  });

  protected readonly pagedActList = computed<ActRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.acts().slice(start, start + size);
  });

  protected readonly pagedSectionList = computed<SectionRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.filteredSections().slice(start, start + size);
  });

  protected readonly pagedSubjectList = computed<SubjectRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.filteredSubjects().slice(start, start + size);
  });

  protected readonly pagedOfficeTypeList = computed<OfficeTypeRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.filteredOfficeTypes().slice(start, start + size);
  });

  protected readonly pagedOfficeList = computed<OfficeRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.filteredOffices().slice(start, start + size);
  });

  protected readonly pagedDesignationList = computed<DesignationRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.filteredDesignations().slice(start, start + size);
  });

  protected readonly pagedOccupationList = computed<OccupationRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.occupations().slice(start, start + size);
  });

  protected readonly pagedEmployeeList = computed<EmployeeRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.filteredEmployees().slice(start, start + size);
  });

  protected readonly pagedDocumentTypeList = computed<DocumentTypeRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.documentTypes().slice(start, start + size);
  });

  protected readonly sortedDocumentTypesForMapping = computed(() =>
    [...this.documentTypes()].sort((a, b) => a.name.localeCompare(b.name))
  );

  protected readonly mappedDocumentTypeIds = computed(
    () => new Set(this.documentTypeMappings().map((item) => item.documentTypeId))
  );

  protected readonly unmappedDocumentTypes = computed(() =>
    this.sortedDocumentTypesForMapping().filter((doc) => !this.mappedDocumentTypeIds().has(doc.id))
  );

  protected readonly pendingDocumentSelectionCount = computed(() => this.pendingDocumentTypeIds().size);

  protected readonly allUnmappedDocumentsSelected = computed(() => {
    const unmapped = this.unmappedDocumentTypes();
    if (!unmapped.length) return false;
    const pending = this.pendingDocumentTypeIds();
    return unmapped.every((doc) => pending.has(doc.id));
  });

  protected readonly mappingWorkspaceReady = computed(() => this.mappingFormSelection() !== null);

  protected readonly configuredSubjectsForCategoryTable = computed(() => {
    const currentSubjectId = this.toPositiveInt(
      this.documentTypeMappingForm.controls.subjectId.getRawValue()
    );
    return this.configuredMappingSubjects().map((row) => ({
      ...row,
      isCurrent: row.subjectId === currentSubjectId
    }));
  });

  protected readonly otherConfiguredSubjectsTable = computed(() =>
    this.configuredSubjectsForCategoryTable().filter((row) => !row.isCurrent)
  );

  protected readonly hasCurrentMappingLoaded = computed(
    () => this.mappingWorkspaceReady() && this.documentTypeMappings().length > 0
  );

  /** Normalize select values (DOM may return strings). */
  protected readonly selectIdCompare = (a: number | string, b: number | string): boolean =>
    Number(a) === Number(b);

  protected mappingCategorySelected(): boolean {
    return this.toPositiveInt(this.documentTypeMappingForm.controls.caseCategoryId.getRawValue()) > 0;
  }

  private readonly stateNameById = computed(() => {
    const map = new Map<number, string>();
    for (const s of this.states()) {
      map.set(s.id, s.name);
    }
    if (this.hasFixedState) {
      map.set(environment.defaultState.id, environment.defaultState.name);
    }
    return map;
  });

  private readonly divisionNameById = computed(() => {
    const map = new Map<number, string>();
    for (const d of this.divisions()) {
      map.set(d.id, d.name);
    }
    return map;
  });

  private readonly districtNameById = computed(() => {
    const map = new Map<number, string>();
    for (const d of this.districts()) {
      map.set(d.id, d.name);
    }
    return map;
  });

  private readonly subdistrictNameById = computed(() => {
    const map = new Map<number, string>();
    for (const s of this.subdistricts()) {
      map.set(s.id, s.name);
    }
    return map;
  });

  private readonly talukaNameById = computed(() => {
    const map = new Map<number, string>();
    for (const t of this.talukas()) {
      map.set(t.id, t.name);
    }
    return map;
  });

  protected resolveStateName(id: number | null | undefined): string {
    if (!id) return '-';
    return this.stateNameById().get(id) ?? '-';
  }

  protected resolveDivisionName(id: number | null | undefined): string {
    if (!id) return '-';
    return this.divisionNameById().get(id) ?? '-';
  }

  protected resolveDistrictName(id: number | null | undefined): string {
    if (!id) return '-';
    return this.districtNameById().get(id) ?? '-';
  }

  protected resolveSubdistrictName(id: number | null | undefined): string {
    if (!id) return '-';
    return this.subdistrictNameById().get(id) ?? '-';
  }

  protected resolveTalukaName(id: number | null | undefined): string {
    if (!id) return '-';
    return this.talukaNameById().get(id) ?? '-';
  }

  protected readonly title = computed(() => {
    switch (this.selected()) {
      case 'STATE':
        return 'Create State';
      case 'DIVISION':
        return 'Create Division';
      case 'DISTRICT':
        return 'Create District';
      case 'SUBDISTRICT':
        return 'Create Subdistrict';
      case 'TALUKA':
        return 'Create Taluka';
      case 'VILLAGE':
        return 'Create Village';
      case 'DEPARTMENT':
        return 'Create Department';
      case 'ACT':
        return 'Create Act';
      case 'SECTION':
        return 'Create Section';
      case 'SUBJECT':
        return 'Create Subject';
      case 'OFFICE_TYPE':
        return 'Create Office Type';
      case 'OFFICE':
        return 'Create Office';
      case 'DESIGNATION':
        return 'Create Designation';
      case 'OCCUPATION':
        return 'Create Occupation';
      case 'EMPLOYEE':
        return 'Create Employee';
      case 'DOCUMENT_TYPE':
        return this.editingDocumentTypeId() ? 'Edit Document Type' : 'Create Document Type';
      case 'DOCUMENT_TYPE_MAPPING':
        return 'Document Mapping (Category + Subject)';
    }
  });

  protected readonly stateForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    lgdCode: [''],
    stateOrUT: ['State']
  });

  protected readonly divisionForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    stateId: [0, [Validators.required, Validators.min(1)]]
  });

  protected readonly districtForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    lgdCode: [''],
    stateId: [0, [Validators.required, Validators.min(1)]],
    divisionId: [0, [Validators.required, Validators.min(1)]]
  });

  protected readonly talukaForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    lgdCode: [''],
    districtId: [0, [Validators.required, Validators.min(1)]],
    subdistrictId: [0, [Validators.required, Validators.min(1)]]
  });

  protected readonly subdistrictForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    lgdCode: [''],
    districtId: [0, [Validators.required, Validators.min(1)]]
  });

  protected readonly villageForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    lgdCode: [''],
    talukaId: [0, [Validators.required, Validators.min(1)]]
  });

  protected readonly departmentForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    stateId: [0, [Validators.required, Validators.min(1)]]
  });

  protected readonly actForm = this.fb.nonNullable.group({
    actCode: ['', [Validators.required, Validators.minLength(2)]],
    actName: ['', [Validators.required, Validators.minLength(2)]],
    actNameLocal: ['']
  });

  protected readonly sectionForm = this.fb.nonNullable.group({
    actId: [0, [Validators.required, Validators.min(1)]],
    sectionCode: ['', [Validators.required, Validators.minLength(1)]],
    sectionName: ['', [Validators.required, Validators.minLength(2)]],
    sectionNameLocal: ['']
  });

  protected readonly subjectForm = this.fb.nonNullable.group({
    departmentId: [0, [Validators.required, Validators.min(1)]],
    subjectCode: ['', [Validators.required, Validators.minLength(1)]],
    subjectName: ['', [Validators.required, Validators.minLength(2)]],
    subjectNameLocal: ['']
  });

  protected readonly officeTypeForm = this.fb.nonNullable.group({
    departmentId: [0, [Validators.required, Validators.min(1)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    shortName: [''],
    shortNameLocal: ['']
  });

  protected readonly officeForm = this.fb.nonNullable.group({
    departmentId: [0, [Validators.required, Validators.min(1)]],
    officeTypeId: [0, [Validators.required, Validators.min(1)]],
    locationId: [0, [Validators.required, Validators.min(1)]],
    stateId: [0],
    divisionId: [0],
    districtId: [0],
    subdistrictId: [0],
    talukaId: [0],
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    shortName: [''],
    shortNameLocal: ['']
  });

  protected readonly officeFilterForm = this.fb.nonNullable.group({
    departmentId: [0],
    officeTypeId: [0]
  });

  private readonly officeTypeIdValue = toSignal(
    this.officeForm.controls.officeTypeId.valueChanges,
    { initialValue: this.officeForm.controls.officeTypeId.value }
  );
  /**
   * Location-chain depth based on office type id:
   *   1 → State only
   *   2 → Subdivision (State + Division)
   *   3 → District (State + Division + District)
   *   6 → Tehsil (State + Division + District + Subdistrict + Taluka)
   */
  protected readonly officeFormLevel = computed<number>(() =>
    this.officeTypeIdToLevel(this.officeTypeIdValue())
  );

  protected readonly designationForm = this.fb.nonNullable.group({
    departmentId: [0, [Validators.required, Validators.min(1)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    shortName: [''],
    shortNameLocal: ['']
  });

  protected readonly districtFilterForm = this.fb.nonNullable.group({
    stateId: [0],
    divisionId: [0]
  });

  protected readonly designationFilterForm = this.fb.nonNullable.group({
    departmentId: [0]
  });

  protected readonly employeeForm = this.fb.nonNullable.group({
    employeeCode: ['', [Validators.required, Validators.minLength(2)]],
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    fullNameLocal: [''],
    mobile: ['', [Validators.required, Validators.minLength(10)]],
    email: ['', [Validators.required, Validators.email]],
    isActive: [true]
  });

  protected readonly occupationForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    shortName: [''],
    shortNameLocal: ['']
  });

  protected readonly employeeFilterForm = this.fb.nonNullable.group({
    active: ['' as '' | 'true' | 'false']
  });

  protected readonly postingForm = this.fb.nonNullable.group({
    officeId: [0, [Validators.required, Validators.min(1)]],
    officeBranchId: [0, [Validators.min(0)]],
    designationId: [0, [Validators.required, Validators.min(1)]],
    fromDate: ['', [Validators.required]]
  });

  protected readonly documentTypeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(2)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    validForPhotoId: [false],
    validForAddress: [false],
    sourceUrl: ['']
  });

  protected readonly documentTypeMappingForm = this.fb.nonNullable.group({
    mappingDepartmentId: [0, [Validators.min(1)]],
    subjectId: [0, [Validators.min(1)]],
    caseCategoryId: [0, [Validators.min(1)]]
  });

  /** Multi-select buffer before adding to mapped list */
  private readonly pendingDocumentTypeIds = signal<Set<number>>(new Set());

  constructor() {
    if (this.hasFixedState) {
      this.divisionForm.controls.stateId.setValue(environment.defaultState.id);
      this.divisionForm.controls.stateId.disable();

      this.districtForm.controls.stateId.setValue(environment.defaultState.id);
      this.districtForm.controls.stateId.disable();

      this.departmentForm.controls.stateId.setValue(environment.defaultState.id);
      this.departmentForm.controls.stateId.disable();
    }

    this.loadStates();
    this.loadActs();


    this.sectionForm.controls.actId.valueChanges.subscribe((actId) => {
      this.selectedSectionActId.set(actId || 0);
      this.page.set(1);
    });

    this.officeTypeForm.controls.departmentId.valueChanges.subscribe((departmentId) => {
      this.selectedOfficeTypeDepartmentId.set(departmentId || 0);
      this.page.set(1);
    });

    this.subjectForm.controls.departmentId.valueChanges.subscribe((departmentId) => {
      this.selectedSubjectDepartmentId.set(departmentId || 0);
      this.page.set(1);
    });

    this.documentTypeMappingForm.controls.caseCategoryId.valueChanges.subscribe(() => {
      if (this.selected() === 'DOCUMENT_TYPE_MAPPING') {
        this.onMappingCategoryChange();
      }
    });

    this.documentTypeMappingForm.controls.mappingDepartmentId.valueChanges.subscribe(() => {
      if (this.selected() === 'DOCUMENT_TYPE_MAPPING') {
        this.onMappingDepartmentChange();
      }
    });

    this.documentTypeMappingForm.controls.subjectId.valueChanges.subscribe(() => {
      if (this.selected() === 'DOCUMENT_TYPE_MAPPING') {
        this.onMappingSubjectChange();
      }
    });

    this.officeForm.controls.departmentId.valueChanges.subscribe((departmentId) => {
      if (!departmentId || departmentId < 1) {
        this.officeTypeOptions.set([]);
        this.officeForm.controls.officeTypeId.setValue(0);
        return;
      }
      this.masters.getOfficeTypes(departmentId).subscribe({
        next: (rows) => {
          this.officeTypeOptions.set(rows);
          const currentTypeId = this.officeForm.controls.officeTypeId.getRawValue();
          if (currentTypeId < 1 && rows.length === 1) {
            this.officeForm.controls.officeTypeId.setValue(rows[0].id);
          } else if (currentTypeId > 0) {
            // Options just loaded while a type was already selected — re-resolve level and location
            const level = this.officeTypeIdToLevel(currentTypeId);
            this.loadOfficeLocationOptions(level);
            this.syncOfficeLocationId(level);
          }
        },
        error: () => this.officeTypeOptions.set([])
      });
    });

    if (this.hasFixedState) {
      this.officeForm.controls.stateId.setValue(environment.defaultState.id);
    }

    this.officeForm.controls.officeTypeId.valueChanges.subscribe((typeId) => {
      this.resetOfficeLocationChain();
      const level = this.officeTypeIdToLevel(typeId);
      this.loadOfficeLocationOptions(level);
      this.syncOfficeLocationId(level);
    });

    this.officeForm.controls.stateId.valueChanges.subscribe(() => {
      this.resetOfficeLocationChain();
      const level = this.officeFormLevel();
      this.loadOfficeLocationOptions(level);
      this.syncOfficeLocationId(level);
    });

    this.officeForm.controls.divisionId.valueChanges.subscribe(() => {
      this.officeDistricts.set([]);
      this.officeSubdistricts.set([]);
      this.officeTalukas.set([]);
      this.officeForm.controls.districtId.setValue(0);
      this.officeForm.controls.subdistrictId.setValue(0);
      this.officeForm.controls.talukaId.setValue(0);
      this.loadOfficeDistricts();
      this.syncOfficeLocationId();
    });
    this.officeForm.controls.districtId.valueChanges.subscribe(() => {
      this.officeSubdistricts.set([]);
      this.officeTalukas.set([]);
      this.officeForm.controls.subdistrictId.setValue(0);
      this.officeForm.controls.talukaId.setValue(0);
      if (this.officeFormLevel() >= 4) {
        this.loadOfficeSubdistricts();
      }
      this.syncOfficeLocationId();
    });
    this.officeForm.controls.subdistrictId.valueChanges.subscribe(() => {
      this.officeTalukas.set([]);
      this.officeForm.controls.talukaId.setValue(0);
      this.loadOfficeTalukas();
      this.syncOfficeLocationId();
    });
    this.officeForm.controls.talukaId.valueChanges.subscribe(() => this.syncOfficeLocationId());

    this.designationForm.controls.departmentId.valueChanges.subscribe((deptId) => {
      this.designationDeptFilter.set(deptId || 0);
      this.page.set(1);
    });

    this.postingForm.controls.officeId.valueChanges.subscribe((officeId) => {
      this.postingForm.controls.officeBranchId.setValue(0);
      if (!officeId || officeId < 1) {
        this.officeBranches.set([]);
        return;
      }
      this.loadOfficeBranches(officeId);
    });
  }

  protected select(kind: MasterKind): void {
    this.selected.set(kind);
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.page.set(1);
    this.editingDepartmentId.set(null);
    this.editingActId.set(null);
    this.editingSectionId.set(null);
    this.editingSubjectId.set(null);
    this.editingOfficeTypeId.set(null);
    this.editingOfficeId.set(null);
    this.editingDesignationId.set(null);
    this.editingOccupationId.set(null);
    this.editingEmployeeId.set(null);
    this.selectedEmployeeForPostingsId.set(null);

    // Reset all client-side filter signals on tab switch
    this.districtFilter.set({ stateId: 0, divisionId: 0 });
    this.districtFilterForm.reset({ stateId: 0, divisionId: 0 }, { emitEvent: false });
    this.selectedSectionActId.set(0);
    this.selectedSubjectDepartmentId.set(0);
    this.selectedOfficeTypeDepartmentId.set(0);
    this.designationDeptFilter.set(0);
    this.employeeActiveFilter.set('');
    this.officeListFilter.set({ departmentId: 0, officeTypeId: 0 });

    // Reset boundary create forms so stale values don't bleed into the next visit
    this.districtForm.controls.divisionId.setValue(0, { emitEvent: false });
    this.subdistrictForm.controls.districtId.setValue(0, { emitEvent: false });
    this.talukaForm.controls.districtId.setValue(0, { emitEvent: false });
    this.talukaForm.controls.subdistrictId.setValue(0, { emitEvent: false });
    this.villageForm.controls.talukaId.setValue(0, { emitEvent: false });

    if (kind === 'DIVISION') {
      this.loadDivisions();
    } else if (kind === 'DISTRICT') {
      this.loadDivisions();
      this.loadDistricts();
    } else if (kind === 'SUBDISTRICT') {
      this.loadDivisions();
      this.loadDistricts();
      this.loadSubdistricts();
    } else if (kind === 'TALUKA') {
      this.loadDivisions();
      this.loadDistricts();
      this.loadSubdistricts();
      this.loadTalukas();
    } else if (kind === 'VILLAGE') {
      this.loadDivisions();
      this.loadDistricts();
      this.loadSubdistricts();
      this.loadTalukas();
      this.loadVillages();
    } else if (kind === 'STATE') {
      this.loadStates();
    } else if (kind === 'DEPARTMENT') {
      this.loadDepartments();
    } else if (kind === 'ACT') {
      this.loadActs();
    } else if (kind === 'SECTION') {
      this.loadActs();
      this.loadSections();
    } else if (kind === 'SUBJECT') {
      this.loadDepartments();
      this.loadSubjects();
    } else if (kind === 'OFFICE_TYPE') {
      this.loadDepartments();
      this.loadOfficeTypes();
    } else if (kind === 'OFFICE') {
      this.loadDepartments();
      this.loadOfficeTypes();
      this.loadOfficeLocationOptions();
      this.loadOffices();
    } else if (kind === 'DESIGNATION') {
      this.loadDepartments();
      this.loadDesignations();
    } else if (kind === 'OCCUPATION') {
      this.loadOccupations();
    } else if (kind === 'EMPLOYEE') {
      this.loadOffices();
      this.loadDesignations();
      this.loadEmployees();
    } else if (kind === 'DOCUMENT_TYPE') {
      this.loadDocumentTypes();
    } else if (kind === 'DOCUMENT_TYPE_MAPPING') {
      this.loadDepartments();
      this.loadCaseCategoriesForMapping();
      this.loadDocumentTypes();
      this.mappingSubjects.set([]);
      this.documentTypeMappingForm.reset({
        mappingDepartmentId: 0,
        subjectId: 0,
        caseCategoryId: 0
      });
      this.documentTypeMappings.set([]);
      this.configuredMappingSubjects.set([]);
      this.mappingContextLabel.set(null);
      this.pendingDocumentTypeIds.set(new Set());
    }
  }

  protected submit(): void {
    this.apiMessage.set(null);
    this.apiError.set(null);

    const kind = this.selected();
    const form =
      kind === 'STATE'
        ? this.stateForm
        : kind === 'DIVISION'
          ? this.divisionForm
          : kind === 'DISTRICT'
            ? this.districtForm
            : kind === 'SUBDISTRICT'
              ? this.subdistrictForm
              : kind === 'TALUKA'
                ? this.talukaForm
                : kind === 'VILLAGE'
                  ? this.villageForm
                  : kind === 'DEPARTMENT'
                    ? this.departmentForm
                    : kind === 'ACT'
                      ? this.actForm
                      : kind === 'SECTION'
                        ? this.sectionForm
                        : kind === 'SUBJECT'
                          ? this.subjectForm
                          : kind === 'OFFICE_TYPE'
                            ? this.officeTypeForm
                            : kind === 'OFFICE'
                              ? this.officeForm
                              : kind === 'DESIGNATION'
                                ? this.designationForm
                                : kind === 'OCCUPATION'
                                  ? this.occupationForm
                                  : kind === 'DOCUMENT_TYPE'
                                    ? this.documentTypeForm
                                  : this.employeeForm;

    form.markAllAsTouched();
    if (form.invalid) {
      this.apiError.set('Please fix validation errors.');
      return;
    }

    this.busy.set(true);

    const req$ =
      kind === 'STATE'
        ? this.masters.createState(this.stateForm.getRawValue())
        : kind === 'DIVISION'
          ? this.masters.createDivision(this.divisionForm.getRawValue())
          : kind === 'DISTRICT'
            ? this.masters.createDistrict(this.districtForm.getRawValue())
            : kind === 'SUBDISTRICT'
              ? this.masters.createSubdistrict(this.subdistrictPayload())
              : kind === 'TALUKA'
                ? this.masters.createTaluka(this.talukaPayload())
                : kind === 'VILLAGE'
                  ? this.masters.createVillage(this.villagePayload())
                  : kind === 'DEPARTMENT'
                    ? this.submitDepartment()
                    : kind === 'ACT'
                      ? this.submitAct()
                      : kind === 'SECTION'
                        ? this.submitSection()
                        : kind === 'SUBJECT'
                          ? this.submitSubject()
                          : kind === 'OFFICE_TYPE'
                            ? this.submitOfficeType()
                            : kind === 'OFFICE'
                              ? this.submitOffice()
                              : kind === 'DESIGNATION'
                                ? this.submitDesignation()
                                : kind === 'OCCUPATION'
                                  ? this.submitOccupation()
                                  : kind === 'DOCUMENT_TYPE'
                                    ? this.submitDocumentType()
                                : this.submitEmployee();

    const reqUnknown$: Observable<unknown> = req$ as Observable<unknown>;

    reqUnknown$.subscribe({
      next: () => {
        this.apiMessage.set(
          kind === 'ACT' ||
            kind === 'SECTION' ||
            kind === 'DEPARTMENT' ||
            kind === 'SUBJECT' ||
            kind === 'OFFICE_TYPE' ||
            kind === 'DOCUMENT_TYPE'
            ? 'Saved successfully.'
            : 'Created successfully.'
        );
        if (kind === 'STATE') {
          this.stateForm.reset({ name: '', localName: '', lgdCode: '', stateOrUT: 'State' });
          this.loadStates();
        } else if (kind === 'DIVISION') {
          this.divisionForm.reset({
            stateId: this.hasFixedState ? environment.defaultState.id : 0,
            name: '',
            localName: ''
          });
          if (this.hasFixedState) {
            this.divisionForm.controls.stateId.disable();
          }
          this.loadDivisions();
        } else if (kind === 'DISTRICT') {
          this.districtForm.reset({
            stateId: this.hasFixedState ? environment.defaultState.id : 0,
            divisionId: this.districtForm.controls.divisionId.getRawValue(),
            name: '',
            localName: '',
            lgdCode: ''
          });
          if (this.hasFixedState) {
            this.districtForm.controls.stateId.disable();
          }
          this.loadDistricts();
        } else if (kind === 'SUBDISTRICT') {
          const keepDistrictId = this.subdistrictForm.controls.districtId.getRawValue();
          this.subdistrictForm.reset({ districtId: keepDistrictId, name: '', localName: '', lgdCode: '' });
          this.loadSubdistricts();
        } else if (kind === 'TALUKA') {
          const keepDistrictId = this.talukaForm.controls.districtId.getRawValue();
          const keepSubdistrictId = this.talukaForm.controls.subdistrictId.getRawValue();
          this.talukaForm.reset({
            districtId: keepDistrictId,
            subdistrictId: keepSubdistrictId,
            name: '',
            localName: '',
            lgdCode: ''
          });
          this.loadTalukas();
        } else {
          if (kind === 'VILLAGE') {
            const keepTalukaId = this.villageForm.controls.talukaId.getRawValue();
            this.villageForm.reset({ talukaId: keepTalukaId, name: '', localName: '', lgdCode: '' });
            this.loadVillages();
          } else if (kind === 'DEPARTMENT') {
            this.editingDepartmentId.set(null);
            this.departmentForm.reset({
              stateId: this.hasFixedState ? environment.defaultState.id : 0,
              name: '',
              localName: ''
            });
            if (this.hasFixedState) {
              this.departmentForm.controls.stateId.disable();
            }
            this.loadDepartments();
          } else if (kind === 'ACT') {
            this.editingActId.set(null);
            this.actForm.reset({ actCode: '', actName: '', actNameLocal: '' });
            this.loadActs();
          } else if (kind === 'SECTION') {
            const keepActId = this.sectionForm.controls.actId.getRawValue();
            this.editingSectionId.set(null);
            this.sectionForm.reset({ actId: keepActId, sectionCode: '', sectionName: '', sectionNameLocal: '' });
            this.loadSections();
          } else if (kind === 'SUBJECT') {
            const keepDeptId = this.subjectForm.controls.departmentId.getRawValue();
            this.editingSubjectId.set(null);
            this.subjectForm.reset({
              departmentId: keepDeptId,
              subjectCode: '',
              subjectName: '',
              subjectNameLocal: ''
            });
            this.loadSubjects();
          } else if (kind === 'OFFICE_TYPE') {
            const keepDeptId = this.officeTypeForm.controls.departmentId.getRawValue();
            this.editingOfficeTypeId.set(null);
            this.officeTypeForm.reset({
              departmentId: keepDeptId,
              name: '',
              localName: '',
              shortName: '',
              shortNameLocal: ''
            });
            this.loadOfficeTypes();
          } else if (kind === 'OFFICE') {
            const keepDeptId = this.officeForm.controls.departmentId.getRawValue();
            const keepOfficeTypeId = this.officeForm.controls.officeTypeId.getRawValue();
            this.editingOfficeId.set(null);
            this.resetOfficeLocationChain();
            this.officeForm.reset({
              departmentId: keepDeptId,
              officeTypeId: keepOfficeTypeId,
              locationId: 0,
              stateId: 0,
              divisionId: 0,
              districtId: 0,
              subdistrictId: 0,
              talukaId: 0,
              name: '',
              localName: '',
              shortName: '',
              shortNameLocal: ''
            });
            this.loadOffices();
          } else if (kind === 'DESIGNATION') {
            const keepDeptId = this.designationForm.controls.departmentId.getRawValue();
            this.editingDesignationId.set(null);
            this.designationForm.reset({
              departmentId: keepDeptId,
              name: '',
              localName: '',
              shortName: '',
              shortNameLocal: ''
            });
            this.loadDesignations();
          } else if (kind === 'OCCUPATION') {
            this.editingOccupationId.set(null);
            this.occupationForm.reset({ name: '', localName: '', shortName: '', shortNameLocal: '' });
            this.loadOccupations();
          } else if (kind === 'DOCUMENT_TYPE') {
            this.editingDocumentTypeId.set(null);
            this.documentTypeForm.reset({
              code: '',
              name: '',
              localName: '',
              validForPhotoId: false,
              validForAddress: false,
              sourceUrl: ''
            });
            this.loadDocumentTypes();
          } else if (kind === 'EMPLOYEE') {
            this.editingEmployeeId.set(null);
            this.employeeForm.reset({
              employeeCode: '',
              fullName: '',
              fullNameLocal: '',
              mobile: '',
              email: '',
              isActive: true
            });
            this.loadEmployees();
          }
        }
      },
      error: (err: unknown) => {
        this.apiError.set(this.formatError(err));
      },
      complete: () => {
        this.busy.set(false);
      }
    });
  }

  private formatError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const serverMsg =
        typeof err.error === 'string'
          ? err.error
          : err.error && typeof err.error.error === 'string'
            ? err.error.error
            : err.error && typeof err.error.message === 'string'
              ? err.error.message
              : null;
      return serverMsg || `Request failed (${err.status}).`;
    }
    if (err instanceof Error) {
      return err.message;
    }
    return 'Request failed.';
  }

  private loadStates(): void {
    this.masters.getStates().subscribe({
      next: (rows) => {
        this.states.set(rows);
        this.page.set(1);
        if (!this.hasFixedState && rows.length === 1) {
          this.divisionForm.controls.stateId.setValue(rows[0].id);
          this.districtForm.controls.stateId.setValue(rows[0].id);
        }
      },
      error: () => {
        // ignore list load error; create forms still usable
      }
    });
  }

  private loadDivisions(): void {
    this.masters.getDivisions().subscribe({
      next: (rows) => {
        this.divisions.set(rows);
        this.page.set(1);
        if (this.districtForm.controls.divisionId.getRawValue() < 1 && rows.length === 1) {
          this.districtForm.controls.divisionId.setValue(rows[0].id);
        }
      },
      error: () => {
        this.divisions.set([]);
      }
    });
  }

  private loadDistricts(): void {
    this.masters.getDistricts().subscribe({
      next: (rows) => {
        this.districts.set(rows);
        this.page.set(1);
      },
      error: () => {
        this.districts.set([]);
      }
    });
  }

  private loadSubdistricts(): void {
    this.masters.getSubdistricts().subscribe({
      next: (rows) => {
        this.subdistricts.set(rows);
        this.page.set(1);
      },
      error: () => {
        this.subdistricts.set([]);
      }
    });
  }

  private loadTalukas(): void {
    this.masters.getTalukas().subscribe({
      next: (rows) => {
        this.talukas.set(rows);
        this.page.set(1);
      },
      error: () => {
        this.talukas.set([]);
      }
    });
  }

  private loadVillages(): void {
    this.masters.getVillages().subscribe({
      next: (rows) => {
        this.villages.set(rows);
        this.page.set(1);
      },
      error: () => {
        this.villages.set([]);
      }
    });
  }

  private loadDepartments(): void {
    this.masters.getDepartments().subscribe({
      next: (rows) => {
        this.departments.set(rows);
        this.page.set(1);
        if (this.selected() === 'SUBJECT') {
          if (rows.length === 1 && this.subjectForm.controls.departmentId.getRawValue() < 1) {
            this.subjectForm.controls.departmentId.setValue(rows[0].id);
          } else {
            this.loadSubjects();
          }
        }
      },
      error: () => {
        this.departments.set([]);
      }
    });
  }

  private loadActs(): void {
    this.masters.getActs().subscribe({
      next: (rows) => {
        this.acts.set(rows);
        this.page.set(1);
        if (this.sectionForm.controls.actId.getRawValue() < 1 && rows.length === 1) {
          this.sectionForm.controls.actId.setValue(rows[0].id);
        }
      },
      error: () => {
        this.acts.set([]);
      }
    });
  }

  private loadSections(): void {
    this.masters.getSections().subscribe({
      next: (rows) => {
        this.sections.set(rows);
        this.page.set(1);
      },
      error: () => {
        this.sections.set([]);
      }
    });
  }

  private submitDepartment() {
    const payload = this.departmentPayload();
    const id = this.editingDepartmentId();
    return id ? this.masters.updateDepartment(id, payload) : this.masters.createDepartment(payload);
  }

  private submitAct() {
    const payload = this.actPayload();
    const id = this.editingActId();
    return id ? this.masters.updateAct(id, payload) : this.masters.createAct(payload);
  }

  private actPayload(): CreateOrUpdateActRequest {
    const raw = this.actForm.getRawValue();
    return {
      actCode: raw.actCode,
      actName: raw.actName,
      actNameLocal: raw.actNameLocal || undefined
    };
  }

  protected startEditAct(row: ActRecord): void {
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.editingActId.set(row.id);
    this.actForm.reset({
      actCode: row.actCode,
      actName: row.actName,
      actNameLocal: row.actNameLocal || ''
    });
  }

  protected cancelEditAct(): void {
    this.editingActId.set(null);
    this.actForm.reset({ actCode: '', actName: '', actNameLocal: '' });
  }

  protected deleteAct(row: ActRecord): void {
    if (!confirm(`Delete act "${row.actName}"?`)) return;
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.busy.set(true);
    this.masters.deleteAct(row.id).subscribe({
      next: () => {
        this.apiMessage.set('Deleted successfully.');
        if (this.editingActId() === row.id) this.cancelEditAct();
        this.loadActs();
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.busy.set(false)
    });
  }

  private submitSection() {
    const payload = this.sectionPayload();
    const id = this.editingSectionId();
    return id ? this.masters.updateSection(id, payload) : this.masters.createSection(payload);
  }

  private loadSubjects(): void {
    this.masters.getSubjects().subscribe({
      next: (rows) => {
        this.subjects.set(rows);
        this.page.set(1);
      },
      error: () => {
        this.subjects.set([]);
      }
    });
  }

  private submitSubject() {
    const payload = this.subjectPayload();
    const id = this.editingSubjectId();
    return id ? this.masters.updateSubject(id, payload) : this.masters.createSubject(payload);
  }

  private loadOfficeTypes(): void {
    this.masters.getOfficeTypes().subscribe({
      next: (rows) => {
        this.officeTypes.set(rows);
        this.page.set(1);
      },
      error: () => {
        this.officeTypes.set([]);
      }
    });
  }

  private submitOfficeType() {
    const payload = this.officeTypePayload();
    const id = this.editingOfficeTypeId();
    return id ? this.masters.updateOfficeType(id, payload) : this.masters.createOfficeType(payload);
  }

  private loadOffices(): void {
    this.masters.getOffices().subscribe({
      next: (rows) => {
        this.offices.set(rows);
        this.page.set(1);
      },
      error: () => this.offices.set([])
    });
  }

  /** Maps office type id to location-chain depth (0 = unknown). */
  private officeTypeIdToLevel(typeId: number | null | undefined): number {
    switch (typeId) {
      case 1: return 1;
      case 2: return 2;
      case 3: return 3;
      case 6: return 4;
      default: return 0;
    }
  }

  private resetOfficeLocationChain(): void {
    this.officeDivisions.set([]);
    this.officeDistricts.set([]);
    this.officeSubdistricts.set([]);
    this.officeTalukas.set([]);
    this.officeForm.controls.divisionId.setValue(0);
    this.officeForm.controls.districtId.setValue(0);
    this.officeForm.controls.subdistrictId.setValue(0);
    this.officeForm.controls.talukaId.setValue(0);
  }

  private loadOfficeLocationOptions(level = this.officeFormLevel()): void {
    const stateId = this.officeForm.controls.stateId.getRawValue();
    if (!stateId || stateId < 1) return;
    if (level === 1) {
      this.officeForm.controls.locationId.setValue(stateId);
      return;
    }
    if (level >= 2) {
      this.masters.getDivisions(stateId).subscribe({
        next: (rows) => this.officeDivisions.set(rows),
        error: () => this.officeDivisions.set([])
      });
    }
  }

  private loadOfficeDistricts(): void {
    const stateId = this.officeForm.controls.stateId.getRawValue();
    const divisionId = this.officeForm.controls.divisionId.getRawValue();
    if (!stateId || stateId < 1 || !divisionId || divisionId < 1) return;
    this.masters.getDistricts(stateId, divisionId).subscribe({
      next: (rows) => this.officeDistricts.set(rows),
      error: () => this.officeDistricts.set([])
    });
  }

  private loadOfficeSubdistricts(): void {
    const districtId = this.officeForm.controls.districtId.getRawValue();
    if (!districtId || districtId < 1) return;
    this.masters.getSubdistricts(districtId).subscribe({
      next: (rows) => this.officeSubdistricts.set(rows),
      error: () => this.officeSubdistricts.set([])
    });
  }

  private loadOfficeTalukas(): void {
    const districtId = this.officeForm.controls.districtId.getRawValue();
    const subdistrictId = this.officeForm.controls.subdistrictId.getRawValue();
    if (!districtId || districtId < 1) return;
    this.masters.getTalukas(districtId, subdistrictId > 0 ? subdistrictId : undefined).subscribe({
      next: (rows) => this.officeTalukas.set(rows),
      error: () => this.officeTalukas.set([])
    });
  }

  private syncOfficeLocationId(level = this.officeFormLevel()): void {
    const id =
      level === 1
        ? this.officeForm.controls.stateId.getRawValue()
        : level === 2
          ? this.officeForm.controls.divisionId.getRawValue()
          : level === 3
            ? this.officeForm.controls.districtId.getRawValue()
            : level === 4
              ? this.officeForm.controls.talukaId.getRawValue()
              : 0;
    this.officeForm.controls.locationId.setValue(id || 0);
  }

  private submitOffice() {
    const payload = this.officePayload();
    const id = this.editingOfficeId();
    return id ? this.masters.updateOffice(id, payload) : this.masters.createOffice(payload);
  }

  private officePayload(): CreateOrUpdateOfficeRequest {
    const raw = this.officeForm.getRawValue();
    return {
      departmentId: raw.departmentId,
      officeTypeId: raw.officeTypeId,
      locationId: raw.locationId,
      name: raw.name,
      localName: raw.localName || undefined,
      shortName: raw.shortName || undefined,
      shortNameLocal: raw.shortNameLocal || undefined
    };
  }

  protected startEditOffice(row: OfficeRecord): void {
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.editingOfficeId.set(row.id);
    this.officeForm.reset({
      departmentId: row.departmentId,
      officeTypeId: row.officeTypeId,
      locationId: row.locationId,
      stateId: 0,
      divisionId: 0,
      districtId: 0,
      subdistrictId: 0,
      talukaId: 0,
      name: row.name,
      localName: row.localName || '',
      shortName: row.shortName || '',
      shortNameLocal: row.shortNameLocal || ''
    });
  }

  protected cancelEditOffice(): void {
    this.editingOfficeId.set(null);
    this.resetOfficeLocationChain();
    this.officeForm.reset({
      departmentId: 0,
      officeTypeId: 0,
      locationId: 0,
      stateId: 0,
      divisionId: 0,
      districtId: 0,
      subdistrictId: 0,
      talukaId: 0,
      name: '',
      localName: '',
      shortName: '',
      shortNameLocal: ''
    });
  }

  protected deleteOffice(row: OfficeRecord): void {
    if (!confirm(`Delete office \"${row.name}\"?`)) return;
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.busy.set(true);
    this.masters.deleteOffice(row.id).subscribe({
      next: () => {
        this.apiMessage.set('Deleted successfully.');
        if (this.editingOfficeId() === row.id) this.cancelEditOffice();
        this.loadOffices();
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.busy.set(false)
    });
  }

  protected applyDistrictFilter(): void {
    const f = this.districtFilterForm.getRawValue();
    this.districtFilter.set({ stateId: f.stateId, divisionId: f.divisionId });
    this.page.set(1);
  }

  protected clearDistrictFilter(): void {
    this.districtFilterForm.reset({ stateId: 0, divisionId: 0 });
    this.districtFilter.set({ stateId: 0, divisionId: 0 });
    this.page.set(1);
  }

  protected applyOfficeFilters(): void {
    const f = this.officeFilterForm.getRawValue();
    this.officeListFilter.set({ departmentId: f.departmentId, officeTypeId: f.officeTypeId });
    this.page.set(1);
  }

  protected clearOfficeFilters(): void {
    this.officeFilterForm.reset({ departmentId: 0, officeTypeId: 0 });
    this.officeListFilter.set({ departmentId: 0, officeTypeId: 0 });
    this.page.set(1);
  }

  private loadDesignations(): void {
    this.masters.getDesignations().subscribe({
      next: (rows) => {
        this.designations.set(rows);
        this.page.set(1);
      },
      error: () => this.designations.set([])
    });
  }

  private submitDesignation() {
    const payload = this.designationPayload();
    const id = this.editingDesignationId();
    return id ? this.masters.updateDesignation(id, payload) : this.masters.createDesignation(payload);
  }

  private loadOccupations(): void {
    this.masters.getOccupations().subscribe({
      next: (rows) => {
        this.occupations.set(rows);
        this.page.set(1);
      },
      error: () => this.occupations.set([])
    });
  }

  private submitOccupation() {
    const payload = this.occupationPayload();
    const id = this.editingOccupationId();
    return id ? this.masters.updateOccupation(id, payload) : this.masters.createOccupation(payload);
  }

  private loadEmployees(): void {
    this.masters.getEmployees().subscribe({
      next: (rows) => {
        this.employees.set(rows);
        this.page.set(1);
      },
      error: () => this.employees.set([])
    });
  }

  private submitEmployee() {
    const id = this.editingEmployeeId();
    const raw = this.employeeForm.getRawValue();
    if (id) {
      const payload: UpdateEmployeeRequest = {
        employeeCode: raw.employeeCode,
        fullName: raw.fullName,
        fullNameLocal: raw.fullNameLocal || undefined,
        mobile: raw.mobile,
        email: raw.email,
        isActive: raw.isActive
      };
      return this.masters.updateEmployee(id, payload);
    }

    const payload: CreateEmployeeRequest = {
      employeeCode: raw.employeeCode,
      fullName: raw.fullName,
      fullNameLocal: raw.fullNameLocal || undefined,
      mobile: raw.mobile,
      email: raw.email
    };
    return this.masters.createEmployee(payload);
  }

  protected startEditEmployee(row: EmployeeRecord): void {
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.editingEmployeeId.set(row.id);
    this.employeeForm.reset({
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      fullNameLocal: row.fullNameLocal || '',
      mobile: row.mobile,
      email: row.email,
      isActive: row.isActive
    });
  }

  protected cancelEditEmployee(): void {
    this.editingEmployeeId.set(null);
    this.employeeForm.reset({
      employeeCode: '',
      fullName: '',
      fullNameLocal: '',
      mobile: '',
      email: '',
      isActive: true
    });
  }

  protected applyEmployeeFilter(): void {
    this.employeeActiveFilter.set(this.employeeFilterForm.controls.active.getRawValue());
    this.page.set(1);
  }

  protected clearEmployeeFilter(): void {
    this.employeeFilterForm.reset({ active: '' });
    this.employeeActiveFilter.set('');
    this.page.set(1);
  }

  protected openEmployeePostings(row: EmployeeRecord): void {
    this.selectedEmployeeForPostingsId.set(row.id);
    this.loadEmployeePostings(row.id);
  }

  private loadEmployeePostings(employeeId: number): void {
    this.masters.getEmployeePostings(employeeId).subscribe({
      next: (rows) => this.employeePostings.set(rows),
      error: () => this.employeePostings.set([])
    });
  }

  private loadOfficeBranches(officeId: number): void {
    this.masters.getOfficeBranches(officeId).subscribe({
      next: (rows) => this.officeBranches.set(rows),
      error: () => this.officeBranches.set([])
    });
  }

  protected addPosting(): void {
    const employeeId = this.selectedEmployeeForPostingsId();
    if (!employeeId) return;

    this.postingForm.markAllAsTouched();
    if (this.postingForm.invalid) {
      this.apiError.set('Please fix validation errors.');
      return;
    }

    const raw = this.postingForm.getRawValue();
    const payload: CreateEmployeePostingRequest = {
      officeId: raw.officeId,
      designationId: raw.designationId,
      fromDate: raw.fromDate
    };
    if (raw.officeBranchId > 0) {
      payload.officeBranchId = raw.officeBranchId;
    }

    this.busy.set(true);
    this.masters.addEmployeePosting(employeeId, payload).subscribe({
      next: () => {
        this.apiMessage.set('Posting saved successfully.');
        this.postingForm.reset({ officeId: 0, officeBranchId: 0, designationId: 0, fromDate: '' });
        this.loadEmployeePostings(employeeId);
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.busy.set(false)
    });
  }

  protected closePosting(postingId: number): void {
    const employeeId = this.selectedEmployeeForPostingsId();
    if (!employeeId) return;

    const toDate = prompt('Enter To Date (YYYY-MM-DD)');
    if (!toDate) return;

    const payload: ClosePostingRequest = { toDate };
    this.busy.set(true);
    this.masters.closeEmployeePosting(postingId, payload).subscribe({
      next: () => {
        this.apiMessage.set('Posting closed successfully.');
        this.loadEmployeePostings(employeeId);
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.busy.set(false)
    });
  }

  private loadDocumentTypes(): void {
    this.masters.getDocumentTypes().subscribe({
      next: (rows) => {
        this.documentTypes.set(rows);
        this.page.set(1);
      },
      error: () => this.documentTypes.set([])
    });
  }

  private loadCaseCategoriesForMapping(): void {
    this.masters.getCaseCategories().subscribe({
      next: (rows) => this.caseCategories.set(rows),
      error: () => this.caseCategories.set([])
    });
  }

  private loadDocumentMappingSubjects(departmentId: number): void {
    if (departmentId < 1) {
      this.mappingSubjects.set([]);
      return;
    }
    this.mappingSubjectsLoading.set(true);
    this.masters.getSubjects(departmentId).subscribe({
      next: (rows) => {
        this.mappingSubjects.set(rows);
        if (rows.length === 0) {
          this.apiMessage.set('No subjects found for this department. Create subjects under the Subject tab first.');
        }
      },
      error: (err: unknown) => {
        this.mappingSubjects.set([]);
        this.apiError.set(this.formatError(err));
      },
      complete: () => this.mappingSubjectsLoading.set(false)
    });
  }

  private toPositiveInt(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  }

  private mappingFormSelection(): {
    mappingDepartmentId: number;
    subjectId: number;
    caseCategoryId: number;
  } | null {
    const raw = this.documentTypeMappingForm.getRawValue();
    const mappingDepartmentId = this.toPositiveInt(raw.mappingDepartmentId);
    const subjectId = this.toPositiveInt(raw.subjectId);
    const caseCategoryId = this.toPositiveInt(raw.caseCategoryId);
    if (mappingDepartmentId > 0 && subjectId > 0 && caseCategoryId > 0) {
      return { mappingDepartmentId, subjectId, caseCategoryId };
    }
    return null;
  }

  private resetMappingWorkspace(): void {
    this.documentTypeMappings.set([]);
    this.pendingDocumentTypeIds.set(new Set());
    this.mappingContextLabel.set(null);
  }

  protected onMappingDepartmentChange(): void {
    const departmentId = this.toPositiveInt(
      this.documentTypeMappingForm.controls.mappingDepartmentId.getRawValue()
    );
    this.documentTypeMappingForm.controls.subjectId.setValue(0, { emitEvent: false });
    this.documentTypeMappingForm.controls.caseCategoryId.setValue(0, { emitEvent: false });
    this.mappingSubjects.set([]);
    this.configuredMappingSubjects.set([]);
    this.configuredSubjectDocumentsBySubjectId.set(new Map());
    this.resetMappingWorkspace();
    if (departmentId > 0) {
      this.loadDocumentMappingSubjects(departmentId);
    }
  }

  protected onMappingSubjectChange(): void {
    this.documentTypeMappingForm.controls.caseCategoryId.setValue(0, { emitEvent: false });
    this.configuredMappingSubjects.set([]);
    this.configuredSubjectDocumentsBySubjectId.set(new Map());
    this.resetMappingWorkspace();
  }

  protected onMappingCategoryChange(): void {
    const categoryId = this.toPositiveInt(this.documentTypeMappingForm.controls.caseCategoryId.getRawValue());
    this.resetMappingWorkspace();
    if (categoryId > 0) {
      this.loadConfiguredSubjects(categoryId);
    } else {
      this.configuredMappingSubjects.set([]);
    }
    if (this.mappingFormSelection()) {
      this.loadDocumentTypeMappings();
    }
  }

  protected loadConfiguredSubjects(caseCategoryId?: number): void {
    const id = this.toPositiveInt(
      caseCategoryId ?? this.documentTypeMappingForm.controls.caseCategoryId.getRawValue()
    );
    if (id < 1) {
      this.configuredMappingSubjects.set([]);
      this.configuredSubjectDocumentsBySubjectId.set(new Map());
      return;
    }
    this.masters.getConfiguredSubjectsForCategory(id).subscribe({
      next: (rows) => {
        this.configuredMappingSubjects.set(rows);
        if (!rows.length) {
          this.configuredSubjectDocumentsBySubjectId.set(new Map());
          return;
        }
        forkJoin(
          rows.map((s) =>
            this.masters.getDocumentTypeMappings(id, s.subjectId).pipe(
              map((resp) => ({ subjectId: s.subjectId, items: resp.items ?? [] }))
            )
          )
        ).subscribe({
          next: (results) => {
            const bySubject = new Map<number, DocumentTypeMappingItemRecord[]>();
            for (const r of results) {
              bySubject.set(r.subjectId, r.items);
            }
            this.configuredSubjectDocumentsBySubjectId.set(bySubject);
          },
          error: () => this.configuredSubjectDocumentsBySubjectId.set(new Map())
        });
      },
      error: () => {
        this.configuredMappingSubjects.set([]);
        this.configuredSubjectDocumentsBySubjectId.set(new Map());
      }
    });
  }

  protected mappingDocumentCode(item: DocumentTypeMappingItemRecord): string {
    return (
      item.documentType?.code ||
      this.documentTypes().find((d) => d.id === item.documentTypeId)?.code ||
      `DOC-${item.documentTypeId}`
    );
  }

  protected mappingDocumentName(item: DocumentTypeMappingItemRecord): string {
    return (
      item.documentType?.name ||
      this.documentTypes().find((d) => d.id === item.documentTypeId)?.name ||
      `Document #${item.documentTypeId}`
    );
  }

  protected mappingDocumentLocalName(item: DocumentTypeMappingItemRecord): string {
    return (
      item.documentType?.localName ||
      this.documentTypes().find((d) => d.id === item.documentTypeId)?.localName ||
      '—'
    );
  }

  protected configuredSubjectDocumentNames(subjectId: number): string {
    const items = this.configuredSubjectDocumentsBySubjectId().get(subjectId) ?? [];
    if (!items.length) {
      return '—';
    }
    return items.map((item) => this.mappingDocumentName(item)).join(', ');
  }

  protected selectConfiguredSubject(summary: ConfiguredSubjectSummary): void {
    this.documentTypeMappingForm.controls.subjectId.setValue(summary.subjectId, { emitEvent: false });
    if (this.mappingFormSelection()) {
      this.loadDocumentTypeMappings();
    }
  }

  protected loadDocumentTypeMappings(): void {
    this.apiMessage.set(null);
    this.apiError.set(null);

    const selection = this.mappingFormSelection();
    if (!selection) {
      this.apiError.set('Please select department, subject, and case category.');
      return;
    }

    this.busy.set(true);
    this.masters.getDocumentTypeMappings(selection.caseCategoryId, selection.subjectId).subscribe({
      next: (resp) => {
        this.documentTypeMappings.set(resp.items ?? []);
        this.pendingDocumentTypeIds.set(new Set());
        const dept = this.departments().find((d) => d.id === selection.mappingDepartmentId);
        this.mappingContextLabel.set(
          `${dept?.name ?? 'Department'} · ${resp.subjectName} (${resp.subjectCode}) · ${resp.caseCategoryName} (${resp.caseCategoryCode})`
        );
        this.apiMessage.set('Mapping loaded.');
        this.loadConfiguredSubjects(selection.caseCategoryId);
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.busy.set(false)
    });
  }

  protected isDocumentPending(documentTypeId: number): boolean {
    return this.pendingDocumentTypeIds().has(documentTypeId);
  }

  protected togglePendingDocument(documentTypeId: number, checked: boolean): void {
    this.pendingDocumentTypeIds.update((ids) => {
      const next = new Set(ids);
      if (checked) {
        next.add(documentTypeId);
      } else {
        next.delete(documentTypeId);
      }
      return next;
    });
  }

  protected toggleSelectAllUnmapped(checked: boolean): void {
    if (checked) {
      this.pendingDocumentTypeIds.set(new Set(this.unmappedDocumentTypes().map((doc) => doc.id)));
    } else {
      this.pendingDocumentTypeIds.set(new Set());
    }
  }

  protected addPendingDocumentsToMapping(): void {
    const pending = this.pendingDocumentTypeIds();
    if (!pending.size) {
      this.apiError.set('Select at least one document from the master list.');
      return;
    }
    this.apiError.set(null);
    let nextOrder = this.documentTypeMappings().reduce((max, item) => Math.max(max, item.displayOrder), 0);
    const additions: DocumentTypeMappingItemRecord[] = [];
    for (const doc of this.documentTypes()) {
      if (!pending.has(doc.id) || this.isDocumentTypeMapped(doc.id)) {
        continue;
      }
      nextOrder += 1;
      additions.push({
        documentTypeId: doc.id,
        required: true,
        displayOrder: nextOrder,
        documentType: doc
      });
    }
    if (!additions.length) {
      this.apiError.set('Selected documents are already mapped.');
      return;
    }
    this.documentTypeMappings.set(
      [...this.documentTypeMappings(), ...additions].sort((a, b) => a.displayOrder - b.displayOrder)
    );
    this.pendingDocumentTypeIds.set(new Set());
    this.apiMessage.set(`${additions.length} document(s) added. Review required/order, then save mapping.`);
  }

  protected isDocumentTypeMapped(documentTypeId: number): boolean {
    return this.mappedDocumentTypeIds().has(documentTypeId);
  }

  protected getMappingItem(documentTypeId: number): DocumentTypeMappingItemRecord | undefined {
    return this.documentTypeMappings().find((item) => item.documentTypeId === documentTypeId);
  }

  protected setMappingRequired(documentTypeId: number, required: boolean): void {
    this.documentTypeMappings.update((rows) =>
      rows.map((item) => (item.documentTypeId === documentTypeId ? { ...item, required } : item))
    );
  }

  protected setMappingDisplayOrder(documentTypeId: number, displayOrder: number): void {
    const order = Number.isFinite(displayOrder) && displayOrder > 0 ? displayOrder : 1;
    this.documentTypeMappings.update((rows) => {
      const updated = rows.map((item) =>
        item.documentTypeId === documentTypeId ? { ...item, displayOrder: order } : item
      );
      return updated.sort((a, b) => a.displayOrder - b.displayOrder);
    });
  }

  protected removeDocumentTypeMappingItem(documentTypeId: number): void {
    this.documentTypeMappings.set(this.documentTypeMappings().filter((item) => item.documentTypeId !== documentTypeId));
  }

  protected clearAndSaveDocumentTypeMappings(): void {
    if (!confirm('Remove all document mappings for this category and subject?')) return;
    this.documentTypeMappings.set([]);
    this.saveDocumentTypeMappings();
  }

  protected saveDocumentTypeMappings(): void {
    this.apiMessage.set(null);
    this.apiError.set(null);

    const selection = this.mappingFormSelection();
    if (!selection) {
      this.apiError.set('Please select department, subject, and case category.');
      return;
    }

    const items = [...this.documentTypeMappings()]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((item, index) => ({
        documentTypeId: item.documentTypeId,
        required: item.required,
        displayOrder: item.displayOrder > 0 ? item.displayOrder : index + 1
      }));

    this.busy.set(true);
    this.masters
      .replaceDocumentTypeMappings({
        caseCategoryId: selection.caseCategoryId,
        subjectId: selection.subjectId,
        items
      })
      .subscribe({
        next: (resp) => {
          this.documentTypeMappings.set(resp.items ?? []);
          const dept = this.departments().find((d) => d.id === selection.mappingDepartmentId);
          this.mappingContextLabel.set(
            `${dept?.name ?? 'Department'} · ${resp.subjectName} (${resp.subjectCode}) · ${resp.caseCategoryName} (${resp.caseCategoryCode})`
          );
          this.apiMessage.set(items.length ? 'Mapping saved.' : 'All mappings cleared for this combination.');
          this.loadConfiguredSubjects(selection.caseCategoryId);
        },
        error: (err: unknown) => this.apiError.set(this.formatError(err)),
        complete: () => this.busy.set(false)
      });
  }

  private documentTypePayload(): CreateOrUpdateDocumentTypeRequest {
    const raw = this.documentTypeForm.getRawValue();
    return {
      code: raw.code.trim().toUpperCase(),
      name: raw.name.trim(),
      localName: raw.localName.trim() || undefined,
      validForPhotoId: raw.validForPhotoId,
      validForAddress: raw.validForAddress,
      sourceUrl: raw.sourceUrl.trim() || undefined
    };
  }

  private submitDocumentType() {
    const payload = this.documentTypePayload();
    const id = this.editingDocumentTypeId();
    return id ? this.masters.updateDocumentType(id, payload) : this.masters.createDocumentType(payload);
  }

  protected startEditDocumentType(row: DocumentTypeRecord): void {
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.editingDocumentTypeId.set(row.id);
    this.documentTypeForm.reset({
      code: row.code,
      name: row.name,
      localName: row.localName || '',
      validForPhotoId: row.validForPhotoId,
      validForAddress: row.validForAddress,
      sourceUrl: row.sourceUrl || ''
    });
  }

  protected cancelEditDocumentType(): void {
    this.editingDocumentTypeId.set(null);
    this.documentTypeForm.reset({
      code: '',
      name: '',
      localName: '',
      validForPhotoId: false,
      validForAddress: false,
      sourceUrl: ''
    });
  }

  protected deleteDocumentType(row: DocumentTypeRecord): void {
    if (!confirm(`Delete document type "${row.name}"?`)) return;
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.busy.set(true);
    this.masters.deleteDocumentType(row.id).subscribe({
      next: () => {
        this.apiMessage.set('Document type deleted.');
        if (this.editingDocumentTypeId() === row.id) this.cancelEditDocumentType();
        this.loadDocumentTypes();
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.busy.set(false)
    });
  }

  private designationPayload(): CreateOrUpdateDesignationRequest {
    const raw = this.designationForm.getRawValue();
    return {
      departmentId: raw.departmentId,
      name: raw.name,
      localName: raw.localName || undefined,
      shortName: raw.shortName || undefined,
      shortNameLocal: raw.shortNameLocal || undefined
    };
  }

  protected startEditDesignation(row: DesignationRecord): void {
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.editingDesignationId.set(row.id);
    this.designationForm.reset({
      departmentId: row.departmentId,
      name: row.name,
      localName: row.localName || '',
      shortName: row.shortName || '',
      shortNameLocal: row.shortNameLocal || ''
    });
  }

  protected cancelEditDesignation(): void {
    this.editingDesignationId.set(null);
    const keepDeptId = this.designationForm.controls.departmentId.getRawValue();
    this.designationForm.reset({
      departmentId: keepDeptId,
      name: '',
      localName: '',
      shortName: '',
      shortNameLocal: ''
    });
  }

  protected deleteDesignation(row: DesignationRecord): void {
    if (!confirm(`Delete designation \"${row.name}\"?`)) return;
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.busy.set(true);
    this.masters.deleteDesignation(row.id).subscribe({
      next: () => {
        this.apiMessage.set('Deleted successfully.');
        if (this.editingDesignationId() === row.id) this.cancelEditDesignation();
        this.loadDesignations();
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.busy.set(false)
    });
  }

  protected applyDesignationFilter(): void {
    this.designationDeptFilter.set(this.designationFilterForm.controls.departmentId.getRawValue());
    this.page.set(1);
  }

  protected clearDesignationFilter(): void {
    this.designationFilterForm.reset({ departmentId: 0 });
    this.designationDeptFilter.set(0);
    this.page.set(1);
  }

  private occupationPayload(): CreateOrUpdateOccupationRequest {
    const raw = this.occupationForm.getRawValue();
    return {
      name: raw.name,
      localName: raw.localName || undefined,
      shortName: raw.shortName || undefined,
      shortNameLocal: raw.shortNameLocal || undefined
    };
  }

  protected startEditOccupation(row: OccupationRecord): void {
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.editingOccupationId.set(row.id);
    this.occupationForm.reset({
      name: row.name,
      localName: row.localName || '',
      shortName: row.shortName || '',
      shortNameLocal: row.shortNameLocal || ''
    });
  }

  protected cancelEditOccupation(): void {
    this.editingOccupationId.set(null);
    this.occupationForm.reset({ name: '', localName: '', shortName: '', shortNameLocal: '' });
  }

  protected deleteOccupation(row: OccupationRecord): void {
    if (!confirm(`Delete occupation "${row.name}"?`)) return;
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.busy.set(true);
    this.masters.deleteOccupation(row.id).subscribe({
      next: () => {
        this.apiMessage.set('Deleted successfully.');
        if (this.editingOccupationId() === row.id) this.cancelEditOccupation();
        this.loadOccupations();
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.busy.set(false)
    });
  }

  private officeTypePayload(): CreateOrUpdateOfficeTypeRequest {
    const raw = this.officeTypeForm.getRawValue();
    return {
      departmentId: raw.departmentId,
      name: raw.name,
      localName: raw.localName || undefined,
      shortName: raw.shortName || undefined,
      shortNameLocal: raw.shortNameLocal || undefined
    };
  }

  protected startEditOfficeType(row: OfficeTypeRecord): void {
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.editingOfficeTypeId.set(row.id);
    this.officeTypeForm.reset({
      departmentId: row.departmentId,
      name: row.name,
      localName: row.localName || '',
      shortName: row.shortName || '',
      shortNameLocal: row.shortNameLocal || ''
    });
  }

  protected cancelEditOfficeType(): void {
    this.editingOfficeTypeId.set(null);
    const keepDeptId = this.officeTypeForm.controls.departmentId.getRawValue();
    this.officeTypeForm.reset({
      departmentId: keepDeptId,
      name: '',
      localName: '',
      shortName: '',
      shortNameLocal: ''
    });
  }

  protected deleteOfficeType(row: OfficeTypeRecord): void {
    if (!confirm(`Delete office type \"${row.name}\"?`)) return;
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.busy.set(true);
    this.masters.deleteOfficeType(row.id).subscribe({
      next: () => {
        this.apiMessage.set('Deleted successfully.');
        if (this.editingOfficeTypeId() === row.id) this.cancelEditOfficeType();
        this.loadOfficeTypes();
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.busy.set(false)
    });
  }

  private subjectPayload(): CreateOrUpdateSubjectRequest {
    const raw = this.subjectForm.getRawValue();
    return {
      departmentId: raw.departmentId,
      subjectCode: raw.subjectCode,
      subjectName: raw.subjectName,
      subjectNameLocal: raw.subjectNameLocal || undefined
    };
  }

  protected startEditSubject(row: SubjectRecord): void {
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.editingSubjectId.set(row.id);
    this.subjectForm.reset({
      departmentId: row.departmentId,
      subjectCode: row.subjectCode,
      subjectName: row.subjectName,
      subjectNameLocal: row.subjectNameLocal || ''
    });
  }

  protected cancelEditSubject(): void {
    this.editingSubjectId.set(null);
    const keepDeptId = this.subjectForm.controls.departmentId.getRawValue();
    this.subjectForm.reset({
      departmentId: keepDeptId,
      subjectCode: '',
      subjectName: '',
      subjectNameLocal: ''
    });
  }

  protected deleteSubject(row: SubjectRecord): void {
    if (!confirm(`Delete subject \"${row.subjectName}\"?`)) return;
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.busy.set(true);
    this.masters.deleteSubject(row.id).subscribe({
      next: () => {
        this.apiMessage.set('Deleted successfully.');
        if (this.editingSubjectId() === row.id) this.cancelEditSubject();
        this.loadSubjects();
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.busy.set(false)
    });
  }

  private sectionPayload() {
    const raw = this.sectionForm.getRawValue();
    return {
      actId: raw.actId,
      sectionCode: raw.sectionCode,
      sectionName: raw.sectionName,
      sectionNameLocal: raw.sectionNameLocal || undefined
    };
  }

  protected startEditSection(row: SectionRecord): void {
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.editingSectionId.set(row.id);
    this.sectionForm.reset({
      actId: row.actId,
      sectionCode: row.sectionCode,
      sectionName: row.sectionName,
      sectionNameLocal: row.sectionNameLocal || ''
    });
  }

  protected cancelEditSection(): void {
    this.editingSectionId.set(null);
    const keepActId = this.sectionForm.controls.actId.getRawValue();
    this.sectionForm.reset({ actId: keepActId, sectionCode: '', sectionName: '', sectionNameLocal: '' });
  }

  protected deleteSection(row: SectionRecord): void {
    if (!confirm(`Delete section "${row.sectionCode}"?`)) return;
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.busy.set(true);
    this.masters.deleteSection(row.id).subscribe({
      next: () => {
        this.apiMessage.set('Deleted successfully.');
        if (this.editingSectionId() === row.id) this.cancelEditSection();
        this.loadSections();
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.busy.set(false)
    });
  }

  private subdistrictPayload(): CreateSubdistrictRequest {
    const raw = this.subdistrictForm.getRawValue();
    const district = this.districts().find((d) => d.id === raw.districtId);
    return {
      name: raw.name,
      localName: raw.localName || undefined,
      lgdCode: raw.lgdCode || undefined,
      districtId: raw.districtId,
      districtLgdCode: district?.lgdCode ?? undefined
    };
  }

  private talukaPayload(): CreateTalukaRequest {
    const raw = this.talukaForm.getRawValue();
    const district = this.districts().find((d) => d.id === raw.districtId);
    const subdistrict = this.subdistricts().find((s) => s.id === raw.subdistrictId);
    return {
      name: raw.name,
      localName: raw.localName || undefined,
      lgdCode: raw.lgdCode || undefined,
      districtId: raw.districtId,
      districtLgdCode: district?.lgdCode ?? undefined,
      subdistrictId: raw.subdistrictId,
      subdistrictLgdCode: subdistrict?.lgdCode ?? undefined
    };
  }

  private villagePayload(): CreateVillageRequest {
    const raw = this.villageForm.getRawValue();
    const taluka = this.talukas().find((t) => t.id === raw.talukaId);
    return {
      name: raw.name,
      localName: raw.localName || undefined,
      lgdCode: raw.lgdCode || undefined,
      talukaId: raw.talukaId,
      talukaLgdCode: taluka?.lgdCode ?? undefined
    };
  }

  private departmentPayload(): CreateOrUpdateDepartmentRequest {
    const raw = this.departmentForm.getRawValue();
    return {
      name: raw.name,
      localName: raw.localName || undefined,
      stateId: this.hasFixedState ? environment.defaultState.id : raw.stateId
    };
  }

  protected startEditDepartment(row: DepartmentRecord): void {
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.editingDepartmentId.set(row.id);
    this.departmentForm.reset({
      name: row.name,
      localName: row.localName || '',
      stateId: row.stateId
    });
    if (this.hasFixedState) {
      this.departmentForm.controls.stateId.disable();
    }
  }

  protected cancelEditDepartment(): void {
    this.editingDepartmentId.set(null);
    this.departmentForm.reset({
      stateId: this.hasFixedState ? environment.defaultState.id : 0,
      name: '',
      localName: ''
    });
    if (this.hasFixedState) {
      this.departmentForm.controls.stateId.disable();
    }
  }

  protected deleteDepartment(row: DepartmentRecord): void {
    if (!confirm(`Delete department "${row.name}"?`)) return;

    this.apiMessage.set(null);
    this.apiError.set(null);
    this.busy.set(true);
    this.masters.deleteDepartment(row.id).subscribe({
      next: () => {
        this.apiMessage.set('Deleted successfully.');
        if (this.editingDepartmentId() === row.id) {
          this.cancelEditDepartment();
        }
        this.loadDepartments();
      },
      error: (err: unknown) => {
        this.apiError.set(this.formatError(err));
      },
      complete: () => {
        this.busy.set(false);
      }
    });
  }

  protected readonly pageRange = computed<number[]>(() => {
    const total = this.totalPages();
    const current = this.page();
    const delta = 2;
    const range: number[] = [];
    const rangeStart = Math.max(1, current - delta);
    const rangeEnd = Math.min(total, current + delta);
    for (let i = rangeStart; i <= rangeEnd; i++) range.push(i);
    return range;
  });

  protected readonly pageFrom = computed(() => {
    const current = Math.min(this.page(), this.totalPages());
    return (current - 1) * this.pageSize() + 1;
  });

  protected readonly pageTo = computed(() => {
    const current = Math.min(this.page(), this.totalPages());
    return Math.min(current * this.pageSize(), this.total());
  });

  protected setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  protected prevPage(): void {
    this.page.set(Math.max(1, this.page() - 1));
  }

  protected nextPage(): void {
    this.page.set(Math.min(this.totalPages(), this.page() + 1));
  }

  protected goToPage(p: number): void {
    this.page.set(Math.max(1, Math.min(this.totalPages(), p)));
  }
}

