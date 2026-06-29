import { RCCMS_API } from '../core/rccms-api.paths';
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

  const disputedOrder = mergeDisputedOrderPreview(
    toRecord(appRaw['disputedOrder']),
    form
  );

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
    caseCategoryId: Number(appRaw['caseCategoryId'] ?? form['caseCategoryId'] ?? 0) || undefined,
    caseCategoryName: pickStr(appRaw, 'caseCategoryName') || pickStr(form, 'caseCategoryName'),
    status: String(appRaw['status'] ?? ''),
    processingStage: pickStr(appRaw, 'processingStage'),
    processingStageLabel: pickStr(appRaw, 'processingStageLabel'),
    currentAssigneeRole: pickStr(appRaw, 'currentAssigneeRole'),
    officeId: Number(appRaw['officeId'] ?? form['officeId'] ?? 0) || undefined,
    officeName:
      pickStr(appRaw, 'officeName') ||
      pickStr(form, 'hearingOfficeName', 'officeName', 'urbanOfficeName') ||
      pickStr(toRecord(appRaw['disputedOrder']), 'hearingOfficeName', 'officeName', 'urbanOfficeName'),
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

export interface PreviewInfoItem {
  label: string;
  value: string;
}

/** Build disputed-order block from saved form when API omits nested search fields. */
export function buildDisputedOrderFromForm(
  form: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!form) return null;
  const hasCriteria =
    form['searchMode'] != null ||
    pickStr(form, 'searchValue') ||
    form['mutationDetails'] != null ||
    pickStr(form, 'ruralSurveyPin') ||
    pickStr(form, 'urbanVillageCode') ||
    pickStr(form, 'ctsNoInput');
  if (!hasCriteria) return null;

  return {
    searchMode: form['searchMode'],
    searchValue: form['searchValue'],
    searchDisplayText: form['searchDisplayText'],
    mutationFound: form['mutationFound'],
    mutationSearched: form['mutationSearched'] ?? form['searchedMutation'],
    mutationDetails: form['mutationDetails'],
    manualInwardNumber: form['manualInwardNumber'],
    manualInwardDate: form['manualInwardDate'],
    manualMutationType: form['manualMutationType'],
    manualApplicantName: form['manualApplicantName'],
    manualVillage: form['manualVillage'],
    manualStatus: form['manualStatus'],
    landRecordType: form['landRecordType'],
    districtId: form['districtId'],
    talukaId: form['talukaId'],
    divisionCode: form['divisionCode'],
    officeId: form['officeId'],
    officeName: form['officeName'],
    hearingOfficeName: form['hearingOfficeName'],
    districtName: form['districtName'],
    talukaName: form['talukaName'],
    ruralDistrictCode: form['ruralDistrictCode'],
    ruralDistrictName: form['ruralDistrictName'],
    ruralTalukaCode: form['ruralTalukaCode'],
    ruralTalukaName: form['ruralTalukaName'],
    ruralVillageLgdCode: form['ruralVillageLgdCode'],
    ruralVillageName: form['ruralVillageName'],
    ruralSurveyPin: form['ruralSurveyPin'],
    urbanDistrictCode: form['urbanDistrictCode'],
    urbanDistrictName: form['urbanDistrictName'],
    urbanOfficeCode: form['urbanOfficeCode'],
    urbanOfficeName: form['urbanOfficeName'],
    urbanVillageCode: form['urbanVillageCode'],
    urbanVillageName: form['urbanVillageName'],
    ctsNoInput: form['ctsNoInput'],
    selectedSubCtsNo: form['selectedSubCtsNo'],
    selectedInwardNumber: form['selectedInwardNumber'],
    mutationNumberInput: form['mutationNumberInput'],
    mutationYear: form['mutationYear'],
    mutationTypeFilter: form['mutationTypeFilter'],
    selectedUrbanMutationTypeCode: form['selectedUrbanMutationTypeCode'],
    selectedUrbanMutationTypeName: form['selectedUrbanMutationTypeName'],
    notice9Resolved: form['notice9Resolved']
  };
}

