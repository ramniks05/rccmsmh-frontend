import { Component, DestroyRef, effect, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { finalize } from 'rxjs';

import {
  FilingApplicationService,
  ApplicationPreviewResponse,
  ApplicationPreviewNotice,
  ApplicationPreviewApplication,
  ApplicationHistoryResponse,
  ApplicationHistoryEntry
} from '../../../services/filing-application.service';
import { ApplicationHistoryTimelineComponent } from '../application-history-timeline/application-history-timeline.component';
import { TokenStorageService } from '../../../services/token-storage.service';
import {
  buildMarathiJudgmentPreviewHtml,
  JudgmentPreviewVars,
  toDevanagariDigits
} from '../../../shared/sunvai-marathi-template';
import {
  attachmentFileName,
  attachmentStorageKey,
  descriptionParagraphs,
  isImageAttachmentMime,
  formatPreviewDate,
  formatApplicationStatusLabel,
  formatLandRecordTypeLabel,
  formatSearchModeLabel,
  landSurveyOrCtsLabel,
  expandDisputedLandPreviewRows,
  mergeApplicationPreviewWithLocal,
  mergeDisputedOrderPreview,
  partyDisplayName,
  pickStr,
  PreviewInfoItem,
  resolveCaseCategoryPreviewLabel,
  resolveOfficePreviewLabel,
  searchCriteriaPreviewItems,
  toRecord,
  toRecordArray,
  vakaltnamaAssignmentsFromForm
} from '../../../shared/application-preview.util';
import {
  buildApplicationPreviewPrintHtml,
  downloadHtmlFile,
  openPrintWindow,
  type ApplicationPreviewPrintModel
} from '../../../shared/application-preview-print.util';
import { isFilingDocumentHtml, openFilingDocumentHtml } from '../../../shared/filing-affidavit-prayer.util';
import { CATEGORY1_FILING_RETURN_SESSION_KEY } from '../efiling/services/category1-filing.service';
import { CaseCategoryService } from '../../../services/case-category.service';
import { FileUploadService } from '../../../services/file-upload.service';

type PreviewTab = 'application' | 'history' | 'notices' | 'hearings' | 'ordersheet' | 'judgment';

@Component({
  selector: 'app-application-preview',
  imports: [RouterLink, ApplicationHistoryTimelineComponent],
  templateUrl: './application-preview.component.html',
  styleUrl: './application-preview.component.css'
})
export class ApplicationPreviewComponent implements OnInit {
  /** When set with `embedded`, loads preview for this id (filing dialog). */
  applicationId = input<number | null>(null);
  /** Renders inside filing modal — no back link / full page chrome. */
  embedded = input(false);
  /** Filing draft: show application tab only (no history/notices). */
  applicationOnly = input(false);
  /** When set (filing flow), merge with API for complete draft preview. */
  localPreview = input<ApplicationPreviewResponse | null>(null);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(FilingApplicationService);
  private readonly caseCategories = inject(CaseCategoryService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly fileUpload = inject(FileUploadService);
  private readonly destroyRef = inject(DestroyRef);
  private fetchedCategoryName = '';
  protected readonly attachmentBlobUrls = signal<Record<string, string>>({});
  /** Storage key of attachment whose inline preview is visible (set only after View). */
  protected readonly attachmentPreviewKey = signal<string | null>(null);
  protected readonly attachmentPreviewLoadingKey = signal<string | null>(null);
  protected readonly attachmentPreviewError = signal<string | null>(null);

  private loadedApplicationId = 0;
  private lastEmbeddedLocalRef: ApplicationPreviewResponse | null = null;
  private lastLoadedLocalRef: ApplicationPreviewResponse | null = null;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<ApplicationPreviewResponse | null>(null);
  protected readonly activeTab = signal<PreviewTab>('application');

  protected readonly history = signal<ApplicationHistoryResponse | null>(null);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal<string | null>(null);

  protected backLink = this.tokenStorage.isOfficer() ? '/cases' : '/applications';
  protected previewFromFiling = false;
  /** Resolved case category for “Continue filing” (query param, session, or preview API). */
  protected continueFilingCaseCategoryId = 0;

  constructor() {
    this.destroyRef.onDestroy(() => {
      for (const url of Object.values(this.attachmentBlobUrls())) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      }
      this.attachmentBlobUrls.set({});
    });

    effect(() => {
      if (!this.embedded()) return;
      const id = Number(this.applicationId() ?? 0);
      const local = this.localPreview();
      if (id < 1 && !local) return;
      if (id === this.loadedApplicationId && local === this.lastEmbeddedLocalRef && this.data()) {
        return;
      }
      this.lastEmbeddedLocalRef = local;
      this.loadApplication(id);
    });
  }

  ngOnInit(): void {
    if (this.embedded()) return;

    const from = this.route.snapshot.queryParamMap.get('from');
    this.previewFromFiling = from === 'filing';
    this.continueFilingCaseCategoryId = this.resolveContinueFilingCaseCategoryId();
    if (!this.previewFromFiling) {
      this.backLink = this.tokenStorage.isOfficer() ? '/cases' : '/applications';
    }

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.error.set('Invalid application ID.');
      this.loading.set(false);
      return;
    }
    this.loadApplication(id);
  }

  private loadApplication(id: number): void {
    const local = this.localPreview();
    const localBundleChanged = local != null && local !== this.lastLoadedLocalRef;
    if (id === this.loadedApplicationId && this.data() && !localBundleChanged) return;
    this.loadedApplicationId = id;
    this.loading.set(true);
    this.error.set(null);
    this.data.set(null);
    this.history.set(null);
    this.activeTab.set('application');

    const applyBundle = (resp: ApplicationPreviewResponse) => {
      const bundle =
        local && (this.applicationOnly() || this.embedded())
          ? mergeApplicationPreviewWithLocal(local, resp)
          : resp;
      this.data.set(bundle);
      this.ensureCategoryNameOnBundle(bundle);
      if (this.continueFilingCaseCategoryId < 1) {
        const fromApi = Number(bundle.application?.caseCategoryId ?? 0);
        if (fromApi > 0) {
          this.continueFilingCaseCategoryId = fromApi;
        }
      }
      if (this.applicationOnly()) {
        this.history.set(null);
      } else if (bundle.applicationHistory) {
        this.history.set(bundle.applicationHistory);
      } else {
        this.loadHistory();
      }
      this.loading.set(false);
    };

    if (local && this.applicationOnly()) {
      const draft: ApplicationPreviewResponse = {
        ...local,
        application: { ...local.application, applicationId: id > 0 ? id : local.application.applicationId }
      };
      this.lastLoadedLocalRef = local;
      this.data.set(draft);
      this.ensureCategoryNameOnBundle(draft);
      this.history.set(null);
      this.loading.set(false);
      return;
    }

    this.service.getApplicationPreviewForRole(id, this.tokenStorage.isOfficer()).subscribe({
      next: (resp) => applyBundle(resp),
      error: () => {
        if (local) {
          applyBundle({ ...local, application: { ...local.application, applicationId: id } });
          return;
        }
        this.error.set('Failed to load application details.');
        this.loading.set(false);
      }
    });
  }

  protected canContinueDraftFiling(): boolean {
    const status = (this.app()?.status ?? '').toUpperCase();
    return status === 'DRAFT' && this.continueFilingCaseCategoryId > 0;
  }

  protected continueFiling(): void {
    const catId = this.continueFilingCaseCategoryId;
    const appId = Number(this.app()?.applicationId ?? 0);
    if (catId < 1) {
      void this.router.navigate(['/applications/new']);
      return;
    }
    try {
      sessionStorage.setItem(
        CATEGORY1_FILING_RETURN_SESSION_KEY,
        JSON.stringify({
          caseCategoryId: catId,
          applicationId: appId > 0 ? appId : null
        })
      );
    } catch { /**/ }
    void this.router.navigate(['/applications/new'], {
      queryParams: {
        caseCategoryId: catId,
        ...(appId > 0 ? { applicationId: appId } : {})
      }
    });
  }

  private resolveContinueFilingCaseCategoryId(): number {
    const fromQuery = Number(this.route.snapshot.queryParamMap.get('caseCategoryId') || 0);
    if (fromQuery > 0) return fromQuery;

    try {
      const raw = sessionStorage.getItem(CATEGORY1_FILING_RETURN_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { caseCategoryId?: number; applicationId?: number };
        const fromSession = Number(parsed.caseCategoryId ?? 0);
        if (fromSession > 0) return fromSession;
      }
    } catch {
      /**/
    }
    return 0;
  }

  protected setTab(tab: PreviewTab): void {
    this.activeTab.set(tab);
    if (tab === 'history' && !this.history() && !this.historyLoading()) {
      this.loadHistory();
    }
  }

  protected loadHistory(): void {
    if (!this.loadedApplicationId || this.historyLoading()) return;
    this.historyLoading.set(true);
    this.historyError.set(null);
    this.service
      .getApplicationHistoryForRole(this.loadedApplicationId, this.tokenStorage.isOfficer())
      .pipe(finalize(() => this.historyLoading.set(false)))
      .subscribe({
        next: (h) => this.history.set(h),
        error: () => this.historyError.set('Failed to load application history.')
      });
  }

  protected noticeHtml(notice: ApplicationPreviewNotice): SafeHtml {
    const html = notice.finalContent || notice.previewContent || '';
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  protected app(): ApplicationPreviewApplication | null {
    return this.data()?.application ?? null;
  }

  protected form(): Record<string, unknown> {
    return this.app()?.form ?? {};
  }

  protected applicants(): Array<Record<string, unknown>> {
    const a = this.app();
    if (!a) return [];
    return a.applicants?.length ? a.applicants : toRecordArray(this.form()['applicants']);
  }

  protected respondents(): Array<Record<string, unknown>> {
    const a = this.app();
    if (!a) return [];
    return a.respondents?.length ? a.respondents : toRecordArray(this.form()['respondents']);
  }

  protected disputedLands(): Array<Record<string, unknown>> {
    const a = this.app();
    if (!a) return [];
    const raw = a.disputedLands?.length ? a.disputedLands : toRecordArray(this.form()['disputedLands']);
    return expandDisputedLandPreviewRows(raw);
  }

  protected previewStatusLabel(): string {
    const app = this.app();
    return formatApplicationStatusLabel(app?.status, {
      applicationOnly: this.applicationOnly(),
      applicationId: app?.applicationId
    });
  }

  protected isUnsavedPreviewStatus(): boolean {
    return (this.app()?.status ?? '').toUpperCase() === 'PREVIEW';
  }

  protected isDraftStatus(): boolean {
    return (this.app()?.status ?? '').toUpperCase() === 'DRAFT';
  }

  protected attachments(): Array<Record<string, unknown>> {
    const a = this.app();
    if (!a) return [];
    return a.attachments?.length ? a.attachments : toRecordArray(this.form()['attachments']);
  }

  protected officeLabel(): string {
    return resolveOfficePreviewLabel(this.app()) || '—';
  }

  protected categoryLabel(): string {
    const label = resolveCaseCategoryPreviewLabel(this.app());
    if (label) return label;
    if (this.fetchedCategoryName) return this.fetchedCategoryName;
    return '—';
  }

  private ensureCategoryNameOnBundle(bundle: ApplicationPreviewResponse): void {
    const app = bundle.application;
    if (resolveCaseCategoryPreviewLabel(app)) {
      return;
    }
    const catId = Number(app.caseCategoryId ?? app.form?.['caseCategoryId'] ?? 0);
    if (catId < 1) return;
    this.caseCategories.getCaseCategory(catId).subscribe({
      next: (cat) => {
        const name = cat.name?.trim() || cat.code || '';
        this.fetchedCategoryName = name;
        this.data.update((current) => {
          if (!current) return current;
          return {
            ...current,
            application: { ...current.application, caseCategoryName: name, caseCategoryId: catId }
          };
        });
      }
    });
  }

  protected disputedOrder(): Record<string, unknown> | null {
    return mergeDisputedOrderPreview(this.app()?.disputedOrder, this.form());
  }

  protected searchCriteriaItems(): PreviewInfoItem[] {
    return searchCriteriaPreviewItems(this.disputedOrder(), this.form());
  }

  protected mutationDetails(): Record<string, unknown> | null {
    return toRecord(this.disputedOrder()?.['mutationDetails']);
  }

  protected descriptionParagraphs(): string[] {
    return descriptionParagraphs(this.app());
  }

  protected affidavitText(): string {
    const d = this.app()?.description;
    const direct = d?.affidavitText?.trim();
    if (direct) return direct;
    return pickStr(this.form(), 'affidavitText');
  }

  protected prayerText(): string {
    const d = this.app()?.description;
    const direct = d?.prayerText?.trim();
    if (direct) return direct;
    return pickStr(this.form(), 'prayerText');
  }

  protected affidavitSrcdoc(): SafeHtml | null {
    const raw = this.affidavitText();
    if (!raw.trim()) return null;
    const html = isFilingDocumentHtml(raw) ? raw : `<pre style="font-family:inherit;white-space:pre-wrap;padding:16px">${this.escapeForHtml(raw)}</pre>`;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  protected prayerSrcdoc(): SafeHtml | null {
    const raw = this.prayerText();
    if (!raw.trim()) return null;
    const html = isFilingDocumentHtml(raw) ? raw : `<pre style="font-family:inherit;white-space:pre-wrap;padding:16px">${this.escapeForHtml(raw)}</pre>`;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  protected vakaltnamaAssignments(): Array<Record<string, unknown>> {
    return vakaltnamaAssignmentsFromForm(this.form());
  }

  protected applicantNameByTempId(tempId: string): string {
    const row = this.applicants().find(
      (a) => String(a['tempId'] ?? a['clientRowKey'] ?? '') === tempId
    );
    return row ? partyDisplayName(row) : tempId;
  }

  protected toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((x) => String(x ?? '').trim()).filter(Boolean);
  }

  protected vakaltnamaAdvocateName(group: Record<string, unknown>): string {
    return pickStr(toRecord(group['advocate']), 'fullName');
  }

  protected vakaltnamaBarCouncil(group: Record<string, unknown>): string {
    return pickStr(toRecord(group['advocate']), 'barCouncilNumber');
  }

  protected openAffidavitPrint(): void {
    const raw = this.affidavitText();
    if (!raw.trim()) return;
    if (!openFilingDocumentHtml(raw)) {
      alert('Allow pop-ups to print the affidavit.');
    }
  }

  protected openPrayerPrint(): void {
    const raw = this.prayerText();
    if (!raw.trim()) return;
    if (!openFilingDocumentHtml(raw)) {
      alert('Allow pop-ups to print the prayer.');
    }
  }

  private escapeForHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  protected actSectionLabel(): string {
    const f = this.form();
    const custom = pickStr(f, 'sectionCustomText', 'customSectionName');
    if (custom) return custom;
    const actName = pickStr(f, 'actName');
    const sectionName = pickStr(f, 'sectionName');
    if (actName && sectionName) return `${actName} — ${sectionName}`;
    if (actName) return actName;
    if (sectionName) return sectionName;
    return '—';
  }

  protected landTypeLabel(land: Record<string, unknown>): string {
    return formatLandRecordTypeLabel(land['landType']) || '—';
  }

  protected landDistrictLabel(land: Record<string, unknown>): string {
    return pickStr(land, 'districtName') || '—';
  }

  protected landOfficeTalukaLabel(land: Record<string, unknown>): string {
    return pickStr(land, 'officeName', 'talukaName') || '—';
  }

  protected landVillageLabel(land: Record<string, unknown>): string {
    return pickStr(land, 'villageName') || '—';
  }

  protected processingStageLabel(): string {
    return (
      this.history()?.processingStageLabel ||
      this.app()?.processingStageLabel ||
      this.history()?.processingStage ||
      this.app()?.processingStage ||
      ''
    );
  }

  protected caseNoDisplay(): string {
    return this.history()?.caseNo || this.app()?.caseNo || '';
  }

  protected showJudgmentTab(): boolean {
    if (this.data()?.judgmentSummary) return true;
    return (this.history()?.entries ?? []).some((e) => e.action.startsWith('JUDGMENT_'));
  }

  protected onHistoryEntry(entry: ApplicationHistoryEntry): void {
    if (!entry.referenceType) return;
    switch (entry.referenceType) {
      case 'HEARING':
        this.setTab('hearings');
        break;
      case 'NOTICE':
        this.setTab('notices');
        break;
      case 'ORDER_SHEET':
        this.setTab('ordersheet');
        break;
      case 'JUDGMENT':
        this.setTab('judgment');
        break;
    }
  }

  protected str(v: unknown): string {
    return v != null && String(v).trim() ? String(v) : '—';
  }

  private printField(v: unknown): string {
    const s = v != null ? String(v).trim() : '';
    return s && s !== '—' ? s : '';
  }

  protected partyName(p: Record<string, unknown>): string {
    return partyDisplayName(p) || '—';
  }

  protected formatDate(v: string | null | undefined): string {
    return formatPreviewDate(v);
  }

  protected searchModeLabel(mode: unknown): string {
    return formatSearchModeLabel(String(mode ?? ''));
  }

  protected landCts(land: Record<string, unknown>): string {
    const label = landSurveyOrCtsLabel(land);
    return label || '—';
  }

  protected storageKeyForAttachment(att: Record<string, unknown>): string {
    return attachmentStorageKey(att);
  }

  protected attachmentUrl(att: Record<string, unknown>): string | null {
    const key = attachmentStorageKey(att);
    if (!key) return null;
    return this.attachmentBlobUrls()[key] ?? null;
  }

  protected isImageAttachment(att: Record<string, unknown>): boolean {
    const mime = String(att['mimeType'] ?? att['mime_type'] ?? '');
    if (isImageAttachmentMime(mime)) return true;
    const name = String(att['fileName'] ?? att['file_name'] ?? '').toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
  }

  protected isAttachmentPreviewOpen(att: Record<string, unknown>): boolean {
    const key = attachmentStorageKey(att);
    return !!key && this.attachmentPreviewKey() === key;
  }

  protected isAttachmentPreviewLoading(att: Record<string, unknown>): boolean {
    const key = attachmentStorageKey(att);
    return !!key && this.attachmentPreviewLoadingKey() === key;
  }

  protected isPdfAttachment(att: Record<string, unknown>): boolean {
    const mime = String(att['mimeType'] ?? att['mime_type'] ?? '').toLowerCase();
    if (mime === 'application/pdf') return true;
    const name = String(att['fileName'] ?? att['file_name'] ?? '').toLowerCase();
    return name.endsWith('.pdf');
  }

  protected viewAttachment(att: Record<string, unknown>): void {
    const key = attachmentStorageKey(att);
    if (!key) return;

    if (this.attachmentPreviewKey() === key) {
      this.attachmentPreviewKey.set(null);
      this.attachmentPreviewError.set(null);
      return;
    }

    this.attachmentPreviewKey.set(key);
    this.attachmentPreviewError.set(null);

    if (this.attachmentBlobUrls()[key]) {
      return;
    }

    const fileName = attachmentFileName(att);
    const inline = this.isImageAttachment(att) || this.isPdfAttachment(att);
    this.attachmentPreviewLoadingKey.set(key);
    this.fileUpload
      .download(key, { fileName: fileName || undefined, inline })
      .pipe(
        finalize(() => {
          if (this.attachmentPreviewLoadingKey() === key) {
            this.attachmentPreviewLoadingKey.set(null);
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (blob) => {
          this.setAttachmentBlobUrl(key, URL.createObjectURL(blob));
        },
        error: () => {
          this.attachmentPreviewError.set('Could not load this file.');
        }
      });
  }

  private setAttachmentBlobUrl(key: string, url: string): void {
    const prev = this.attachmentBlobUrls()[key];
    if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
    this.attachmentBlobUrls.update((m) => ({ ...m, [key]: url }));
  }

  protected canExportPreview(): boolean {
    return !this.loading() && !!this.data() && !!this.app();
  }

  protected printApplicationPreview(): void {
    const html = this.buildApplicationPreviewPrintHtml();
    if (!html) return;
    if (!openPrintWindow(html, true)) {
      alert('Allow pop-ups to print the application preview.');
    }
  }

  protected downloadApplicationPreview(): void {
    const html = this.buildApplicationPreviewPrintHtml();
    if (!html) return;
    const no = (this.app()?.applicationNo || 'application').replace(/[^\w.-]+/g, '_');
    downloadHtmlFile(html, `application-preview-${no}.html`);
  }

  private buildApplicationPreviewPrintHtml(): string {
    const app = this.app();
    if (!app) return '';
    const model: ApplicationPreviewPrintModel = {
      title: app.applicationNo || 'Application',
      caseNo: this.caseNoDisplay(),
      status: this.previewStatusLabel(),
      summaryRows: [
        { label: 'Application no.', value: app.applicationNo || '' },
        { label: 'Status', value: this.previewStatusLabel() },
        { label: 'Category', value: this.categoryLabel() !== '—' ? this.categoryLabel() : '' },
        { label: 'Subject', value: app.subjectName || '' },
        { label: 'Office', value: this.officeLabel() !== '—' ? this.officeLabel() : '' },
        { label: 'Act / section', value: this.actSectionLabel() !== '—' ? this.actSectionLabel() : '' },
        {
          label: 'Filed by',
          value: app.filedByName
            ? app.filedByRole
              ? `${app.filedByName} (${app.filedByRole})`
              : app.filedByName
            : ''
        },
        { label: 'Submitted', value: app.submittedAt ? this.formatDate(app.submittedAt) : '' }
      ],
      searchCriteria: this.searchCriteriaItems(),
      applicants: this.buildPartyPrintRows(this.applicants(), 'Applicant'),
      respondents: this.buildPartyPrintRows(this.respondents(), 'Respondent'),
      disputedLands: this.disputedLands().map((land, index) => ({
        lineNo: String(land['lineNo'] ?? index + 1),
        landType: this.landTypeLabel(land) !== '—' ? this.landTypeLabel(land) : '',
        district: this.landDistrictLabel(land) !== '—' ? this.landDistrictLabel(land) : '',
        officeTaluka: this.landOfficeTalukaLabel(land) !== '—' ? this.landOfficeTalukaLabel(land) : '',
        village: this.landVillageLabel(land) !== '—' ? this.landVillageLabel(land) : '',
        ctsSurvey: this.landCts(land) !== '—' ? this.landCts(land) : '',
        plotFlat: this.str(land['flatNo'] ?? land['plotNo'] ?? land['gat']) !== '—' ? this.str(land['flatNo'] ?? land['plotNo'] ?? land['gat']) : '',
        totalArea: this.str(land['totalArea']) !== '—' ? this.str(land['totalArea']) : '',
        disputedArea: this.str(land['disputedArea']) !== '—' ? this.str(land['disputedArea']) : ''
      })),
      vakaltnamaGroups: this.vakaltnamaAssignments().map((g, gi) => ({
        title: `Group ${gi + 1}`,
        advocate: this.vakaltnamaAdvocateName(g) || '—',
        barCouncil: this.vakaltnamaBarCouncil(g) || '—',
        applicants: this.toStringArray(g['applicantIds'])
          .map((id) => this.applicantNameByTempId(id))
          .join(', ')
      })),
      descriptionParagraphs: this.descriptionParagraphs(),
      affidavitHtml: this.affidavitText(),
      prayerHtml: this.prayerText(),
      attachments: this.attachments().map((att) => ({
        kind: this.str(att['kind'] ?? att['documentTypeId']),
        fileName: this.str(att['fileName']),
        mimeType: this.str(att['mimeType']),
        uploadedAt: att['uploadedAt'] ? this.formatDate(String(att['uploadedAt'])) : ''
      }))
    };
    return buildApplicationPreviewPrintHtml(model);
  }

  private buildPartyPrintRows(
    rows: Array<Record<string, unknown>>,
    role: string
  ): ApplicationPreviewPrintModel['applicants'] {
    return rows.map((p, index) => ({
      title: `${role} #${p['lineNo'] ?? index + 1} — ${this.partyName(p)}`,
      lines: [
        { label: 'Mobile', value: this.printField(p['mobile']) },
        { label: 'Email', value: this.printField(p['email']) },
        { label: 'Pincode', value: this.printField(p['pincode']) },
        { label: 'Age', value: this.printField(p['age']) },
        { label: 'Occupation', value: this.printField(p['occupation']) },
        { label: 'Address', value: this.printField(p['address']) },
        {
          label: 'Location',
          value: [p['village'], p['taluka'], p['district']]
            .map((x) => this.printField(x))
            .filter(Boolean)
            .join(', ')
        }
      ]
    }));
  }

  protected previewPublishedJudgment(): void {
    const app = this.app();
    const body = this.data()?.judgmentSummary?.trim() || '';
    if (!body || !app) return;
    const today = new Date();
    const marathiMonth = [
      'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
      'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'
    ];
    const lands = this.disputedLands();
    const land = lands[0] ?? {};
    const vars: JudgmentPreviewVars = {
      phoneNumber: '',
      emailId: '',
      referenceNumber: String(app.caseNo ?? app.applicationNo ?? ''),
      referenceYearTwoDigits: toDevanagariDigits(String(today.getFullYear()).slice(-2)),
      noticeDateDay: toDevanagariDigits(String(today.getDate())),
      noticeDateMonth: marathiMonth[today.getMonth()] ?? '',
      noticeDateYear: toDevanagariDigits(String(today.getFullYear()).slice(-2)),
      caseNo: String(app.caseNo ?? ''),
      actSection: this.actSectionLabel(),
      villageNameMoje: pickStr(land, 'villageName'),
      taluka: pickStr(land, 'talukaName'),
      district: pickStr(land, 'districtName'),
      applicantNames: this.applicants().map((a) => partyDisplayName(a)),
      respondentNames: this.respondents().map((r) => partyDisplayName(r)),
      judgmentBody: body,
      signatoryName: '',
      signatoryDesignation: '',
      signatoryOffice: ''
    };
    const html = buildMarathiJudgmentPreviewHtml(vars);
    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }
}
