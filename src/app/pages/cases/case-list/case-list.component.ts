import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  OfficerApplicationDetail,
  OfficerFilingService,
  OfficerInboxItem
} from '../../../services/officer-filing.service';
import { ApplicationHistoryResponse } from '../../../services/filing-application.service';
import { ApplicationHistoryTimelineComponent } from '../../applications/application-history-timeline/application-history-timeline.component';
import {
  CaseHearingResponse,
  CaseJudgmentWorkflowResponse,
  judgmentTextFromResponse,
  judgmentWorkflowStatus,
  CaseNoticeItem,
  OfficerCaseInboxItem,
  OfficerAssignmentActionResponse,
  CaseOrderSheetHistoryResponse,
  CaseOrderSheetResponse,
  OfficerApproveResponse,
  OfficerCaseStageService,
  OfficerRoznamaTableRow,
  RoznamaResponse
} from '../../../services/officer-case-stage.service';
import { LandRecordsService, NoticeNineViewResponse, RuralSubSurveyRow, UrbanCtsRow } from '../../../services/land-records.service';
import { TokenStorageService } from '../../../services/token-storage.service';
import {
  buildDefaultJudgmentBodyText,
  buildMarathiJudgmentPreviewHtml,
  buildMarathiRoznamaPreviewHtml,
  buildMarathiSunvaniNoticeHtml,
  JudgmentPreviewVars,
  parseRoznamaContent,
  RoznamaEntryRow,
  RoznamaPreviewVars,
  serializeRoznamaContent,
  SunvaniNoticeVars,
  toDevanagariDigits
} from '../../../shared/sunvai-marathi-template';

@Component({
  selector: 'app-case-list',
  imports: [NgTemplateOutlet, RouterLink, ApplicationHistoryTimelineComponent],
  templateUrl: './case-list.component.html',
  styleUrl: './case-list.component.css'
})
export class CaseListComponent implements OnInit {
  private readonly officerFilings = inject(OfficerFilingService);
  private readonly officerCaseStage = inject(OfficerCaseStageService);
  private readonly landRecords = inject(LandRecordsService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);

  protected readonly role = this.tokenStorage.getRole() || '-';
  protected readonly isAdvocate = this.tokenStorage.isAdvocate();
  protected readonly isOfficer = this.tokenStorage.isOfficer();

  /** Logged-in officer's designation role — derived once from designationName in token. */
  protected readonly loginRole: 'CLERK' | 'PRESIDING_OFFICER' | '' = (() => {
    const d = String(this.tokenStorage.getDesignationName() || '').toLowerCase();
    if (d.includes('clerk')) return 'CLERK';
    if (d.includes('presid') || d.includes('po')) return 'PRESIDING_OFFICER';
    return '';
  })();

  protected readonly isClerk = this.loginRole === 'CLERK';
  protected readonly isPO = this.loginRole === 'PRESIDING_OFFICER';

  protected readonly loadingOfficerInbox = signal(false);
  protected readonly officerInboxError = signal<string | null>(null);
  protected readonly officerInbox = signal<OfficerInboxItem[]>([]);
  protected readonly caseInboxLoading = signal(false);
  protected readonly caseInboxError = signal<string | null>(null);
  protected readonly caseInbox = signal<OfficerCaseInboxItem[]>([]);
  /** Case statuses: ACTIVE | HEARING_SCHEDULED | DISPOSED */
  protected readonly officerMenu = signal<
    | 'ALL'
    | 'CLERK_DESK'
    | 'PO_DESK'
    | 'ASSIGN_HEARING'
    | 'PENDING_NOTICE'
    | 'PENDING_ORDER_SHEET'
    | 'CAUSE_LIST'
    | 'PENDING_JUDGMENT'
    | 'DISPOSED'
  >('ALL');
  protected readonly selectedApplicationId = signal<number | null>(null);
  protected readonly loadingOfficerDetail = signal(false);
  protected readonly officerDetailError = signal<string | null>(null);
  protected readonly officerDetail = signal<OfficerApplicationDetail | null>(null);
  protected readonly applicationHistory = signal<ApplicationHistoryResponse | null>(null);
  protected readonly applicationHistoryLoading = signal(false);
  protected readonly applicationHistoryError = signal<string | null>(null);
  protected readonly generatedCase = signal<OfficerApproveResponse | null>(null);
  /** Two-tab view: Action (context-specific form) | Details (read-only summary) */
  protected readonly officerTab = signal<'action' | 'details'>('action');
  protected readonly viewerFlowRole = signal<'CLERK' | 'PRESIDING_OFFICER' | ''>('');

  // Case stage operations
  protected readonly actionError = signal<string | null>(null);
  protected readonly actionMessage = signal<string | null>(null);
  protected readonly approving = signal(false);
  protected readonly assigning = signal(false);
  protected readonly actionRemarksInput = signal('');

  protected readonly hearingDateInput = signal('');
  protected readonly hearingNoticeGenerate = signal(true);
  protected readonly hearingRemarksInput = signal('');
  protected readonly hearingsLoading = signal(false);
  protected readonly hearings = signal<CaseHearingResponse[]>([]);
  protected readonly todayCauseListLoading = signal(false);
  protected readonly todayCauseList = signal<CaseHearingResponse[]>([]);

  protected readonly orderSheetHearingIdInput = signal('');
  protected readonly orderSheetContentInput = signal('');
  /** Tabular roznamah entries: column 1 = date, column 2 = content. */
  protected readonly roznamaEntryRows = signal<RoznamaEntryRow[]>([{ date: '', content: '' }]);
  protected readonly orderSheetRemarksInput = signal('');
  protected readonly orderSheetSaving = signal(false);
  protected readonly currentOrderSheet = signal<CaseOrderSheetResponse | null>(null);
  protected readonly orderSheetHistory = signal<CaseOrderSheetHistoryResponse[]>([]);

  // ── Notice workflow ────────────────────────────────────────────────────────
  protected readonly notices = signal<CaseNoticeItem[]>([]);
  protected readonly noticesLoading = signal(false);
  protected readonly noticeActionLoading = signal(false);
  protected readonly noticeSubmitting = signal(false);
  protected readonly noticeType = signal('HEARING_NOTICE');
  protected readonly noticeHearingIdInput = signal('');
  /** Set of selected party keys, e.g. "APPLICANT:1", "RESPONDENT:2" */
  protected readonly selectedPartyKeys = signal<Set<string>>(new Set());
  protected readonly noticeSignRef = signal('');
  protected readonly noticeRevertReason = signal('');
  protected readonly orderSheetRevertReason = signal('');
  protected readonly judgmentRevertReason = signal('');

  // ── Judgment workflow ──────────────────────────────────────────────────────
  protected readonly judgmentWorkflow = signal<CaseJudgmentWorkflowResponse | null>(null);
  protected readonly judgmentLoading = signal(false);
  protected readonly judgmentSummaryInput = signal('');
  protected readonly judgmentSaving = signal(false);
  protected readonly judgmentSubmitting = signal(false);

  // ── Order sheet finalize / sign ────────────────────────────────────────────
  protected readonly orderSheetFinalizing = signal(false);
  protected readonly orderSheetSigning = signal(false);
  protected readonly orderSheetSubmitting = signal(false);
  protected readonly orderSheetSignRef = signal('');

  // ── Cause list / roznama table ─────────────────────────────────────────────
  protected readonly roznamaTableDate = signal(this.todayIsoDate());
  protected readonly roznamaTableLoading = signal(false);
  protected readonly roznamaTableError = signal<string | null>(null);
  protected readonly roznamaTableRows = signal<OfficerRoznamaTableRow[]>([]);
  /** Hearing context from cause-list row — always pass to roznama APIs */
  protected readonly selectedRoznamaHearing = signal<{
    hearingId: number;
    hearingDate: string;
    filingApplicationId: number;
  } | null>(null);
  /** Full cause-list row when opened from roznama table (stage, canEdit, archived content). */
  protected readonly selectedRoznamaTableRow = signal<OfficerRoznamaTableRow | null>(null);
  protected readonly roznamaPanelTab = signal<'roznama' | 'rehearing'>('roznama');
  /** After roznamah signed: officer chooses rehearing vs final judgment. */
  protected readonly postRoznamaPath = signal<'rehearing' | 'judgment' | null>(null);
  protected readonly rehearingDateInput = signal('');
  protected readonly rehearingNoticeGenerate = signal(true);
  protected readonly rehearingRemarksInput = signal('Rehearing');
  protected readonly rehearingScheduling = signal(false);
  protected readonly roznamaReadOnlyContent = signal('');

  // Notice 9 fetch (officer side)
  protected readonly notice9FetchLoading = signal(false);
  protected readonly notice9FetchError = signal<string | null>(null);
  protected readonly notice9FetchedUrl = signal<string | null>(null);
  protected readonly notice9FetchedPreviewKind = signal<'image' | 'pdf' | 'none'>('none');

  // Disputed land fetch (officer side) - show one selected land detail
  protected readonly landDetailLoading = signal(false);
  protected readonly landDetailError = signal<string | null>(null);
  protected readonly landDetailTitle = signal<string>('');
  protected readonly landDetailPayload = signal<Record<string, unknown> | null>(null);

  ngOnInit(): void {
    if (this.isAdvocate && !this.isOfficer) {
      void this.router.navigate(['/applications']);
    }
  }

  constructor() {
    if (this.isOfficer) {
      this.loadOfficerInbox();
    }
  }

  protected loadOfficerInbox(): void {
    this.loadingOfficerInbox.set(true);
    this.officerInboxError.set(null);
    this.officerFilings.getInbox().subscribe({
      next: (rows) => this.officerInbox.set(rows || []),
      error: (err: unknown) => this.officerInboxError.set(this.formatError(err)),
      complete: () => this.loadingOfficerInbox.set(false)
    });
    // Always load ALL cases without a status filter so every menu tab
    // can client-side filter from the same dataset.
    this.loadCaseInbox();
  }

  protected setOfficerMenu(
    menu: 'ALL' | 'CLERK_DESK' | 'PO_DESK' | 'ASSIGN_HEARING' | 'PENDING_NOTICE' | 'PENDING_ORDER_SHEET' | 'CAUSE_LIST' | 'PENDING_JUDGMENT' | 'DISPOSED'
  ): void {
    this.officerMenu.set(menu);
    if (menu === 'CAUSE_LIST') {
      this.loadRoznamaTable();
    }
  }

  private todayIsoDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  protected roznamaOnePerCaseHint(): string {
    return 'This case has one order sheet (roznamah). Each save updates the same register; add a new table row when a rehearing date is held.';
  }

  private latestHearingFromList(rows: CaseHearingResponse[]): CaseHearingResponse | null {
    if (!rows.length) return null;
    return rows.reduce((a, b) => (b.hearingNo > a.hearingNo ? b : a));
  }

  protected latestHearingRef(): { hearingId: number; hearingDate: string } | null {
    const ctx = this.selectedRoznamaHearing();
    if (ctx?.hearingId) return { hearingId: ctx.hearingId, hearingDate: ctx.hearingDate };
    const hid = Number(this.orderSheetHearingIdInput().trim());
    if (hid > 0) {
      const h = this.hearings().find((x) => x.hearingId === hid);
      if (h) {
        return { hearingId: hid, hearingDate: h.hearingDate?.slice(0, 10) || this.roznamaTableDate() };
      }
    }
    const latest = this.latestHearingFromList(this.hearings());
    if (!latest?.hearingId) return null;
    return {
      hearingId: latest.hearingId,
      hearingDate: latest.hearingDate?.slice(0, 10) || this.roznamaTableDate()
    };
  }

  protected roznamaHearingQuery(): { hearingId: number; hearingDate: string } | null {
    return this.latestHearingRef();
  }

