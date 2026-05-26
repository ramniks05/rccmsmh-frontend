import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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

type PreviewTab = 'application' | 'history' | 'notices' | 'hearings' | 'ordersheet' | 'judgment';

@Component({
  selector: 'app-application-preview',
  imports: [RouterLink, ApplicationHistoryTimelineComponent],
  templateUrl: './application-preview.component.html',
  styleUrl: './application-preview.component.css'
})
export class ApplicationPreviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(FilingApplicationService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly sanitizer = inject(DomSanitizer);

  private applicationId = 0;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<ApplicationPreviewResponse | null>(null);
  protected readonly activeTab = signal<PreviewTab>('application');

  protected readonly history = signal<ApplicationHistoryResponse | null>(null);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal<string | null>(null);

  protected readonly backLink = this.tokenStorage.isOfficer() ? '/cases' : '/applications';

  ngOnInit(): void {
    this.applicationId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.applicationId) {
      this.error.set('Invalid application ID.');
      this.loading.set(false);
      return;
    }
    this.service.getApplicationPreview(this.applicationId).subscribe({
      next: (resp) => {
        this.data.set(resp);
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

  protected setTab(tab: PreviewTab): void {
    this.activeTab.set(tab);
    if (tab === 'history' && !this.history() && !this.historyLoading()) {
      this.loadHistory();
    }
  }

  protected loadHistory(): void {
    if (!this.applicationId || this.historyLoading()) return;
    this.historyLoading.set(true);
    this.historyError.set(null);
    this.service
      .getApplicationHistory(this.applicationId)
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
