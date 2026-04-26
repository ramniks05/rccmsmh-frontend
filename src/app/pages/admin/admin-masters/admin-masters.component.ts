import { Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import {
  AdminMastersService,
  ActRecord,
  SectionRecord,
  DepartmentRecord,
  DocumentTypeMappingItemRecord,
  MasterRecord,
  DesignationRecord,
  EmployeePostingRecord,
  EmployeeRecord,
  OfficeLevel,
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
  type CreateOrUpdateDepartmentRequest
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
  | 'EMPLOYEE'
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
  protected readonly employeePostings = signal<EmployeePostingRecord[]>([]);
  protected readonly documentTypeMappings = signal<DocumentTypeMappingItemRecord[]>([]);
  protected readonly mappingSubjects = signal<SubjectRecord[]>([]);

  protected readonly editingDepartmentId = signal<number | null>(null);
  protected readonly editingActId = signal<number | null>(null);
  protected readonly editingSectionId = signal<number | null>(null);
  protected readonly editingSubjectId = signal<number | null>(null);
  protected readonly editingOfficeTypeId = signal<number | null>(null);
  protected readonly editingOfficeId = signal<number | null>(null);
  protected readonly editingDesignationId = signal<number | null>(null);
  protected readonly editingEmployeeId = signal<number | null>(null);
  protected readonly selectedEmployeeForPostingsId = signal<number | null>(null);

  protected readonly selectedSectionActId = signal<number>(0);
  protected readonly selectedOfficeTypeDepartmentId = signal<number>(0);
  protected readonly selectedSubjectDepartmentId = signal<number>(0);
  protected readonly officeTypeOptions = signal<OfficeTypeRecord[]>([]);

  protected readonly officeDivisions = signal<MasterRecord[]>([]);
  protected readonly officeDistricts = signal<MasterRecord[]>([]);
  protected readonly officeSubdistricts = signal<MasterRecord[]>([]);
  protected readonly officeTalukas = signal<MasterRecord[]>([]);
  protected readonly officeVillages = signal<MasterRecord[]>([]);

  protected readonly pageSize = signal(10);
  protected readonly page = signal(1);

  protected readonly isDepartment = computed(() => this.selected() === 'DEPARTMENT');
  protected readonly isAct = computed(() => this.selected() === 'ACT');
  protected readonly isSection = computed(() => this.selected() === 'SECTION');
  protected readonly isSubject = computed(() => this.selected() === 'SUBJECT');
  protected readonly isOfficeType = computed(() => this.selected() === 'OFFICE_TYPE');
  protected readonly isOffice = computed(() => this.selected() === 'OFFICE');
  protected readonly isDesignation = computed(() => this.selected() === 'DESIGNATION');
  protected readonly isEmployee = computed(() => this.selected() === 'EMPLOYEE');
  protected readonly isDocumentTypeMapping = computed(() => this.selected() === 'DOCUMENT_TYPE_MAPPING');

  protected readonly activeMasterList = computed<MasterRecord[]>(() => {
    const kind = this.selected();
    switch (kind) {
      case 'STATE':
        return this.states();
      case 'DIVISION':
        return this.divisions();
      case 'DISTRICT':
        return this.districts();
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

  protected readonly total = computed(() =>
    this.isDepartment()
      ? this.departments().length
      : this.isAct()
        ? this.acts().length
        : this.isSection()
          ? this.sections().length
          : this.isSubject()
            ? this.subjects().length
            : this.isOfficeType()
              ? this.officeTypes().length
                : this.isOffice()
                  ? this.offices().length
                  : this.isDesignation()
                    ? this.designations().length
                    : this.isEmployee()
                      ? this.employees().length
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
    return this.sections().slice(start, start + size);
  });

  protected readonly pagedSubjectList = computed<SubjectRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.subjects().slice(start, start + size);
  });

  protected readonly pagedOfficeTypeList = computed<OfficeTypeRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.officeTypes().slice(start, start + size);
  });

  protected readonly pagedOfficeList = computed<OfficeRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.offices().slice(start, start + size);
  });

  protected readonly pagedDesignationList = computed<DesignationRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.designations().slice(start, start + size);
  });

  protected readonly pagedEmployeeList = computed<EmployeeRecord[]>(() => {
    const size = this.pageSize();
    const currentPage = Math.min(this.page(), this.totalPages());
    const start = (currentPage - 1) * size;
    return this.employees().slice(start, start + size);
  });

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
      case 'EMPLOYEE':
        return 'Create Employee';
      case 'DOCUMENT_TYPE_MAPPING':
        return 'Document Type Mapping';
    }
  });

  protected readonly stateForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    lgdCode: ['']
  });

  protected readonly divisionForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    lgdCode: [''],
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
    lgdCode: [''],
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
    level: ['TALUKA' as OfficeLevel, [Validators.required]],
    locationId: [0, [Validators.required, Validators.min(1)]],
    stateId: [0],
    divisionId: [0],
    districtId: [0],
    subdistrictId: [0],
    talukaId: [0],
    villageId: [0],
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    shortName: [''],
    shortNameLocal: ['']
  });

  protected readonly officeFilterForm = this.fb.nonNullable.group({
    departmentId: [0],
    officeTypeId: [0],
    level: ['' as '' | OfficeLevel],
    locationId: [0],
    stateId: [0],
    divisionId: [0],
    districtId: [0],
    subdistrictId: [0],
    talukaId: [0],
    villageId: [0]
  });

  protected readonly designationForm = this.fb.nonNullable.group({
    departmentId: [0, [Validators.required, Validators.min(1)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    localName: [''],
    shortName: [''],
    shortNameLocal: ['']
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

  protected readonly employeeFilterForm = this.fb.nonNullable.group({
    active: ['' as '' | 'true' | 'false']
  });

  protected readonly postingForm = this.fb.nonNullable.group({
    officeId: [0, [Validators.required, Validators.min(1)]],
    officeBranchId: [0, [Validators.min(0)]],
    designationId: [0, [Validators.required, Validators.min(1)]],
    fromDate: ['', [Validators.required]]
  });

  protected readonly documentTypeMappingForm = this.fb.nonNullable.group({
    caseCategoryId: [0, [Validators.required, Validators.min(1)]],
    subjectId: [0, [Validators.required, Validators.min(1)]]
  });

  protected readonly documentTypeMappingItemForm = this.fb.nonNullable.group({
    documentTypeId: [0, [Validators.required, Validators.min(1)]],
    required: [false],
    displayOrder: [1, [Validators.required, Validators.min(1)]]
  });

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

    this.districtForm.controls.divisionId.valueChanges.subscribe((divisionId) => {
      if (!divisionId || divisionId < 1) {
        this.districts.set([]);
        this.subdistricts.set([]);
        this.talukas.set([]);
        this.villages.set([]);
        return;
      }
      this.loadDistricts();
    });

    this.subdistrictForm.controls.districtId.valueChanges.subscribe((districtId) => {
      if (!districtId || districtId < 1) {
        this.subdistricts.set([]);
        this.talukas.set([]);
        this.villages.set([]);
        return;
      }
      this.loadSubdistricts();
    });

    this.talukaForm.controls.districtId.valueChanges.subscribe((districtId) => {
      if (!districtId || districtId < 1) {
        this.subdistricts.set([]);
        this.talukas.set([]);
        this.villages.set([]);
        return;
      }
      this.loadSubdistricts();
    });

    this.talukaForm.controls.subdistrictId.valueChanges.subscribe((subdistrictId) => {
      if (!subdistrictId || subdistrictId < 1) {
        this.talukas.set([]);
        this.villages.set([]);
        return;
      }
      this.loadTalukas();
    });

    this.villageForm.controls.talukaId.valueChanges.subscribe((talukaId) => {
      if (!talukaId || talukaId < 1) {
        this.villages.set([]);
        return;
      }
      this.loadVillages();
    });

    this.sectionForm.controls.actId.valueChanges.subscribe((actId) => {
      this.selectedSectionActId.set(actId || 0);
      this.loadSections();
    });

    this.officeTypeForm.controls.departmentId.valueChanges.subscribe((departmentId) => {
      this.selectedOfficeTypeDepartmentId.set(departmentId || 0);
      this.loadOfficeTypes();
    });

    this.subjectForm.controls.departmentId.valueChanges.subscribe((departmentId) => {
      this.selectedSubjectDepartmentId.set(departmentId || 0);
      this.loadSubjects();
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
          if (this.officeForm.controls.officeTypeId.getRawValue() < 1 && rows.length === 1) {
            this.officeForm.controls.officeTypeId.setValue(rows[0].id);
          }
        },
        error: () => this.officeTypeOptions.set([])
      });
    });

    if (this.hasFixedState) {
      this.officeForm.controls.stateId.setValue(environment.defaultState.id);
      this.officeFilterForm.controls.stateId.setValue(environment.defaultState.id);
    }

    this.officeForm.controls.level.valueChanges.subscribe(() => {
      this.resetOfficeLocationChain();
      this.loadOfficeLocationOptions();
      this.syncOfficeLocationId();
    });
    this.officeForm.controls.divisionId.valueChanges.subscribe(() => {
      this.officeDistricts.set([]);
      this.officeSubdistricts.set([]);
      this.officeTalukas.set([]);
      this.officeVillages.set([]);
      this.officeForm.controls.districtId.setValue(0);
      this.officeForm.controls.subdistrictId.setValue(0);
      this.officeForm.controls.talukaId.setValue(0);
      this.officeForm.controls.villageId.setValue(0);
      this.loadOfficeDistricts();
      this.syncOfficeLocationId();
    });
    this.officeForm.controls.districtId.valueChanges.subscribe(() => {
      this.officeSubdistricts.set([]);
      this.officeTalukas.set([]);
      this.officeVillages.set([]);
      this.officeForm.controls.subdistrictId.setValue(0);
      this.officeForm.controls.talukaId.setValue(0);
      this.officeForm.controls.villageId.setValue(0);
      this.loadOfficeSubdistricts();
      this.syncOfficeLocationId();
    });
    this.officeForm.controls.subdistrictId.valueChanges.subscribe(() => {
      this.officeTalukas.set([]);
      this.officeVillages.set([]);
      this.officeForm.controls.talukaId.setValue(0);
      this.officeForm.controls.villageId.setValue(0);
      this.loadOfficeTalukas();
      this.syncOfficeLocationId();
    });
    this.officeForm.controls.talukaId.valueChanges.subscribe(() => {
      this.officeVillages.set([]);
      this.officeForm.controls.villageId.setValue(0);
      this.loadOfficeVillages();
      this.syncOfficeLocationId();
    });
    this.officeForm.controls.villageId.valueChanges.subscribe(() => this.syncOfficeLocationId());

    this.officeFilterForm.controls.level.valueChanges.subscribe(() => {
      this.resetOfficeFilterLocationChain();
      this.loadOfficeFilterLocationOptions();
      this.syncOfficeFilterLocationId();
    });
    this.officeFilterForm.controls.divisionId.valueChanges.subscribe(() => {
      this.officeDistricts.set([]);
      this.officeSubdistricts.set([]);
      this.officeTalukas.set([]);
      this.officeVillages.set([]);
      this.officeFilterForm.controls.districtId.setValue(0);
      this.officeFilterForm.controls.subdistrictId.setValue(0);
      this.officeFilterForm.controls.talukaId.setValue(0);
      this.officeFilterForm.controls.villageId.setValue(0);
      this.loadOfficeDistricts(true);
      this.syncOfficeFilterLocationId();
    });
    this.officeFilterForm.controls.districtId.valueChanges.subscribe(() => {
      this.officeSubdistricts.set([]);
      this.officeTalukas.set([]);
      this.officeVillages.set([]);
      this.officeFilterForm.controls.subdistrictId.setValue(0);
      this.officeFilterForm.controls.talukaId.setValue(0);
      this.officeFilterForm.controls.villageId.setValue(0);
      this.loadOfficeSubdistricts(true);
      this.syncOfficeFilterLocationId();
    });
    this.officeFilterForm.controls.subdistrictId.valueChanges.subscribe(() => {
      this.officeTalukas.set([]);
      this.officeVillages.set([]);
      this.officeFilterForm.controls.talukaId.setValue(0);
      this.officeFilterForm.controls.villageId.setValue(0);
      this.loadOfficeTalukas(true);
      this.syncOfficeFilterLocationId();
    });
    this.officeFilterForm.controls.talukaId.valueChanges.subscribe(() => {
      this.officeVillages.set([]);
      this.officeFilterForm.controls.villageId.setValue(0);
      this.loadOfficeVillages(true);
      this.syncOfficeFilterLocationId();
    });
    this.officeFilterForm.controls.villageId.valueChanges.subscribe(() => this.syncOfficeFilterLocationId());

    this.officeFilterForm.controls.stateId.valueChanges.subscribe(() => {
      this.resetOfficeFilterLocationChain();
      this.loadOfficeFilterLocationOptions();
      this.syncOfficeFilterLocationId();
    });

    this.designationForm.controls.departmentId.valueChanges.subscribe(() => this.loadDesignations());

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
    this.editingEmployeeId.set(null);
    this.selectedEmployeeForPostingsId.set(null);

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
    } else if (kind === 'EMPLOYEE') {
      this.loadOffices();
      this.loadDesignations();
      this.loadEmployees();
    } else if (kind === 'DOCUMENT_TYPE_MAPPING') {
      this.loadDocumentMappingSubjects();
      this.documentTypeMappings.set([]);
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
              ? this.masters.createSubdistrict(this.subdistrictForm.getRawValue())
              : kind === 'TALUKA'
                ? this.masters.createTaluka(this.talukaForm.getRawValue())
                : kind === 'VILLAGE'
                  ? this.masters.createVillage(this.villageForm.getRawValue())
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
                                : this.submitEmployee();

    const reqUnknown$: Observable<unknown> = req$ as Observable<unknown>;

    reqUnknown$.subscribe({
      next: () => {
        this.apiMessage.set(
          kind === 'ACT' ||
            kind === 'SECTION' ||
            kind === 'DEPARTMENT' ||
            kind === 'SUBJECT' ||
            kind === 'OFFICE_TYPE'
            ? 'Saved successfully.'
            : 'Created successfully.'
        );
        if (kind === 'STATE') {
          this.stateForm.reset({ name: '', localName: '', lgdCode: '' });
          this.loadStates();
        } else if (kind === 'DIVISION') {
          this.divisionForm.reset({
            stateId: this.hasFixedState ? environment.defaultState.id : 0,
            name: '',
            localName: '',
            lgdCode: ''
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
              localName: '',
              lgdCode: ''
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
            const keepLevel = this.officeForm.controls.level.getRawValue();
            this.editingOfficeId.set(null);
            this.officeForm.reset({
              departmentId: keepDeptId,
              officeTypeId: keepOfficeTypeId,
              level: keepLevel,
              locationId: 0,
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
    const stateId = this.hasFixedState
      ? environment.defaultState.id
      : this.divisionForm.controls.stateId.getRawValue();
    if (!stateId || stateId < 1) {
      this.divisions.set([]);
      return;
    }
    this.masters.getDivisions(stateId).subscribe({
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
    const stateId = this.hasFixedState
      ? environment.defaultState.id
      : this.districtForm.controls.stateId.getRawValue();
    const divisionId = this.districtForm.controls.divisionId.getRawValue();
    if (!stateId || stateId < 1 || !divisionId || divisionId < 1) {
      this.districts.set([]);
      return;
    }
    this.masters.getDistricts(stateId, divisionId).subscribe({
      next: (rows) => {
        this.districts.set(rows);
        this.page.set(1);
        if (this.subdistrictForm.controls.districtId.getRawValue() < 1 && rows.length === 1) {
          this.subdistrictForm.controls.districtId.setValue(rows[0].id);
        }
        if (this.talukaForm.controls.districtId.getRawValue() < 1 && rows.length === 1) {
          this.talukaForm.controls.districtId.setValue(rows[0].id);
        }
      },
      error: () => {
        this.districts.set([]);
      }
    });
  }

  private loadSubdistricts(): void {
    const districtId = this.talukaForm.controls.districtId.getRawValue() || this.subdistrictForm.controls.districtId.getRawValue();
    if (!districtId || districtId < 1) {
      this.subdistricts.set([]);
      return;
    }
    this.masters.getSubdistricts(districtId).subscribe({
      next: (rows) => {
        this.subdistricts.set(rows);
        this.page.set(1);
        if (this.talukaForm.controls.subdistrictId.getRawValue() < 1 && rows.length === 1) {
          this.talukaForm.controls.subdistrictId.setValue(rows[0].id);
        }
      },
      error: () => {
        this.subdistricts.set([]);
      }
    });
  }

  private loadTalukas(): void {
    const districtId = this.talukaForm.controls.districtId.getRawValue();
    const subdistrictId = this.talukaForm.controls.subdistrictId.getRawValue();
    if (!districtId || districtId < 1 || !subdistrictId || subdistrictId < 1) {
      this.talukas.set([]);
      return;
    }
    this.masters.getTalukas(districtId, subdistrictId).subscribe({
      next: (rows) => {
        this.talukas.set(rows);
        this.page.set(1);
        if (this.villageForm.controls.talukaId.getRawValue() < 1 && rows.length === 1) {
          this.villageForm.controls.talukaId.setValue(rows[0].id);
        }
      },
      error: () => {
        this.talukas.set([]);
      }
    });
  }

  private loadVillages(): void {
    const talukaId = this.villageForm.controls.talukaId.getRawValue();
    if (!talukaId || talukaId < 1) {
      this.villages.set([]);
      return;
    }
    this.masters.getVillages(talukaId).subscribe({
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
    const actId = this.selectedSectionActId() || this.sectionForm.controls.actId.getRawValue() || 0;
    this.masters.getSections(actId > 0 ? actId : undefined).subscribe({
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
    const departmentId =
      this.selectedSubjectDepartmentId() || this.subjectForm.controls.departmentId.getRawValue() || 0;
    this.masters.getSubjects(departmentId > 0 ? departmentId : undefined).subscribe({
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
    const departmentId =
      this.selectedOfficeTypeDepartmentId() || this.officeTypeForm.controls.departmentId.getRawValue() || 0;
    this.masters.getOfficeTypes(departmentId > 0 ? departmentId : undefined).subscribe({
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
    const f = this.officeFilterForm.getRawValue();
    this.masters
      .getOffices({
        departmentId: f.departmentId > 0 ? f.departmentId : undefined,
        officeTypeId: f.officeTypeId > 0 ? f.officeTypeId : undefined,
        level: f.level || undefined,
        locationId: f.locationId > 0 ? f.locationId : undefined
      })
      .subscribe({
        next: (rows) => {
          this.offices.set(rows);
          this.page.set(1);
        },
        error: () => this.offices.set([])
      });
  }

  private resetOfficeLocationChain(): void {
    this.officeDivisions.set([]);
    this.officeDistricts.set([]);
    this.officeSubdistricts.set([]);
    this.officeTalukas.set([]);
    this.officeVillages.set([]);
    this.officeForm.controls.divisionId.setValue(0);
    this.officeForm.controls.districtId.setValue(0);
    this.officeForm.controls.subdistrictId.setValue(0);
    this.officeForm.controls.talukaId.setValue(0);
    this.officeForm.controls.villageId.setValue(0);
  }

  private resetOfficeFilterLocationChain(): void {
    this.officeDivisions.set([]);
    this.officeDistricts.set([]);
    this.officeSubdistricts.set([]);
    this.officeTalukas.set([]);
    this.officeVillages.set([]);
    this.officeFilterForm.controls.divisionId.setValue(0);
    this.officeFilterForm.controls.districtId.setValue(0);
    this.officeFilterForm.controls.subdistrictId.setValue(0);
    this.officeFilterForm.controls.talukaId.setValue(0);
    this.officeFilterForm.controls.villageId.setValue(0);
  }

  private loadOfficeLocationOptions(): void {
    const level = this.officeForm.controls.level.getRawValue();
    const stateId = this.hasFixedState ? environment.defaultState.id : this.officeForm.controls.stateId.getRawValue();
    if (!stateId || stateId < 1) return;
    if (level === 'STATE') {
      this.officeForm.controls.locationId.setValue(stateId);
      return;
    }
    this.masters.getDivisions(stateId).subscribe({
      next: (rows) => this.officeDivisions.set(rows),
      error: () => this.officeDivisions.set([])
    });
  }

  private loadOfficeFilterLocationOptions(): void {
    const level = this.officeFilterForm.controls.level.getRawValue();
    const stateId = this.hasFixedState ? environment.defaultState.id : this.officeFilterForm.controls.stateId.getRawValue();
    if (!stateId || stateId < 1) return;
    if (level === 'STATE') {
      this.officeFilterForm.controls.locationId.setValue(stateId);
      return;
    }
    this.masters.getDivisions(stateId).subscribe({
      next: (rows) => this.officeDivisions.set(rows),
      error: () => this.officeDivisions.set([])
    });
  }

  private loadOfficeDistricts(isFilter = false): void {
    const stateId = this.hasFixedState ? environment.defaultState.id : (isFilter ? this.officeFilterForm.controls.stateId.getRawValue() : this.officeForm.controls.stateId.getRawValue());
    const divisionId = isFilter ? this.officeFilterForm.controls.divisionId.getRawValue() : this.officeForm.controls.divisionId.getRawValue();
    if (!stateId || stateId < 1 || !divisionId || divisionId < 1) return;
    this.masters.getDistricts(stateId, divisionId).subscribe({
      next: (rows) => this.officeDistricts.set(rows),
      error: () => this.officeDistricts.set([])
    });
  }

  private loadOfficeSubdistricts(isFilter = false): void {
    const districtId = isFilter ? this.officeFilterForm.controls.districtId.getRawValue() : this.officeForm.controls.districtId.getRawValue();
    if (!districtId || districtId < 1) return;
    this.masters.getSubdistricts(districtId).subscribe({
      next: (rows) => this.officeSubdistricts.set(rows),
      error: () => this.officeSubdistricts.set([])
    });
  }

  private loadOfficeTalukas(isFilter = false): void {
    const districtId = isFilter ? this.officeFilterForm.controls.districtId.getRawValue() : this.officeForm.controls.districtId.getRawValue();
    const subdistrictId = isFilter ? this.officeFilterForm.controls.subdistrictId.getRawValue() : this.officeForm.controls.subdistrictId.getRawValue();
    if (!districtId || districtId < 1 || !subdistrictId || subdistrictId < 1) return;
    this.masters.getTalukas(districtId, subdistrictId).subscribe({
      next: (rows) => this.officeTalukas.set(rows),
      error: () => this.officeTalukas.set([])
    });
  }

  private loadOfficeVillages(isFilter = false): void {
    const talukaId = isFilter ? this.officeFilterForm.controls.talukaId.getRawValue() : this.officeForm.controls.talukaId.getRawValue();
    if (!talukaId || talukaId < 1) return;
    this.masters.getVillages(talukaId).subscribe({
      next: (rows) => this.officeVillages.set(rows),
      error: () => this.officeVillages.set([])
    });
  }

  private syncOfficeLocationId(): void {
    const level = this.officeForm.controls.level.getRawValue();
    const id =
      level === 'STATE'
        ? (this.hasFixedState ? environment.defaultState.id : this.officeForm.controls.stateId.getRawValue())
        : level === 'DIVISION'
          ? this.officeForm.controls.divisionId.getRawValue()
          : level === 'DISTRICT'
            ? this.officeForm.controls.districtId.getRawValue()
            : level === 'SUBDISTRICT'
              ? this.officeForm.controls.subdistrictId.getRawValue()
              : level === 'TALUKA'
                ? this.officeForm.controls.talukaId.getRawValue()
                : this.officeForm.controls.villageId.getRawValue();
    this.officeForm.controls.locationId.setValue(id || 0);
  }

  private syncOfficeFilterLocationId(): void {
    const level = this.officeFilterForm.controls.level.getRawValue();
    if (!level) {
      this.officeFilterForm.controls.locationId.setValue(0);
      return;
    }
    const id =
      level === 'STATE'
        ? (this.hasFixedState ? environment.defaultState.id : this.officeFilterForm.controls.stateId.getRawValue())
        : level === 'DIVISION'
          ? this.officeFilterForm.controls.divisionId.getRawValue()
          : level === 'DISTRICT'
            ? this.officeFilterForm.controls.districtId.getRawValue()
            : level === 'SUBDISTRICT'
              ? this.officeFilterForm.controls.subdistrictId.getRawValue()
              : level === 'TALUKA'
                ? this.officeFilterForm.controls.talukaId.getRawValue()
                : this.officeFilterForm.controls.villageId.getRawValue();
    this.officeFilterForm.controls.locationId.setValue(id || 0);
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
      level: raw.level,
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
      level: row.level,
      locationId: row.locationId,
      name: row.name,
      localName: row.localName || '',
      shortName: row.shortName || '',
      shortNameLocal: row.shortNameLocal || ''
    });
  }

  protected cancelEditOffice(): void {
    this.editingOfficeId.set(null);
    this.officeForm.reset({
      departmentId: 0,
      officeTypeId: 0,
      level: 'TALUKA',
      locationId: 0,
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

  protected applyOfficeFilters(): void {
    this.loadOffices();
  }

  protected clearOfficeFilters(): void {
    this.officeFilterForm.reset({ departmentId: 0, officeTypeId: 0, level: '', locationId: 0 });
    this.loadOffices();
  }

  private loadDesignations(): void {
    const deptId =
      this.designationFilterForm.controls.departmentId.getRawValue() ||
      this.designationForm.controls.departmentId.getRawValue();
    const departmentId = deptId > 0 ? deptId : undefined;
    this.masters.getDesignations(departmentId).subscribe({
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

  private loadEmployees(): void {
    const a = this.employeeFilterForm.controls.active.getRawValue();
    const active = a === '' ? undefined : a === 'true';
    this.masters.getEmployees(active).subscribe({
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
    this.loadEmployees();
  }

  protected clearEmployeeFilter(): void {
    this.employeeFilterForm.reset({ active: '' });
    this.loadEmployees();
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

  private loadDocumentMappingSubjects(): void {
    this.masters.getSubjects().subscribe({
      next: (rows) => this.mappingSubjects.set(rows),
      error: () => this.mappingSubjects.set([])
    });
  }

  protected loadDocumentTypeMappings(): void {
    this.apiMessage.set(null);
    this.apiError.set(null);

    this.documentTypeMappingForm.markAllAsTouched();
    if (this.documentTypeMappingForm.invalid) {
      this.apiError.set('Please select case category and subject.');
      return;
    }

    const raw = this.documentTypeMappingForm.getRawValue();
    this.busy.set(true);
    this.masters.getDocumentTypeMappings(raw.caseCategoryId, raw.subjectId).subscribe({
      next: (rows) => {
        this.documentTypeMappings.set(rows);
        this.apiMessage.set('Mapping loaded.');
      },
      error: (err: unknown) => this.apiError.set(this.formatError(err)),
      complete: () => this.busy.set(false)
    });
  }

  protected addDocumentTypeMappingItem(): void {
    this.apiMessage.set(null);
    this.apiError.set(null);
    this.documentTypeMappingItemForm.markAllAsTouched();
    if (this.documentTypeMappingItemForm.invalid) {
      this.apiError.set('Please enter valid document type item details.');
      return;
    }

    const raw = this.documentTypeMappingItemForm.getRawValue();
    if (this.documentTypeMappings().some((item) => item.documentTypeId === raw.documentTypeId)) {
      this.apiError.set('Duplicate document type is not allowed.');
      return;
    }

    const draftItem: DocumentTypeMappingItemRecord = {
      documentTypeId: raw.documentTypeId,
      required: raw.required,
      displayOrder: raw.displayOrder,
      documentType: {
        id: raw.documentTypeId,
        code: `DOC-${raw.documentTypeId}`,
        name: `Document Type #${raw.documentTypeId}`,
        localName: null,
        validForPhotoId: false,
        validForAddress: false,
        sourceUrl: null
      }
    };

    this.documentTypeMappings.set(
      [...this.documentTypeMappings(), draftItem].sort((a, b) => a.displayOrder - b.displayOrder)
    );
    this.documentTypeMappingItemForm.reset({ documentTypeId: 0, required: false, displayOrder: raw.displayOrder + 1 });
  }

  protected removeDocumentTypeMappingItem(documentTypeId: number): void {
    this.documentTypeMappings.set(this.documentTypeMappings().filter((item) => item.documentTypeId !== documentTypeId));
  }

  protected saveDocumentTypeMappings(): void {
    this.apiMessage.set(null);
    this.apiError.set(null);

    this.documentTypeMappingForm.markAllAsTouched();
    if (this.documentTypeMappingForm.invalid) {
      this.apiError.set('Please select case category and subject.');
      return;
    }

    const raw = this.documentTypeMappingForm.getRawValue();
    const items = this.documentTypeMappings().map((item) => ({
      documentTypeId: item.documentTypeId,
      required: item.required,
      displayOrder: item.displayOrder
    }));

    this.busy.set(true);
    this.masters
      .replaceDocumentTypeMappings({
        caseCategoryId: raw.caseCategoryId,
        subjectId: raw.subjectId,
        items
      })
      .subscribe({
        next: () => this.apiMessage.set('Mapping saved.'),
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
    this.loadDesignations();
  }

  protected clearDesignationFilter(): void {
    this.designationFilterForm.reset({ departmentId: 0 });
    this.loadDesignations();
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

  private departmentPayload(): CreateOrUpdateDepartmentRequest {
    const raw = this.departmentForm.getRawValue();
    return {
      name: raw.name,
      localName: raw.localName || undefined,
      lgdCode: raw.lgdCode || undefined,
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
      lgdCode: row.lgdCode || '',
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
      localName: '',
      lgdCode: ''
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
}