  protected latestHearingLabel(): string {
    const h = this.latestHearingFromList(this.hearings());
    if (!h) return '—';
    return `Hearing #${h.hearingNo} · ${h.hearingDate?.slice(0, 10) || ''}`;
  }

  protected ensureHearingRowInRegister(hearingDate: string): void {
    const d = (hearingDate || '').slice(0, 10);
    if (!d) return;
    const rows = this.roznamaEntryRows();
    if (rows.some((r) => r.date === d)) return;
    this.roznamaEntryRows.set([...rows, { date: d, content: '' }]);
    this.orderSheetContentInput.set(this.roznamaContentForApi());
  }

  protected loadRoznamaTable(): void {
    const date = this.roznamaTableDate().trim() || this.todayIsoDate();
    this.roznamaTableLoading.set(true);
    this.roznamaTableError.set(null);
    this.officerCaseStage.getRoznamaTable(date)
      .pipe(finalize(() => this.roznamaTableLoading.set(false)))
      .subscribe({
        next: (resp) => this.roznamaTableRows.set(resp.rows || []),
        error: (err: unknown) => {
          this.roznamaTableRows.set([]);
          this.roznamaTableError.set(this.formatError(err));
        }
      });
  }

  protected openRoznamaRow(row: OfficerRoznamaTableRow): void {
    this.selectedRoznamaTableRow.set(row);
    this.selectedRoznamaHearing.set({
      hearingId: row.hearingId,
      hearingDate: row.hearingDate?.slice(0, 10) || row.causeDate?.slice(0, 10) || '',
      filingApplicationId: row.filingApplicationId
    });
    this.orderSheetHearingIdInput.set(String(row.hearingId));
    this.roznamaPanelTab.set('roznama');
    this.viewOfficerApplication(row.filingApplicationId);
  }

  protected setRoznamaPanelTab(tab: 'roznama' | 'rehearing'): void {
    this.roznamaPanelTab.set(tab);
  }

  protected selectRoznamaHearingFromList(hearing: CaseHearingResponse): void {
    const appId = this.selectedApplicationId();
    const hearingDate = hearing.hearingDate?.slice(0, 10) || '';
    this.selectedRoznamaTableRow.set(null);
    this.selectedRoznamaHearing.set({
      hearingId: hearing.hearingId,
      hearingDate,
      filingApplicationId: appId ?? 0
    });
    this.orderSheetHearingIdInput.set(String(hearing.hearingId));
    this.ensureHearingRowInRegister(hearingDate);
  }

  private upStage(v: unknown): string {
    return String(v || '').toUpperCase();
  }

  /** Active roznamah still in workflow — blocks scheduling rehearing. */
  protected hasRoznamaInProgress(): boolean {
    const st = this.upStage(this.currentOrderSheet()?.status);
    return st === 'CLERK_DRAFT' || st === 'PO_SCRUTINY' || st === 'PO_FINALIZED';
  }

  /** Signed and no newer rehearing — view only. After rehearing, same register can be updated. */
  protected isRoznamaReadOnly(): boolean {
    if (this.upStage(this.currentOrderSheet()?.status) !== 'PO_SIGNED') return false;
    return !this.hasNewerHearingAfterSigned();
  }

  protected roznamaStatusLabel(): string {
    return this.currentOrderSheet()?.status || '—';
  }

  /** Case-level roznamah signed (one document per case). */
  protected isCurrentHearingRoznamaSigned(): boolean {
    return this.upStage(this.currentOrderSheet()?.status) === 'PO_SIGNED';
  }

  /** Rehearing scheduled after the case roznamah was signed. */
  protected hasNewerHearingAfterSigned(): boolean {
    if (!this.isCurrentHearingRoznamaSigned()) return false;
    const os = this.currentOrderSheet();
    const linkedId = os?.hearingId;
    const linked = linkedId ? this.hearings().find((h) => h.hearingId === linkedId) : null;
    const baselineNo = linked?.hearingNo ?? 0;
    return this.hearings().some((h) => h.hearingNo > baselineNo);
  }

  /** Choose rehearing vs final judgment after signed roznamah. */
  protected showPostRoznamaDecisionPanel(): boolean {
    if (!this.canRunCaseActions() || !this.showOrderSheetSection()) return false;
    if (!this.isCurrentHearingRoznamaSigned()) return false;
    if (this.hasNewerHearingAfterSigned()) return false;
    const jStatus = judgmentWorkflowStatus(this.judgmentWorkflow());
    if (jStatus) return false;
    return true;
  }

