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
import { FileUploadService } from '../../../services/file-upload.service';

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

    this.uploadBusyId.set(doc.id);
    this.error.set(null);
    this.fileUpload
      .upload(file, 'filing')
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
              mimeType: file.type || 'application/octet-stream'
            }
          }));
          this.emitApplicantAttachments();
          this.message.set(`${doc.name} uploaded.`);
        },
        error: (err: unknown) => this.error.set(this.formatError(err))
      });
  }

  protected removeApplicantUpload(documentTypeId: number): void {
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
