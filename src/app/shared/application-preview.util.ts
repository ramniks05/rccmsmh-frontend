import { environment } from '../../environments/environment';
import {
  ApplicationPreviewApplication,
  ApplicationPreviewResponse
} from '../services/filing-application.service';

export function pickStr(obj: Record<string, unknown> | null | undefined, ...keys: string[]): string {
  if (!obj) return '';
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

export function toRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((x) => x != null && typeof x === 'object') as Array<Record<string, unknown>>;
  }
  return [];
}

export function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Unwrap `{ application, ... }` or nested `data` envelopes from preview APIs. */
export function normalizeApplicationPreviewResponse(raw: unknown): ApplicationPreviewResponse {
  const root = toRecord(raw) ?? {};
  const inner =
    toRecord(root['data']) ??
    toRecord(root['payload']) ??
    toRecord(root['result']) ??
    root;

  const appRaw = toRecord(inner['application']) ?? inner;
  const form = toRecord(appRaw['form']) ?? {};

  const applicants =
    toRecordArray(appRaw['applicants']).length > 0
      ? toRecordArray(appRaw['applicants'])
      : toRecordArray(form['applicants']);

  const respondents =
    toRecordArray(appRaw['respondents']).length > 0
      ? toRecordArray(appRaw['respondents'])
      : toRecordArray(form['respondents']);

  const disputedLands =
    toRecordArray(appRaw['disputedLands']).length > 0
      ? toRecordArray(appRaw['disputedLands'])
      : toRecordArray(form['disputedLands']);

  const attachments =
    toRecordArray(appRaw['attachments']).length > 0
      ? toRecordArray(appRaw['attachments'])
      : toRecordArray(form['attachments']);

  const disputedOrder =
    toRecord(appRaw['disputedOrder']) ??
    (form['searchMode'] != null || form['mutationDetails'] != null
      ? {
          searchMode: form['searchMode'],
          searchValue: form['searchValue'],
          mutationFound: form['mutationFound'],
          mutationSearched: form['mutationSearched'] ?? form['searchedMutation'],
          mutationDetails: form['mutationDetails'],
          manualInwardNumber: form['manualInwardNumber'],
          manualInwardDate: form['manualInwardDate'],
          manualMutationType: form['manualMutationType'],
          manualApplicantName: form['manualApplicantName'],
          manualVillage: form['manualVillage'],
          manualStatus: form['manualStatus'],
          notice9Resolved: form['notice9Resolved']
        }
      : null);

  const descRoot = toRecord(appRaw['description']);
  const description =
    descRoot ??
    (form['descriptionParagraphs'] || form['affidavitText'] || form['prayerText']
      ? {
          paragraphs: form['descriptionParagraphs'],
          affidavitText: form['affidavitText'],
          prayerText: form['prayerText']
        }
      : null);

  const application: ApplicationPreviewApplication = {
    applicationId: Number(appRaw['applicationId'] ?? 0),
    applicationNo: String(appRaw['applicationNo'] ?? ''),
    clientApplicationRef: pickStr(appRaw, 'clientApplicationRef'),
    caseId: (appRaw['caseId'] as number | null) ?? null,
    caseNo: (appRaw['caseNo'] as string | null) ?? null,
    caseCategoryId: Number(appRaw['caseCategoryId'] ?? 0) || undefined,
    caseCategoryName: pickStr(appRaw, 'caseCategoryName'),
    status: String(appRaw['status'] ?? ''),
    processingStage: pickStr(appRaw, 'processingStage'),
    processingStageLabel: pickStr(appRaw, 'processingStageLabel'),
    currentAssigneeRole: pickStr(appRaw, 'currentAssigneeRole'),
    officeId: Number(appRaw['officeId'] ?? 0) || undefined,
    officeName: pickStr(appRaw, 'officeName'),
    subjectId: Number(appRaw['subjectId'] ?? 0) || undefined,
    subjectName: pickStr(appRaw, 'subjectName'),
    applicationDescription: pickStr(appRaw, 'applicationDescription') || pickStr(form, 'applicationDescription'),
    filedByName: pickStr(appRaw, 'filedByName'),
    filedByRole: pickStr(appRaw, 'filedByRole'),
    createdAt: pickStr(appRaw, 'createdAt'),
    updatedAt: pickStr(appRaw, 'updatedAt'),
    submittedAt: pickStr(appRaw, 'submittedAt'),
    form,
    disputedOrder: disputedOrder ?? undefined,
    applicants,
    respondents,
    disputedLands,
    attachments,
    description: description ?? undefined
  };

  const applicationHistory =
    (inner['applicationHistory'] as ApplicationPreviewResponse['applicationHistory']) ??
    (appRaw['applicationHistory'] as ApplicationPreviewResponse['applicationHistory']) ??
    undefined;

  return {
    application,
    notices: Array.isArray(inner['notices']) ? inner['notices'] : [],
    hearings: Array.isArray(inner['hearings']) ? inner['hearings'] : [],
    orderSheetHistory: Array.isArray(inner['orderSheetHistory']) ? inner['orderSheetHistory'] : [],
    judgmentWorkflowStatus: (inner['judgmentWorkflowStatus'] as string | null) ?? null,
    judgmentSummary: (inner['judgmentSummary'] as string | null) ?? null,
    applicationHistory
  };
}

export function formatSearchModeLabel(mode: string): string {
  switch (mode) {
    case 'INWARD_NUMBER':
      return 'Inward number';
    case 'SURVEY_NUMBER':
      return 'Survey / CTS';
    case 'MUTATION_NUMBER':
      return 'Mutation number';
    default:
      return mode || '—';
  }
}

export function partyDisplayName(p: Record<string, unknown>): string {
  const direct = pickStr(p, 'name');
  if (direct) return direct;
  return [pickStr(p, 'firstName'), pickStr(p, 'middleName'), pickStr(p, 'lastName')]
    .filter(Boolean)
    .join(' ');
}

export function descriptionParagraphs(app: ApplicationPreviewApplication | null): string[] {
  if (!app) return [];
  const desc = toRecord(app.description);
  const raw = desc?.['paragraphs'];
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const p of raw) {
      const t = String(p ?? '').trim();
      if (!t) continue;
      out.push(...t.split(/\n\n+/).map((x) => x.trim()).filter(Boolean));
    }
    if (out.length) return out;
  }
  const text = app.applicationDescription?.trim();
  if (!text) return [];
  return text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
}

export function buildAttachmentFileUrl(att: Record<string, unknown>): string | null {
  const storageKey = pickStr(att, 'storageKey', 'storage_key');
  if (storageKey) {
    const base = environment.apiBaseUrl.replace(/\/$/, '');
    const key = storageKey.replace(/^\//, '');
    return `${base}/${key}`;
  }
  const fileUrl = pickStr(att, 'fileUrl', 'file_url', 'url');
  return fileUrl || null;
}

export function formatPreviewDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export function landSurveyOrCtsLabel(land: Record<string, unknown>): string {
  const pin = pickStr(land, 'surveyPin');
  if (pin) return pin;
  const parent = pickStr(land, 'parentCtsNo');
  const sub = pickStr(land, 'subCtsNo', 'ctsNo');
  if (parent && sub) return `${parent} / ${sub}`;
  return pickStr(land, 'ctsNo', 'surveyNumber', 'gat');
}
