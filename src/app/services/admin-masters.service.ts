import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface MasterRecord {
  id: number;
  name: string;
  localName: string | null;
  lgdCode: string | null;
  stateId: number | null;
  divisionId: number | null;
  districtId: number | null;
  subdistrictId?: number | null;
  talukaId: number | null;
}

export interface CreateStateRequest {
  name: string;
  localName?: string;
  lgdCode?: string;
}

export interface CreateDivisionRequest {
  name: string;
  localName?: string;
  lgdCode?: string;
  stateId: number;
}

export interface CreateDistrictRequest {
  name: string;
  localName?: string;
  lgdCode?: string;
  stateId: number;
  divisionId: number;
}

export interface CreateSubdistrictRequest {
  name: string;
  localName?: string;
  lgdCode?: string;
  districtId: number;
}

export interface CreateTalukaRequest {
  name: string;
  localName?: string;
  lgdCode?: string;
  districtId: number;
  subdistrictId: number;
}

export interface CreateVillageRequest {
  name: string;
  localName?: string;
  lgdCode?: string;
  talukaId: number;
}

export interface DepartmentRecord {
  id: number;
  name: string;
  localName: string | null;
  lgdCode: string | null;
  stateId: number;
}

export interface CreateOrUpdateDepartmentRequest {
  name: string;
  localName?: string;
  lgdCode?: string;
  stateId: number;
}

export interface DeleteResponse {
  deleted: boolean;
  id: number;
}

export interface ActRecord {
  id: number;
  actCode: string;
  actName: string;
  actNameLocal: string | null;
}

export interface CreateOrUpdateActRequest {
  actCode: string;
  actName: string;
  actNameLocal?: string;
}

export interface SectionRecord {
  id: number;
  actId: number;
  actCode: string;
  actName: string;
  actNameLocal: string | null;
  sectionCode: string;
  sectionName: string;
  sectionNameLocal: string | null;
}

export interface CreateOrUpdateSectionRequest {
  actId: number;
  sectionCode: string;
  sectionName: string;
  sectionNameLocal?: string;
}

export interface SubjectRecord {
  id: number;
  departmentId: number;
  departmentName: string | null;
  departmentLocalName: string | null;
  subjectCode: string;
  subjectName: string;
  subjectNameLocal: string | null;
}

export interface CreateOrUpdateSubjectRequest {
  departmentId: number;
  subjectCode: string;
  subjectName: string;
  subjectNameLocal?: string;
}

export interface OfficeTypeRecord {
  id: number;
  departmentId: number;
  departmentName: string | null;
  departmentLocalName: string | null;
  name: string;
  localName: string | null;
  shortName: string | null;
  shortNameLocal: string | null;
}

export interface CreateOrUpdateOfficeTypeRequest {
  departmentId: number;
  name: string;
  localName?: string;
  shortName?: string;
  shortNameLocal?: string;
}

export type OfficeLevel = 'STATE' | 'DIVISION' | 'DISTRICT' | 'SUBDISTRICT' | 'TALUKA' | 'VILLAGE';

export interface OfficeRecord {
  id: number;
  departmentId: number;
  officeTypeId: number;
  level: OfficeLevel;
  locationId: number;
  name: string;
  localName: string | null;
  shortName: string | null;
  shortNameLocal: string | null;
}

export interface CreateOrUpdateOfficeRequest {
  departmentId: number;
  officeTypeId: number;
  level: OfficeLevel;
  locationId: number;
  name: string;
  localName?: string;
  shortName?: string;
  shortNameLocal?: string;
}

export interface DesignationRecord {
  id: number;
  departmentId: number;
  departmentName: string | null;
  departmentLocalName: string | null;
  name: string;
  localName: string | null;
  shortName: string | null;
  shortNameLocal: string | null;
}

export interface CreateOrUpdateDesignationRequest {
  departmentId: number;
  name: string;
  localName?: string;
  shortName?: string;
  shortNameLocal?: string;
}

export interface EmployeeRecord {
  id: number;
  employeeCode: string;
  fullName: string;
  fullNameLocal: string | null;
  mobile: string;
  email: string;
  isActive: boolean;
}

export interface CreateEmployeeRequest {
  employeeCode: string;
  fullName: string;
  fullNameLocal?: string;
  mobile: string;
  email: string;
}

export interface UpdateEmployeeRequest extends CreateEmployeeRequest {
  isActive: boolean;
}

export interface EmployeePostingRecord {
  id: number;
  employeeId: number;
  officeId: number;
  officeName: string;
  officeBranchId: number | null;
  officeBranchName: string | null;
  designationId: number;
  designationName: string;
  fromDate: string; // yyyy-MM-dd
  toDate: string | null; // yyyy-MM-dd
}

