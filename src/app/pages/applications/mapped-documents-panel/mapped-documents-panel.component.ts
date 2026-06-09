import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import {
  DocumentChecklist,
  DocumentChecklistItem,
  DocumentChecklistSaveEntry,
  FilingMappedAttachment,
  MappedDocumentType,
  MappedDocumentsService
} from '../../../services/mapped-documents.service';
import { FILE_UPLOAD_MAX_BYTES, FILING_ATTACHMENT_UPLOAD_CATEGORY } from '../../../core/rccms-api.paths';
import { FileUploadService } from '../../../services/file-upload.service';
import {
  DomSanitizer,
  SafeResourceUrl
} from '@angular/platform-browser';

const ALLOWED_FILING_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png'
]);
const ALLOWED_FILING_EXT = /\.(pdf|jpe?g|png)$/i;

export type MappedDocumentsPanelMode = 'applicant' | 'clerk' | 'readonly';

interface ApplicantUploadState {
  storageKey: string;
  fileName: string;
  mimeType: string;
}

interface ClerkRowState {
  clerkVerified: boolean | null;
  clerkRemarks: string;
}

@Component({
  selector: 'app-mapped-documents-panel',
  imports: [],
  templateUrl: './mapped-documents-panel.component.html',
  styleUrl: './mapped-documents-panel.component.css'
})
export class MappedDocumentsPanelComponent {
  private readonly mappedDocs = inject(MappedDocumentsService);
  private readonly fileUpload = inject(FileUploadService);

  readonly mode = input<MappedDocumentsPanelMode>('applicant');
  readonly caseCategoryId = input(0);
  readonly subjectId = input(0);
  readonly applicationId = input<number | null>(null);
  readonly initialAttachments = input<FilingMappedAttachment[]>([]);

