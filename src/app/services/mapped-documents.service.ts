import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface MappedDocumentType {
  id: number;
  code: string;
  name: string;
  localName: string | null;
  validForPhotoId?: boolean;
  validForAddress?: boolean;
  sourceUrl?: string | null;
  required: boolean;
  displayOrder: number;
}

export interface FilingMappedAttachment {
  documentTypeId: number;
  storageKey: string;
  fileName: string;
  mimeType: string;
}

export interface DocumentChecklistDocumentType {
  id: number;
  code: string;
  name: string;
  localName?: string | null;
  validForPhotoId?: boolean;
  validForAddress?: boolean;
  sourceUrl?: string | null;
}

export interface DocumentChecklistItem {
  checklistId?: number | null;
  documentTypeId: number;
  documentType: DocumentChecklistDocumentType;
  required: boolean;
  displayOrder: number;
  uploaded: boolean;
  attachmentId?: number | null;
  fileName?: string | null;
  storageKey?: string | null;
  clerkVerified?: boolean | null;
  clerkVerifiedByLoginId?: string | null;
  clerkVerifiedAt?: string | null;
  clerkRemarks?: string | null;
}

export interface DocumentChecklist {
  applicationId: number;
  caseCategoryId: number;
  subjectId: number;
  documentsConfigured: boolean;
  allRequiredUploaded: boolean;
  allRequiredClerkVerified: boolean;
  items: DocumentChecklistItem[];
}

export interface DocumentChecklistSaveEntry {
  documentTypeId: number;
  clerkVerified: boolean;
  clerkRemarks?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MappedDocumentsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  getRequiredDocuments(caseCategoryId: number, subjectId: number): Observable<MappedDocumentType[]> {
    return this.http.get<MappedDocumentType[]>(
      `${this.apiBaseUrl}/api/document-types/by-case-category-subject`,
      { params: { caseCategoryId: String(caseCategoryId), subjectId: String(subjectId) } }
    );
  }

  getDocumentChecklist(applicationId: number): Observable<DocumentChecklist> {
    return this.http.get<DocumentChecklist>(
      `${this.apiBaseUrl}/api/filing-applications/officer/${applicationId}/document-checklist`
    );
  }

  saveDocumentChecklist(
    applicationId: number,
    entries: DocumentChecklistSaveEntry[]
  ): Observable<DocumentChecklist> {
    return this.http.put<DocumentChecklist>(
      `${this.apiBaseUrl}/api/filing-applications/officer/${applicationId}/document-checklist`,
      { entries }
    );
  }
}