export interface CreateEmployeePostingRequest {
  officeId: number;
  officeBranchId?: number;
  designationId: number;
  fromDate: string; // yyyy-MM-dd
}

export interface OfficeBranchRecord {
  id: number;
  officeId: number;
  name: string;
  localName: string | null;
  shortName: string | null;
  shortNameLocal: string | null;
}

export interface DocumentTypeRecord {
  id: number;
  code: string;
  name: string;
  localName: string | null;
  validForPhotoId: boolean;
  validForAddress: boolean;
  sourceUrl: string | null;
}

export interface DocumentTypeMappingItemRecord {
  documentTypeId: number;
  required: boolean;
  displayOrder: number;
  documentType: DocumentTypeRecord;
}

export interface ReplaceDocumentTypeMappingsRequest {
  caseCategoryId: number;
  subjectId: number;
  items: Array<{
    documentTypeId: number;
    required: boolean;
    displayOrder: number;
  }>;
}

export interface MessageResponse {
  message: string;
}

export interface ClosePostingRequest {
  toDate: string; // yyyy-MM-dd
}

@Injectable({
  providedIn: 'root'
})
export class AdminMastersService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  createState(payload: CreateStateRequest): Observable<MasterRecord> {
    return this.http.post<MasterRecord>(`${this.apiBaseUrl}/api/admin/masters/states`, payload);
  }

  createDivision(payload: CreateDivisionRequest): Observable<MasterRecord> {
    return this.http.post<MasterRecord>(`${this.apiBaseUrl}/api/admin/masters/divisions`, payload);
  }

  createDistrict(payload: CreateDistrictRequest): Observable<MasterRecord> {
    return this.http.post<MasterRecord>(`${this.apiBaseUrl}/api/admin/masters/districts`, payload);
  }

  createSubdistrict(payload: CreateSubdistrictRequest): Observable<MasterRecord> {
    return this.http.post<MasterRecord>(`${this.apiBaseUrl}/api/admin/masters/subdistricts`, payload);
  }

  createTaluka(payload: CreateTalukaRequest): Observable<MasterRecord> {
    return this.http.post<MasterRecord>(`${this.apiBaseUrl}/api/admin/masters/talukas`, payload);
  }

  createVillage(payload: CreateVillageRequest): Observable<MasterRecord> {
    return this.http.post<MasterRecord>(`${this.apiBaseUrl}/api/admin/masters/villages`, payload);
  }

  createDepartment(payload: CreateOrUpdateDepartmentRequest): Observable<DepartmentRecord> {
    return this.http.post<DepartmentRecord>(`${this.apiBaseUrl}/api/admin/masters/departments`, payload);
  }

  getDepartments(): Observable<DepartmentRecord[]> {
    return this.http.get<DepartmentRecord[]>(`${this.apiBaseUrl}/api/admin/masters/departments`);
  }

  updateDepartment(id: number, payload: CreateOrUpdateDepartmentRequest): Observable<DepartmentRecord> {
    return this.http.put<DepartmentRecord>(`${this.apiBaseUrl}/api/admin/masters/departments/${id}`, payload);
  }

  deleteDepartment(id: number): Observable<DeleteResponse> {
    return this.http.delete<DeleteResponse>(`${this.apiBaseUrl}/api/admin/masters/departments/${id}`);
  }

  createAct(payload: CreateOrUpdateActRequest): Observable<ActRecord> {
    return this.http.post<ActRecord>(`${this.apiBaseUrl}/api/admin/masters/acts`, payload);
  }

  getActs(): Observable<ActRecord[]> {
    return this.http.get<ActRecord[]>(`${this.apiBaseUrl}/api/admin/masters/acts`);
  }

  updateAct(id: number, payload: CreateOrUpdateActRequest): Observable<ActRecord> {
    return this.http.put<ActRecord>(`${this.apiBaseUrl}/api/admin/masters/acts/${id}`, payload);
  }

  deleteAct(id: number): Observable<DeleteResponse> {
    return this.http.delete<DeleteResponse>(`${this.apiBaseUrl}/api/admin/masters/acts/${id}`);
  }

  createSection(payload: CreateOrUpdateSectionRequest): Observable<SectionRecord> {
    return this.http.post<SectionRecord>(`${this.apiBaseUrl}/api/admin/masters/sections`, payload);
  }

  getSections(actId?: number): Observable<SectionRecord[]> {
    return this.http.get<SectionRecord[]>(`${this.apiBaseUrl}/api/admin/masters/sections`, {
      params: actId ? { actId } : {}
    });
  }

  updateSection(id: number, payload: CreateOrUpdateSectionRequest): Observable<SectionRecord> {
    return this.http.put<SectionRecord>(`${this.apiBaseUrl}/api/admin/masters/sections/${id}`, payload);
  }

  deleteSection(id: number): Observable<DeleteResponse> {
    return this.http.delete<DeleteResponse>(`${this.apiBaseUrl}/api/admin/masters/sections/${id}`);
  }

  createSubject(payload: CreateOrUpdateSubjectRequest): Observable<SubjectRecord> {
    return this.http.post<SubjectRecord>(`${this.apiBaseUrl}/api/admin/masters/subjects`, payload);
  }

  getSubjects(departmentId?: number): Observable<SubjectRecord[]> {
    return this.http.get<SubjectRecord[]>(`${this.apiBaseUrl}/api/admin/masters/subjects`, {
      params: departmentId ? { departmentId } : {}
    });
  }

  updateSubject(id: number, payload: CreateOrUpdateSubjectRequest): Observable<SubjectRecord> {
    return this.http.put<SubjectRecord>(`${this.apiBaseUrl}/api/admin/masters/subjects/${id}`, payload);
  }

  deleteSubject(id: number): Observable<DeleteResponse> {
    return this.http.delete<DeleteResponse>(`${this.apiBaseUrl}/api/admin/masters/subjects/${id}`);
  }

  createOfficeType(payload: CreateOrUpdateOfficeTypeRequest): Observable<OfficeTypeRecord> {
    return this.http.post<OfficeTypeRecord>(`${this.apiBaseUrl}/api/admin/masters/office-types`, payload);
  }

  getOfficeTypes(departmentId?: number): Observable<OfficeTypeRecord[]> {
    return this.http.get<OfficeTypeRecord[]>(`${this.apiBaseUrl}/api/admin/masters/office-types`, {
      params: departmentId ? { departmentId } : {}
    });
  }

  updateOfficeType(id: number, payload: CreateOrUpdateOfficeTypeRequest): Observable<OfficeTypeRecord> {
    return this.http.put<OfficeTypeRecord>(`${this.apiBaseUrl}/api/admin/masters/office-types/${id}`, payload);
  }

  deleteOfficeType(id: number): Observable<DeleteResponse> {
    return this.http.delete<DeleteResponse>(`${this.apiBaseUrl}/api/admin/masters/office-types/${id}`);
  }

  createOffice(payload: CreateOrUpdateOfficeRequest): Observable<OfficeRecord> {
    return this.http.post<OfficeRecord>(`${this.apiBaseUrl}/api/admin/masters/offices`, payload);
  }

  getOffices(filters?: {
    departmentId?: number;
    officeTypeId?: number;
    level?: OfficeLevel;
    locationId?: number;
  }): Observable<OfficeRecord[]> {
    const params: Record<string, string | number> = {};
    if (filters?.departmentId) params['departmentId'] = filters.departmentId;
    if (filters?.officeTypeId) params['officeTypeId'] = filters.officeTypeId;
    if (filters?.level) params['level'] = filters.level;
    if (filters?.locationId) params['locationId'] = filters.locationId;
    return this.http.get<OfficeRecord[]>(`${this.apiBaseUrl}/api/admin/masters/offices`, { params });
  }

  updateOffice(id: number, payload: CreateOrUpdateOfficeRequest): Observable<OfficeRecord> {
    return this.http.put<OfficeRecord>(`${this.apiBaseUrl}/api/admin/masters/offices/${id}`, payload);
  }

  deleteOffice(id: number): Observable<DeleteResponse> {
    return this.http.delete<DeleteResponse>(`${this.apiBaseUrl}/api/admin/masters/offices/${id}`);
  }

  createDesignation(payload: CreateOrUpdateDesignationRequest): Observable<DesignationRecord> {
    return this.http.post<DesignationRecord>(`${this.apiBaseUrl}/api/admin/masters/designations`, payload);
  }

  getDesignations(departmentId?: number): Observable<DesignationRecord[]> {
    return this.http.get<DesignationRecord[]>(`${this.apiBaseUrl}/api/admin/masters/designations`, {
      params: departmentId ? { departmentId } : {}
    });
  }

  updateDesignation(id: number, payload: CreateOrUpdateDesignationRequest): Observable<DesignationRecord> {
    return this.http.put<DesignationRecord>(`${this.apiBaseUrl}/api/admin/masters/designations/${id}`, payload);
  }

  deleteDesignation(id: number): Observable<DeleteResponse> {
    return this.http.delete<DeleteResponse>(`${this.apiBaseUrl}/api/admin/masters/designations/${id}`);
  }

  createEmployee(payload: CreateEmployeeRequest): Observable<EmployeeRecord> {
    return this.http.post<EmployeeRecord>(`${this.apiBaseUrl}/api/admin/employees`, payload);
  }

  getEmployees(active?: boolean): Observable<EmployeeRecord[]> {
    return this.http.get<EmployeeRecord[]>(`${this.apiBaseUrl}/api/admin/employees`, {
      params: active === undefined ? {} : { active }
    });
  }

  updateEmployee(id: number, payload: UpdateEmployeeRequest): Observable<EmployeeRecord> {
    return this.http.put<EmployeeRecord>(`${this.apiBaseUrl}/api/admin/employees/${id}`, payload);
  }

  addEmployeePosting(employeeId: number, payload: CreateEmployeePostingRequest): Observable<EmployeePostingRecord> {
    return this.http.post<EmployeePostingRecord>(
      `${this.apiBaseUrl}/api/admin/employees/${employeeId}/postings`,
      payload
    );
  }

  getEmployeePostings(employeeId: number): Observable<EmployeePostingRecord[]> {
    return this.http.get<EmployeePostingRecord[]>(`${this.apiBaseUrl}/api/admin/employees/${employeeId}/postings`);
  }

  closeEmployeePosting(postingId: number, payload: ClosePostingRequest): Observable<EmployeePostingRecord> {
    return this.http.post<EmployeePostingRecord>(
      `${this.apiBaseUrl}/api/admin/employees/postings/${postingId}/close`,
      payload
    );
  }

  getOfficeBranches(officeId: number): Observable<OfficeBranchRecord[]> {
    return this.http.get<OfficeBranchRecord[]>(`${this.apiBaseUrl}/api/admin/offices/${officeId}/branches`);
  }

  getOfficeBranch(branchId: number): Observable<OfficeBranchRecord> {
    return this.http.get<OfficeBranchRecord>(`${this.apiBaseUrl}/api/admin/branches/${branchId}`);
  }

  getDocumentTypeMappings(
    caseCategoryId: number,
    subjectId: number
  ): Observable<DocumentTypeMappingItemRecord[]> {
    return this.http.get<DocumentTypeMappingItemRecord[]>(`${this.apiBaseUrl}/api/admin/document-type-mappings`, {
      params: { caseCategoryId, subjectId }
    });
  }

  replaceDocumentTypeMappings(payload: ReplaceDocumentTypeMappingsRequest): Observable<MessageResponse> {
    return this.http.put<MessageResponse>(`${this.apiBaseUrl}/api/admin/document-type-mappings`, payload);
  }

  getDocumentTypesForCaseCategorySubject(
    caseCategoryId: number,
    subjectId: number
  ): Observable<DocumentTypeRecord[]> {
    return this.http.get<DocumentTypeRecord[]>(`${this.apiBaseUrl}/api/document-types/by-case-category-subject`, {
      params: { caseCategoryId, subjectId }
    });
  }

  getStates(): Observable<MasterRecord[]> {
    return this.http.get<MasterRecord[]>(`${this.apiBaseUrl}/api/admin/masters/states`);
  }

  getDivisions(stateId: number): Observable<MasterRecord[]> {
    return this.http.get<MasterRecord[]>(`${this.apiBaseUrl}/api/admin/masters/divisions`, {
      params: { stateId }
    });
  }

  getDistricts(stateId: number, divisionId: number): Observable<MasterRecord[]> {
    return this.http.get<MasterRecord[]>(`${this.apiBaseUrl}/api/admin/masters/districts`, {
      params: { stateId, divisionId }
    });
  }

  getSubdistricts(districtId: number): Observable<MasterRecord[]> {
    return this.http.get<MasterRecord[]>(`${this.apiBaseUrl}/api/admin/masters/subdistricts`, {
      params: { districtId }
    });
  }

  getTalukas(districtId: number, subdistrictId?: number): Observable<MasterRecord[]> {
    return this.http.get<MasterRecord[]>(`${this.apiBaseUrl}/api/admin/masters/talukas`, {
      params: subdistrictId ? { districtId, subdistrictId } : { districtId }
    });
  }

  getVillages(talukaId: number): Observable<MasterRecord[]> {
    return this.http.get<MasterRecord[]>(`${this.apiBaseUrl}/api/admin/masters/villages`, {
      params: { talukaId }
    });
  }
}