  readonly attachmentsChange = output<FilingMappedAttachment[]>();
  readonly checklistLoaded = output<DocumentChecklist | null>();

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploadBusyId = signal<number | null>(null);
  protected readonly viewBusyId = signal<number | null>(null);
  protected readonly previewDocId = signal<number | null>(null);
  protected readonly previewBlobUrls = signal<Record<number, string>>({});
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);

  protected readonly requiredDocuments = signal<MappedDocumentType[]>([]);
  protected readonly checklist = signal<DocumentChecklist | null>(null);
  protected readonly applicantUploads = signal<Record<number, ApplicantUploadState>>({});
  private readonly clerkRows = signal<Record<number, ClerkRowState>>({});

  protected readonly sortedRequiredDocuments = computed(() =>
    [...this.requiredDocuments()].sort((a, b) => a.displayOrder - b.displayOrder)
  );

  protected readonly sortedChecklistItems = computed(() => {
    const items = this.checklist()?.items ?? [];
    return [...items].sort((a, b) => a.displayOrder - b.displayOrder);
  });

  protected readonly allRequiredUploaded = computed(() => {
    if (this.mode() === 'applicant') {
      const docs = this.sortedRequiredDocuments().filter((d) => d.required);
      if (!docs.length) return true;
      const uploads = this.applicantUploads();
      return docs.every((d) => !!uploads[d.id]?.storageKey);
    }
    return this.checklist()?.allRequiredUploaded ?? false;
  });

  protected readonly allRequiredClerkVerified = computed(
    () => this.checklist()?.allRequiredClerkVerified ?? false
  );

  private readonly sanitizer = inject(DomSanitizer);

  constructor() {
    effect(() => {
      const mode = this.mode();
      const categoryId = this.caseCategoryId();
      const subjectId = this.subjectId();
      const appId = this.applicationId();
      if (mode === 'applicant' && categoryId > 0 && subjectId > 0) {
        this.loadRequiredDocuments(categoryId, subjectId);
      } else if ((mode === 'clerk' || mode === 'readonly') && appId && appId > 0) {
        this.loadChecklist(appId);
      }
    });

    effect(() => {
      if (this.mode() !== 'applicant') return;
      const initial = this.initialAttachments();
      if (!initial.length) return;
      const map: Record<number, ApplicantUploadState> = {};
      for (const att of initial) {
        if (att.documentTypeId > 0 && att.storageKey) {
          map[att.documentTypeId] = {
            storageKey: att.storageKey,
            fileName: att.fileName,
            mimeType: att.mimeType
          };
        }
      }
      this.applicantUploads.set(map);
    });
  }

  protected loadRequiredDocuments(categoryId: number, subjectId: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.mappedDocs
      .getRequiredDocuments(categoryId, subjectId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (rows) => {
          this.requiredDocuments.set(rows ?? []);
          if (!rows?.length) {
            this.message.set('No documents are configured for this case category and subject.');
          } else {
            this.message.set(null);
          }
          this.emitApplicantAttachments();
        },
        error: (err: unknown) => {
          this.requiredDocuments.set([]);
          this.error.set(this.formatError(err));
        }
      });
  }

  protected loadChecklist(applicationId: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.mappedDocs
      .getDocumentChecklist(applicationId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          this.checklist.set(resp);
          this.checklistLoaded.emit(resp);
          const rows: Record<number, ClerkRowState> = {};
          for (const item of resp.items ?? []) {
            rows[item.documentTypeId] = {
              clerkVerified: item.clerkVerified ?? null,
              clerkRemarks: item.clerkRemarks ?? ''
            };
          }
          this.clerkRows.set(rows);
        },
        error: (err: unknown) => {
          this.checklist.set(null);
          this.checklistLoaded.emit(null);
          this.error.set(this.formatError(err));
        }
      });
  }

  protected onApplicantFileSelected(doc: MappedDocumentType, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const validationError = this.validateFilingUploadFile(file);
    if (validationError) {
      this.error.set(validationError);
      return;
    }
    this.error.set(null);

    // Revoke old preview if exists
    const prevUrl = this.previewBlobUrls()[doc.id];
    if (prevUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(prevUrl);
    }

    // Create preview instantly (works for image + pdf)
    const previewUrl = URL.createObjectURL(file);

    this.previewBlobUrls.update((m) => ({
      ...m,
      [doc.id]: previewUrl
    }));

    // Open preview automatically
    this.previewDocId.set(doc.id);

    this.uploadBusyId.set(doc.id);
    this.fileUpload
      .upload(file, FILING_ATTACHMENT_UPLOAD_CATEGORY)
      .pipe(finalize(() => this.uploadBusyId.set(null)))
      .subscribe({
        next: (resp) => {
          if (!resp.storageKey) {
            this.error.set('Upload did not return a storage key.');
            return;
          }
          this.applicantUploads.update((prev) => ({
            ...prev,
            [doc.id]: {
              storageKey: resp.storageKey,
              fileName: resp.fileName || file.name,
              mimeType: resp.mimeType || file.type || 'application/octet-stream'
            }
          }));
          this.emitApplicantAttachments();
          this.message.set(`${doc.name} uploaded.`);
        },
        error: (err: unknown) => {
          // cleanup preview if upload fails
          const failedPreview = this.previewBlobUrls()[doc.id];
          if (failedPreview?.startsWith('blob:')) {
            URL.revokeObjectURL(failedPreview);
          }

          this.previewBlobUrls.update((m) => {
            const next = { ...m };
            delete next[doc.id];
            return next;
          });

          this.previewDocId.set(null);
          this.error.set(this.formatError(err));
        }
      });
  }

  protected removeApplicantUpload(documentTypeId: number): void {
    const previewUrl = this.previewBlobUrls()[documentTypeId];
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    this.previewBlobUrls.update((m) => {
      const next = { ...m };
      delete next[documentTypeId];
      return next;
    });
    if (this.previewDocId() === documentTypeId) {
      this.previewDocId.set(null);
    }
    this.applicantUploads.update((prev) => {
      const next = { ...prev };
      delete next[documentTypeId];
      return next;
    });
    this.emitApplicantAttachments();
  }

  protected applicantUpload(documentTypeId: number): ApplicantUploadState | undefined {
    return this.applicantUploads()[documentTypeId];
  }

  protected isPreviewOpen(documentTypeId: number): boolean {
    return this.previewDocId() === documentTypeId;
  }

  protected isImageMime(mimeType: string): boolean {
    return mimeType.toLowerCase().startsWith('image/');
  }

  protected isPdfMime(mimeType: string, fileName: string): boolean {
    if (mimeType.toLowerCase() === 'application/pdf') return true;
    return fileName.toLowerCase().endsWith('.pdf');
  }

  protected previewUrl(
    documentTypeId: number
  ): string | SafeResourceUrl | null {
    const url = this.previewBlobUrls()[documentTypeId];

    if (!url) return null;

    const up = this.applicantUploads()[documentTypeId];

    // sanitize for PDF iframe
    if (up && this.isPdfMime(up.mimeType, up.fileName)) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    // normal string for images
    return url;
  }

  protected viewApplicantUpload(documentTypeId: number): void {
    const up = this.applicantUploads()[documentTypeId];
    if (!up?.storageKey) return;

    if (this.previewDocId() === documentTypeId) {
      this.previewDocId.set(null);
      return;
    }

    this.previewDocId.set(documentTypeId);
    const cached = this.previewBlobUrls()[documentTypeId];
    if (cached) return;

    const inline =
      this.isImageMime(up.mimeType) || this.isPdfMime(up.mimeType, up.fileName);
    this.viewBusyId.set(documentTypeId);
    this.fileUpload
      .download(up.storageKey, { fileName: up.fileName, inline })
      .pipe(finalize(() => this.viewBusyId.set(null)))
      .subscribe({
        next: (blob) => {
          const prev = this.previewBlobUrls()[documentTypeId];
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
          this.previewBlobUrls.update((m) => ({
            ...m,
            [documentTypeId]: URL.createObjectURL(blob)
          }));
        },
        error: () => {
          this.previewDocId.set(null);
          this.error.set('Could not load document preview.');
        }
      });
  }

  validateApplicantForSubmit(): string | null {
    const missing = this.sortedRequiredDocuments()
      .filter((d) => d.required && !this.applicantUploads()[d.id]?.storageKey)
      .map((d) => d.name);
    if (!missing.length) return null;
    return `Upload required documents: ${missing.join(', ')}`;
  }

  protected buildApplicantAttachments(): FilingMappedAttachment[] {
    return Object.entries(this.applicantUploads())
      .filter(([, v]) => v.storageKey)
      .map(([id, v]) => ({
        documentTypeId: Number(id),
        storageKey: v.storageKey,
        fileName: v.fileName,
        mimeType: v.mimeType
      }));
  }

  private emitApplicantAttachments(): void {
    this.attachmentsChange.emit(this.buildApplicantAttachments());
  }

  protected clerkRow(documentTypeId: number): ClerkRowState {
    return this.clerkRows()[documentTypeId] ?? { clerkVerified: null, clerkRemarks: '' };
  }

  protected setClerkVerified(documentTypeId: number, verified: boolean): void {
    this.clerkRows.update((prev) => ({
      ...prev,
      [documentTypeId]: {
        clerkVerified: verified,
        clerkRemarks: prev[documentTypeId]?.clerkRemarks ?? ''
      }
    }));
  }

  protected onClerkRemarksChange(documentTypeId: number, remarks: string): void {
    this.clerkRows.update((prev) => ({
      ...prev,
      [documentTypeId]: {
        clerkVerified: prev[documentTypeId]?.clerkVerified ?? null,
        clerkRemarks: remarks
      }
    }));
  }

  protected saveClerkChecklist(): void {
    const appId = this.applicationId();
    if (!appId) return;

    const items = this.sortedChecklistItems();
    const entries: DocumentChecklistSaveEntry[] = [];
    for (const item of items) {
      const row = this.clerkRow(item.documentTypeId);
      if (!item.uploaded) continue;
      if (row.clerkVerified === null) {
        this.error.set(`Mark clerk verification (yes/no) for: ${item.documentType.name}`);
        return;
      }
      entries.push({
        documentTypeId: item.documentTypeId,
        clerkVerified: row.clerkVerified,
        clerkRemarks: row.clerkRemarks.trim() || undefined
      });
    }

    this.saving.set(true);
    this.error.set(null);
    this.mappedDocs
      .saveDocumentChecklist(appId, entries)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (resp) => {
          this.checklist.set(resp);
          this.checklistLoaded.emit(resp);
          const rows: Record<number, ClerkRowState> = {};
          for (const item of resp.items ?? []) {
            rows[item.documentTypeId] = {
              clerkVerified: item.clerkVerified ?? null,
              clerkRemarks: item.clerkRemarks ?? ''
            };
          }
          this.clerkRows.set(rows);
          this.message.set('Document checklist saved.');
        },
        error: (err: unknown) => this.error.set(this.formatError(err))
      });
  }

  protected documentLabel(item: DocumentChecklistItem): string {
    return item.documentType?.name || `Document #${item.documentTypeId}`;
  }

  private validateFilingUploadFile(file: File): string | null {
    if (file.size > FILE_UPLOAD_MAX_BYTES) {
      return 'File is too large. Maximum size is 5 MB.';
    }
    const mime = (file.type || '').toLowerCase();
    if (mime && ALLOWED_FILING_MIME.has(mime)) return null;
    if (ALLOWED_FILING_EXT.test(file.name)) return null;
    return 'Only PDF, JPG, JPEG, or PNG files are allowed.';
  }

  private formatError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { error?: string; message?: string } | null;
      if (body?.error) return body.error;
      if (body?.message) return body.message;
      return `Request failed (${err.status}).`;
    }
    return 'Request failed.';
  }
}