export function mergeDisputedOrderPreview(
  fromApp: Record<string, unknown> | null | undefined,
  form: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  const app = toRecord(fromApp);
  const built = buildDisputedOrderFromForm(form);
  if (!app && !built) return null;
  const merged: Record<string, unknown> = { ...built, ...app };
  for (const [key, value] of Object.entries(built ?? {})) {
    if (value != null && String(value).trim() !== '') {
      merged[key] = value;
    }
  }
  const mutation = toRecord(app?.['mutationDetails']) ?? toRecord(built?.['mutationDetails']);
  if (mutation) merged['mutationDetails'] = mutation;
  return merged;
}

export function resolveOfficePreviewLabel(
  app: ApplicationPreviewApplication | null | undefined
): string {
  if (!app) return '';
  const form = app.form ?? {};
  const order = toRecord(app.disputedOrder);
  const direct = pickStr(app as unknown as Record<string, unknown>, 'officeName');
  if (direct) return direct;

  const hearing = pickStr(form, 'hearingOfficeName') || pickStr(order, 'hearingOfficeName');
  if (hearing) return hearing;

  const urbanName = pickStr(form, 'urbanOfficeName') || pickStr(order, 'urbanOfficeName');
  if (urbanName) return urbanName;

  const fromForm = pickStr(form, 'officeName', 'officeLabel');
  if (fromForm) return fromForm;
  return pickStr(order, 'officeName');
}

export function resolveCaseCategoryPreviewLabel(
  app: ApplicationPreviewApplication | null | undefined
): string {
  if (!app) return '';
  const direct = pickStr(app as unknown as Record<string, unknown>, 'caseCategoryName');
  if (direct) return direct;
  return pickStr(app.form, 'caseCategoryName');
}

export function formatLandRecordTypeLabel(landType: unknown): string {
  const t = String(landType ?? '').trim();
  if (t === 'RURAL_7_12') return 'Rural 7/12';
  if (t === 'URBAN_PROPERTY_CARD') return 'Urban property card';
  return t.replace(/_/g, ' ');
}

/** All user-entered search / location criteria for preview (names only — codes stay in form JSON). */
export function searchCriteriaPreviewItems(
  order: Record<string, unknown> | null,
  form: Record<string, unknown> | null | undefined
): PreviewInfoItem[] {
  const f = form ?? {};
  const o = order ?? {};
  const items: PreviewInfoItem[] = [];
  const push = (label: string, ...keys: string[]) => {
    const value =
      keys.map((k) => pickStr(o, k) || pickStr(f, k)).find(Boolean) ?? '';
    if (value) items.push({ label, value });
  };

  const mode = pickStr(o, 'searchMode') || pickStr(f, 'searchMode');
  if (mode) items.push({ label: 'Search type', value: formatSearchModeLabel(mode) });

  push('Search value', 'searchValue', 'searchDisplayText');

  const landType =
    pickStr(o, 'landRecordType') ||
    pickStr(f, 'landRecordType') ||
    (pickStr(f, 'ruralVillageName') || pickStr(f, 'ruralSurveyPin')
      ? 'RURAL_7_12'
      : pickStr(f, 'urbanVillageName') || pickStr(f, 'ctsNoInput')
        ? 'URBAN_PROPERTY_CARD'
        : '');
  if (landType) {
    items.push({ label: 'Land record type', value: formatLandRecordTypeLabel(landType) });
  }

  push('Hearing office', 'hearingOfficeName', 'officeName', 'urbanOfficeName');
  push('District', 'districtName');
  push('Taluka', 'talukaName');

  if (mode === 'INWARD_NUMBER') {
    push('Inward / search number', 'searchValue', 'selectedInwardNumber');
    push('Manual inward no.', 'manualInwardNumber');
    push('Manual inward date', 'manualInwardDate');
    push('Manual mutation type', 'manualMutationType');
    push('Manual applicant', 'manualApplicantName');
    push('Manual village', 'manualVillage');
    push('Manual status', 'manualStatus');
  }

  if (mode === 'SURVEY_NUMBER') {
    push('District', 'ruralDistrictName');
    push('Taluka', 'ruralTalukaName');
    push('Village', 'ruralVillageName');
    push('Survey / pin', 'ruralSurveyPin');
  }

  if (mode === 'MUTATION_NUMBER') {
    push('Mutation number', 'mutationNumberInput', 'searchValue');
    push('Mutation year', 'mutationYear');
    push('Mutation type filter', 'mutationTypeFilter');
    push('District', 'urbanDistrictName');
    push('Office', 'urbanOfficeName', 'hearingOfficeName');
    push('Village', 'urbanVillageName');
    push('CTS (parent)', 'ctsNoInput');
    push('Sub-CTS', 'selectedSubCtsNo');
    push('Mutation type', 'selectedUrbanMutationTypeName');
    push('Selected inward', 'selectedInwardNumber');
  }

  const mutationFound = o['mutationFound'] ?? f['mutationFound'];
  if (mutationFound === true || mutationFound === false) {
    items.push({ label: 'Mutation found', value: mutationFound ? 'Yes' : 'No' });
  }
  const mutationSearched = o['mutationSearched'] ?? f['mutationSearched'] ?? f['searchedMutation'];
  if (mutationSearched === true || mutationSearched === false) {
    items.push({ label: 'Mutation searched', value: mutationSearched ? 'Yes' : 'No' });
  }

  const m = toRecord(o['mutationDetails']) ?? toRecord(f['mutationDetails']);
  if (m) {
    const addFromMutation = (label: string, key: string) => {
      const value = pickStr(m, key);
      if (value) items.push({ label, value });
    };
    addFromMutation('Resolved inward no.', 'inwardNumber');
    addFromMutation('Inward date', 'inwardDate');
    addFromMutation('Mutation type', 'mutationType');
    addFromMutation('Order applicant', 'applicantName');
    addFromMutation('Order village', 'village');
    addFromMutation('Order status', 'status');
  }

  return items;
}

