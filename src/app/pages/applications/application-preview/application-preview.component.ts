import { Component, effect, inject, input, OnInit, signal } from '@angular/core';
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
  buildAttachmentFileUrl,
  descriptionParagraphs,
  formatPreviewDate,
  formatSearchModeLabel,
  landSurveyOrCtsLabel,
  partyDisplayName,
  pickStr,
  toRecord,
  toRecordArray
} from '../../../shared/application-preview.util';
import { CATEGORY1_FILING_RETURN_SESSION_KEY } from '../efiling/services/category1-filing.service';

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

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(FilingApplicationService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly sanitizer = inject(DomSanitizer);

  private loadedApplicationId = 0;

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
    effect(() => {
      if (!this.embedded()) return;
      const id = Number(this.applicationId() ?? 0);
      if (id > 0) {
        this.loadApplication(id);
      }
    });
  }

  ngOnInit(): void {
    if (this.embedded()) return;

    const from = this.route.snapshot.queryParamMap.get('from');
    this.previewFromFiling = from === 'filing';
    if (this.previewFromFiling) {
      this.continueFilingCaseCategoryId = this.resolveContinueFilingCaseCategoryId();
    } else {
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
    if (id === this.loadedApplicationId && this.data()) return;
    this.loadedApplicationId = id;
    this.loading.set(true);
    this.error.set(null);
    this.data.set(null);
    this.history.set(null);
    this.activeTab.set('application');

    this.service.getApplicationPreview(id).subscribe({
      next: (resp) => {
        this.data.set(resp);
        if (this.previewFromFiling && this.continueFilingCaseCategoryId < 1) {
          const fromApi = Number(resp.application?.caseCategoryId ?? 0);
          if (fromApi > 0) {
            this.continueFilingCaseCategoryId = fromApi;
          }
        }
        if (resp.applicationHistory) {
          this.history.set(resp.applicationHistory);
        } else {
          this.loadHistory();
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load application details.');
        this.loading.set(false);
      }
    });
  }

  protected continueFiling(): void {
    const catId = this.continueFilingCaseCategoryId;
    if (catId < 1) {
      void this.router.navigate(['/applications/new']);
      return;
    }
    void this.router.navigate(['/applications/new'], { queryParams: { caseCategoryId: catId } });
  }

  private resolveContinueFilingCaseCategoryId(): number {
    const fromQuery = Number(this.route.snapshot.queryParamMap.get('caseCategoryId') || 0);
    if (fromQuery > 0) return fromQuery;

    try {
      const raw = sessionStorage.getItem(CATEGORY1_FILING_RETURN_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { caseCategoryId?: number };
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
      .getApplicationHistory(this.loadedApplicationId)
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
    return a.disputedLands?.length ? a.disputedLands : toRecordArray(this.form()['disputedLands']);
  }

  protected attachments(): Array<Record<string, unknown>> {
    const a = this.app();
    if (!a) return [];
    return a.attachments?.length ? a.attachments : toRecordArray(this.form()['attachments']);
  }

  protected disputedOrder(): Record<string, unknown> | null {
    return toRecord(this.app()?.disputedOrder) ?? null;
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

  protected actSectionLabel(): string {
    const f = this.form();
    const custom = pickStr(f, 'sectionCustomText');
    if (custom) return custom;
    const code = pickStr(f, 'sectionCode');
    const act = pickStr(f, 'actCode');
    if (code && act) return `${act} — ${code}`;
    if (code) return code;
    const sectionId = f['sectionId'];
    const actId = f['actId'];
    if (sectionId || actId) return `Act ${actId || '—'} / Section ${sectionId || '—'}`;
    return '—';
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

  protected attachmentUrl(att: Record<string, unknown>): string | null {
    return buildAttachmentFileUrl(att);
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
