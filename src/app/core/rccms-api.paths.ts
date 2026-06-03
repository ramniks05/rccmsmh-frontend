/**
 * RCCMS HTTP API paths — keep in sync with backend OpenAPI / integration docs.
 * Base URL: environment.apiBaseUrl (e.g. http://localhost:8080)
 */

export const RCCMS_API = {
  files: {
    upload: '/api/files/upload',
    download: '/api/files/download'
  },
  filingApplications: {
    save: '/api/filing-applications/save',
    mine: '/api/filing-applications/mine',
    preview: (applicationId: number) => `/api/filing-applications/${applicationId}/preview`,
    history: (applicationId: number) => `/api/filing-applications/${applicationId}/history`,
    officerInbox: '/api/filing-applications/officer/inbox',
    officerPreview: (applicationId: number) =>
      `/api/filing-applications/officer/${applicationId}/preview`,
    officerDetail: (applicationId: number) => `/api/filing-applications/officer/${applicationId}`,
    officerHistory: (applicationId: number) =>
      `/api/filing-applications/officer/${applicationId}/history`,
    officerDocumentChecklist: (applicationId: number) =>
      `/api/filing-applications/officer/${applicationId}/document-checklist`
  },
  documentTypes: {
    byCaseCategorySubject: '/api/document-types/by-case-category-subject'
  }
} as const;

/** POST /api/files/upload — category for application mapped documents. */
export const FILING_ATTACHMENT_UPLOAD_CATEGORY = 'filing-attachment';

/** rccms.files.max-size-bytes (5 MB). */
export const FILE_UPLOAD_MAX_BYTES = 5_242_880;