/** User-facing filing status (never show raw PREVIEW code after draft is saved). */
export function formatApplicationStatusLabel(
  status: string | null | undefined,
  options?: { applicationOnly?: boolean; applicationId?: number }
): string {
  const s = String(status ?? '').trim().toUpperCase();
  const appId = Number(options?.applicationId ?? 0);
  const filingModal = !!options?.applicationOnly;

  if (s === 'DRAFT') return 'Draft';
  if (s === 'SUBMITTED') return 'Submitted';
  if (s === 'PREVIEW' || (filingModal && appId < 1)) {
    return 'Not submitted (preview only)';
  }
  if (!s) return filingModal && appId < 1 ? 'Not submitted (preview only)' : '—';
  return String(status).trim();
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

export function descriptionParagraphs(
  app: Pick<ApplicationPreviewApplication, 'description' | 'form' | 'applicationDescription'> | null | undefined
): string[] {
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
  const formParagraphs = app.form?.['descriptionParagraphs'];
  if (Array.isArray(formParagraphs)) {
    const out: string[] = [];
    for (const p of formParagraphs) {
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

/** Resolve affidavit HTML/text from description block and/or nested form fields. */
export function pickAffidavitPreviewText(
  app: Pick<ApplicationPreviewApplication, 'description' | 'form'> | null | undefined
): string {
  if (!app) return '';
  const desc = toRecord(app.description as unknown);
  const form = app.form ?? {};
  const nestedDesc = toRecord(form['description']);
  return (
    pickStr(desc, 'affidavitText') ||
    pickStr(form, 'affidavitText') ||
    pickStr(nestedDesc, 'affidavitText')
  );
}

/** Resolve prayer HTML/text from description block and/or nested form fields. */
export function pickPrayerPreviewText(
  app: Pick<ApplicationPreviewApplication, 'description' | 'form'> | null | undefined
): string {
  if (!app) return '';
  const desc = toRecord(app.description as unknown);
  const form = app.form ?? {};
  const nestedDesc = toRecord(form['description']);
  return (
    pickStr(desc, 'prayerText') ||
    pickStr(form, 'prayerText') ||
    pickStr(nestedDesc, 'prayerText')
  );
}

export interface FileDownloadUrlOptions {
  fileName?: string;
  inline?: boolean;
}

/** GET /api/files/download — use with HttpClient + JWT, not as plain &lt;a href&gt;. */
export function buildFileDownloadApiUrl(
  storageKey: string,
  options?: FileDownloadUrlOptions
): string {
  const base = environment.apiBaseUrl.replace(/\/$/, '');
  const key = storageKey.trim().replace(/^\//, '');
  const params = new URLSearchParams({ storageKey: key });
  const fileName = options?.fileName?.trim();
  if (fileName) params.set('fileName', fileName);
  if (options?.inline === true) params.set('inline', 'true');
  else if (options?.inline === false) params.set('inline', 'false');
  return `${base}${RCCMS_API.files.download}?${params.toString()}`;
}

/** @deprecated Use FileUploadService.download() — browser cannot send JWT on raw href/img src. */
export function isStorageKeyPath(value: string): boolean {
  const v = value.trim().replace(/^\//, '');
  return v.startsWith('uploads/');
}

export function isImageAttachmentMime(mimeType: string | null | undefined): boolean {
  return String(mimeType ?? '').trim().toLowerCase().startsWith('image/');
}

export function attachmentStorageKey(att: Record<string, unknown>): string {
  return pickStr(att, 'storageKey', 'storage_key');
}

export function attachmentFileName(att: Record<string, unknown>): string {
  return pickStr(att, 'fileName', 'file_name');
}

export function buildAttachmentFileUrl(att: Record<string, unknown>): string | null {
  const storageKey = attachmentStorageKey(att);
  const fileUrl = pickStr(att, 'fileUrl', 'file_url', 'url');
  const key =
    storageKey ||
    (fileUrl && isStorageKeyPath(fileUrl) ? fileUrl.replace(/^\//, '') : '');
  if (key) {
    return buildFileDownloadApiUrl(key, {
      fileName: attachmentFileName(att) || undefined,
      inline: isImageAttachmentMime(String(att['mimeType'] ?? att['mime_type'] ?? ''))
    });
  }
  if (fileUrl && !isStorageKeyPath(fileUrl)) {
    return fileUrl;
  }
  return null;
}

export function formatPreviewDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function mergePreviewDescription(
  local?: ApplicationPreviewApplication['description'],
  api?: ApplicationPreviewApplication['description'],
  localForm?: Record<string, unknown>,
  apiForm?: Record<string, unknown>
): ApplicationPreviewApplication['description'] {
  const l = toRecord(local as unknown);
  const a = toRecord(api as unknown);
  const affidavit =
    pickStr(l, 'affidavitText') ||
    pickStr(a, 'affidavitText') ||
    pickStr(localForm, 'affidavitText') ||
    pickStr(apiForm, 'affidavitText');
  const prayer =
    pickStr(l, 'prayerText') ||
    pickStr(a, 'prayerText') ||
    pickStr(localForm, 'prayerText') ||
    pickStr(apiForm, 'prayerText');
  const localParagraphs = Array.isArray(l?.['paragraphs'])
    ? (l['paragraphs'] as unknown[]).map((p) => String(p ?? '').trim()).filter(Boolean)
    : [];
  const apiParagraphs = Array.isArray(a?.['paragraphs'])
    ? (a['paragraphs'] as unknown[]).map((p) => String(p ?? '').trim()).filter(Boolean)
    : [];
  return {
    ...(a ?? {}),
    ...(l ?? {}),
    paragraphs: (localParagraphs.length ? localParagraphs : apiParagraphs) as string[] | undefined,
    affidavitText: affidavit || undefined,
    prayerText: prayer || undefined
  };
}

/** Prefer locally captured filing draft data; merge server metadata (no. / id). */
export function mergeApplicationPreviewWithLocal(
  local: ApplicationPreviewResponse,
  api?: ApplicationPreviewResponse | null
): ApplicationPreviewResponse {
  const la = local.application;
  const aa = api?.application;
  if (!aa) return local;

  return {
    ...local,
    application: {
      ...aa,
      ...la,
      applicationId: aa.applicationId || la.applicationId,
      applicationNo: aa.applicationNo || la.applicationNo,
      clientApplicationRef: la.clientApplicationRef || aa.clientApplicationRef,
      status: aa.status || la.status,
      form: { ...(aa.form ?? {}), ...(la.form ?? {}) },
      disputedOrder:
        mergeDisputedOrderPreview(la.disputedOrder, la.form) ??
        mergeDisputedOrderPreview(aa.disputedOrder, { ...(aa.form ?? {}), ...(la.form ?? {}) }) ??
        undefined,
      caseCategoryName:
        la.caseCategoryName ||
        aa.caseCategoryName ||
        pickStr(la.form, 'caseCategoryName'),
      officeName:
        la.officeName ||
        aa.officeName ||
        pickStr(la.form, 'hearingOfficeName', 'officeName', 'urbanOfficeName'),
      officeId: la.officeId || aa.officeId || Number(la.form?.['officeId'] ?? 0) || undefined,
      applicants: la.applicants?.length ? la.applicants : aa.applicants,
      respondents: la.respondents?.length ? la.respondents : aa.respondents,
      disputedLands: la.disputedLands?.length ? la.disputedLands : aa.disputedLands,
      attachments: la.attachments?.length ? la.attachments : aa.attachments,
      description: mergePreviewDescription(la.description, aa.description, la.form, aa.form),
      applicationDescription: la.applicationDescription || aa.applicationDescription,
      subjectName: la.subjectName || aa.subjectName
    },
    notices: local.notices?.length ? local.notices : (api?.notices ?? []),
    hearings: local.hearings?.length ? local.hearings : (api?.hearings ?? []),
    orderSheetHistory: local.orderSheetHistory?.length
      ? local.orderSheetHistory
      : (api?.orderSheetHistory ?? []),
    applicationHistory: api?.applicationHistory ?? local.applicationHistory
  };
}

export function vakaltnamaAssignmentsFromForm(
  form: Record<string, unknown> | null | undefined
): Array<Record<string, unknown>> {
  const raw = form?.['vakalatnamaAssignments'] ?? form?.['vakaltnamaAssignments'];
  return toRecordArray(raw);
}

export function landSurveyOrCtsLabel(land: Record<string, unknown>): string {
  const pin = pickStr(land, 'surveyPin');
  if (pin) return pin;
  const parent = pickStr(land, 'parentCtsNo');
  const sub = pickStr(land, 'subCtsNo', 'ctsNo');
  if (parent && sub) return `${parent} / ${sub}`;
  return pickStr(land, 'ctsNo', 'surveyNumber', 'gat');
}

function pickLandTotalArea(row: Record<string, unknown> | null | undefined): string {
  if (!row) return '';
  return pickStr(
    row,
    'total_area',
    'totalArea',
    'TOTAL_AREA',
    'built_up_area',
    'builtUpArea',
    'carpet_area',
    'carpetArea',
    'open_area',
    'openArea',
    'area'
  );
}

/** Flatten nested landDetail / propertyDetail for preview tables. */
export function expandDisputedLandPreviewRows(
  lands: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (let landIndex = 0; landIndex < lands.length; landIndex++) {
    const land = lands[landIndex];
    const baseLine = Number(land['lineNo'] ?? landIndex + 1);
    const base = {
      landType: land['landType'],
      districtName: land['districtName'] ?? land['districtCode'],
      talukaName: land['talukaName'] ?? land['talukaCode'],
      officeName: land['officeName'] ?? land['officeCode'],
      villageName: land['villageName'] ?? land['villageCode'],
      surveyPin: land['surveyPin'],
      parentCtsNo: land['parentCtsNo'],
      subCtsNo: land['subCtsNo'],
      ctsNo: land['ctsNo']
    };

    const nestedDetails = toRecordArray(land['landDetail']);
    if (nestedDetails.length) {
      nestedDetails.forEach((d, di) => {
        out.push({
          ...base,
          lineNo: nestedDetails.length > 1 ? `${baseLine}.${di + 1}` : baseLine,
          disputedArea: pickStr(d, 'disputed_area', 'disputedArea'),
          totalArea: pickLandTotalArea(d),
          gat: pickStr(d, 'gat', 'GAT'),
          plotNo: pickStr(d, 'plot_no', 'plotNo')
        });
      });
      continue;
    }

    const property = toRecord(land['propertyDetail']);
    if (property && Object.keys(property).length) {
      out.push({
        ...base,
        lineNo: baseLine,
        disputedArea: pickStr(property, 'disputed_area', 'disputedArea') || pickStr(land, 'disputedArea'),
        totalArea: pickLandTotalArea(property) || pickStr(land, 'totalArea'),
        flatNo: pickStr(property, 'flat_no', 'flatNo', 'unit_no', 'unitNo', 'plot_no', 'plotNo')
      });
      continue;
    }

    if (pickStr(land, 'disputedArea', 'disputed_area') || pickStr(land, 'totalArea', 'total_area')) {
      out.push({
        ...base,
        lineNo: baseLine,
        disputedArea: pickStr(land, 'disputedArea', 'disputed_area'),
        totalArea: pickStr(land, 'totalArea', 'total_area') || pickLandTotalArea(land)
      });
      continue;
    }

    out.push({ ...base, lineNo: baseLine, disputedArea: '—', totalArea: '—' });
  }
  return out;
}