  protected selectPostRoznamaPath(path: 'rehearing' | 'judgment'): void {
    this.postRoznamaPath.set(path);
    this.actionError.set(null);
    if (path === 'rehearing') {
      this.setRoznamaPanelTab('rehearing');
      this.actionMessage.set('Schedule the next hearing date below. Roznamah will start fresh for that date.');
    } else {
      this.loadJudgmentWorkflow();
      this.actionMessage.set('Proceed with final judgment below. Publishing judgment will dispose the case.');
      setTimeout(() => {
        document.getElementById('judgment-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

  protected showRehearingPathOption(): boolean {
    return this.viewerFlowRole() === 'PRESIDING_OFFICER' && this.canScheduleRehearing();
  }

  protected showJudgmentPathOption(): boolean {
    return !this.isDisposedCase() && this.isCurrentHearingRoznamaSigned();
  }

  protected judgmentStatusLabel(): string {
    return judgmentWorkflowStatus(this.judgmentWorkflow()) || '—';
  }

  protected judgmentStepHint(): string {
    const st = judgmentWorkflowStatus(this.judgmentWorkflow());
    if (!st) return 'Clerk or PO: save draft → Clerk submits to PO → PO finalize → PO publish (case disposed).';
    if (st === 'CLERK_DRAFT') {
      return this.viewerFlowRole() === 'CLERK'
        ? 'Save draft, then submit to Presiding Officer for scrutiny.'
        : 'Clerk draft stage: you may save draft here. After clerk submits, use Finalize then Publish.';
    }
    if (st === 'PO_SCRUTINY') {
      return 'Submitted for scrutiny. Presiding Officer: review text, then Finalize and Publish. Revert to send back to Clerk.';
    }
    if (st === 'PO_FINALIZED') return 'Presiding Officer may publish judgment to dispose the case.';
    if (st === 'PUBLISHED') return 'Judgment published. Case is disposed.';
    return '';
  }

  protected judgmentTextFromWorkflow(resp: CaseJudgmentWorkflowResponse | null): string {
    return judgmentTextFromResponse(resp);
  }

  private applyJudgmentWorkflow(resp: CaseJudgmentWorkflowResponse): void {
    this.judgmentWorkflow.set(resp);
    this.judgmentSummaryInput.set(judgmentTextFromResponse(resp));
    if (judgmentWorkflowStatus(resp)) {
      this.postRoznamaPath.set('judgment');
    }
  }

  /** Schedule next hearing after case roznamah is signed (rehearing). */
  protected canScheduleRehearing(): boolean {
    if (!this.showOrderSheetSection() || this.isDisposedCase()) return false;
    if (this.hasRoznamaInProgress()) return false;
    return this.isCurrentHearingRoznamaSigned();
  }

  protected loadCaseInbox(status?: string): void {
    this.caseInboxLoading.set(true);
    this.caseInboxError.set(null);
    this.officerCaseStage.getCaseInbox(status).subscribe({
      next: (rows) => this.caseInbox.set(rows || []),
      error: (err: unknown) => this.caseInboxError.set(this.formatError(err)),
      complete: () => this.caseInboxLoading.set(false)
    });
  }

  /** Build a lookup map: filingApplicationId → OfficerCaseInboxItem */
  private caseMapByAppId(): Map<number, OfficerCaseInboxItem> {
    const map = new Map<number, OfficerCaseInboxItem>();
    for (const c of (this.caseInbox() || [])) {
      map.set(c.filingApplicationId, c);
    }
    return map;
  }

  /** Case status for a given applicationId (from joined caseInbox). */
  protected caseStatusFor(applicationId: number): string {
    return this.caseMapByAppId().get(applicationId)?.status || '';
  }

  /** Proceeding stage within HEARING_SCHEDULED (from case inbox / detail / cause list row). */
  protected currentProceedingStage(): string {
    const appId = this.selectedApplicationId();
    if (appId) {
      const fromCase = this.caseMapByAppId().get(appId)?.proceedingStage;
      if (fromCase) return String(fromCase).trim().toUpperCase();
    }
    const row = this.selectedRoznamaTableRow();
    if (row?.proceedingStage) return String(row.proceedingStage).trim().toUpperCase();
    const detailStage = String(
      (this.officerDetail() as { proceedingStage?: string } | null)?.proceedingStage ||
        this.officerDetail()?.processingStage ||
        ''
    ).trim();
    return detailStage.toUpperCase();
  }

  /** Stages where order sheet / roznamah UI is active (aligned with Pending Order Sheet inbox). */
  private isOrderSheetProceedingStage(stage: string): boolean {
    if (!stage) return false;
    const orderSheetStages = new Set([
      'ORDER_SHEET_PENDING',
      'ORDER_SHEET_IN_PROGRESS',
      'ROZNAMA_NOT_STARTED',
      'ROZNAMA_CLERK_DRAFT',
      'ROZNAMA_PENDING_CLERK',
      'ROZNAMA_PO_SCRUTINY',
      'ROZNAMA_PO_SIGN',
      'ROZNAMA_PO_FINALIZE',
      'ROZNAMA_PO_SIGNED'
    ]);
    if (orderSheetStages.has(stage)) return true;
    return stage.includes('ORDER_SHEET') || stage.includes('ROZNAMA');
  }

  protected orderSheetStageBlockedHint(): string | null {
    if (!this.caseIdForActions() || this.currentCaseStatus() !== 'HEARING_SCHEDULED') return null;
    if (this.showOrderSheetSection()) return null;
    const stage = this.currentProceedingStage();
    if (!stage) {
      return 'Complete hearing notice workflow first. Order sheet appears when the case proceeding stage moves to order sheet / roznamah.';
    }
    if (stage === 'NOTICE_PENDING' || stage === 'NOTICE_IN_PROGRESS') {
      return 'Finish notice draft, finalize, sign, and serve before the order sheet (roznamah) form is shown.';
    }
    if (stage === 'JUDGMENT_PENDING' || stage === 'JUDGMENT_IN_PROGRESS') {
      return 'Case is in judgment stage. Use the Judgment section below.';
    }
    return `Order sheet is not available at proceeding stage: ${stage}.`;
  }

  /** Case number for a given applicationId (from joined caseInbox). */
  protected caseNoFor(applicationId: number): string {
    return this.caseMapByAppId().get(applicationId)?.caseNo || '-';
  }

  /**
   * Merged inbox = officerInbox (pending applications)
   *              + caseInbox entries whose filingApplicationId is NOT already
   *                in officerInbox (approved cases that left the filing queue).
   *
   * Approved cases are represented as synthetic OfficerInboxItem rows so the
   * rest of the filtering and template code stays uniform.
   */
  private mergedInbox(): OfficerInboxItem[] {
    const appRows = this.officerInbox() || [];
    const appIds = new Set(appRows.map((r) => r.applicationId));

    const syntheticFromCases: OfficerInboxItem[] = (this.caseInbox() || [])
      .filter((c) => !appIds.has(c.filingApplicationId))
      .map((c) => ({
        applicationId: c.filingApplicationId,
        applicationNo: '',
        caseId: c.caseId,
        clientApplicationRef: '',
        caseCategoryId: c.caseCategoryId,
        caseCategoryName: c.caseCategoryName,
        subjectId: 0,
        subjectName: c.caseCategoryName,
        officeId: c.officeId,
        officeName: c.officeName,
        status: 'APPROVED',
        applicationDescription: null,
        filedByName: '',
        filedByRole: '',
        submittedAt: c.approvedAt,
        createdAt: c.approvedAt,
        processingStage: 'CASE_PROCEEDINGS',
        currentAssigneeRole: 'PRESIDING_OFFICER'
      }));

    return [...appRows, ...syntheticFromCases];
  }

  /**
   * All menus filter from mergedInbox() so approved cases (only in caseInbox)
   * are always visible alongside pending applications (only in officerInbox).
   */
  protected filteredOfficerInbox(): OfficerInboxItem[] {
    const rows = this.mergedInbox();
    const menu = this.officerMenu();
    const up = (v: unknown) => String(v || '').toUpperCase();

    if (menu === 'ALL') return rows;

    if (menu === 'CLERK_DESK') {
      return rows.filter((r) => {
        const stage = up(r.processingStage);
        return stage === 'CLERK_DRAFT_REVIEW' || stage === 'PO_SENT_BACK_TO_CLERK' || up(r.currentAssigneeRole) === 'CLERK';
      });
    }

    if (menu === 'PO_DESK') {
      // Applications assigned to PO, not yet converted to a case
      return rows.filter((r) => {
        const stage = up(r.processingStage);
        return (stage === 'PO_UNDER_REVIEW') && !this.caseMapByAppId().has(r.applicationId);
      });
    }

    const caseMap = this.caseMapByAppId();

    if (menu === 'ASSIGN_HEARING') {
      return rows.filter((r) => up(caseMap.get(r.applicationId)?.status) === 'ACTIVE');
    }

    // HEARING_SCHEDULED cases — split by proceedingStage (falls back to PENDING_NOTICE if absent)
    if (menu === 'PENDING_NOTICE') {
      return rows.filter((r) => {
        const c = caseMap.get(r.applicationId);
        if (up(c?.status) !== 'HEARING_SCHEDULED') return false;
        const stage = up(c?.proceedingStage ?? '');
        return !stage || stage === 'NOTICE_PENDING' || stage === 'NOTICE_IN_PROGRESS';
      });
    }

    if (menu === 'PENDING_ORDER_SHEET') {
      return rows.filter((r) => {
        const c = caseMap.get(r.applicationId);
        if (up(c?.status) !== 'HEARING_SCHEDULED') return false;
        const stage = up(c?.proceedingStage ?? '');
        if (this.isClerk) {
          return (
            stage === 'ORDER_SHEET_PENDING' ||
            stage === 'ORDER_SHEET_IN_PROGRESS' ||
            stage === 'ROZNAMA_CLERK_DRAFT' ||
            stage === 'ROZNAMA_PENDING_CLERK'
          );
        }
        return (
          stage === 'ORDER_SHEET_IN_PROGRESS' ||
          stage === 'ROZNAMA_PO_SCRUTINY' ||
          stage === 'ROZNAMA_PO_SIGN' ||
          stage === 'ROZNAMA_PO_FINALIZE'
        );
      });
    }

    if (menu === 'PENDING_JUDGMENT') {
      return rows.filter((r) => {
        const c = caseMap.get(r.applicationId);
        if (up(c?.status) !== 'HEARING_SCHEDULED') return false;
        const stage = up(c?.proceedingStage ?? '');
        return stage === 'JUDGMENT_PENDING' || stage === 'JUDGMENT_IN_PROGRESS';
      });
    }

    if (menu === 'DISPOSED') {
      return rows.filter((r) => up(caseMap.get(r.applicationId)?.status) === 'DISPOSED');
    }

    return rows;
  }

  protected menuCount(
    menu: 'ALL' | 'CLERK_DESK' | 'PO_DESK' | 'ASSIGN_HEARING' | 'PENDING_NOTICE' | 'PENDING_ORDER_SHEET' | 'PENDING_JUDGMENT' | 'DISPOSED'
  ): number {
    const rows = this.mergedInbox();
    const up = (v: unknown) => String(v || '').toUpperCase();
    const caseMap = this.caseMapByAppId();

    if (menu === 'ALL') return rows.length;
    if (menu === 'CLERK_DESK') return rows.filter((r) => {
      const stage = up(r.processingStage);
      return (stage === 'CLERK_DRAFT_REVIEW' || stage === 'PO_SENT_BACK_TO_CLERK' || up(r.currentAssigneeRole) === 'CLERK');
    }).length;
    if (menu === 'PO_DESK') return rows.filter((r) => up(r.processingStage) === 'PO_UNDER_REVIEW' && !caseMap.has(r.applicationId)).length;
    if (menu === 'ASSIGN_HEARING') return rows.filter((r) => up(caseMap.get(r.applicationId)?.status) === 'ACTIVE').length;
    if (menu === 'PENDING_NOTICE') return rows.filter((r) => {
      const c = caseMap.get(r.applicationId);
      if (up(c?.status) !== 'HEARING_SCHEDULED') return false;
      const stage = up(c?.proceedingStage ?? '');
      return !stage || stage === 'NOTICE_PENDING' || stage === 'NOTICE_IN_PROGRESS';
    }).length;
    if (menu === 'PENDING_ORDER_SHEET') {
      return rows.filter((r) => {
        const c = caseMap.get(r.applicationId);
        if (up(c?.status) !== 'HEARING_SCHEDULED') return false;
        const stage = up(c?.proceedingStage ?? '');
        if (this.isClerk) {
          return (
            stage === 'ORDER_SHEET_PENDING' ||
            stage === 'ORDER_SHEET_IN_PROGRESS' ||
            stage === 'ROZNAMA_CLERK_DRAFT' ||
            stage === 'ROZNAMA_PENDING_CLERK'
          );
        }
        return (
          stage === 'ORDER_SHEET_IN_PROGRESS' ||
          stage === 'ROZNAMA_PO_SCRUTINY' ||
          stage === 'ROZNAMA_PO_SIGN' ||
          stage === 'ROZNAMA_PO_FINALIZE'
        );
      }).length;
    }
    if (menu === 'PENDING_JUDGMENT') return rows.filter((r) => {
      const c = caseMap.get(r.applicationId);
      if (up(c?.status) !== 'HEARING_SCHEDULED') return false;
      const stage = up(c?.proceedingStage ?? '');
      return stage === 'JUDGMENT_PENDING' || stage === 'JUDGMENT_IN_PROGRESS';
    }).length;
    if (menu === 'DISPOSED') return rows.filter((r) => up(caseMap.get(r.applicationId)?.status) === 'DISPOSED').length;
    return 0;
  }

  protected viewOfficerApplication(applicationId: number): void {
    this.selectedApplicationId.set(applicationId);
    this.loadingOfficerDetail.set(true);
    this.officerDetailError.set(null);
    this.notice9FetchError.set(null);
    this.notice9FetchedUrl.set(null);
    this.notice9FetchedPreviewKind.set('none');
    this.landDetailError.set(null);
    this.landDetailTitle.set('');
    this.landDetailPayload.set(null);
    this.generatedCase.set(null);
    this.actionError.set(null);
    this.actionMessage.set(null);
    this.hearings.set([]);
    this.todayCauseList.set([]);
    this.currentOrderSheet.set(null);
    this.orderSheetHistory.set([]);
    this.selectedRoznamaHearing.set(null);
    this.selectedRoznamaTableRow.set(null);
    this.roznamaPanelTab.set('roznama');
    this.postRoznamaPath.set(null);
    this.roznamaReadOnlyContent.set('');
    this.roznamaEntryRows.set([{ date: '', content: '' }]);
    this.notices.set([]);
    this.judgmentWorkflow.set(null);
    this.selectedPartyKeys.set(new Set());
    this.noticeHearingIdInput.set('');
    this.officerTab.set('action');
    this.viewerFlowRole.set('');
    this.applicationHistory.set(null);
    this.applicationHistoryError.set(null);
    // Scroll to the detail card immediately so user sees the loading state
    setTimeout(() => {
      document.getElementById('application-details-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    // For approved cases that exist in caseInbox, use the case endpoint; otherwise use the filing application endpoint
    const caseEntry = this.caseMapByAppId().get(applicationId);
    const detail$ = caseEntry
      ? this.officerCaseStage.getCaseDetail(caseEntry.caseId)
      : this.officerFilings.getApplicationDetail(applicationId);

    detail$
      .pipe(finalize(() => this.loadingOfficerDetail.set(false)))
      .subscribe({
        next: (row) => {
          const detail = this.unwrapDetail(row);
          this.officerDetail.set(detail);
          const embeddedHistory =
            detail.applicationHistory ??
            ((row as Record<string, unknown>)['applicationHistory'] as ApplicationHistoryResponse | undefined);
          this.loadApplicationHistory(applicationId, embeddedHistory);
          this.viewerFlowRole.set(this.resolveAssigneeRole(detail));
          // Prefer caseId from caseInbox (most reliable), fall back to detail field
          const knownCaseId = caseEntry?.caseId;
          const detailCaseId = (detail as unknown as Record<string, unknown>)['caseId'];
          const resolvedCaseId = knownCaseId ?? (typeof detailCaseId === 'number' && detailCaseId > 0 ? detailCaseId : null);
          const caseNo = caseEntry?.caseNo ?? String((detail as unknown as Record<string, unknown>)['caseNo'] || '');
          if (resolvedCaseId) {
            this.generatedCase.set({
              applicationId,
              applicationNo: String((detail as unknown as Record<string, unknown>)['applicationNo'] || ''),
              caseId: resolvedCaseId,
              caseNo,
              message: 'Case already generated.'
            });
          this.loadHearings();
          this.loadNotices();
          this.loadJudgmentWorkflow();
        }
      },
        error: (err: unknown) => this.officerDetailError.set(this.formatError(err))
      });
  }

  private loadApplicationHistory(
    applicationId: number,
    embedded?: ApplicationHistoryResponse
  ): void {
    if (embedded) {
      this.applicationHistory.set(embedded);
      this.applicationHistoryLoading.set(false);
      this.applicationHistoryError.set(null);
      return;
    }
    this.applicationHistoryLoading.set(true);
    this.applicationHistoryError.set(null);
    this.officerFilings.getApplicationHistory(applicationId).subscribe({
      next: (h) => {
        this.applicationHistory.set(h);
        this.applicationHistoryLoading.set(false);
      },
      error: (err: unknown) => {
        this.applicationHistoryError.set(this.formatError(err));
        this.applicationHistoryLoading.set(false);
      }
    });
  }

  protected selectOfficerTab(tab: 'action' | 'details'): void {
    this.officerTab.set(tab);
  }

  /** Label shown on the Action tab button — matches the workflow step. */
  protected actionTabLabel(): string {
    const s = this.currentCaseStatus();
    if (!this.caseIdForActions()) {
      if (this.isAssignedToClerk()) return 'Scrutiny & Forward';
      if (this.isAssignedToPo()) return 'Approval Decision';
      return 'Action';
    }
    if (s === 'ACTIVE') return 'Assign Hearing Date';
    if (s === 'HEARING_SCHEDULED') {
      // Reflect the most relevant pending action based on sub-workflow progress
      const noticeDone = this.notices().some((n) => String((n as unknown as Record<string,unknown>)['status'] || '').toUpperCase() === 'SERVED');
      const osSigned = this.isCurrentHearingRoznamaSigned();
      if (!noticeDone) return 'Pending Draft Notice';
      if (!osSigned) return 'Pending Order Sheet';
      if (this.showPostRoznamaDecisionPanel()) return 'Next: Rehearing or Judgment';
      if (this.postRoznamaPath() === 'rehearing') return 'Schedule Rehearing';
      const jStatus = judgmentWorkflowStatus(this.judgmentWorkflow());
      if (!jStatus || jStatus === 'CLERK_DRAFT') return 'Pending Judgment';
      if (jStatus === 'PO_SCRUTINY') return 'Finalize Judgment';
      if (jStatus === 'PO_FINALIZED') return 'Publish Judgment';
      return 'Case Proceedings';
    }
    if (s === 'DISPOSED') return 'Disposed';
    return 'Action';
  }

  protected caseIdForActions(): number | null {
    const generated = this.generatedCase();
    if (generated?.caseId) return generated.caseId;
    const detail = this.officerDetail() as unknown as Record<string, unknown> | null;
    const caseId = detail?.['caseId'];
    return typeof caseId === 'number' && caseId > 0 ? caseId : null;
  }

  protected currentAssigneeRole(): string {
    const detailRole = String(this.officerDetail()?.currentAssigneeRole || '').toUpperCase();
    if (detailRole) return detailRole;
    const selectedId = this.selectedApplicationId();
    const inboxRole =
      this.officerInbox().find((x) => x.applicationId === selectedId)?.currentAssigneeRole || '';
    if (String(inboxRole).trim()) return String(inboxRole).toUpperCase();
    const stage = String(this.officerDetail()?.processingStage || '').toUpperCase();
    if (stage.includes('CLERK')) return 'CLERK';
    if (stage.includes('PO')) return 'PRESIDING_OFFICER';
    return '';
  }

  protected isAssignedToClerk(): boolean {
    return this.currentAssigneeRole() === 'CLERK';
  }

  protected isAssignedToPo(): boolean {
    return this.currentAssigneeRole() === 'PRESIDING_OFFICER';
  }

  protected canForwardToPo(): boolean {
    const role = this.currentAssigneeRole();
    const noCase = !this.caseIdForActions();
    if (!noCase) return false;
    if (this.viewerFlowRole() !== 'CLERK') return false;
    if (role === 'CLERK') return true;
    if (!role) {
      const stage = String(this.officerDetail()?.processingStage || '').toUpperCase();
      if (!stage || stage.includes('CLERK')) return true;
    }
    return false;
  }

  protected canPoReviewActions(): boolean {
    return !this.caseIdForActions() && this.isAssignedToPo() && this.viewerFlowRole() === 'PRESIDING_OFFICER';
  }

  protected isDisposedCase(): boolean {
    // Judgment published → case is DISPOSED
    const judgmentStatus = judgmentWorkflowStatus(this.judgmentWorkflow());
    if (judgmentStatus === 'PUBLISHED') return true;
    // Case status from inbox or detail
    const caseStatus = this.currentCaseStatus();
    if (caseStatus === 'DISPOSED') return true;
    const detailStatus = (this.officerDetail()?.status || '').toUpperCase();
    return detailStatus === 'DISPOSED';
  }

  protected canRunCaseActions(): boolean {
    return !!this.caseIdForActions() && !this.isDisposedCase();
  }

  /** Case status from caseInbox for the currently selected application. */
  protected currentCaseStatus(): string {
    const selectedId = this.selectedApplicationId();
    if (!selectedId) return '';
    return String(this.caseMapByAppId().get(selectedId)?.status || '').toUpperCase();
  }

  /** Hearing scheduling: visible for ACTIVE or HEARING_SCHEDULED cases. */
  protected showHearingSection(): boolean {
    if (!this.caseIdForActions()) return false;
    const s = this.currentCaseStatus();
    return s === 'ACTIVE' || s === 'HEARING_SCHEDULED';
  }

  /** Notice section: only during notice proceeding stages (default when stage unset). */
  protected showNoticeSection(): boolean {
    if (!this.caseIdForActions() || this.currentCaseStatus() !== 'HEARING_SCHEDULED') return false;
    const stage = this.currentProceedingStage();
    if (!stage) return true;
    return stage === 'NOTICE_PENDING' || stage === 'NOTICE_IN_PROGRESS';
  }

  /** Order sheet: only when case proceeding stage is order sheet / roznamah (not during notice). */
  protected showOrderSheetSection(): boolean {
    if (!this.caseIdForActions() || this.currentCaseStatus() !== 'HEARING_SCHEDULED') return false;
    return this.isOrderSheetProceedingStage(this.currentProceedingStage());
  }

  /** Judgment section: after path chosen, workflow started, or case disposed. */
  protected showJudgmentSection(): boolean {
    if (!this.caseIdForActions()) return false;
    const s = this.currentCaseStatus();
    if (s === 'DISPOSED' || this.isDisposedCase()) return true;
    if (s !== 'HEARING_SCHEDULED') return false;
    const jStatus = judgmentWorkflowStatus(this.judgmentWorkflow());
    if (jStatus) return true;
    if (this.postRoznamaPath() === 'judgment') return true;
    return false;
  }

  /** Can schedule hearing: ACTIVE only (HEARING_SCHEDULED = already scheduled). */
  protected canScheduleHearing(): boolean {
    return this.currentCaseStatus() === 'ACTIVE' && !this.isDisposedCase();
  }

  /** PO always edits roznamah until signed (draft, scrutiny, pre-sign). */
  protected canPoEditRoznama(): boolean {
    if (this.viewerFlowRole() !== 'PRESIDING_OFFICER' || this.isDisposedCase() || !this.showOrderSheetSection()) {
      return false;
    }
    if (this.isRoznamaReadOnly()) return false;
    const os = this.currentOrderSheet();
    if (!os) return true;
    const st = this.upStage(os.status);
    if (st === 'PO_SIGNED') return false;
    if (st === 'CLERK_DRAFT' || st === 'PO_SCRUTINY' || st === 'PO_FINALIZED') return true;
    return os.canEdit !== false;
  }

  /** @deprecated alias */
  protected canPoSaveRoznamaDraft(): boolean {
    return this.canPoEditRoznama();
  }

  protected poRoznamaSaveLabel(): string {
    const st = this.upStage(this.currentOrderSheet()?.status);
    if (!st) return 'Save Roznama Draft';
    if (st === 'PO_SCRUTINY') return 'Update (scrutiny)';
    if (st === 'PO_FINALIZED') return 'Update before sign';
    return 'Update Roznama';
  }

  protected poRoznamaEditHint(): string | null {
    const st = this.upStage(this.currentOrderSheet()?.status);
    if (st === 'PO_SCRUTINY') {
      return 'Clerk submitted roznamah for scrutiny. You may edit and save changes, then finalize and sign.';
    }
    if (st === 'PO_FINALIZED') {
      return 'Review saved text, make any last changes, save, then sign.';
    }
    if (st === 'CLERK_DRAFT') {
      return 'Edit roznamah here. After clerk submits for scrutiny, you can still change and save before signing.';
    }
    return null;
  }

  /** Clerk edits PO's CLERK_DRAFT roznamah and submits for scrutiny. */
  protected canClerkEditRoznama(): boolean {
    if (this.viewerFlowRole() !== 'CLERK' || this.isDisposedCase() || !this.showOrderSheetSection()) return false;
    if (this.isRoznamaReadOnly()) return false;
    const os = this.currentOrderSheet();
    return !os || os.status === 'CLERK_DRAFT';
  }

  /** Clerk submits to PO after editing. */
  protected canClerkSubmitOrderSheetToPo(): boolean {
    return this.canClerkEditRoznama();
  }

  /** PO optional finalize after PO_SCRUTINY. */
  protected canFinalizeOrderSheet(): boolean {
    if (this.viewerFlowRole() !== 'PRESIDING_OFFICER' || this.isDisposedCase()) return false;
    return this.currentOrderSheet()?.status === 'PO_SCRUTINY';
  }

  /** PO sign from PO_SCRUTINY (min path) or PO_FINALIZED. */
  protected canSignOrderSheet(): boolean {
    if (this.viewerFlowRole() !== 'PRESIDING_OFFICER' || this.isDisposedCase()) return false;
    const st = this.currentOrderSheet()?.status || '';
    return st === 'PO_SCRUTINY' || st === 'PO_FINALIZED';
  }

  protected canPoDraftOrderSheet(): boolean {
    return this.canPoSaveRoznamaDraft();
  }

  protected canClerkEditOrderSheet(): boolean {
    return this.canClerkEditRoznama();
  }

  /** Clerk can draft notice. */
  protected canDraftNotice(): boolean {
    if (this.viewerFlowRole() !== 'CLERK' || !this.showNoticeSection() || this.isDisposedCase()) return false;
    // Show draft form only when no notice exists yet
    return this.notices().length === 0;
  }

  /** Clerk or PO can save draft when none or CLERK_DRAFT (not after submit to PO). */
  protected canDraftJudgment(): boolean {
    const role = this.viewerFlowRole();
    if (role !== 'CLERK' && role !== 'PRESIDING_OFFICER') return false;
    if (this.isDisposedCase() || !this.showJudgmentSection()) return false;
    const st = judgmentWorkflowStatus(this.judgmentWorkflow());
    return !st || st === 'CLERK_DRAFT';
  }

  /** Clerk submits draft to PO → PO_SCRUTINY. */
  protected canClerkSubmitJudgmentToPo(): boolean {
    if (this.viewerFlowRole() !== 'CLERK' || this.isDisposedCase() || !this.showJudgmentSection()) return false;
    if (judgmentWorkflowStatus(this.judgmentWorkflow()) !== 'CLERK_DRAFT') return false;
    return !!this.judgmentSummaryInput().trim() || !!this.judgmentTextFromWorkflow(this.judgmentWorkflow());
  }

  /** Read-only judgment text after clerk submit or when finalized. */
  protected showJudgmentReadOnly(): boolean {
    if (!this.showJudgmentSection() || this.canDraftJudgment()) return false;
    const st = judgmentWorkflowStatus(this.judgmentWorkflow());
    return st === 'PO_SCRUTINY' || st === 'PO_FINALIZED' || st === 'PUBLISHED';
  }

  /** PO finalizes after clerk submit (PO_SCRUTINY). */
  protected canFinalizeJudgment(): boolean {
    if (this.viewerFlowRole() !== 'PRESIDING_OFFICER' || this.isDisposedCase()) return false;
    return judgmentWorkflowStatus(this.judgmentWorkflow()) === 'PO_SCRUTINY';
  }

  /** PO can publish judgment when PO_FINALIZED. */
  protected canPublishJudgment(): boolean {
    if (this.viewerFlowRole() !== 'PRESIDING_OFFICER' || this.isDisposedCase()) return false;
    return judgmentWorkflowStatus(this.judgmentWorkflow()) === 'PO_FINALIZED';
  }

  /** PO reverts from PO_SCRUTINY or PO_FINALIZED back to CLERK_DRAFT. */
  protected canRevertJudgment(): boolean {
    if (this.viewerFlowRole() !== 'PRESIDING_OFFICER' || this.isDisposedCase()) return false;
    const st = judgmentWorkflowStatus(this.judgmentWorkflow());
    return st === 'PO_SCRUTINY' || st === 'PO_FINALIZED';
  }

  /** @deprecated kept for template backward compat */
  protected canWriteOrderSheet(): boolean {
    return this.canPoEditRoznama() || this.canClerkEditRoznama();
  }
  protected canPassFinalJudgment(): boolean { return this.canDraftJudgment(); }

  protected approveAndGenerateCase(): void {
    const appId = this.selectedApplicationId();
    if (!appId) return;
    this.approving.set(true);
    this.actionError.set(null);
    this.actionMessage.set(null);
    this.officerCaseStage.approveApplication(appId).subscribe({
      next: (resp) => {
        this.generatedCase.set(resp);
        this.actionMessage.set(resp.message || 'Case generated successfully.');
        this.loadHearings();
        this.loadCurrentOrderSheet();
        this.loadOrderSheetHistory();
        this.loadOfficerInbox();
      },
      error: (err: unknown) => this.actionError.set(this.formatError(err)),
      complete: () => this.approving.set(false)
    });
  }

  protected forwardToPo(): void {
    const appId = this.selectedApplicationId();
    if (!appId) return;
    const remarks = this.actionRemarksInput().trim();
    if (!remarks) {
      this.actionError.set('Remarks are required.');
      return;
    }
    this.assigning.set(true);
    this.actionError.set(null);
    this.officerCaseStage.forwardToPo(appId, { remarks }).subscribe({
      next: (resp) => this.applyAssignmentAction(resp),
      error: (err: unknown) => this.actionError.set(this.formatError(err)),
      complete: () => this.assigning.set(false)
    });
  }

  protected returnToClerk(): void {
    const appId = this.selectedApplicationId();
    if (!appId) return;
    const remarks = this.actionRemarksInput().trim();
    if (!remarks) {
      this.actionError.set('Remarks are required.');
      return;
    }
    this.assigning.set(true);
    this.actionError.set(null);
    this.officerCaseStage.returnToClerk(appId, { remarks }).subscribe({
      next: (resp) => this.applyAssignmentAction(resp),
      error: (err: unknown) => this.actionError.set(this.formatError(err)),
      complete: () => this.assigning.set(false)
    });
  }

  protected rejectApplicationByPo(): void {
    const appId = this.selectedApplicationId();
    if (!appId) return;
    const remarks = this.actionRemarksInput().trim();
    if (!remarks) {
      this.actionError.set('Remarks are required.');
      return;
    }
    if (!confirm('Reject this application?')) return;
    this.assigning.set(true);
    this.actionError.set(null);
    this.officerCaseStage.rejectApplication(appId, { remarks }).subscribe({
      next: (resp) => this.applyAssignmentAction(resp),
      error: (err: unknown) => this.actionError.set(this.formatError(err)),
      complete: () => this.assigning.set(false)
    });
  }

  protected scheduleRehearing(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) {
      this.actionError.set('Approve application first to get case ID.');
      return;
    }
    if (this.hasRoznamaInProgress()) {
      this.actionError.set('Finish or revert the current roznamah before scheduling rehearing.');
      return;
    }
    const hearingDate = this.rehearingDateInput().trim();
    if (!hearingDate) {
      this.actionError.set('Please select the next hearing date.');
      return;
    }
    this.rehearingScheduling.set(true);
    this.actionError.set(null);
    this.officerCaseStage
      .scheduleHearing(caseId, {
        hearingDate,
        noticeGenerate: this.rehearingNoticeGenerate(),
        remarks: this.rehearingRemarksInput().trim() || 'Rehearing'
      })
      .pipe(finalize(() => this.rehearingScheduling.set(false)))
      .subscribe({
        next: (resp) => {
          const hd = resp.hearingDate?.slice(0, 10) || hearingDate;
          this.actionMessage.set(
            `Rehearing #${resp.hearingNo} scheduled for ${hd}. Add proceedings for this date in the case roznamah register below (same document).`
          );
          this.rehearingDateInput.set('');
          this.rehearingRemarksInput.set('Rehearing');
          this.selectedRoznamaTableRow.set(null);
          this.selectedRoznamaHearing.set({
            hearingId: resp.hearingId,
            hearingDate: hd,
            filingApplicationId: this.selectedApplicationId() ?? 0
          });
          this.orderSheetHearingIdInput.set(String(resp.hearingId));
          this.roznamaPanelTab.set('roznama');
          this.postRoznamaPath.set('rehearing');
          this.loadHearings();
          this.loadRoznamaTable();
          this.loadCaseInbox();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected scheduleHearing(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) {
      this.actionError.set('Approve application first to get case ID.');
      return;
    }
    const hearingDate = this.hearingDateInput().trim();
    if (!hearingDate) {
      this.actionError.set('Please select hearing date.');
      return;
    }
    this.actionError.set(null);
    this.actionMessage.set(null);
    this.hearingsLoading.set(true);
    this.officerCaseStage
      .scheduleHearing(caseId, {
        hearingDate,
        noticeGenerate: this.hearingNoticeGenerate(),
        remarks: this.hearingRemarksInput().trim()
      })
      .subscribe({
        next: (resp) => {
          this.actionMessage.set(`Hearing #${resp.hearingNo} scheduled.`);
          this.hearingRemarksInput.set('');
          this.loadHearings();
          this.loadTodayCauseList();
          this.loadCaseInbox();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err)),
        complete: () => this.hearingsLoading.set(false)
      });
  }

  protected loadHearings(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.hearingsLoading.set(true);
    this.officerCaseStage.listHearings(caseId).subscribe({
      next: (rows) => {
        this.hearings.set(rows || []);
        const latest = this.latestHearingFromList(rows || []);
        if (latest?.hearingId) {
          this.orderSheetHearingIdInput.set(String(latest.hearingId));
          if (!this.selectedRoznamaHearing()) {
            this.selectedRoznamaHearing.set({
              hearingId: latest.hearingId,
              hearingDate: latest.hearingDate?.slice(0, 10) || '',
              filingApplicationId: this.selectedApplicationId() ?? 0
            });
          }
        }
        this.loadCurrentOrderSheet();
        this.loadOrderSheetHistory();
      },
      error: (err: unknown) => this.actionError.set(this.formatError(err)),
      complete: () => this.hearingsLoading.set(false)
    });
  }

  protected loadTodayCauseList(): void {
    this.todayCauseListLoading.set(true);
    this.officerCaseStage.getTodayCauseList().subscribe({
      next: (rows) => this.todayCauseList.set(rows || []),
      error: (err: unknown) => this.actionError.set(this.formatError(err)),
      complete: () => this.todayCauseListLoading.set(false)
    });
  }

  protected saveOrderSheet(): void {
    const caseId = this.caseIdForActions();
    const ref = this.latestHearingRef();
    if (!caseId) {
      this.actionError.set('Approve application first to get case ID.');
      return;
    }
    const content = this.roznamaContentForApi().trim();
    if (!content || !this.roznamaEntryRows().some((r) => r.content.trim())) {
      this.actionError.set('Roznama content is required in at least one table row.');
      return;
    }
    const hadExisting = !!this.currentOrderSheet()?.id;
    this.orderSheetSaving.set(true);
    this.actionError.set(null);
    this.officerCaseStage
      .draftRoznama(caseId, {
        hearingId: ref?.hearingId,
        hearingDate: ref?.hearingDate,
        content,
        remarks: this.orderSheetRemarksInput().trim() || undefined
      })
      .subscribe({
        next: (resp) => {
          this.currentOrderSheet.set(resp as CaseOrderSheetResponse);
          this.actionMessage.set(hadExisting ? 'Roznama updated.' : 'Roznama saved.');
          this.loadOrderSheetHistory();
          this.loadRoznamaTable();
          this.loadCaseInbox();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err)),
        complete: () => this.orderSheetSaving.set(false)
      });
  }

  protected loadCurrentOrderSheet(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;

    const ref = this.latestHearingRef();
    const defaultDate = ref?.hearingDate || this.todayIsoDate();

    this.officerCaseStage.getRoznama(caseId).subscribe({
      next: (resp) => {
        const sheet = resp as CaseOrderSheetResponse;
        this.currentOrderSheet.set(sheet);
        const content = sheet.content || sheet.draftContent || sheet.finalContent || '';
        this.syncRoznamaRowsFromContent(content, defaultDate);
        this.roznamaReadOnlyContent.set(this.isRoznamaReadOnly() ? content : '');
        if (ref) {
          this.ensureHearingRowInRegister(ref.hearingDate);
        }
        if (this.upStage(sheet.status) === 'PO_SIGNED') {
          this.loadJudgmentWorkflow();
        }
      },
      error: () => {
        this.currentOrderSheet.set(null);
        this.roznamaEntryRows.set([{ date: defaultDate, content: '' }]);
        this.roznamaReadOnlyContent.set('');
        if (ref) {
          this.actionMessage.set('No roznamah yet for this case. Save draft to create the register.');
        }
      }
    });
  }

  protected loadOrderSheetHistory(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.officerCaseStage.getRoznamaHistory(caseId).subscribe({
      next: (rows) => this.orderSheetHistory.set(rows || []),
      error: () => this.orderSheetHistory.set([])
    });
  }

  protected submitOrderSheetToPO(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.orderSheetSubmitting.set(true);
    this.actionError.set(null);
    this.officerCaseStage.submitRoznamaToPO(caseId)
      .pipe(finalize(() => this.orderSheetSubmitting.set(false)))
      .subscribe({
        next: (resp) => {
          this.currentOrderSheet.set(resp as CaseOrderSheetResponse);
          this.actionMessage.set('Roznama submitted to Presiding Officer for scrutiny.');
          this.loadOrderSheetHistory();
          this.loadRoznamaTable();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected finalizeOrderSheet(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.orderSheetFinalizing.set(true);
    this.actionError.set(null);
    this.officerCaseStage.finalizeRoznama(caseId)
      .pipe(finalize(() => this.orderSheetFinalizing.set(false)))
      .subscribe({
        next: (resp) => {
          this.currentOrderSheet.set(resp as CaseOrderSheetResponse);
          this.actionMessage.set('Roznama finalized.');
          this.loadRoznamaTable();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected signOrderSheet(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    const ref = this.orderSheetSignRef().trim();
    if (!ref) { this.actionError.set('Digital signature reference is required.'); return; }
    this.orderSheetSigning.set(true);
    this.actionError.set(null);
    const hearingRef = this.latestHearingRef();
    this.officerCaseStage.signRoznama(caseId, {
      digitalSignatureRef: ref,
      hearingId: hearingRef?.hearingId,
      hearingDate: hearingRef?.hearingDate
    })
      .pipe(finalize(() => this.orderSheetSigning.set(false)))
      .subscribe({
        next: (resp) => {
          this.currentOrderSheet.set(resp as CaseOrderSheetResponse);
          this.postRoznamaPath.set(null);
          this.actionMessage.set(
            'Roznama signed. Choose below: schedule another hearing (rehearing) or proceed to final judgment.'
          );
          this.loadJudgmentWorkflow();
          this.loadCaseInbox();
          this.loadRoznamaTable();
          this.loadHearings();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected revertOrderSheet(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    const reason = this.orderSheetRevertReason().trim();
    if (!reason) { this.actionError.set('Please enter remarks before reverting.'); return; }
    this.actionError.set(null);
    this.officerCaseStage.revertRoznamaToClerk(caseId, reason)
      .subscribe({
        next: (resp) => {
          this.currentOrderSheet.set(resp as CaseOrderSheetResponse);
          this.actionMessage.set('Roznama reverted to Clerk for editing.');
          this.orderSheetRevertReason.set('');
          this.loadOrderSheetHistory();
          this.loadRoznamaTable();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }


  // ── Notice workflow ────────────────────────────────────────────────────────

  protected loadNotices(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.noticesLoading.set(true);
    this.officerCaseStage.listNotices(caseId)
      .pipe(finalize(() => this.noticesLoading.set(false)))
      .subscribe({
        next: (rows) => this.notices.set(rows || []),
        error: () => this.notices.set([])
      });
  }

  /** Build checkbox options from loaded applicants + respondents. */
  protected partyOptions(): Array<{ key: string; label: string }> {
    const opts: Array<{ key: string; label: string }> = [];
    this.detailApplicants().forEach((a, i) => {
      const id = String(a['lineNo'] ?? (i + 1));
      const name = String(a['name'] || `Applicant ${i + 1}`);
      opts.push({ key: `APPLICANT:${id}`, label: `Applicant ${id}: ${name}` });
    });
    this.detailRespondents().forEach((r, i) => {
      const id = String(r['lineNo'] ?? (i + 1));
      const name = String(r['name'] || `Respondent ${i + 1}`);
      opts.push({ key: `RESPONDENT:${id}`, label: `Respondent ${id}: ${name}` });
    });
    return opts;
  }

  protected toggleParty(key: string, checked: boolean): void {
    const s = new Set(this.selectedPartyKeys());
    checked ? s.add(key) : s.delete(key);
    this.selectedPartyKeys.set(s);
  }

  protected isPartySelected(key: string): boolean {
    return this.selectedPartyKeys().has(key);
  }

  /** Generate and open the Marathi notice preview in a new window. */
  /** Builds the fixed Marathi notice HTML from current case data. */
  private buildNoticeHtml(): string {
    const hearing = this.hearings()[0] ?? null;
    const land = this.detailDisputedLands()[0] ?? null;
    const form = this.detailForm() ?? {};
    const caseEntry = this.generatedCase();
    const today = new Date();

    const marathiMonth = ['जानेवारी','फेब्रुवारी','मार्च','एप्रिल','मे','जून','जुलै','ऑगस्ट','सप्टेंबर','ऑक्टोबर','नोव्हेंबर','डिसेंबर'];
    const parseDateParts = (dateStr: string | undefined) => {
      if (!dateStr) return { day: '', month: '', year: '' };
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { day: dateStr, month: '', year: '' };
      return {
        day: toDevanagariDigits(String(d.getDate())),
        month: marathiMonth[d.getMonth()] ?? '',
        year: toDevanagariDigits(String(d.getFullYear()).slice(-2))
      };
    };

    const hDate = parseDateParts(hearing?.hearingDate);

    const vars: SunvaniNoticeVars = {
      phoneNumber: '',
      emailId: '',
      referenceNumber: String(caseEntry?.caseNo ?? this.caseNoFor(this.selectedApplicationId()!)),
      referenceYearTwoDigits: toDevanagariDigits(String(today.getFullYear()).slice(-2)),
      noticeDateDay: toDevanagariDigits(String(today.getDate())),
      noticeDateMonth: marathiMonth[today.getMonth()] ?? '',
      noticeDateYear: toDevanagariDigits(String(today.getFullYear()).slice(-2)),
      applicantNames: this.detailApplicants().map((a) => String(a['name'] || '')),
      applicantAddresses: this.detailApplicants().map((a) => String(a['address'] || '')),
      respondentNames: this.detailRespondents().map((r) => String(r['name'] || '')),
      respondentAddresses: this.detailRespondents().map((r) => String(r['address'] || '')),
      actSection: String(form['sectionCustomText'] ?? form['customSectionName'] ?? form['actId'] ?? ''),
      villageNameMoje: String(land?.['villageName'] ?? land?.['villageLgdCode'] ?? ''),
      taluka: String(land?.['talukaName'] ?? land?.['talukaCode'] ?? ''),
      district: String(land?.['districtName'] ?? land?.['districtCode'] ?? ''),
      // Clerk draft: name left blank; PO sees their own name automatically
      hearingOfficerName: this.isPO ? (this.tokenStorage.getDisplayName() ?? '') : '',
      hearingDateDay: hDate.day,
      hearingDateMonth: hDate.month,
      hearingDateYear: hDate.year,
      hearingTime: '11.00',
      hearingAddress: String(this.tokenStorage.getOfficeName() ?? ''),
      signatoryName: this.isPO ? (this.tokenStorage.getDisplayName() ?? '') : '',
      signatoryDesignation: this.isPO ? (this.tokenStorage.getDesignationName() ?? '') : '',
      signatoryOffice: String(this.tokenStorage.getOfficeName() ?? ''),
      copyRecipients: []
    };

    return buildMarathiSunvaniNoticeHtml(vars);
  }

  protected previewNotice(): void {
    const html = this.buildNoticeHtml();
    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) { w.document.write(html); w.document.close(); }
  }

  private marathiDateParts(dateStr: string | undefined): { day: string; month: string; year: string; display: string } {
    const marathiMonth = ['जानेवारी','फेब्रुवारी','मार्च','एप्रिल','मे','जून','जुलै','ऑगस्ट','सप्टेंबर','ऑक्टोबर','नोव्हेंबर','डिसेंबर'];
    if (!dateStr) return { day: '', month: '', year: '', display: '' };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { day: dateStr, month: '', year: '', display: dateStr };
    const day = toDevanagariDigits(String(d.getDate()));
    const month = marathiMonth[d.getMonth()] ?? '';
    const year = toDevanagariDigits(String(d.getFullYear()).slice(-2));
    return { day, month, year, display: [day, month, `२०${year}`].filter(Boolean).join(' / ') };
  }

  protected defaultRoznamaRowDate(): string {
    return this.roznamaHearingQuery()?.hearingDate?.slice(0, 10) || this.todayIsoDate();
  }

  protected syncRoznamaRowsFromContent(content: string, defaultDate?: string): void {
    const date = defaultDate || this.defaultRoznamaRowDate();
    const rows = parseRoznamaContent(content, date);
    this.roznamaEntryRows.set(rows.length > 0 ? rows : [{ date, content: '' }]);
    this.orderSheetContentInput.set(serializeRoznamaContent(this.roznamaEntryRows()));
  }

  protected roznamaContentForApi(): string {
    return serializeRoznamaContent(this.roznamaEntryRows());
  }

  protected updateRoznamaRowDate(index: number, event: Event): void {
    const date = (event.target as HTMLInputElement).value;
    this.roznamaEntryRows.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, date } : r))
    );
    this.orderSheetContentInput.set(this.roznamaContentForApi());
  }

  protected updateRoznamaRowContent(index: number, event: Event): void {
    const content = (event.target as HTMLTextAreaElement).value;
    this.roznamaEntryRows.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, content } : r))
    );
    this.orderSheetContentInput.set(this.roznamaContentForApi());
  }

  protected addRoznamaTableRow(): void {
    this.roznamaEntryRows.update((rows) => [...rows, { date: this.defaultRoznamaRowDate(), content: '' }]);
    this.orderSheetContentInput.set(this.roznamaContentForApi());
  }

  protected removeRoznamaTableRow(index: number): void {
    this.roznamaEntryRows.update((rows) => {
      if (rows.length <= 1) return [{ date: this.defaultRoznamaRowDate(), content: '' }];
      return rows.filter((_, i) => i !== index);
    });
    this.orderSheetContentInput.set(this.roznamaContentForApi());
  }

  protected syncRoznamaRowsFromHistory(): void {
    const history = this.orderSheetHistory();
    if (history.length === 0) return;
    const rows: RoznamaEntryRow[] = history
      .filter((h) => h.content?.trim())
      .map((h) => ({
        date: (h.hearingDate || '').slice(0, 10),
        content: h.content
      }));
    if (rows.length > 0) {
      this.roznamaEntryRows.set(rows);
    }
  }

  private buildRoznamaPreviewHtml(): string {
    const hearing = this.selectedRoznamaHearing()
      ? { hearingDate: this.selectedRoznamaHearing()!.hearingDate }
      : (this.hearings()[0] ?? null);
    const land = this.detailDisputedLands()[0] ?? null;
    const form = this.detailForm() ?? {};
    const caseEntry = this.generatedCase();
    const today = new Date();
    const marathiMonth = ['जानेवारी','फेब्रुवारी','मार्च','एप्रिल','मे','जून','जुलै','ऑगस्ट','सप्टेंबर','ऑक्टोबर','नोव्हेंबर','डिसेंबर'];
    const hDate = this.marathiDateParts(hearing?.hearingDate);
    const content =
      this.roznamaContentForApi() ||
      this.orderSheetContentInput().trim() ||
      String(this.currentOrderSheet()?.content ?? this.currentOrderSheet()?.draftContent ?? '');
    const rows = parseRoznamaContent(content, this.defaultRoznamaRowDate());
    const previewRows =
      this.roznamaEntryRows().some((r) => r.content.trim()) ? this.roznamaEntryRows() : rows;

    const vars: RoznamaPreviewVars = {
      phoneNumber: '',
      emailId: '',
      referenceNumber: String(caseEntry?.caseNo ?? this.caseNoFor(this.selectedApplicationId()!)),
      referenceYearTwoDigits: toDevanagariDigits(String(today.getFullYear()).slice(-2)),
      noticeDateDay: toDevanagariDigits(String(today.getDate())),
      noticeDateMonth: marathiMonth[today.getMonth()] ?? '',
      noticeDateYear: toDevanagariDigits(String(today.getFullYear()).slice(-2)),
      actSection: String(form['sectionCustomText'] ?? form['customSectionName'] ?? form['actId'] ?? ''),
      villageNameMoje: String(land?.['villageName'] ?? land?.['villageLgdCode'] ?? ''),
      taluka: String(land?.['talukaName'] ?? land?.['talukaCode'] ?? ''),
      district: String(land?.['districtName'] ?? land?.['districtCode'] ?? ''),
      hearingDateDisplay: hDate.display,
      roznamaRows: previewRows,
      roznamaContent: content,
      signatoryName: this.isPO ? (this.tokenStorage.getDisplayName() ?? '') : '',
      signatoryDesignation: this.isPO ? (this.tokenStorage.getDesignationName() ?? '') : '',
      signatoryOffice: String(this.tokenStorage.getOfficeName() ?? '')
    };

    return buildMarathiRoznamaPreviewHtml(vars);
  }

  protected previewRoznama(): void {
    const html = this.buildRoznamaPreviewHtml();
    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) { w.document.write(html); w.document.close(); }
  }

  /** One final judgment document per case (unlike roznamah per hearing). */
  protected judgmentOnePerCaseHint(): string {
    return 'This case has a single final judgment document. Roznamah remains per hearing; judgment is created once when disposing the case.';
  }

  protected hasJudgmentContent(): boolean {
    return !!this.judgmentSummaryInput().trim();
  }

  protected canGenerateJudgmentTemplate(): boolean {
    if (!this.canDraftJudgment()) return false;
    return judgmentWorkflowStatus(this.judgmentWorkflow()) !== 'PUBLISHED';
  }

  protected generateJudgmentTemplate(): void {
    if (!this.canGenerateJudgmentTemplate()) return;
    if (this.hasJudgmentContent()) {
      if (!confirm('Replace current judgment text with a fresh template? This cannot be undone without re-editing.')) {
        return;
      }
    }
    const caseNo = String(
      this.judgmentWorkflow()?.caseNo ??
        this.generatedCase()?.caseNo ??
        this.caseNoFor(this.selectedApplicationId()!) ??
        ''
    );
    const body = buildDefaultJudgmentBodyText({
      caseNo,
      applicantNames: this.detailApplicants().map((a) => String(a['name'] || '')),
      respondentNames: this.detailRespondents().map((r) => String(r['name'] || ''))
    });
    this.judgmentSummaryInput.set(body);
    this.actionMessage.set('Judgment template generated. Review, edit, preview, then save draft.');
  }

  private buildJudgmentPreviewHtml(): string {
    const land = this.detailDisputedLands()[0] ?? null;
    const form = this.detailForm() ?? {};
    const caseEntry = this.generatedCase();
    const today = new Date();
    const marathiMonth = ['जानेवारी','फेब्रुवारी','मार्च','एप्रिल','मे','जून','जुलै','ऑगस्ट','सप्टेंबर','ऑक्टोबर','नोव्हेंबर','डिसेंबर'];
    const caseNo = String(
      this.judgmentWorkflow()?.caseNo ??
        caseEntry?.caseNo ??
        this.caseNoFor(this.selectedApplicationId()!) ??
        ''
    );
    const body =
      this.judgmentSummaryInput().trim() ||
      judgmentTextFromResponse(this.judgmentWorkflow());

    const vars: JudgmentPreviewVars = {
      phoneNumber: '',
      emailId: '',
      referenceNumber: caseNo,
      referenceYearTwoDigits: toDevanagariDigits(String(today.getFullYear()).slice(-2)),
      noticeDateDay: toDevanagariDigits(String(today.getDate())),
      noticeDateMonth: marathiMonth[today.getMonth()] ?? '',
      noticeDateYear: toDevanagariDigits(String(today.getFullYear()).slice(-2)),
      caseNo,
      actSection: String(form['sectionCustomText'] ?? form['customSectionName'] ?? form['actId'] ?? ''),
      villageNameMoje: String(land?.['villageName'] ?? land?.['villageLgdCode'] ?? ''),
      taluka: String(land?.['talukaName'] ?? land?.['talukaCode'] ?? ''),
      district: String(land?.['districtName'] ?? land?.['districtCode'] ?? ''),
      applicantNames: this.detailApplicants().map((a) => String(a['name'] || '')),
      respondentNames: this.detailRespondents().map((r) => String(r['name'] || '')),
      judgmentBody: body,
      signatoryName: this.isPO ? (this.tokenStorage.getDisplayName() ?? '') : '',
      signatoryDesignation: this.isPO ? (this.tokenStorage.getDesignationName() ?? '') : '',
      signatoryOffice: String(this.tokenStorage.getOfficeName() ?? '')
    };

    return buildMarathiJudgmentPreviewHtml(vars);
  }

  protected previewJudgment(): void {
    const html = this.buildJudgmentPreviewHtml();
    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) { w.document.write(html); w.document.close(); }
  }

  protected draftNotice(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    const hearingIdVal = this.noticeHearingIdInput().trim();
    const hearingId = hearingIdVal ? Number(hearingIdVal) : null;
    const parties = Array.from(this.selectedPartyKeys());
    // Generate content from the fixed Marathi template — no manual input needed
    const content = this.buildNoticeHtml();
    this.noticeActionLoading.set(true);
    this.actionError.set(null);
    this.officerCaseStage.draftNotice(caseId, {
      hearingId, noticeType: this.noticeType(), draftContent: content, selectedParties: parties
    }).pipe(finalize(() => this.noticeActionLoading.set(false)))
      .subscribe({
        next: () => { this.actionMessage.set('Notice drafted.'); this.loadNotices(); },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected submitNoticeToPO(noticeId: number): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.noticeSubmitting.set(true);
    this.actionError.set(null);
    this.officerCaseStage.submitNoticeToPO(caseId, noticeId)
      .pipe(finalize(() => this.noticeSubmitting.set(false)))
      .subscribe({
        next: () => { this.actionMessage.set('Notice submitted to Presiding Officer.'); this.loadNotices(); },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected finalizeNotice(noticeId: number): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.noticeActionLoading.set(true);
    this.officerCaseStage.finalizeNotice(caseId, noticeId)
      .pipe(finalize(() => this.noticeActionLoading.set(false)))
      .subscribe({
        next: () => { this.actionMessage.set('Notice finalized.'); this.loadNotices(); },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected signNotice(noticeId: number): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    const ref = this.noticeSignRef().trim();
    if (!ref) { this.actionError.set('Digital signature reference is required.'); return; }
    this.noticeActionLoading.set(true);
    this.officerCaseStage.signNotice(caseId, noticeId, { digitalSignatureRef: ref })
      .pipe(finalize(() => this.noticeActionLoading.set(false)))
      .subscribe({
        next: () => { this.actionMessage.set('Notice signed.'); this.noticeSignRef.set(''); this.loadNotices(); },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected revertNotice(noticeId: number): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    const reason = this.noticeRevertReason().trim();
    if (!reason) { this.actionError.set('Please enter a reason before reverting.'); return; }
    this.noticeActionLoading.set(true);
    this.actionError.set(null);
    this.officerCaseStage.revertNotice(caseId, noticeId, reason)
      .pipe(finalize(() => this.noticeActionLoading.set(false)))
      .subscribe({
        next: () => { this.actionMessage.set('Notice reverted to Clerk.'); this.noticeRevertReason.set(''); this.loadNotices(); },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected serveNotice(noticeId: number): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.noticeActionLoading.set(true);
    this.officerCaseStage.serveNotice(caseId, noticeId)
      .pipe(finalize(() => this.noticeActionLoading.set(false)))
      .subscribe({
        next: () => { this.actionMessage.set('Notice served.'); this.loadNotices(); },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  // ── Judgment workflow ──────────────────────────────────────────────────────

  protected loadJudgmentWorkflow(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.judgmentLoading.set(true);
    this.officerCaseStage.getJudgmentWorkflow(caseId)
      .pipe(finalize(() => this.judgmentLoading.set(false)))
      .subscribe({
        next: (resp) => this.applyJudgmentWorkflow(resp),
        error: () => this.judgmentWorkflow.set(null)
      });
  }

  protected saveDraftJudgment(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    const summary = this.judgmentSummaryInput().trim();
    if (!summary) {
      this.actionError.set('Judgment text is required. Enter summary / order text and save.');
      return;
    }
    this.judgmentSaving.set(true);
    this.actionError.set(null);
    this.officerCaseStage
      .draftJudgment(caseId, summary)
      .pipe(finalize(() => this.judgmentSaving.set(false)))
      .subscribe({
        next: (resp) => {
          this.applyJudgmentWorkflow(resp);
          this.actionMessage.set(resp.message || 'Judgment draft saved.');
          this.loadCaseInbox();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected submitJudgmentToPO(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.judgmentSubmitting.set(true);
    this.actionError.set(null);
    this.officerCaseStage
      .submitJudgmentToPO(caseId)
      .pipe(finalize(() => this.judgmentSubmitting.set(false)))
      .subscribe({
        next: (resp) => {
          this.applyJudgmentWorkflow(resp);
          this.actionMessage.set(resp.message || 'Judgment submitted to Presiding Officer for scrutiny.');
          this.loadCaseInbox();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected revertJudgment(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    const reason = this.judgmentRevertReason().trim();
    if (!reason) { this.actionError.set('Please enter a reason before reverting.'); return; }
    this.actionError.set(null);
    this.officerCaseStage.revertJudgment(caseId, reason)
      .subscribe({
        next: (resp) => {
          this.applyJudgmentWorkflow(resp);
          this.actionMessage.set(resp.message || 'Judgment reverted to Clerk.');
          this.judgmentRevertReason.set('');
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected finalizeJudgment(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.judgmentSaving.set(true);
    this.actionError.set(null);
    this.officerCaseStage.finalizeJudgment(caseId)
      .pipe(finalize(() => this.judgmentSaving.set(false)))
      .subscribe({
        next: (resp) => {
          this.applyJudgmentWorkflow(resp);
          this.actionMessage.set(resp.message || 'Judgment finalized.');
          this.loadCaseInbox();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected publishJudgment(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    if (!confirm('Publish judgment and dispose this case? This action is irreversible.')) return;
    this.judgmentSaving.set(true);
    this.actionError.set(null);
    this.officerCaseStage.publishJudgment(caseId)
      .pipe(finalize(() => this.judgmentSaving.set(false)))
      .subscribe({
        next: (resp) => {
          this.applyJudgmentWorkflow(resp);
          this.postRoznamaPath.set(null);
          this.actionMessage.set(resp.message || 'Judgment published. Case is DISPOSED.');
          this.loadOfficerInbox();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  private applyAssignmentAction(resp: OfficerAssignmentActionResponse): void {
    const current = this.officerDetail();
    if (current) {
      this.officerDetail.set({
        ...current,
        processingStage: resp.processingStage,
        currentAssigneeRole: resp.currentAssigneeRole
      });
    }
    this.actionMessage.set(resp.message || 'Action completed.');
    this.actionRemarksInput.set('');
    this.loadOfficerInbox();
  }

  private resolveAssigneeRole(_detail: OfficerApplicationDetail | null): 'CLERK' | 'PRESIDING_OFFICER' | '' {
    // Primary: use the logged-in officer's designation to determine their workflow role
    const designation = String(this.tokenStorage.getDesignationName() || '').toLowerCase();
    if (designation.includes('clerk')) return 'CLERK';
    if (designation.includes('presid') || designation.includes('po')) return 'PRESIDING_OFFICER';

    // Fallback: processingStage
    const stage = String(_detail?.processingStage || '').toUpperCase();
    if (stage === 'CLERK_DRAFT_REVIEW' || stage === 'PO_SENT_BACK_TO_CLERK') return 'CLERK';
    if (stage === 'PO_UNDER_REVIEW' || stage === 'CASE_PROCEEDINGS') return 'PRESIDING_OFFICER';

    // Fallback: currentAssigneeRole from detail
    const fromDetail = String(_detail?.currentAssigneeRole || '').toUpperCase();
    if (fromDetail === 'CLERK' || fromDetail === 'PRESIDING_OFFICER') return fromDetail;

    return '';
  }

  protected toPrettyDate(value: string | null | undefined): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  }

  protected detailApplicants(): Array<Record<string, unknown>> {
    const x = this.officerDetail() as Record<string, unknown> | null;
    if (!x) return [];
    const top = this.toRecordArray(x['applicants']);
    if (top.length) return top;
    const f = this.detailForm();
    return this.toRecordArray(f?.['applicants']);
  }

  protected detailRespondents(): Array<Record<string, unknown>> {
    const x = this.officerDetail() as Record<string, unknown> | null;
    if (!x) return [];
    const top = this.toRecordArray(x['respondents']);
    if (top.length) return top;
    const f = this.detailForm();
    return this.toRecordArray(f?.['respondents']);
  }

  protected detailDisputedLands(): Array<Record<string, unknown>> {
    const x = this.officerDetail() as Record<string, unknown> | null;
    if (!x) return [];
    const top = this.toRecordArray(x['disputedLands']);
    if (top.length) return top;
    const f = this.detailForm();
    return this.toRecordArray(f?.['disputedLands']);
  }

  protected detailVakalatnamaAssignments(): Array<Record<string, unknown>> {
    const x = this.officerDetail() as Record<string, unknown> | null;
    if (!x) return [];
    const top = this.toRecordArray(x['vakalatnamaAssignments'] ?? x['vakaltnamaAssignments']);
    if (top.length) return top;
    const f = this.detailForm();
    return this.toRecordArray(f?.['vakalatnamaAssignments'] ?? f?.['vakaltnamaAssignments']);
  }

  protected detailAttachments(): Array<Record<string, unknown>> {
    const x = this.officerDetail() as Record<string, unknown> | null;
    if (!x) return [];
    const top = this.toRecordArray(x['attachments']);
    if (top.length) return top;
    const f = this.detailForm();
    return this.toRecordArray(f?.['attachments']);
  }

  protected detailDisputedOrder(): Record<string, unknown> | null {
    const x = this.officerDetail() as Record<string, unknown> | null;
    if (!x) return null;
    const direct = this.toRecord(x['disputedOrder']);
    if (direct) {
      return direct;
    }
    const f = this.detailForm();
    if (!f) return null;
    return {
      searchMode: f['searchMode'] ?? null,
      searchValue: f['searchValue'] ?? null,
      mutationFound: f['mutationFound'] ?? null,
      mutationSearched: f['mutationSearched'] ?? f['searchedMutation'] ?? null,
      mutationDetails: f['mutationDetails'] ?? null,
      manualInwardNumber: f['manualInwardNumber'] ?? null,
      manualInwardDate: f['manualInwardDate'] ?? null,
      manualMutationType: f['manualMutationType'] ?? null,
      manualApplicantName: f['manualApplicantName'] ?? null,
      manualVillage: f['manualVillage'] ?? null,
      manualStatus: f['manualStatus'] ?? null,
      notice9Resolved: f['notice9Resolved'] ?? null
    };
  }

  protected detailForm(): Record<string, unknown> | null {
    const x = this.officerDetail() as Record<string, unknown> | null;
    if (!x) return null;
    return this.toRecord(x['form']);
  }

  protected detailDescription(): string {
    const x = this.officerDetail();
    const direct = x?.applicationDescription;
    if (typeof direct === 'string' && direct.trim()) return direct;
    const f = this.detailForm();
    const fromForm = f?.['applicationDescription'];
    return typeof fromForm === 'string' && fromForm.trim() ? fromForm : '-';
  }

  protected detailMutationDetails(): Record<string, unknown> | null {
    const order = this.detailDisputedOrder();
    if (!order) return null;
    const m = order['mutationDetails'];
    if (!m || typeof m !== 'object') return null;
    return m as Record<string, unknown>;
  }

  protected detailNotice9Resolved(): Record<string, unknown> | null {
    const order = this.detailDisputedOrder();
    if (!order) return null;
    const n = order['notice9Resolved'];
    if (!n || typeof n !== 'object') return null;
    return n as Record<string, unknown>;
  }

  protected notice9Url(): string | null {
    const n = this.detailNotice9Resolved();
    const fromResolved = n?.['url'];
    if (typeof fromResolved === 'string' && fromResolved.trim()) return fromResolved;
    const m = this.detailMutationDetails();
    const fromMutation = m?.['notice9Url'];
    if (typeof fromMutation === 'string' && fromMutation.trim()) return fromMutation;
    return null;
  }

  protected attachFileUrl(): string | null {
    const m = this.detailMutationDetails();
    const raw = m?.['attachFileUrl'];
    return typeof raw === 'string' && raw.trim() ? raw : null;
  }

  protected notice9IsImage(): boolean {
    const url = (this.notice9Url() || '').toLowerCase();
    if (!url) return false;
    if (url.startsWith('data:image/')) return true;
    return /\.(png|jpg|jpeg|webp|gif)(\?|$)/.test(url);
  }

  protected notice9EffectiveUrl(): string | null {
    return this.notice9FetchedUrl() || this.notice9Url();
  }

  protected notice9EffectiveIsImage(): boolean {
    const url = (this.notice9EffectiveUrl() || '').toLowerCase();
    if (!url) return false;
    if (url.startsWith('data:image/')) return true;
    return /\.(png|jpg|jpeg|webp|gif)(\?|$)/.test(url);
  }

  protected inwardNumberForNotice9(): string | null {
    const m = this.detailMutationDetails();
    const inward = m?.['inwardNumber'];
    if (typeof inward === 'string' && inward.trim()) return inward.trim();
    const order = this.detailDisputedOrder();
    const searchValue = order?.['searchValue'];
    if (typeof searchValue === 'string' && searchValue.trim()) return searchValue.trim();
    return null;
  }

  protected fetchNotice9FromApi(): void {
    const inwardNumber = this.inwardNumberForNotice9();
    if (!inwardNumber) {
      this.notice9FetchError.set('Inward number not available to fetch Notice 9.');
      return;
    }
    this.notice9FetchLoading.set(true);
    this.notice9FetchError.set(null);
    this.landRecords.getUrbanNoticeNineView(inwardNumber).subscribe({
      next: (resp) => {
        const resolved = this.resolveNoticeNine(resp);
        this.notice9FetchedUrl.set(resolved.url);
        this.notice9FetchedPreviewKind.set(resolved.previewKind);
      },
      error: (err: unknown) => this.notice9FetchError.set(this.formatError(err)),
      complete: () => this.notice9FetchLoading.set(false)
    });
  }

  protected viewLandDetails(row: Record<string, unknown>): void {
    this.landDetailError.set(null);
    this.landDetailPayload.set(null);
    this.landDetailTitle.set('');

    const landType = typeof row['landType'] === 'string' ? (row['landType'] as string) : '';
    if (!landType) {
      this.landDetailError.set('Land type missing.');
      return;
    }

    if (landType === 'RURAL_7_12') {
      const village = typeof row['villageLgdCode'] === 'string' ? (row['villageLgdCode'] as string) : '';
      const pin = typeof row['surveyPin'] === 'string' ? (row['surveyPin'] as string) : '';
      if (!village || !pin) {
        this.landDetailError.set('Village LGD code / Survey pin missing for rural land details.');
        return;
      }
      this.landDetailLoading.set(true);
      this.landDetailTitle.set(`Rural 7/12 details (Village ${village}, Pin ${pin})`);
      this.landRecords.getRuralSubSurveyList(village, pin).subscribe({
        next: (rows: RuralSubSurveyRow[]) => {
          const match = rows.find((r) => {
            const samePin = String(r.pin || '').trim() === String(pin).trim();
            if (!samePin) return false;
            const keys = ['pin1', 'pin2', 'pin3', 'pin4', 'pin5', 'pin6', 'pin7', 'pin8'] as const;
            return keys.every((k) => {
              const expected = row[k] == null ? '' : String(row[k]).trim();
              const actual = (r as any)[k] == null ? '' : String((r as any)[k]).trim();
              return expected === '' || expected === actual;
            });
          });
          this.landDetailPayload.set((match ?? rows[0] ?? null) as unknown as Record<string, unknown> | null);
          if (!match && (!rows || rows.length === 0)) {
            this.landDetailError.set('No rural land records returned for this pin.');
          }
        },
        error: (err: unknown) => this.landDetailError.set(this.formatError(err)),
        complete: () => this.landDetailLoading.set(false)
      });
      return;
    }

    if (landType === 'URBAN_PROPERTY_CARD') {
      const villageCode = typeof row['villageCode'] === 'string' ? (row['villageCode'] as string) : '';
      const ctsNo = typeof row['ctsNo'] === 'string' ? (row['ctsNo'] as string) : '';
      if (!villageCode) {
        this.landDetailError.set('Village code missing for urban property card lookup.');
        return;
      }
      this.landDetailLoading.set(true);
      this.landDetailTitle.set(`Urban property details (Village ${villageCode}${ctsNo ? `, CTS ${ctsNo}` : ''})`);
      this.landRecords.getUrbanCtsList(villageCode, ctsNo || undefined).subscribe({
        next: (rows: UrbanCtsRow[]) => {
          const found = rows.find((r) => String(r.cts_no || '').trim() === String(ctsNo || '').trim());
          this.landDetailPayload.set(
            ({ found: !!found, returnedCount: rows.length, ctsNo: ctsNo || null } as unknown) as Record<string, unknown>
          );
          if (rows.length === 0) {
            this.landDetailError.set('No urban CTS records returned.');
          }
        },
        error: (err: unknown) => this.landDetailError.set(this.formatError(err)),
        complete: () => this.landDetailLoading.set(false)
      });
      return;
    }

    this.landDetailError.set(`Unsupported land type: ${landType}`);
  }

  private resolveNoticeNine(response: NoticeNineViewResponse | string | Record<string, unknown>): {
    url: string | null;
    previewKind: 'image' | 'pdf' | 'none';
  } {
    const empty = { url: null, previewKind: 'none' as const };
    if (typeof response === 'string') {
      const cleaned = this.cleanText(response);
      if (!cleaned) return empty;
      return { url: cleaned, previewKind: this.detectPreviewKindFromUrl(cleaned) };
    }
    const raw = response as NoticeNineViewResponse;
    const type = this.cleanText(raw.type || '').toLowerCase();
    if (type === 'base64-file') {
      const directDataUrl = this.cleanText(raw.dataUrl || '');
      const mimeType = this.cleanText(raw.mimeType || 'application/octet-stream');
      const base64 = this.cleanText(raw.base64 || '');
      let dataUrl = '';
      if (directDataUrl) dataUrl = directDataUrl;
      else if (base64) dataUrl = `data:${mimeType};base64,${base64}`;
      if (!dataUrl) return empty;
      return { url: dataUrl, previewKind: this.detectPreviewKindFromUrl(dataUrl) };
    }
    const rawUrl = this.cleanText(raw.url || raw.notice9Url || raw.fileUrl || '');
    if (rawUrl) return { url: rawUrl, previewKind: this.detectPreviewKindFromUrl(rawUrl) };
    return empty;
  }

  private cleanText(value: string): string {
    let v = String(value ?? '').trim();
    if (!v) return '';
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1).trim();
    }
    v = v.replace(/\\\//g, '/').trim();
    return v;
  }

  private detectPreviewKindFromUrl(url: string): 'image' | 'pdf' | 'none' {
    const lower = url.toLowerCase();
    if (lower.startsWith('data:image/')) return 'image';
    if (lower.startsWith('data:application/pdf')) return 'pdf';
    if (lower.endsWith('.pdf')) return 'pdf';
    if (/\.(png|jpg|jpeg|webp|gif)(\?|$)/.test(lower)) return 'image';
    return 'none';
  }

  protected applicantIdsLabel(v: Record<string, unknown>): string {
    const arr = this.toRecordArray(v['applicantIds']);
    if (arr.length > 0) return arr.map((x) => String(x)).join(', ');
    if (Array.isArray(v['applicantIds'])) {
      return (v['applicantIds'] as unknown[]).map((x) => String(x)).join(', ');
    }
    return '-';
  }

  protected advocateName(v: Record<string, unknown>): string {
    const adv = this.toRecord(v['advocate']);
    if (!adv) return '-';
    const full = adv['fullName'];
    if (typeof full === 'string' && full.trim()) return full;
    const name = adv['name'];
    if (typeof name === 'string' && name.trim()) return name;
    return '-';
  }

  protected coAdvocatesCount(v: Record<string, unknown>): number {
    return this.toRecordArray(v['coAdvocates']).length;
  }

  protected uploadedAtLabel(v: Record<string, unknown>): string {
    const raw = v['uploadedAt'];
    return this.toPrettyDate(typeof raw === 'string' ? raw : '');
  }

  protected landDetailRows(): Array<{ label: string; value: string }> {
    const payload = this.landDetailPayload();
    if (!payload) return [];
    const orderedKeys = [
      'pin',
      'pin1',
      'pin2',
      'pin3',
      'pin4',
      'pin5',
      'pin6',
      'pin7',
      'pin8',
      'ctsNo',
      'found',
      'returnedCount'
    ];
    const keys = Array.from(new Set([...orderedKeys, ...Object.keys(payload)]));
    const rows: Array<{ label: string; value: string }> = [];
    for (const key of keys) {
      const raw = payload[key];
      if (raw == null) continue;
      const value = String(raw).trim();
      if (!value) continue;
      rows.push({
        label: this.landDetailLabel(key),
        value
      });
    }
    return rows;
  }

  private landDetailLabel(key: string): string {
    const labels: Record<string, string> = {
      pin: 'Survey Pin',
      pin1: 'Pin Part 1',
      pin2: 'Pin Part 2',
      pin3: 'Pin Part 3',
      pin4: 'Pin Part 4',
      pin5: 'Pin Part 5',
      pin6: 'Pin Part 6',
      pin7: 'Pin Part 7',
      pin8: 'Pin Part 8',
      ctsNo: 'CTS Number',
      found: 'Found',
      returnedCount: 'Returned Count'
    };
    return labels[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  private unwrapDetail(row: unknown): OfficerApplicationDetail {
    const direct = this.toRecord(row);
    if (!direct) return {} as OfficerApplicationDetail;
    const wrapped = this.toRecord(direct['data']) ?? this.toRecord(direct['payload']) ?? this.toRecord(direct['result']);
    return (wrapped ?? direct) as unknown as OfficerApplicationDetail;
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    if (!value) return null;
    if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  private toRecordArray(value: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(value)) return value.filter((x) => !!x && typeof x === 'object') as Array<Record<string, unknown>>;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter((x) => !!x && typeof x === 'object') as Array<Record<string, unknown>>;
        }
      } catch {
        //
      }
    }
    return [];
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

