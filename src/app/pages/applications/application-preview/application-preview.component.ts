import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { finalize } from 'rxjs';

import {
  FilingApplicationService,
  ApplicationPreviewResponse,
  ApplicationPreviewNotice,
  ApplicationHistoryResponse,
  ApplicationHistoryEntry,
} from '../../../services/filing-application.service';
import { ApplicationHistoryTimelineComponent } from '../application-history-timeline/application-history-timeline.component';
import { TokenStorageService } from '../../../services/token-storage.service';
import {
  buildMarathiJudgmentPreviewHtml,
  JudgmentPreviewVars,
  toDevanagariDigits
} from '../../../shared/sunvai-marathi-template';

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

  protected app(): ApplicationPreviewResponse['application'] | null {
    return this.data()?.application ?? null;
  }

  protected processingStageLabel(): string {
    return this.history()?.processingStageLabel || this.history()?.processingStage || '';
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

  protected arr(v: unknown): Record<string, unknown>[] {
    return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
  }

  protected str(v: unknown): string {
    return v != null ? String(v) : '-';
  }

  protected previewPublishedJudgment(): void {
    const app = this.app();
    const body = this.data()?.judgmentSummary?.trim() || '';
    if (!body) return;
    const today = new Date();
    const marathiMonth = ['जानेवारी','फेब्रुवारी','मार्च','एप्रिल','मे','जून','जुलै','ऑगस्ट','सप्टेंबर','ऑक्टोबर','नोव्हेंबर','डिसेंबर'];
    const form = app?.form ?? {};
    const lands = this.arr(app?.disputedLands);
    const land = lands[0] ?? {};
    const vars: JudgmentPreviewVars = {
      phoneNumber: '',
      emailId: '',
      referenceNumber: String(app?.caseNo ?? app?.applicationNo ?? ''),
      referenceYearTwoDigits: toDevanagariDigits(String(today.getFullYear()).slice(-2)),
      noticeDateDay: toDevanagariDigits(String(today.getDate())),
      noticeDateMonth: marathiMonth[today.getMonth()] ?? '',
      noticeDateYear: toDevanagariDigits(String(today.getFullYear()).slice(-2)),
      caseNo: String(app?.caseNo ?? ''),
      actSection: String(form['customSectionName'] ?? form['actId'] ?? ''),
      villageNameMoje: String(land['villageName'] ?? ''),
      taluka: String(land['talukaName'] ?? ''),
      district: String(land['districtName'] ?? ''),
      applicantNames: this.arr(app?.applicants).map((a) => String(a['name'] ?? '')),
      respondentNames: this.arr(app?.respondents).map((r) => String(r['name'] ?? '')),
      judgmentBody: body,
      signatoryName: '',
      signatoryDesignation: '',
      signatoryOffice: ''
    };
    const html = buildMarathiJudgmentPreviewHtml(vars);
    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) { w.document.write(html); w.document.close(); }
  }
}
