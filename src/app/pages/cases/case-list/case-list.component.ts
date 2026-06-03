import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs/operators';

import {
  OfficerApplicationDetail,
  OfficerFilingService,
  OfficerInboxItem
} from '../../../services/officer-filing.service';
import {
  ApplicationHistoryResponse,
  ApplicationPreviewResponse,
  FilingApplicationService
} from '../../../services/filing-application.service';
import { ApplicationHistoryTimelineComponent } from '../../applications/application-history-timeline/application-history-timeline.component';
import {
  CaseHearingResponse,
  CaseJudgmentWorkflowResponse,
  judgmentBindingText,
  judgmentFieldLabel,
  judgmentInferredEditable,
  judgmentTextFromResponse,
  judgmentWorkflowStatus,
  normalizeJudgmentWorkflow,
  buildJudgmentSignPublishBody,
  CaseNoticeItem,
  CaseWorkflowContext,
  CompleteRoznamaRequest,
  CompleteRoznamaResponse,
  JudgmentHistoryRow,
  OfficerCaseInboxItem,
  OfficerAssignmentActionResponse,
  CaseOrderSheetHistoryResponse,
  CaseOrderSheetResponse,
  OfficerApproveResponse,
  OfficerCaseStageService,
  OfficerRoznamaTableRow,
  PendingServeNoticeRow,
  RoznamaAttendanceEntry,
  RoznamaAttendanceSaveEntry,
  RoznamaResponse,
  RoznamaTableRow,
  workflowActiveHearing
} from '../../../services/officer-case-stage.service';
import { LandRecordsService, NoticeNineViewResponse, RuralSubSurveyRow, UrbanCtsRow } from '../../../services/land-records.service';
import { TokenStorageService } from '../../../services/token-storage.service';
import {
  buildMarathiJudgmentPreviewHtml,
  buildMarathiRoznamaPreviewHtml,
  buildMarathiSunvaniNoticeHtml,
  JudgmentPreviewVars,
  parseRoznamaContent,
  normalizeRoznamaEntryRow,
  normalizeRoznamaEntryRows,
  unwrapRoznamaCellContent,
  RoznamaEntryRow,
  RoznamaPreviewVars,
  serializeRoznamaContent,
  stripHtmlToPlainText,
  SunvaniNoticeVars,
  toDevanagariDigits
} from '../../../shared/sunvai-marathi-template';
import { formatSearchModeLabel } from '../../../shared/application-preview.util';
import { landDetailDisplayFields } from '../../../shared/land-display.util';
import { RichTextEditorComponent } from '../../../shared/rich-text-editor/rich-text-editor.component';
import { MappedDocumentsPanelComponent } from '../../applications/mapped-documents-panel/mapped-documents-panel.component';
import { DocumentChecklist } from '../../../services/mapped-documents.service';

type OfficerMenuKey =
  | 'CLERK_DESK'
  | 'PO_DESK'
  | 'ASSIGN_HEARING'
  | 'PENDING_NOTICE'
  | 'CAUSE_LIST'
  | 'PENDING_JUDGMENT'
  | 'ACTIVE_CASES'
  | 'ADJOURNED_QUEUE';

type WorkflowIntentKey =
  | 'none'
  | 'general'
  | 'notice'
  | 'roznama'
  | 'hearing'
  | 'judgment'
  | 'filing';

type SidebarEntry =
  | { type: 'divider'; label: string }
  | { type: 'link'; label: string; route: string; icon: string }
  | { type: 'menu'; key: OfficerMenuKey; label: string; icon: string };

const SIDEBAR_ICONS = {
  dashboard:
    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  filing:
    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  approval: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  hearing:
    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  notice:
    'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v4.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  roznama:
    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  judgment:
    'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0H15',
  adjourned: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  cases:
    'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
} as const;

@Component({
  selector: 'app-case-list',
  imports: [
    FormsModule,
    NgTemplateOutlet,
    RouterLink,
    ApplicationHistoryTimelineComponent,
    RichTextEditorComponent,
    MappedDocumentsPanelComponent
  ],
  templateUrl: './case-list.component.html',
  styleUrl: './case-list.component.css'
})
export class CaseListComponent implements OnInit {
  private static readonly OFFICER_MENU_STORAGE_KEY = 'rccms.officerMenu';
  private static readonly SIDEBAR_COLLAPSED_KEY = 'rccms.workbenchSidebarCollapsed';

  private readonly officerFilings = inject(OfficerFilingService);
  private readonly filingApplications = inject(FilingApplicationService);
  private readonly officerCaseStage = inject(OfficerCaseStageService);
  private readonly landRecords = inject(LandRecordsService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly role = this.tokenStorage.getRole() || '-';
  protected readonly isAdvocate = this.tokenStorage.isAdvocate();
  protected readonly isOfficer = this.tokenStorage.isOfficer();

  protected readonly isPO = this.tokenStorage.isPresidingOfficer();
  protected readonly isClerk = this.tokenStorage.isClerkOfficer();
  protected readonly loginRole: 'CLERK' | 'PRESIDING_OFFICER' | '' = this.isPO
    ? 'PRESIDING_OFFICER'
    : this.isClerk
      ? 'CLERK'
      : '';

  private pendingRouteOpen: { applicationId?: number; caseId?: number } | null = null;

  protected readonly loadingOfficerInbox = signal(false);
  protected readonly officerInboxError = signal<string | null>(null);
  protected readonly officerInbox = signal<OfficerInboxItem[]>([]);
  protected readonly caseInboxLoading = signal(false);
  protected readonly caseInboxError = signal<string | null>(null);
  protected readonly caseInbox = signal<OfficerCaseInboxItem[]>([]);
  protected readonly officerMenu = signal<OfficerMenuKey>(
    this.isClerk ? 'CLERK_DESK' : 'PO_DESK'
  );
  protected readonly selectedApplicationId = signal<number | null>(null);
  /** Set when opening from notice/cause list if filing application id is missing on the row. */
  protected readonly selectedCaseId = signal<number | null>(null);
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
  /** Which action form to render inside the workflow panel. */
  protected readonly workflowIntent = signal<WorkflowIntentKey>('none');

  /** True = hide case list, show workflow full width. False = show case list only. */
  protected readonly workflowPanelOpen = signal(false);

  /** Narrow icon-only sidebar when true. */
  protected readonly sidebarCollapsed = signal(false);

  protected readonly sidebarEntries = computed(() => this.buildSidebarEntries());

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
  protected readonly pendingServeRows = signal<PendingServeNoticeRow[]>([]);
  protected readonly pendingServeLoading = signal(false);
  protected readonly pendingServeError = signal<string | null>(null);
  protected readonly selectedPendingServe = signal<PendingServeNoticeRow | null>(null);
  protected readonly noticeActionLoading = signal(false);
  protected readonly noticeSubmitting = signal(false);
  protected readonly noticeType = signal('HEARING_NOTICE');
  protected readonly noticeHearingIdInput = signal('');
  /** Selected party keys, e.g. "APPLICANT:1", "RESPONDENT:2" */
  protected readonly selectedPartyKeys = signal<string[]>([]);
  protected readonly noticePartyRows = signal<
    Array<{ key: string; role: 'Applicant' | 'Respondent'; name: string }>
  >([]);
  protected readonly noticePartiesLoading = signal(false);
  protected readonly noticePartiesError = signal<string | null>(null);
  protected readonly noticeSignRef = signal('');
  protected readonly noticeRevertReason = signal('');
  protected readonly orderSheetRevertReason = signal('');
  protected readonly judgmentRevertReason = signal('');
  protected readonly judgmentSendToClerkRemarks = signal('');

  // ── Judgment workflow ──────────────────────────────────────────────────────
  protected readonly judgmentWorkflow = signal<CaseJudgmentWorkflowResponse | null>(null);
  protected readonly judgmentLoading = signal(false);
  protected readonly judgmentSummaryInput = signal('');
  protected readonly judgmentSaving = signal(false);
  protected readonly judgmentSubmitting = signal(false);
  protected readonly judgmentHistory = signal<JudgmentHistoryRow[]>([]);
  protected readonly judgmentHistoryLoading = signal(false);
  protected readonly judgmentSignatureRef = signal('');

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
  protected readonly roznamaDocTab = signal<
    'summary' | 'parties' | 'notices' | 'hearings' | 'land' | 'roznama' | 'attachments' | 'documents' | 'history'
  >('summary');
  protected readonly roznamaPreviewBundle = signal<ApplicationPreviewResponse | null>(null);
  protected readonly roznamaPreviewLoading = signal(false);
  /** Collapse case reference sidebar (notice / roznamma drafting). */
  protected readonly caseReferenceCollapsed = signal(false);

  /** From GET /{caseId}/workflow-context?hearingId= — drives allowed buttons. */
  protected readonly workflowContext = signal<CaseWorkflowContext | null>(null);
  protected readonly workflowContextLoading = signal(false);
  protected readonly hearingOutcomeInput = signal<'FINAL' | 'ADJOURN' | ''>('');
  protected readonly nextHearingDateOnRoznama = signal('');
  protected readonly roznamaCompleting = signal(false);
  protected readonly attendanceRequired = signal(false);
  protected readonly attendanceComplete = signal(false);
  protected readonly attendanceEntries = signal<RoznamaAttendanceEntry[]>([]);
  protected readonly attendanceSaving = signal(false);
  protected readonly attendanceValidationError = signal<string | null>(null);
  protected readonly attendancePanelHighlight = signal(false);
  private readonly attendanceTouchedKeys = signal<Set<string>>(new Set());
  protected readonly rescheduleDateInput = signal('');
  protected readonly rescheduleRemarksInput = signal('');
  protected readonly rescheduleNoticeGenerate = signal(true);
  protected readonly rescheduleSubmitting = signal(false);

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
      return;
    }
    if (this.isOfficer) {
      this.restoreSidebarCollapsed();
      this.restoreOfficerMenu();
      this.applyOfficerRouteQuery(this.route.snapshot.queryParamMap);
      this.route.queryParamMap.subscribe((params) => this.applyOfficerRouteQuery(params));
      this.loadOfficerInbox();
      if (this.isPO) {
        this.loadPendingServeQueue();
        if (this.officerMenu() === 'CAUSE_LIST') {
          this.loadRoznamaTable();
        }
      }
    }
  }

  private applyOfficerRouteQuery(params: { get: (key: string) => string | null }): void {
    const menu = params.get('menu');
    if (menu && this.isOfficerMenuAllowed(menu as OfficerMenuKey)) {
      const key = menu as OfficerMenuKey;
      if (this.officerMenu() !== key) {
        this.officerMenu.set(key);
        this.persistOfficerMenu(key);
        this.loadCaseInboxForMenu();
        if (key === 'CAUSE_LIST') {
          this.loadRoznamaTable();
        }
        if (key === 'PENDING_NOTICE') {
          this.loadPendingServeQueue();
        }
      }
    }

    const appRaw = params.get('applicationId');
    const caseRaw = params.get('caseId');
    if (appRaw || caseRaw) {
      this.pendingRouteOpen = {
        applicationId: appRaw ? Number(appRaw) : undefined,
        caseId: caseRaw ? Number(caseRaw) : undefined
      };
      this.tryOpenPendingRoute();
    }
  }

  private tryOpenPendingRoute(): void {
    if (!this.pendingRouteOpen) return;
    const { applicationId, caseId } = this.pendingRouteOpen;
    let appId = applicationId;
    if (!appId && caseId) {
      appId = (this.caseInbox() || []).find((c) => c.caseId === caseId)?.filingApplicationId;
    }
    if (!appId) return;
    this.pendingRouteOpen = null;
    if (this.officerMenu() === 'PENDING_JUDGMENT') {
      this.openJudgmentCase(appId, caseId);
    } else {
      this.viewOfficerApplication(appId, { caseId });
    }
  }

  protected loadOfficerInbox(): void {
    this.loadingOfficerInbox.set(true);
    this.officerInboxError.set(null);
    this.officerFilings.getInbox().subscribe({
      next: (rows) => {
        this.officerInbox.set(rows || []);
        this.tryOpenPendingRoute();
      },
      error: (err: unknown) => this.officerInboxError.set(this.formatError(err)),
      complete: () => this.loadingOfficerInbox.set(false)
    });
    this.loadCaseInboxForMenu();
    if (this.isPO) {
      this.loadPendingServeQueue();
    }
  }

  protected toggleSidebar(): void {
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    try {
      sessionStorage.setItem(CaseListComponent.SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  protected isSidebarMenuActive(key: OfficerMenuKey): boolean {
    if (this.workflowPanelOpen()) {
      if (this.workflowIntent() === 'judgment') return key === 'PENDING_JUDGMENT';
      if (this.workflowIntent() === 'roznama') return key === 'CAUSE_LIST';
      if (this.workflowIntent() === 'notice') return key === 'PENDING_NOTICE';
    }
    return this.officerMenu() === key;
  }

  private restoreSidebarCollapsed(): void {
    try {
      this.sidebarCollapsed.set(sessionStorage.getItem(CaseListComponent.SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      /* ignore */
    }
  }

  private buildSidebarEntries(): SidebarEntry[] {
    const entries: SidebarEntry[] = [
      {
        type: 'link',
        label: 'Dashboard',
        route: '/officer/dashboard',
        icon: SIDEBAR_ICONS.dashboard
      }
    ];

    if (this.isClerk) {
      entries.push(
        { type: 'divider', label: 'Clerk' },
        { type: 'menu', key: 'CLERK_DESK', label: 'Scrutiny', icon: SIDEBAR_ICONS.filing },
        { type: 'menu', key: 'PENDING_JUDGMENT', label: 'Draft judgment', icon: SIDEBAR_ICONS.judgment },
        { type: 'menu', key: 'ACTIVE_CASES', label: 'Active cases', icon: SIDEBAR_ICONS.cases }
      );
    }

    if (this.isPO) {
      entries.push(
        { type: 'divider', label: 'Presiding Officer' },
        { type: 'menu', key: 'PO_DESK', label: 'Approval', icon: SIDEBAR_ICONS.approval },
        { type: 'menu', key: 'ASSIGN_HEARING', label: 'Assign hearing', icon: SIDEBAR_ICONS.hearing },
        { type: 'menu', key: 'PENDING_NOTICE', label: 'Serve notice', icon: SIDEBAR_ICONS.notice },
        { type: 'menu', key: 'CAUSE_LIST', label: 'Roznama', icon: SIDEBAR_ICONS.roznama },
        { type: 'menu', key: 'PENDING_JUDGMENT', label: 'Judgment', icon: SIDEBAR_ICONS.judgment },
        { type: 'menu', key: 'ADJOURNED_QUEUE', label: 'Adjourned', icon: SIDEBAR_ICONS.adjourned },
        { type: 'menu', key: 'ACTIVE_CASES', label: 'Active cases', icon: SIDEBAR_ICONS.cases }
      );
    }

    return entries;
  }

  protected setOfficerMenu(menu: OfficerMenuKey): void {
    if (!this.isOfficerMenuAllowed(menu)) {
      return;
    }
    const sameMenu = this.officerMenu() === menu;
    if (!sameMenu) {
      this.closeWorkflow();
      this.officerMenu.set(menu);
      this.persistOfficerMenu(menu);
      this.loadCaseInboxForMenu();
    } else if (this.workflowPanelOpen()) {
      this.closeWorkflow();
    }
    if (menu === 'CAUSE_LIST') {
      this.loadRoznamaTable();
      return;
    }
    if (menu === 'PENDING_NOTICE') {
      this.loadPendingServeQueue();
    }
    if (menu === 'PENDING_JUDGMENT' || menu === 'ADJOURNED_QUEUE' || menu === 'ACTIVE_CASES') {
      this.loadCaseInboxForMenu();
    }
  }

  private loadCaseInboxForMenu(): void {
    const menu = this.officerMenu();
    let status: string | undefined;
    if (menu === 'PENDING_JUDGMENT') {
      status = 'READY_FOR_JUDGMENT';
    } else if (menu === 'ADJOURNED_QUEUE') {
      status = 'ADJOURNED';
    }
    this.loadCaseInbox(status);
  }

  private isOfficerMenuAllowed(menu: OfficerMenuKey): boolean {
    if (menu === 'ACTIVE_CASES') {
      return true;
    }
    if (this.isClerk) {
      return menu === 'CLERK_DESK' || menu === 'PENDING_JUDGMENT';
    }
    if (this.isPO && menu === 'CLERK_DESK') {
      return false;
    }
    return true;
  }

  private restoreOfficerMenu(): void {
    try {
      const saved = sessionStorage.getItem(CaseListComponent.OFFICER_MENU_STORAGE_KEY);
      if (saved && this.isOfficerMenuAllowed(saved as OfficerMenuKey)) {
        this.officerMenu.set(saved as OfficerMenuKey);
      }
    } catch {
      /* ignore private browsing / quota errors */
    }
  }

  private persistOfficerMenu(menu: OfficerMenuKey): void {
    try {
      sessionStorage.setItem(CaseListComponent.OFFICER_MENU_STORAGE_KEY, menu);
    } catch {
      /* ignore */
    }
  }

  private workflowIntentForMenu(
    menu: OfficerMenuKey,
    opts?: {
      roznamaRow?: OfficerRoznamaTableRow;
      intent?: Exclude<WorkflowIntentKey, 'none'>;
    }
  ): Exclude<WorkflowIntentKey, 'none'> {
    if (opts?.intent) {
      return opts.intent;
    }
    if (opts?.roznamaRow || menu === 'CAUSE_LIST') {
      return 'roznama';
    }
    if (menu === 'PENDING_NOTICE') {
      return 'notice';
    }
    if (menu === 'PENDING_JUDGMENT') {
      return 'judgment';
    }
    if (menu === 'ASSIGN_HEARING') {
      return 'hearing';
    }
    if (menu === 'PO_DESK' || menu === 'CLERK_DESK') {
      return 'filing';
    }
    return 'general';
  }

  protected menuQueueTitle(): string {
    switch (this.officerMenu()) {
      case 'CLERK_DESK':
        return 'Pending Application for Scrutiny';
      case 'PO_DESK':
        return 'Pending for Approval';
      case 'ASSIGN_HEARING':
        return 'Pending for Assign Hearing Date';
      case 'PENDING_NOTICE':
        return 'Pending for Serve Notice';
      case 'CAUSE_LIST':
        return 'Roznama';
      case 'PENDING_JUDGMENT':
        return this.isClerk ? 'Draft Judgment' : 'Judgment';
      case 'ACTIVE_CASES':
        return 'All active cases';
      case 'ADJOURNED_QUEUE':
        return 'Adjourned — schedule next date';
      default:
        return 'Queue';
    }
  }

  protected loadPendingServeQueue(): void {
    this.pendingServeLoading.set(true);
    this.pendingServeError.set(null);
    this.officerCaseStage
      .getPendingServeNotices()
      .pipe(finalize(() => this.pendingServeLoading.set(false)))
      .subscribe({
        next: (resp) =>
          this.pendingServeRows.set((resp.rows ?? []).map((r) => this.normalizePendingServeRow(r))),
        error: (err: unknown) => {
          this.pendingServeRows.set([]);
          this.pendingServeError.set(this.formatError(err));
        }
      });
  }

  protected openPendingServeRow(row: PendingServeNoticeRow): void {
    const normalized = this.normalizePendingServeRow(row);
    this.persistOfficerMenu('PENDING_NOTICE');
    if (this.officerMenu() !== 'PENDING_NOTICE') {
      this.officerMenu.set('PENDING_NOTICE');
    }
    this.openWorkflowPanel('notice');
    this.selectedPendingServe.set(normalized);
    this.selectedCaseId.set(normalized.caseId);
    const appId = this.resolveApplicationId(normalized.filingApplicationId, {
      caseId: normalized.caseId
    });
    if (!appId) {
      this.openCaseWorkflow(normalized.caseId, normalized.caseNo, {
        skipNoticeReset: true,
        pendingRow: normalized,
        intent: 'notice'
      });
      return;
    }
    this.hydrateNoticeParties(appId, normalized.caseId);
    this.viewOfficerApplication(appId, {
      skipNoticeReset: true,
      caseId: normalized.caseId,
      pendingRow: normalized,
      intent: 'notice'
    });
  }

  protected reloadNoticeParties(): void {
    const row = this.selectedPendingServe();
    const appId = this.selectedApplicationId() ?? row?.filingApplicationId;
    if (!appId) {
      this.noticePartiesError.set('Open a case from the notice queue first.');
      return;
    }
    this.hydrateNoticeParties(appId, row?.caseId ?? this.caseIdForActions());
  }

  /** Opened from Pending for Serve Notice → Open. */
  protected isNoticeWorkflow(): boolean {
    return this.workflowPanelOpen() && this.workflowIntent() === 'notice';
  }

  /** @deprecated use isNoticeWorkflow() */
  protected showNoticeInlinePanel(): boolean {
    return this.isNoticeWorkflow();
  }

  private todayIsoDate(): string {
    const d = new Date();
    return this.toIsoDateLocal(d);
  }

  private toIsoDateLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Earliest selectable date for new / next hearing (day after today). */
  protected minSelectableHearingDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return this.toIsoDateLocal(d);
  }

  /** Null if valid; otherwise error message (must be strictly after today). */
  protected hearingDateAfterTodayError(date: string): string | null {
    const trimmed = date.trim().slice(0, 10);
    if (!trimmed) return null;
    if (trimmed <= this.todayIsoDate()) {
      return 'Hearing date must be after today.';
    }
    return null;
  }

  protected isFutureHearingDate(date: string): boolean {
    return this.hearingDateAfterTodayError(date) === null && !!date.trim();
  }

  protected roznamaOnePerCaseHint(): string {
    return 'This case has one order sheet (roznamah). Each save updates the same register; add a new table row when a rehearing date is held.';
  }

  private latestHearingFromList(rows: CaseHearingResponse[]): CaseHearingResponse | null {
    if (!rows.length) return null;
    const active = rows.filter((h) => this.upStage(h.hearingStatus ?? h.status) !== 'COMPLETED');
    const pool = active.length ? active : rows;
    return pool.reduce((a, b) => (b.hearingNo > a.hearingNo ? b : a));
  }

  protected activeHearingFromWorkflowContext(): { hearingId: number; hearingDate: string } | null {
    const h = workflowActiveHearing(this.workflowContext());
    if (!h?.hearingId) return null;
    return { hearingId: h.hearingId, hearingDate: (h.hearingDate || '').slice(0, 10) };
  }

  protected latestHearingRef(): { hearingId: number; hearingDate: string } | null {
    const editable = this.roznamaEntryRows().find((r) => r.readOnly === false && r.hearingId);
    if (editable?.hearingId) {
      return {
        hearingId: editable.hearingId,
        hearingDate: (editable.date || editable.hearingDate || '').slice(0, 10)
      };
    }
    const fromCtx = this.activeHearingFromWorkflowContext();
    if (fromCtx) return fromCtx;
    const os = this.currentOrderSheet();
    if (os?.hearingId) {
      const linked = this.roznamaEntryRows().find((r) => r.hearingId === os.hearingId);
      return {
        hearingId: os.hearingId,
        hearingDate: (linked?.date || linked?.hearingDate || this.assignedHearingDate()).slice(0, 10)
      };
    }
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

  /** Hearing date from assign-hearing / cause list — not editable on roznamma. */
  protected assignedHearingDate(): string {
    const ref = this.latestHearingRef();
    if (ref?.hearingDate) return ref.hearingDate.slice(0, 10);
    const tableRow = this.selectedRoznamaTableRow();
    if (tableRow?.hearingDate) return tableRow.hearingDate.slice(0, 10);
    if (tableRow?.causeDate) return tableRow.causeDate.slice(0, 10);
    const pending = this.selectedPendingServe();
    if (pending?.hearingDate) return pending.hearingDate.slice(0, 10);
    return '';
  }

  protected syncAssignedHearingDateToRoznama(): void {
    const d = this.assignedHearingDate();
    if (!d) return;
    const idx = this.editableRoznamaRowIndex();
    this.roznamaEntryRows.update((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, date: d, hearingDate: d } : r))
    );
    this.orderSheetContentInput.set(this.roznamaContentForApi());
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
    this.clearAttendanceState();
    this.persistOfficerMenu('CAUSE_LIST');
    if (this.officerMenu() !== 'CAUSE_LIST') {
      this.officerMenu.set('CAUSE_LIST');
    }
    this.openWorkflowPanel('roznama');
    this.selectedRoznamaTableRow.set(row);
    this.selectedCaseId.set(row.caseId);
    const hearingDate = row.hearingDate?.slice(0, 10) || row.causeDate?.slice(0, 10) || '';
    const appId = this.resolveApplicationId(row.filingApplicationId, { caseId: row.caseId });
    this.selectedRoznamaHearing.set({
      hearingId: row.hearingId,
      hearingDate,
      filingApplicationId: appId ?? row.filingApplicationId ?? 0
    });
    this.orderSheetHearingIdInput.set(String(row.hearingId));
    this.roznamaPanelTab.set('roznama');
    if (hearingDate) {
      this.syncAssignedHearingDateToRoznama();
      this.ensureHearingRowInRegister(hearingDate);
    } else {
      this.roznamaEntryRows.set([{ date: this.todayIsoDate(), content: '' }]);
    }
    const prefilled = row.finalContent || row.draftContent;
    if (prefilled) {
      this.syncRoznamaRowsFromContent(prefilled, hearingDate || this.todayIsoDate());
      this.syncAssignedHearingDateToRoznama();
    }
    if (row.caseId > 0) {
      this.loadCurrentOrderSheet();
      this.loadRoznamaCaseDocuments();
    }
    if (!appId) {
      this.openCaseWorkflow(row.caseId, row.caseNo, { roznamaRow: row, intent: 'roznama' });
      return;
    }
    this.viewOfficerApplication(appId, {
      caseId: row.caseId,
      roznamaRow: row,
      intent: 'roznama'
    });
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
    const editable = this.roznamaEntryRows().find((r) => r.readOnly === false);
    if (editable) {
      const st = this.upStage(editable.status);
      return st === 'CLERK_DRAFT' || st === 'PO_SCRUTINY' || st === 'PO_FINALIZED' || st === 'PO_DRAFT';
    }
    const st = this.upStage(this.currentOrderSheet()?.status);
    return st === 'CLERK_DRAFT' || st === 'PO_SCRUTINY' || st === 'PO_FINALIZED';
  }

  /** Signed and no editable row for a newer hearing. */
  protected isRoznamaReadOnly(): boolean {
    if (this.roznamaEntryRows().some((r) => r.readOnly === false)) {
      return false;
    }
    if (this.roznamaEntryRows().some((r) => r.readOnly === true)) {
      return true;
    }
    if (this.upStage(this.currentOrderSheet()?.status) !== 'PO_SIGNED') return false;
    return !this.hasNewerHearingAfterSigned();
  }

  protected roznamaStatusLabel(): string {
    const editable = this.roznamaEntryRows().find((r) => r.readOnly === false);
    if (editable?.status) return editable.status;
    const signed = this.roznamaEntryRows().find((r) => r.readOnly === true && r.status);
    if (signed?.status) return signed.status;
    return this.currentOrderSheet()?.status || '—';
  }

  /** Case-level roznamah signed (one document per case). */
  protected isCurrentHearingRoznamaSigned(): boolean {
    return this.upStage(this.currentOrderSheet()?.status) === 'PO_SIGNED';
  }

  /** Rehearing scheduled after the case roznamah was signed. */
  protected hasNewerHearingAfterSigned(): boolean {
    if (this.roznamaEntryRows().some((r) => r.readOnly === false)) {
      return true;
    }
    if (!this.isCurrentHearingRoznamaSigned()) return false;
    const os = this.currentOrderSheet();
    const linkedId = os?.hearingId;
    const linked = linkedId ? this.hearings().find((h) => h.hearingId === linkedId) : null;
    const baselineNo = linked?.hearingNo ?? 0;
    return this.hearings().some((h) => h.hearingNo > baselineNo);
  }

  /** Legacy post-roznama chooser — not used on dedicated roznamma screen. */
  protected showPostRoznamaDecisionPanel(): boolean {
    if (this.isRoznamaWorkflow() || this.isJudgmentWorkflow()) return false;
    if (this.officerRole() !== 'PRESIDING_OFFICER') return false;
    if (!this.canRunCaseActions() || !this.showOrderSheetSection()) return false;
    if (!this.isCurrentHearingRoznamaSigned()) return false;
    if (this.hasNewerHearingAfterSigned()) return false;
    const jStatus = judgmentWorkflowStatus(this.judgmentWorkflow());
    if (jStatus) return false;
    return true;
  }

  protected hasAllowedAction(action: string): boolean {
    const want = this.upStage(action);
    const sources = [
      ...(this.workflowContext()?.allowedActions ?? []),
      ...(this.workflowContext()?.roznama?.allowedActions ?? []),
      ...(this.workflowContext()?.notice?.allowedActions ?? [])
    ];
    return sources.some((a) => this.upStage(a) === want);
  }

  /** Judgment actions from workflow-context.judgment + judgment workflow response. */
  protected judgmentAllowedActionsList(): string[] {
    const j = this.workflowContext()?.judgment?.allowedActions ?? [];
    const fromWorkflow = this.judgmentWorkflow()?.allowedActions ?? [];
    const merged = [...j, ...fromWorkflow];
    if (merged.length) {
      return [...new Set(merged.map((a) => this.upStage(a)))];
    }
    const top = this.workflowContext()?.allowedActions ?? [];
    return top
      .map((a) => this.upStage(a))
      .filter((a) => a.includes('JUDGMENT') || a.includes('JUDG'));
  }

  protected usesJudgmentAllowedActions(): boolean {
    return this.judgmentAllowedActionsList().length > 0;
  }

  protected hasJudgmentAllowedAction(action: string): boolean {
    const want = this.upStage(action);
    const aliases: Record<string, string[]> = {
      SUBMIT_JUDGMENT_TO_PO: [
        'SUBMIT_JUDGMENT_TO_PO',
        'SUBMIT_TO_PO',
        'CLERK_SUBMIT_JUDGMENT',
        'SEND_JUDGMENT_TO_PO'
      ],
      CLERK_UPDATE_JUDGMENT: [
        'CLERK_UPDATE_JUDGMENT',
        'CLERK_DRAFT_JUDGMENT',
        'UPDATE_CLERK_JUDGMENT',
        'EDIT_JUDGMENT'
      ],
      SEND_JUDGMENT_TO_CLERK: ['SEND_JUDGMENT_TO_CLERK', 'SEND_TO_CLERK']
    };
    const wants = aliases[want] ?? [want];
    const list = this.judgmentAllowedActionsList();
    if (wants.some((w) => list.some((a) => a === w || w.includes(a) || a.includes(w)))) {
      return true;
    }
    const top = (this.workflowContext()?.allowedActions ?? []).map((a) => this.upStage(a));
    return wants.some((w) => top.some((a) => a === w || w.includes(a) || a.includes(w)));
  }

  protected loadWorkflowContext(options?: { syncDedicatedIntent?: boolean }): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    const hearingId = this.isJudgmentWorkflow()
      ? undefined
      : this.latestHearingRef()?.hearingId;
    this.workflowContextLoading.set(true);
    this.officerCaseStage
      .getWorkflowContext(caseId, hearingId ?? undefined)
      .pipe(finalize(() => this.workflowContextLoading.set(false)))
      .subscribe({
        next: (ctx) => {
          this.workflowContext.set(ctx);
          const ctxStatus = this.upStage(ctx?.judgment?.workflowStatus ?? ctx?.judgment?.status);
          const jCtx = ctx?.judgment;
          const current = this.judgmentWorkflow();
          if (current && jCtx) {
            const merged = normalizeJudgmentWorkflow({
              ...current,
              workflowStatus: judgmentWorkflowStatus(current) || ctxStatus || current.workflowStatus,
              status: judgmentWorkflowStatus(current) || ctxStatus || current.status,
              allowedActions: jCtx.allowedActions ?? current.allowedActions,
              submittable: jCtx.submittable ?? current.submittable,
              actorRole: jCtx.actorRole ?? current.actorRole,
              editable: current.editable
            });
            if (jCtx.editable === true || judgmentInferredEditable(merged, this.judgmentActorRole())) {
              merged.editable = true;
            } else if (jCtx.editable === false && !judgmentInferredEditable(merged, this.judgmentActorRole())) {
              merged.editable = false;
            }
            this.judgmentWorkflow.set(merged);
          } else if (ctxStatus && current && !judgmentWorkflowStatus(current)) {
            this.judgmentWorkflow.set({ ...current, workflowStatus: ctxStatus, status: ctxStatus });
          }
          if (options?.syncDedicatedIntent) {
            this.syncDedicatedIntentFromContext(ctx);
          }
        },
        error: () => this.workflowContext.set(null)
      });
  }

  /** Active cases / adjourned queue open with intent general — resolve to a dedicated action panel. */
  private syncDedicatedIntentFromContext(ctx: CaseWorkflowContext | null): void {
    const resolved = this.resolveDedicatedWorkflowIntent(ctx);
    if (!resolved || resolved === this.workflowIntent()) {
      return;
    }
    this.workflowIntent.set(resolved);
    if (resolved === 'judgment') {
      this.loadJudgmentModule();
      return;
    }
    if (resolved === 'roznama') {
      this.syncRoznamaSelectionFromContext(ctx);
      this.loadCurrentOrderSheet();
      this.loadRoznamaCaseDocuments();
      this.loadCaseReferenceData();
      return;
    }
    if (resolved === 'notice') {
      const appId = this.selectedApplicationId();
      if (appId) {
        this.hydrateNoticeParties(appId, this.caseIdForActions());
      }
      this.loadCaseReferenceData();
      return;
    }
    if (resolved === 'hearing') {
      this.loadCaseReferenceData();
    }
  }

  private syncRoznamaSelectionFromContext(ctx: CaseWorkflowContext | null): void {
    if (this.selectedRoznamaTableRow()) {
      return;
    }
    const appId = this.selectedApplicationId() ?? 0;
    const active = workflowActiveHearing(ctx);
    const latest = active
      ? {
          hearingId: active.hearingId,
          hearingDate: (active.hearingDate || '').slice(0, 10),
          hearingNo: active.hearingNo
        }
      : this.latestHearingFromList(this.hearings());
    if (!latest?.hearingId) {
      return;
    }
    const hearingDate = (latest.hearingDate || '').slice(0, 10);
    this.selectedRoznamaHearing.set({
      hearingId: latest.hearingId,
      hearingDate,
      filingApplicationId: appId
    });
    this.orderSheetHearingIdInput.set(String(latest.hearingId));
    if (hearingDate) {
      this.syncAssignedHearingDateToRoznama();
    }
  }

  private resolveDedicatedWorkflowIntent(
    ctx: CaseWorkflowContext | null
  ): Exclude<WorkflowIntentKey, 'none' | 'general' | 'filing'> | null {
    if (!this.caseIdForActions()) {
      return null;
    }
    if (this.canScheduleHearing()) {
      return 'hearing';
    }
    if (this.resolveJudgmentIntent(ctx)) {
      return 'judgment';
    }
    if (this.resolveNoticeIntent(ctx)) {
      return 'notice';
    }
    if (this.resolveRoznamaIntent(ctx)) {
      return 'roznama';
    }
    return null;
  }

  private resolveJudgmentIntent(ctx: CaseWorkflowContext | null): boolean {
    const caseStatus = this.upStage(ctx?.caseStatus ?? this.currentCaseStatus());
    if (caseStatus === 'READY_FOR_JUDGMENT') {
      return true;
    }
    if (caseStatus === 'DISPOSED') {
      return !!this.upStage(ctx?.judgment?.workflowStatus ?? ctx?.judgment?.status);
    }
    const stage = this.upStage(ctx?.proceedingStage ?? this.currentProceedingStage());
    if (stage.includes('JUDGMENT')) {
      return true;
    }
    const j = ctx?.judgment;
    if (this.upStage(j?.workflowStatus ?? j?.status) || (j?.allowedActions?.length ?? 0) > 0) {
      return true;
    }
    const top = (ctx?.allowedActions ?? []).map((a) => this.upStage(a));
    if (top.some((a) => a.includes('JUDGMENT'))) {
      return true;
    }
    if (this.postRoznamaPath() === 'judgment' && this.isCurrentHearingRoznamaSigned()) {
      return true;
    }
    return false;
  }

  private resolveNoticeIntent(ctx: CaseWorkflowContext | null): boolean {
    if (!this.isHearingScheduledCase()) {
      return false;
    }
    const noticeServed = ctx?.noticeServed === true || this.isNoticeServed();
    if (noticeServed) {
      return false;
    }
    const stage = this.upStage(ctx?.proceedingStage ?? this.currentProceedingStage());
    if (stage.startsWith('NOTICE') || stage === 'HEARING_SCHEDULED' || !stage) {
      return true;
    }
    if ((ctx?.notice?.allowedActions?.length ?? 0) > 0) {
      return true;
    }
    const top = (ctx?.allowedActions ?? []).map((a) => this.upStage(a));
    return top.some((a) => a.includes('NOTICE') || a.includes('SERVE'));
  }

  private resolveRoznamaIntent(ctx: CaseWorkflowContext | null): boolean {
    if (!this.canActAsPresidingOfficer() || !this.isHearingScheduledCase()) {
      return false;
    }
    const noticeServed = ctx?.noticeServed === true || this.isNoticeServed();
    if (!noticeServed) {
      return false;
    }
    const stage = this.upStage(ctx?.proceedingStage ?? this.currentProceedingStage());
    if (this.isOrderSheetProceedingStage(stage) || !stage) {
      return true;
    }
    if ((ctx?.roznama?.allowedActions?.length ?? 0) > 0) {
      return true;
    }
    const top = (ctx?.allowedActions ?? []).map((a) => this.upStage(a));
    if (top.some((a) => a.includes('ROZNAMA') || a === 'COMPLETE_ROZNAMA')) {
      return true;
    }
    return stage.includes('ROZNAMA') || stage.includes('ORDER_SHEET');
  }

  protected canCompleteRoznama(): boolean {
    if (!this.canActAsPresidingOfficer() || this.roznamaCompleting()) return false;
    if (!this.primaryRoznamaPlainText()) return false;
    const outcome = this.hearingOutcomeInput();
    if (outcome !== 'FINAL' && outcome !== 'ADJOURN') return false;
    const nextDate = this.nextHearingDateOnRoznama().trim();
    if (outcome === 'ADJOURN' && nextDate && this.hearingDateAfterTodayError(nextDate)) {
      return false;
    }
    if (this.attendanceRequired() && !this.attendanceComplete() && this.validateAttendanceBeforeSave()) {
      return false;
    }
    const ctx = this.workflowContext();
    if (ctx?.allowedActions?.length) {
      return this.hasAllowedAction('COMPLETE_ROZNAMA');
    }
    return this.canPoEditRoznama();
  }

  protected showRoznamaAttendancePanel(): boolean {
    return this.attendanceRequired() && this.attendanceEntries().length > 0;
  }

  protected canSaveRoznamaAttendance(): boolean {
    return this.canPoEditRoznama() && this.attendanceRequired() && !this.attendanceSaving();
  }

  protected attendancePartyKey(entry: RoznamaAttendanceEntry): string {
    return `${entry.partyType}:${entry.partyRefId ?? entry.otherPartyKey ?? entry.partyName}`;
  }

  protected attendancePartyTypeLabel(partyType: string): string {
    if (partyType === 'APPLICANT') return 'Applicant';
    if (partyType === 'RESPONDENT') return 'Respondent';
    return 'Other';
  }

  protected attendanceRowIncomplete(entry: RoznamaAttendanceEntry): boolean {
    if (!entry.mandatory) return false;
    if (entry.present !== null) return false;
    return !this.attendanceTouchedKeys().has(this.attendancePartyKey(entry));
  }

  protected attendancePresentLabel(entry: RoznamaAttendanceEntry): string {
    if (entry.present === true) return 'Present';
    if (entry.present === false) return 'Absent';
    return 'Not marked';
  }

  protected onAttendancePresentChange(entry: RoznamaAttendanceEntry, present: boolean): void {
    const key = this.attendancePartyKey(entry);
    this.attendanceTouchedKeys.update((keys) => {
      const next = new Set(keys);
      next.add(key);
      return next;
    });
    this.attendanceEntries.update((rows) =>
      rows.map((row) =>
        row.partyType === entry.partyType && row.partyRefId === entry.partyRefId ? { ...row, present } : row
      )
    );
    this.attendanceValidationError.set(null);
    this.attendancePanelHighlight.set(false);
  }

  protected saveRoznamaAttendance(): void {
    const caseId = this.caseIdForActions();
    const hearingRef = this.latestHearingRef();
    if (!caseId || !hearingRef?.hearingId) {
      this.actionError.set('Hearing not loaded.');
      return;
    }
    const validation = this.validateAttendanceBeforeSave();
    if (validation) {
      this.attendanceValidationError.set(validation);
      this.attendancePanelHighlight.set(true);
      return;
    }
    const entries = this.buildAttendanceSaveEntries();
    if (!entries.length) {
      this.attendanceValidationError.set('No attendance entries to save.');
      return;
    }
    this.attendanceSaving.set(true);
    this.actionError.set(null);
    this.attendanceValidationError.set(null);
    this.officerCaseStage
      .saveHearingAttendance(caseId, hearingRef.hearingId, { entries })
      .pipe(finalize(() => this.attendanceSaving.set(false)))
      .subscribe({
        next: (resp) => {
          this.applyAttendanceResponse(resp);
          this.actionMessage.set('Attendance saved.');
        },
        error: (err: unknown) => this.setActionErrorFromHttp(err)
      });
  }

  protected refreshRoznamaAttendance(): void {
    const caseId = this.caseIdForActions();
    const hearingRef = this.latestHearingRef();
    if (!caseId || !hearingRef?.hearingId) return;
    this.officerCaseStage.getHearingAttendance(caseId, hearingRef.hearingId).subscribe({
      next: (resp) => this.applyAttendanceResponse(resp),
      error: () => {
        /* keep current local state */
      }
    });
  }

  protected canRescheduleHearing(): boolean {
    if (!this.canActAsPresidingOfficer() || this.rescheduleSubmitting()) return false;
    if (this.hearingOutcomeInput() !== 'ADJOURN') return false;
    if (this.hasAllowedAction('RESCHEDULE_HEARING')) return true;
    return this.upStage(this.currentCaseStatus()) === 'ADJOURNED';
  }

  /** Case adjourned after roznamma — officer must choose Adjourn to see reschedule. */
  protected needsPostAdjournReschedule(): boolean {
    if (!this.isRoznamaWorkflow() || !this.isRoznamaReadOnly()) return false;
    if (this.hasAllowedAction('RESCHEDULE_HEARING')) return true;
    return this.upStage(this.currentCaseStatus()) === 'ADJOURNED';
  }

  /** Reschedule fields — only after officer selects Adjourn (or post-sign adjourn without date). */
  protected showAdjournRescheduleForm(): boolean {
    return this.hearingOutcomeInput() === 'ADJOURN' && this.canRescheduleHearing() && !this.canPoEditRoznama();
  }

  protected setHearingOutcome(outcome: 'FINAL' | 'ADJOURN'): void {
    this.hearingOutcomeInput.set(outcome);
    if (outcome === 'FINAL') {
      this.nextHearingDateOnRoznama.set('');
      this.rescheduleDateInput.set('');
    }
  }

  /** Complete roznamma — single POST (save + sign + outcome). */
  protected completeRoznama(): void {
    const caseId = this.caseIdForActions();
    const hearingRef = this.latestHearingRef();
    if (!caseId || !hearingRef?.hearingId) {
      this.actionError.set('Hearing not loaded. Open the case from the roznamma table.');
      return;
    }
    const content = this.roznamaContentForApi().trim();
    if (!content || !this.primaryRoznamaPlainText()) {
      this.actionError.set('Roznama proceedings text is required.');
      return;
    }
    const hearingOutcome = this.hearingOutcomeInput();
    if (hearingOutcome !== 'FINAL' && hearingOutcome !== 'ADJOURN') {
      this.actionError.set('Select hearing outcome: Final or Adjourn.');
      return;
    }
    if (hearingOutcome === 'FINAL') {
      const confirmed = window.confirm(
        'Mark this hearing as FINAL?\n\n' +
          'The case will move to Ready for Judgment. This is not the same as publishing judgment — ' +
          'you will draft judgment later from the Judgment menu.\n\n' +
          'Confirm only if no further hearing is needed for this case.'
      );
      if (!confirmed) {
        return;
      }
    }
    const nextDate = this.nextHearingDateOnRoznama().trim();
    if (hearingOutcome === 'ADJOURN' && nextDate) {
      const dateErr = this.hearingDateAfterTodayError(nextDate);
      if (dateErr) {
        this.actionError.set(dateErr);
        return;
      }
    }
    if (this.attendanceRequired() && !this.attendanceComplete()) {
      const attendanceValidation = this.validateAttendanceBeforeSave();
      if (attendanceValidation) {
        this.actionError.set(attendanceValidation);
        this.attendanceValidationError.set(attendanceValidation);
        this.attendancePanelHighlight.set(true);
        return;
      }
    }

    const payload: CompleteRoznamaRequest = {
      hearingId: hearingRef.hearingId,
      content,
      hearingOutcome,
      hearingDate: hearingRef.hearingDate || this.assignedHearingDate(),
      nextHearingDate: hearingOutcome === 'ADJOURN' && nextDate ? nextDate : undefined,
      remarks: this.orderSheetRemarksInput().trim() || undefined,
      digitalSignatureRef: `PO-DSC-${caseId}-${Date.now()}`
    };
    if (this.attendanceRequired() && !this.attendanceComplete()) {
      payload.attendance = this.buildAttendanceSaveEntries();
    }

    this.roznamaCompleting.set(true);
    this.actionError.set(null);
    this.officerCaseStage
      .completeRoznama(caseId, payload)
      .pipe(finalize(() => this.roznamaCompleting.set(false)))
      .subscribe({
        next: (resp) => this.onRoznamaCompleted(resp),
        error: (err: unknown) => this.setActionErrorFromHttp(err)
      });
  }

  private onRoznamaCompleted(resp: CompleteRoznamaResponse): void {
    const outcome = this.upStage(resp.hearingOutcome);
    const caseStatus = this.upStage(resp.caseStatus);
    if (outcome === 'FINAL' || caseStatus === 'READY_FOR_JUDGMENT') {
      this.actionMessage.set(
        resp.message ||
          'Roznamma signed. Case is ready for judgment — open it later from the Judgment menu.'
      );
      this.loadCaseInboxForMenu();
      this.loadRoznamaTable();
      setTimeout(() => this.closeWorkflow(), 1200);
      return;
    }
    if (outcome === 'ADJOURN') {
      if (resp.nextHearingDate || resp.nextHearingId) {
        this.actionMessage.set(
          resp.message ||
            `Case adjourned. Next hearing: ${resp.nextHearingDate?.slice(0, 10) || 'scheduled'}. Serve notice for the new hearing.`
        );
        this.loadCaseInboxForMenu();
        this.loadRoznamaTable();
        this.loadWorkflowContext();
        setTimeout(() => this.closeWorkflow(), 2000);
        return;
      }
      this.hearingOutcomeInput.set('ADJOURN');
      this.actionMessage.set(
        resp.message || 'Case adjourned. Select Adjourn above, set the next hearing date, then reschedule.'
      );
      this.loadWorkflowContext();
      this.loadCurrentOrderSheet();
      this.loadCaseInboxForMenu();
      return;
    }
    this.actionMessage.set(resp.message || 'Roznamma completed.');
    this.loadWorkflowContext();
    this.loadCurrentOrderSheet();
    this.loadRoznamaTable();
    this.loadCaseInboxForMenu();
  }

  protected submitRescheduleHearing(): void {
    const caseId = this.caseIdForActions();
    const hearingRef = this.latestHearingRef();
    const nextDate = this.rescheduleDateInput().trim();
    if (!caseId || !hearingRef?.hearingId) {
      this.actionError.set('Case or hearing not loaded.');
      return;
    }
    if (!nextDate) {
      this.actionError.set('Next hearing date is required.');
      return;
    }
    const rescheduleDateErr = this.hearingDateAfterTodayError(nextDate);
    if (rescheduleDateErr) {
      this.actionError.set(rescheduleDateErr);
      return;
    }
    this.rescheduleSubmitting.set(true);
    this.actionError.set(null);
    this.officerCaseStage
      .rescheduleHearing(caseId, hearingRef.hearingId, {
        nextHearingDate: nextDate,
        noticeGenerate: this.rescheduleNoticeGenerate(),
        remarks: this.rescheduleRemarksInput().trim() || undefined
      })
      .pipe(finalize(() => this.rescheduleSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.actionMessage.set('Hearing rescheduled. Serve notice for the new hearing date.');
          this.rescheduleDateInput.set('');
          this.loadCaseInboxForMenu();
          this.loadPendingServeQueue();
          this.loadWorkflowContext();
          setTimeout(() => this.closeWorkflow(), 1500);
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected canOpenRoznamaRow(row: OfficerRoznamaTableRow): boolean {
    if (row.proceedingAllowed === false) return false;
    if (row.noticeServed === false) return false;
    return row.canEdit !== false || this.upStage(row.roznamaStatus) !== 'PO_SIGNED';
  }

  protected selectPostRoznamaPath(path: 'rehearing' | 'judgment'): void {
    this.postRoznamaPath.set(path);
    this.actionError.set(null);
    if (path === 'rehearing') {
      this.setRoznamaPanelTab('rehearing');
      this.actionMessage.set('Schedule the next hearing date below. Roznamah will start fresh for that date.');
    } else {
      this.persistOfficerMenu('PENDING_JUDGMENT');
      this.officerMenu.set('PENDING_JUDGMENT');
      this.workflowIntent.set('judgment');
      this.roznamaDocTab.set('summary');
      this.loadJudgmentModule();
      this.actionMessage.set('Save judgment as draft first, then send to clerk or sign when ready.');
      setTimeout(() => {
        document.getElementById('judgment-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

  protected showRehearingPathOption(): boolean {
    return this.viewerFlowRole() === 'PRESIDING_OFFICER' && this.canScheduleRehearing();
  }

  protected showJudgmentPathOption(): boolean {
    return (
      this.officerRole() === 'PRESIDING_OFFICER' &&
      !this.isDisposedCase() &&
      this.isCurrentHearingRoznamaSigned()
    );
  }

  protected effectiveJudgmentWorkflowStatus(): string {
    const j = this.workflowContext()?.judgment;
    const fromCtx = this.upStage(j?.workflowStatus ?? j?.status);
    const fromWorkflow = judgmentWorkflowStatus(this.judgmentWorkflow());
    return fromCtx || fromWorkflow;
  }

  protected isJudgmentClerkDraftStage(): boolean {
    return this.effectiveJudgmentWorkflowStatus() === 'CLERK_DRAFT';
  }

  protected clerkJudgmentEditActions(): string[] {
    return [
      'CLERK_UPDATE_JUDGMENT',
      'CLERK_DRAFT_JUDGMENT',
      'UPDATE_CLERK_JUDGMENT',
      'EDIT_JUDGMENT',
      'SUBMIT_JUDGMENT_TO_PO'
    ];
  }

  protected hasClerkJudgmentEditAction(): boolean {
    return this.clerkJudgmentEditActions().some((a) => this.hasJudgmentAllowedAction(a));
  }

  protected judgmentStatusLabel(): string {
    return this.effectiveJudgmentWorkflowStatus() || '—';
  }

  protected judgmentStepHint(): string {
    const st = this.effectiveJudgmentWorkflowStatus();
    if (this.isJudgmentDisposed()) {
      return 'Judgment published. Case is disposed — read-only.';
    }
    if (!st || st === 'PO_DRAFT') {
      return 'Presiding Officer: save draft, then send to clerk for review.';
    }
    if (st === 'CLERK_DRAFT') {
      return this.judgmentActorRole() === 'CLERK'
        ? 'Clerk: edit the draft, save, then submit to Presiding Officer.'
        : 'With clerk for editing. PO may revert with remarks if needed.';
    }
    if (st === 'PO_SCRUTINY') {
      return 'Presiding Officer: review clerk text — finalize, revert to clerk, or sign and publish to dispose the case.';
    }
    if (st === 'PO_FINALIZED') {
      return 'Presiding Officer: publish or sign and publish to dispose the case.';
    }
    if (st === 'PUBLISHED') {
      return 'Judgment published. Case is disposed.';
    }
    return '';
  }

  protected judgmentFieldLabelText(): string {
    return judgmentFieldLabel(this.judgmentWorkflow());
  }

  protected judgmentActorRole(): 'CLERK' | 'PRESIDING_OFFICER' | '' {
    const st = this.effectiveJudgmentWorkflowStatus();
    const login = this.loginRole;
    // Logged-in role wins at clerk/PO judgment stages (API actorRole can lag after handoff).
    if (login === 'CLERK' && (st === 'CLERK_DRAFT' || this.hasClerkJudgmentEditAction())) {
      return 'CLERK';
    }
    if (
      login === 'PRESIDING_OFFICER' &&
      (st === 'PO_DRAFT' || st === 'PO_SCRUTINY' || st === 'PO_FINALIZED' || !st)
    ) {
      return 'PRESIDING_OFFICER';
    }
    const fromApi = String(
      this.judgmentWorkflow()?.actorRole ?? this.workflowContext()?.judgment?.actorRole ?? ''
    ).toUpperCase();
    if (fromApi === 'CLERK' || fromApi === 'PRESIDING_OFFICER') {
      return fromApi;
    }
    return this.officerRole();
  }

  protected isJudgmentDisposed(): boolean {
    const caseSt = this.upStage(
      this.judgmentWorkflow()?.caseStatus ??
        this.workflowContext()?.caseStatus ??
        this.currentCaseStatus()
    );
    if (caseSt === 'DISPOSED') {
      return true;
    }
    return this.effectiveJudgmentWorkflowStatus() === 'PUBLISHED';
  }

  /** API editable flag — allowedActions override a false editable from backend. */
  protected judgmentEditable(): boolean {
    if (this.isJudgmentDisposed()) {
      return false;
    }
    const w = this.judgmentWorkflow();
    const actor = this.judgmentActorRole();
    if (w && judgmentInferredEditable(w, actor)) {
      return true;
    }
    const ctx = this.workflowContext()?.judgment;
    if (ctx?.editable === true) {
      return true;
    }
    const st = this.effectiveJudgmentWorkflowStatus();
    if (!st || st === 'PO_DRAFT' || st === 'PO_SCRUTINY') {
      return actor === 'PRESIDING_OFFICER';
    }
    if (st === 'CLERK_DRAFT') {
      return actor === 'CLERK';
    }
    return w?.editable === true;
  }

  protected judgmentEditorDisabled(): boolean {
    return (
      !this.judgmentEditable() ||
      this.judgmentLoading() ||
      this.workflowContextLoading() ||
      this.judgmentSaving()
    );
  }

  /** Clerk submit-to-PO (API submittable flag). */
  protected judgmentSubmittable(): boolean {
    const w = this.judgmentWorkflow();
    const ctx = this.workflowContext()?.judgment;
    if (w?.submittable === true || ctx?.submittable === true) {
      return true;
    }
    if (w?.submittable === false || ctx?.submittable === false) {
      return false;
    }
    return (
      this.judgmentActorRole() === 'CLERK' &&
      this.effectiveJudgmentWorkflowStatus() === 'CLERK_DRAFT'
    );
  }

  protected judgmentTextFromWorkflow(resp: CaseJudgmentWorkflowResponse | null): string {
    return judgmentBindingText(resp);
  }

  private applyJudgmentWorkflow(resp: CaseJudgmentWorkflowResponse): void {
    const normalized = normalizeJudgmentWorkflow(resp);
    const bound = judgmentBindingText(normalized);
    const keepTyped = !bound.trim() && !!this.judgmentSummaryInput().trim();
    this.judgmentWorkflow.set(normalized);
    if (!keepTyped) {
      this.judgmentSummaryInput.set(bound);
    }
    if (judgmentWorkflowStatus(normalized) && !this.isJudgmentWorkflow()) {
      this.postRoznamaPath.set('judgment');
    }
  }

  protected openJudgmentCase(applicationId: number, caseId?: number): void {
    this.persistOfficerMenu('PENDING_JUDGMENT');
    if (this.officerMenu() !== 'PENDING_JUDGMENT') {
      this.officerMenu.set('PENDING_JUDGMENT');
    }
    if (this.isClerk) {
      this.viewerFlowRole.set('CLERK');
    } else if (this.isPO) {
      this.viewerFlowRole.set('PRESIDING_OFFICER');
    }
    this.postRoznamaPath.set(null);
    this.roznamaDocTab.set('summary');
    this.viewOfficerApplication(applicationId, { caseId, intent: 'judgment' });
  }

  protected loadJudgmentModule(): void {
    this.roznamaDocTab.set('summary');
    this.loadWorkflowContext();
    this.loadJudgmentWorkflow();
    this.loadJudgmentHistory();
    this.loadCaseReferenceData();
  }

  protected loadJudgmentHistory(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.judgmentHistoryLoading.set(true);
    this.officerCaseStage
      .getJudgmentHistory(caseId)
      .pipe(finalize(() => this.judgmentHistoryLoading.set(false)))
      .subscribe({
        next: (rows) => this.judgmentHistory.set(rows || []),
        error: () => this.judgmentHistory.set([])
      });
  }

  protected judgmentBlueprintLabel(): string {
    const bp = this.workflowContext()?.judgment?.blueprint;
    if (!bp) return '';
    return String(bp).replace(/_/g, ' ');
  }

  protected judgmentContextMessage(): string | null {
    return (
      this.workflowContext()?.judgment?.message?.trim() ||
      this.workflowContext()?.message?.trim() ||
      null
    );
  }

  /** Schedule next hearing after case roznamah is signed (rehearing) — PO only. */
  protected canScheduleRehearing(): boolean {
    if (this.viewerFlowRole() !== 'PRESIDING_OFFICER') return false;
    if (!this.showOrderSheetSection() || this.isDisposedCase()) return false;
    if (this.hasRoznamaInProgress()) return false;
    return this.isCurrentHearingRoznamaSigned();
  }

  protected loadCaseInbox(status?: string): void {
    this.caseInboxLoading.set(true);
    this.caseInboxError.set(null);
    this.officerCaseStage.getCaseInbox(status).subscribe({
      next: (rows) => {
        this.caseInbox.set(rows || []);
        this.tryOpenPendingRoute();
      },
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

  /** Case is in hearings / proceedings (not filing-only ACTIVE). */
  private isCaseProceedingsStatus(status: string): boolean {
    const s = String(status || '').toUpperCase();
    return s === 'HEARING_SCHEDULED' || s === 'NOTICE_SERVED';
  }

  private caseInboxItemForSelection(): OfficerCaseInboxItem | undefined {
    const appId = this.selectedApplicationId();
    if (appId) {
      const fromMap = this.caseMapByAppId().get(appId);
      if (fromMap) return fromMap;
    }
    const caseId = this.selectedCaseId() ?? this.caseIdForActions();
    if (caseId) {
      return (this.caseInbox() || []).find((c) => c.caseId === caseId);
    }
    return undefined;
  }

  /** Proceeding stage within HEARING_SCHEDULED (case inbox / detail only — not filing processingStage). */
  protected currentProceedingStage(): string {
    const fromSelectedCase = this.caseInboxItemForSelection()?.proceedingStage;
    if (fromSelectedCase) return String(fromSelectedCase).trim().toUpperCase();
    const appId = this.selectedApplicationId();
    if (appId) {
      const fromCase = this.caseMapByAppId().get(appId)?.proceedingStage;
      if (fromCase) return String(fromCase).trim().toUpperCase();
    }
    const row = this.selectedRoznamaTableRow();
    if (row?.proceedingStage) return String(row.proceedingStage).trim().toUpperCase();
    const detailPs = (this.officerDetail() as { proceedingStage?: string } | null)?.proceedingStage;
    if (detailPs) return String(detailPs).trim().toUpperCase();
    return '';
  }

  /** True when at least one hearing date exists for this case. */
  private isHearingScheduledByHearings(): boolean {
    return (this.hearings() || []).some((h) => !!h.hearingDate);
  }

  /** Case has a scheduled hearing (inbox status or hearings list). */
  protected isHearingScheduledCase(): boolean {
    const status = this.currentCaseStatus();
    if (this.isCaseProceedingsStatus(status)) return true;
    if (this.currentProceedingStage() === 'NOTICE_SERVED') return true;
    return this.isHearingScheduledByHearings();
  }

  /** Notice marked served — required before order sheet / roznamah proceedings. */
  protected isNoticeServed(): boolean {
    const status = this.currentCaseStatus();
    if (status === 'NOTICE_SERVED') return true;
    if (this.currentProceedingStage() === 'NOTICE_SERVED') return true;
    return (this.notices() || []).some((n) => this.upStage(n.status) === 'SERVED');
  }

  /** Proceedings (order sheet) unlocked only after notice is served. */
  protected canStartProceedings(): boolean {
    if (!this.isHearingScheduledCase()) return false;
    return this.isNoticeServed();
  }

  private patchCaseInboxForApplication(
    applicationId: number,
    patch: Partial<Pick<OfficerCaseInboxItem, 'status' | 'proceedingStage'>>
  ): void {
    this.caseInbox.update((rows) =>
      (rows || []).map((c) => (c.filingApplicationId === applicationId ? { ...c, ...patch } : c))
    );
  }

  /** Stages where order sheet / roznamah UI is active (aligned with Pending Order Sheet inbox). */
  private isOrderSheetProceedingStage(stage: string): boolean {
    if (!stage) return false;
    const orderSheetStages = new Set([
      'NOTICE_SERVED',
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
    if (!this.caseIdForActions() || !this.isHearingScheduledCase()) return null;
    if (this.showOrderSheetSection() || this.showNoticeSection() || this.showJudgmentSection()) return null;
    if (!this.isNoticeServed()) {
      return 'Serve the hearing notice first. Order sheet (roznamah) and other proceedings start only after notice is served.';
    }
    const stage = this.currentProceedingStage();
    if (!stage) {
      return 'Notice is served. Open Order Sheet when the proceeding stage is ready for roznamah.';
    }
    if (stage === 'NOTICE_PENDING' || stage === 'NOTICE_IN_PROGRESS') {
      return 'Finish notice draft, finalize, sign, and serve before the order sheet (roznamah) form is shown.';
    }
    if (stage === 'NOTICE_SERVED') {
      return null;
    }
    if (stage === 'JUDGMENT_PENDING' || stage === 'JUDGMENT_IN_PROGRESS') {
      return 'Case is in judgment stage. Use the Judgment section when it is your step.';
    }
    return `Order sheet is not available at proceeding stage: ${stage}.`;
  }

  /** Stage hint only when this officer has no other authorized section to use. */
  protected showProceedingStageHint(): boolean {
    const hint = this.orderSheetStageBlockedHint();
    if (!hint) return false;
    if (this.hasAuthorizedActionOnTab()) return false;
    return true;
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

    if (menu === 'CLERK_DESK') {
      const caseMap = this.caseMapByAppId();
      return rows.filter((r) => {
        const stage = up(r.processingStage);
        if (
          stage === 'CLERK_DRAFT_REVIEW' ||
          stage === 'PO_SENT_BACK_TO_CLERK' ||
          up(r.currentAssigneeRole) === 'CLERK'
        ) {
          return true;
        }
        const c = caseMap.get(r.applicationId);
        if (!c) return false;
        const proc = up(c.proceedingStage);
        return (
          proc === 'JUDGMENT_PENDING' ||
          proc === 'JUDGMENT_IN_PROGRESS' ||
          up(c.status) === 'READY_FOR_JUDGMENT'
        );
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

    if (menu === 'PENDING_NOTICE') {
      return [];
    }

    if (menu === 'PENDING_JUDGMENT') {
      return rows.filter((r) => {
        const c = caseMap.get(r.applicationId);
        if (!c) return false;
        const status = up(c.status);
        const stage = up(c?.proceedingStage ?? '');
        if (status === 'READY_FOR_JUDGMENT') return true;
        if (this.isClerk) {
          return stage === 'JUDGMENT_PENDING' || stage === 'JUDGMENT_IN_PROGRESS';
        }
        return stage === 'JUDGMENT_PENDING' || stage === 'JUDGMENT_IN_PROGRESS';
      });
    }

    if (menu === 'ACTIVE_CASES') {
      return rows.filter((r) => caseMap.has(r.applicationId));
    }

    if (menu === 'ADJOURNED_QUEUE') {
      return rows.filter((r) => {
        const c = caseMap.get(r.applicationId);
        if (!c) return false;
        const status = up(c.status);
        const stage = up(c.proceedingStage);
        return status === 'ADJOURNED' || stage === 'ADJOURNED_PENDING_NEXT_DATE';
      });
    }

    return rows;
  }

  protected menuCount(menu: OfficerMenuKey): number {
    const rows = this.mergedInbox();
    const up = (v: unknown) => String(v || '').toUpperCase();
    const caseMap = this.caseMapByAppId();

    if (menu === 'CAUSE_LIST') {
      return this.roznamaTableRows().length;
    }
    if (menu === 'CLERK_DESK') {
      const caseMap = this.caseMapByAppId();
      return rows.filter((r) => {
        const stage = up(r.processingStage);
        if (
          stage === 'CLERK_DRAFT_REVIEW' ||
          stage === 'PO_SENT_BACK_TO_CLERK' ||
          up(r.currentAssigneeRole) === 'CLERK'
        ) {
          return true;
        }
        const c = caseMap.get(r.applicationId);
        if (!c) return false;
        const proc = up(c.proceedingStage);
        return (
          proc === 'JUDGMENT_PENDING' ||
          proc === 'JUDGMENT_IN_PROGRESS' ||
          up(c.status) === 'READY_FOR_JUDGMENT'
        );
      }).length;
    }
    if (menu === 'PO_DESK') return rows.filter((r) => up(r.processingStage) === 'PO_UNDER_REVIEW' && !caseMap.has(r.applicationId)).length;
    if (menu === 'ASSIGN_HEARING') return rows.filter((r) => up(caseMap.get(r.applicationId)?.status) === 'ACTIVE').length;
    if (menu === 'PENDING_NOTICE') return this.pendingServeRows().length;
    if (menu === 'PENDING_JUDGMENT') {
      return rows.filter((r) => {
        const c = caseMap.get(r.applicationId);
        if (!c) return false;
        const status = up(c.status);
        const stage = up(c?.proceedingStage ?? '');
        if (status === 'READY_FOR_JUDGMENT') return true;
        return stage === 'JUDGMENT_PENDING' || stage === 'JUDGMENT_IN_PROGRESS';
      }).length;
    }
    if (menu === 'ACTIVE_CASES') {
      return rows.filter((r) => caseMap.has(r.applicationId)).length;
    }
    if (menu === 'ADJOURNED_QUEUE') {
      return rows.filter((r) => {
        const c = caseMap.get(r.applicationId);
        if (!c) return false;
        const status = up(c.status);
        const stage = up(c.proceedingStage);
        return status === 'ADJOURNED' || stage === 'ADJOURNED_PENDING_NEXT_DATE';
      }).length;
    }
    return 0;
  }

  protected hasDetailSelection(): boolean {
    return (this.selectedApplicationId() ?? 0) > 0 || (this.selectedCaseId() ?? 0) > 0;
  }

  private openWorkflowPanel(intent: Exclude<WorkflowIntentKey, 'none'>): void {
    this.workflowIntent.set(intent);
    this.workflowPanelOpen.set(true);
    this.officerTab.set('action');
  }

  protected closeWorkflow(): void {
    this.workflowPanelOpen.set(false);
    this.workflowIntent.set('none');
    this.selectedApplicationId.set(null);
    this.selectedCaseId.set(null);
    this.selectedPendingServe.set(null);
    this.selectedRoznamaTableRow.set(null);
    this.selectedRoznamaHearing.set(null);
    this.workflowContext.set(null);
    this.hearingOutcomeInput.set('');
    this.nextHearingDateOnRoznama.set('');
    this.rescheduleDateInput.set('');
    this.caseReferenceCollapsed.set(false);
    this.roznamaDocTab.set('summary');
    this.officerDetail.set(null);
    this.officerDetailError.set(null);
    this.loadingOfficerDetail.set(false);
    this.generatedCase.set(null);
  }

  protected workflowCaseNo(): string {
    return (
      this.selectedRoznamaTableRow()?.caseNo ||
      this.selectedPendingServe()?.caseNo ||
      this.generatedCase()?.caseNo ||
      this.caseInboxItemForSelection()?.caseNo ||
      ''
    );
  }

  protected workflowTitle(): string {
    const caseNo = this.workflowCaseNo();
    switch (this.workflowIntent()) {
      case 'roznama':
        return caseNo || 'Roznamma';
      case 'notice':
        return caseNo || 'Serve notice';
      case 'hearing':
        return caseNo || 'Schedule hearing';
      case 'judgment':
        return caseNo || 'Judgment';
      case 'filing':
        return 'Filing scrutiny';
      default:
        return this.officerDetail()?.applicationNo || caseNo || 'Case workspace';
    }
  }

  protected workflowStageLabel(): string {
    if (this.isJudgmentWorkflow()) {
      const caseStatus = this.workflowContext()?.caseStatus || this.currentCaseStatus();
      const jStatus = this.judgmentStatusLabel();
      return [caseStatus, jStatus !== '—' ? jStatus : ''].filter(Boolean).join(' · ');
    }
    if (this.isRoznamaWorkflow()) {
      const hearing = this.activeRoznamaHearingLabel();
      const status = this.roznamaStatusLabel();
      return [hearing !== '—' ? hearing : '', status !== '—' ? status : ''].filter(Boolean).join(' · ');
    }
    if (this.isNoticeWorkflow()) {
      const caseStatus = this.workflowContext()?.caseStatus || this.currentCaseStatus();
      const stage = this.workflowContext()?.proceedingStage || this.currentProceedingStage();
      return [caseStatus, stage].filter(Boolean).join(' · ');
    }
    if (this.isHearingWorkflow()) {
      return this.workflowContext()?.caseStatus || this.currentCaseStatus() || 'ACTIVE';
    }
    const stage = this.currentProceedingStage();
    const status = this.currentCaseStatus();
    return [status, stage].filter(Boolean).join(' · ');
  }

  protected dedicatedWorkflowLoading(): boolean {
    if (this.isGeneralWorkflow() && this.workflowContextLoading()) {
      return true;
    }
    if (this.isJudgmentWorkflow()) {
      return this.judgmentLoading() || this.workflowContextLoading();
    }
    if (this.isRoznamaWorkflow() || this.isNoticeWorkflow()) {
      return this.workflowContextLoading();
    }
    return false;
  }

  /** Opened from Active cases / adjourned — intent upgraded after workflow-context loads. */
  protected isGeneralWorkflow(): boolean {
    return this.workflowPanelOpen() && this.workflowIntent() === 'general';
  }

  protected viewOfficerApplication(
    applicationId: number,
    opts?: {
      skipNoticeReset?: boolean;
      caseId?: number;
      pendingRow?: PendingServeNoticeRow | null;
      roznamaRow?: OfficerRoznamaTableRow;
      intent?: Exclude<WorkflowIntentKey, 'none'>;
    }
  ): void {
    const menu = this.officerMenu();
    const intent = this.workflowIntentForMenu(menu, opts);
    this.openWorkflowPanel(intent);

    const preserveRoznamaState = intent === 'roznama';
    const pendingRow =
      opts?.pendingRow ??
      (this.selectedPendingServe()?.filingApplicationId === applicationId ||
      this.selectedPendingServe()?.caseId === opts?.caseId
        ? this.selectedPendingServe()
        : null);
    const resolvedAppId = this.resolveApplicationId(applicationId, {
      caseId: opts?.caseId ?? pendingRow?.caseId ?? this.selectedCaseId()
    });
    const caseEntry = resolvedAppId ? this.caseMapByAppId().get(resolvedAppId) : undefined;
    if (!resolvedAppId) {
      const caseId = opts?.caseId ?? pendingRow?.caseId ?? caseEntry?.caseId;
      if (caseId && caseId > 0) {
        this.openCaseWorkflow(caseId, pendingRow?.caseNo ?? caseEntry?.caseNo ?? '', {
          skipNoticeReset: opts?.skipNoticeReset,
          pendingRow,
          intent: opts?.intent ?? (opts?.roznamaRow ? 'roznama' : pendingRow ? 'notice' : undefined)
        });
        return;
      }
      this.officerDetailError.set('Application ID not found for this case. Refresh the inbox and try again.');
      return;
    }

    this.selectedApplicationId.set(resolvedAppId);
    if (opts?.caseId) {
      this.selectedCaseId.set(opts.caseId);
    } else if (caseEntry?.caseId) {
      this.selectedCaseId.set(caseEntry.caseId);
    }
    this.loadingOfficerDetail.set(true);
    this.officerDetailError.set(null);
    this.notice9FetchError.set(null);
    this.notice9FetchedUrl.set(null);
    this.notice9FetchedPreviewKind.set('none');
    this.landDetailError.set(null);
    this.landDetailTitle.set('');
    this.landDetailPayload.set(null);

    const knownCaseIdEarly =
      opts?.caseId ??
      caseEntry?.caseId ??
      pendingRow?.caseId ??
      opts?.roznamaRow?.caseId ??
      this.selectedCaseId() ??
      null;
    if (knownCaseIdEarly && knownCaseIdEarly > 0) {
      this.generatedCase.set({
        applicationId: resolvedAppId,
        applicationNo: '',
        caseId: knownCaseIdEarly,
        caseNo:
          pendingRow?.caseNo ??
          opts?.roznamaRow?.caseNo ??
          caseEntry?.caseNo ??
          this.caseInboxItemForSelection()?.caseNo ??
          '',
        message: 'Case workspace.'
      });
    } else {
      this.generatedCase.set(null);
    }

    if (opts?.roznamaRow) {
      const hearingDate =
        opts.roznamaRow.hearingDate?.slice(0, 10) || opts.roznamaRow.causeDate?.slice(0, 10) || '';
      this.selectedRoznamaTableRow.set(opts.roznamaRow);
      this.selectedRoznamaHearing.set({
        hearingId: opts.roznamaRow.hearingId,
        hearingDate,
        filingApplicationId: resolvedAppId
      });
      this.orderSheetHearingIdInput.set(String(opts.roznamaRow.hearingId));
      if (hearingDate) {
        this.syncAssignedHearingDateToRoznama();
      }
    } else if (this.workflowIntent() !== 'roznama') {
      this.selectedRoznamaHearing.set(null);
      this.selectedRoznamaTableRow.set(null);
    }

    this.actionError.set(null);
    this.actionMessage.set(null);
    if (!preserveRoznamaState) {
      this.hearings.set([]);
      this.todayCauseList.set([]);
      this.currentOrderSheet.set(null);
      this.orderSheetHistory.set([]);
    }
    this.roznamaPanelTab.set('roznama');
    this.postRoznamaPath.set(null);
    if (!preserveRoznamaState) {
      this.roznamaReadOnlyContent.set('');
      this.roznamaEntryRows.set([{ date: '', content: '' }]);
    }
    this.notices.set([]);
    this.judgmentWorkflow.set(null);
    if (!opts?.skipNoticeReset) {
      this.noticePartyRows.set([]);
      this.noticePartiesLoading.set(false);
      this.noticePartiesError.set(null);
      this.selectedPartyKeys.set([]);
      this.noticeHearingIdInput.set('');
    } else if (pendingRow?.hearingId) {
      this.noticeHearingIdInput.set(String(pendingRow.hearingId));
    }
    this.officerTab.set('action');
    this.applicationHistory.set(null);
    this.applicationHistoryError.set(null);

    const knownCaseId =
      knownCaseIdEarly && knownCaseIdEarly > 0
        ? knownCaseIdEarly
        : (this.generatedCase()?.caseId ?? null);
    if (this.isPO) {
      this.viewerFlowRole.set('PRESIDING_OFFICER');
    } else {
      this.viewerFlowRole.set('');
    }

    this.loadOfficerDetailForView(resolvedAppId, {
      caseEntry,
      pendingRow,
      knownCaseId: knownCaseId && knownCaseId > 0 ? knownCaseId : null,
      skipNoticeReset: opts?.skipNoticeReset
    });
  }

  /** Open proceedings when only case id is known (missing filingApplicationId on queue row). */
  private openCaseWorkflow(
    caseId: number,
    caseNo: string,
    opts?: {
      skipNoticeReset?: boolean;
      pendingRow?: PendingServeNoticeRow | null;
      roznamaRow?: OfficerRoznamaTableRow;
      intent?: Exclude<WorkflowIntentKey, 'none'>;
    }
  ): void {
    const intent =
      opts?.intent ??
      (opts?.roznamaRow ? 'roznama' : opts?.pendingRow ? 'notice' : this.workflowIntent());
    if (intent !== 'none') {
      this.openWorkflowPanel(intent);
    }
    this.selectedCaseId.set(caseId);
    const knownAppId = this.applicationIdForCaseId(caseId);
    if (knownAppId) {
      this.selectedApplicationId.set(knownAppId);
    }
    if (opts?.roznamaRow) {
      const hearingDate =
        opts.roznamaRow.hearingDate?.slice(0, 10) || opts.roznamaRow.causeDate?.slice(0, 10) || '';
      this.selectedRoznamaTableRow.set(opts.roznamaRow);
      this.selectedRoznamaHearing.set({
        hearingId: opts.roznamaRow.hearingId,
        hearingDate,
        filingApplicationId: knownAppId ?? opts.roznamaRow.filingApplicationId ?? 0
      });
      this.orderSheetHearingIdInput.set(String(opts.roznamaRow.hearingId));
      if (hearingDate) {
        this.syncAssignedHearingDateToRoznama();
      }
    }
    this.loadingOfficerDetail.set(true);
    this.officerDetailError.set(null);
    this.actionError.set(null);
    if (opts?.pendingRow) {
      this.selectedPendingServe.set(opts.pendingRow);
      this.noticeHearingIdInput.set(String(opts.pendingRow.hearingId));
    }
    this.generatedCase.set({
      applicationId: 0,
      applicationNo: '',
      caseId,
      caseNo,
      message: 'Case opened from queue.'
    });
    this.officerTab.set('action');
    if (this.isPO) {
      this.viewerFlowRole.set('PRESIDING_OFFICER');
    }
    this.officerCaseStage.getCaseDetail(caseId).subscribe({
      next: (caseRow) => {
        const rec = this.unwrapDetail(caseRow) as unknown as Record<string, unknown>;
        const appId =
          this.resolveApplicationId(
            rec['filingApplicationId'] ??
              rec['applicationId'] ??
              this.toRecord(rec['filingApplication'])?.['applicationId'],
            { caseId }
          ) ?? this.applicationIdForCaseId(caseId);
        if (!appId) {
          this.officerDetailError.set('Could not resolve application for this case.');
          this.loadingOfficerDetail.set(false);
          return;
        }
        this.selectedApplicationId.set(appId);
        this.generatedCase.set({
          applicationId: appId,
          applicationNo: String(rec['applicationNo'] ?? ''),
          caseId,
          caseNo: String(rec['caseNo'] ?? caseNo),
          message: 'Case opened from queue.'
        });
        const ctx = {
          caseEntry: this.caseMapByAppId().get(appId),
          pendingRow: opts?.pendingRow ?? null,
          knownCaseId: caseId,
          skipNoticeReset: opts?.skipNoticeReset
        };
        const detail = this.mapCaseDetailToApplicationDetail(caseRow, appId, ctx);
        this.applyLoadedOfficerDetail(appId, detail, caseRow, ctx);
        this.enrichOfficerDetailFromFiling(appId, detail);
        if (opts?.pendingRow) {
          this.hydrateNoticeParties(appId, caseId);
        }
        if (opts?.roznamaRow || this.workflowIntent() === 'roznama') {
          this.loadCurrentOrderSheet();
          this.loadRoznamaCaseDocuments();
        }
        const intent = this.workflowIntent();
        if (
          opts?.pendingRow ||
          opts?.roznamaRow ||
          intent === 'notice' ||
          intent === 'roznama' ||
          intent === 'judgment' ||
          intent === 'general' ||
          intent === 'hearing'
        ) {
          this.loadWorkflowContext({
            syncDedicatedIntent: intent === 'general' || intent === 'hearing'
          });
        }
        if (
          opts?.pendingRow ||
          opts?.roznamaRow ||
          intent === 'notice' ||
          intent === 'roznama' ||
          intent === 'judgment' ||
          intent === 'hearing'
        ) {
          this.loadCaseReferenceData();
        }
        this.loadingOfficerDetail.set(false);
      },
      error: (err: unknown) => {
        this.officerDetailError.set(this.formatError(err));
        this.loadingOfficerDetail.set(false);
      }
    });
  }

  private coercePositiveId(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private applicationIdForCaseId(caseId: number): number | null {
    const fromInbox = (this.caseInbox() || []).find((c) => c.caseId === caseId);
    return this.coercePositiveId(fromInbox?.filingApplicationId);
  }

  private resolveApplicationId(
    applicationId: unknown,
    ctx?: { caseId?: number | null; pendingRow?: PendingServeNoticeRow | null }
  ): number | null {
    let id = this.coercePositiveId(applicationId);
    if (id) return id;
    const row = ctx?.pendingRow as unknown as Record<string, unknown> | undefined;
    if (row) {
      id =
        this.coercePositiveId(row['filingApplicationId']) ??
        this.coercePositiveId(row['filing_application_id']) ??
        this.coercePositiveId(row['applicationId']) ??
        this.coercePositiveId(row['application_id']);
      if (id) return id;
    }
    const caseId = this.coercePositiveId(ctx?.caseId);
    if (caseId) {
      return this.applicationIdForCaseId(caseId);
    }
    return null;
  }

  private normalizePendingServeRow(row: PendingServeNoticeRow): PendingServeNoticeRow {
    const filingApplicationId =
      this.resolveApplicationId(row.filingApplicationId, { caseId: row.caseId, pendingRow: row }) ?? 0;
    return { ...row, filingApplicationId };
  }

  /** Load officer detail: case API when a case exists (PO proceedings); filing API otherwise. */
  private loadOfficerDetailForView(
    applicationId: number,
    ctx: {
      caseEntry?: OfficerCaseInboxItem;
      pendingRow?: PendingServeNoticeRow | null;
      knownCaseId: number | null;
      skipNoticeReset?: boolean;
    }
  ): void {
    const finish = () => {
      this.loadingOfficerDetail.set(false);
    };

    const loadFiling = () => {
      this.officerFilings.getApplicationDetail(applicationId).subscribe({
        next: (row) => {
          const detail = this.unwrapDetail(row);
          if (!detail.applicationId) {
            (detail as unknown as Record<string, unknown>)['applicationId'] = applicationId;
          }
          this.applyLoadedOfficerDetail(applicationId, detail, row, ctx);
          finish();
        },
        error: (err: unknown) => {
          if (ctx.knownCaseId && this.isFilingAccessDeniedError(err)) {
            this.officerCaseStage.getCaseDetail(ctx.knownCaseId).subscribe({
              next: (caseRow) => {
                const detail = this.mapCaseDetailToApplicationDetail(caseRow, applicationId, ctx);
                this.applyLoadedOfficerDetail(applicationId, detail, caseRow, ctx);
                finish();
              },
              error: (caseErr: unknown) => {
                this.officerDetailError.set(this.formatError(caseErr));
                finish();
              }
            });
            return;
          }
          this.officerDetailError.set(this.formatError(err));
          finish();
        }
      });
    };

    if (ctx.knownCaseId) {
      this.officerCaseStage.getCaseDetail(ctx.knownCaseId).subscribe({
        next: (caseRow) => {
          const detail = this.mapCaseDetailToApplicationDetail(caseRow, applicationId, ctx);
          this.applyLoadedOfficerDetail(applicationId, detail, caseRow, ctx);
          this.enrichOfficerDetailFromFiling(applicationId, detail);
          finish();
        },
        error: () => loadFiling()
      });
      return;
    }

    loadFiling();
  }

  private applyLoadedOfficerDetail(
    applicationId: number,
    detail: OfficerApplicationDetail,
    row: unknown,
    ctx: {
      caseEntry?: OfficerCaseInboxItem;
      pendingRow?: PendingServeNoticeRow | null;
      knownCaseId: number | null;
    }
  ): void {
    this.officerDetail.set(detail);
    this.officerDetailError.set(null);
    const embeddedHistory =
      detail.applicationHistory ??
      ((row as unknown as Record<string, unknown>)['applicationHistory'] as ApplicationHistoryResponse | undefined);
    this.loadApplicationHistory(applicationId, embeddedHistory);
    const assignee = this.resolveAssigneeRole(detail);
    if (this.isRoznamaWorkflow() && this.isPO) {
      this.viewerFlowRole.set('PRESIDING_OFFICER');
    } else {
      this.viewerFlowRole.set(assignee);
    }

    const detailCaseId = (detail as unknown as Record<string, unknown>)['caseId'];
    const knownCaseId =
      ctx.knownCaseId ??
      ctx.caseEntry?.caseId ??
      ctx.pendingRow?.caseId ??
      (typeof detailCaseId === 'number' && detailCaseId > 0 ? detailCaseId : null);
    const caseNo =
      ctx.caseEntry?.caseNo ??
      ctx.pendingRow?.caseNo ??
      String((detail as unknown as Record<string, unknown>)['caseNo'] || '');

    if (knownCaseId) {
      this.generatedCase.set({
        applicationId,
        applicationNo: String((detail as unknown as Record<string, unknown>)['applicationNo'] || ''),
        caseId: knownCaseId,
        caseNo,
        message: 'Case already generated.'
      });
      if (this.isJudgmentWorkflow()) {
        this.loadJudgmentModule();
      } else if (this.isNoticeWorkflow()) {
        this.loadHearings();
        this.loadNotices();
        this.loadWorkflowContext();
        this.loadCaseReferenceData();
      } else if (this.isRoznamaWorkflow()) {
        this.loadHearings();
        this.loadNotices();
        this.loadCurrentOrderSheet();
        this.loadRoznamaCaseDocuments();
        this.loadWorkflowContext();
        this.loadCaseReferenceData();
      } else if (this.isHearingWorkflow() || this.isGeneralWorkflow()) {
        this.loadProceedingsForGeneralCase(knownCaseId, applicationId);
      } else {
        this.loadHearings();
        this.loadNotices();
      }
    } else if (this.officerMenu() === 'PENDING_NOTICE' && ctx.pendingRow?.caseId) {
      this.generatedCase.set({
        applicationId,
        applicationNo: String((detail as unknown as Record<string, unknown>)['applicationNo'] || ''),
        caseId: ctx.pendingRow.caseId,
        caseNo: ctx.pendingRow.caseNo,
        message: 'Case from notice queue.'
      });
      this.loadHearings();
      this.loadNotices();
    } else if (this.officerMenu() === 'PENDING_NOTICE') {
      this.actionError.set(
        'Case ID not found for this application. Refresh the inbox and open the row again.'
      );
    }
    if (this.isNoticeWorkflow() || this.officerMenu() === 'PENDING_NOTICE' || ctx.pendingRow) {
      this.hydrateNoticeParties(applicationId, knownCaseId);
    }
    if (this.isNoticeWorkflow() || this.isRoznamaWorkflow()) {
      this.loadCaseReferenceData();
    }
  }

  private enrichOfficerDetailFromFiling(applicationId: number, base: OfficerApplicationDetail): void {
    this.officerFilings.getApplicationDetail(applicationId).subscribe({
      next: (row) => {
        const filing = this.unwrapDetail(row);
        if (!filing.applicationId) {
          (filing as unknown as Record<string, unknown>)['applicationId'] = applicationId;
        }
        const merged = this.mergeOfficerApplicationDetails(base, filing);
        this.officerDetail.set(merged);
        if (filing.applicationHistory) {
          this.loadApplicationHistory(applicationId, filing.applicationHistory);
        }
      },
      error: () => {
        // Filing endpoint may reject PO after case approval; case detail is enough for proceedings.
      }
    });
  }

  private mergeOfficerApplicationDetails(
    base: OfficerApplicationDetail,
    filing: OfficerApplicationDetail
  ): OfficerApplicationDetail {
    const b = base as unknown as Record<string, unknown>;
    const f = filing as unknown as Record<string, unknown>;
    const parties = this.extractPartyArraysFromRoots([b, f]);
    return {
      ...filing,
      ...base,
      applicationId: base.applicationId || filing.applicationId,
      caseId: base.caseId ?? filing.caseId,
      caseNo: base.caseNo ?? filing.caseNo,
      form: (f['form'] as Record<string, unknown> | undefined) ?? base.form,
      applicants: parties.applicants.length
        ? parties.applicants
        : (f['applicants'] as unknown[]) ?? base.applicants,
      respondents: parties.respondents.length
        ? parties.respondents
        : (f['respondents'] as unknown[]) ?? base.respondents,
      disputedLands: this.toRecordArray(f['disputedLands']).length
        ? this.toRecordArray(f['disputedLands'])
        : base.disputedLands,
      attachments: this.toRecordArray(f['attachments']).length
        ? this.toRecordArray(f['attachments'])
        : base.attachments,
      applicationHistory: filing.applicationHistory ?? base.applicationHistory,
      documentChecklist: filing.documentChecklist ?? base.documentChecklist
    };
  }

  private mapCaseDetailToApplicationDetail(
    caseRow: unknown,
    applicationId: number,
    ctx: { caseEntry?: OfficerCaseInboxItem; pendingRow?: PendingServeNoticeRow | null }
  ): OfficerApplicationDetail {
    const rec = this.unwrapDetail(caseRow) as unknown as Record<string, unknown>;
    const nested =
      this.toRecord(rec['filingApplication']) ??
      this.toRecord(rec['application']) ??
      this.toRecord(rec['filingApplicationDetail']) ??
      {};
    const parties = this.extractPartyArraysFromRoots([rec, nested]);
    const status = String(rec['status'] ?? ctx.caseEntry?.status ?? 'ACTIVE');
    const proceeding = String(rec['proceedingStage'] ?? ctx.caseEntry?.proceedingStage ?? '');

    return {
      applicationId,
      applicationNo: String(rec['applicationNo'] ?? nested['applicationNo'] ?? ''),
      caseId: Number(rec['caseId'] ?? ctx.caseEntry?.caseId ?? ctx.pendingRow?.caseId ?? 0) || undefined,
      caseNo: String(rec['caseNo'] ?? ctx.caseEntry?.caseNo ?? ctx.pendingRow?.caseNo ?? ''),
      clientApplicationRef: String(nested['clientApplicationRef'] ?? rec['clientApplicationRef'] ?? ''),
      caseCategoryId: Number(rec['caseCategoryId'] ?? nested['caseCategoryId'] ?? ctx.caseEntry?.caseCategoryId ?? 0),
      caseCategoryName: String(rec['caseCategoryName'] ?? nested['caseCategoryName'] ?? ctx.caseEntry?.caseCategoryName ?? ''),
      subjectId: Number(nested['subjectId'] ?? rec['subjectId'] ?? 0),
      subjectName: String(nested['subjectName'] ?? rec['subjectName'] ?? ''),
      officeId: Number(rec['officeId'] ?? nested['officeId'] ?? ctx.caseEntry?.officeId ?? 0),
      officeName: String(rec['officeName'] ?? nested['officeName'] ?? ctx.caseEntry?.officeName ?? ''),
      status,
      applicationDescription: (nested['applicationDescription'] as string | null) ?? null,
      filedByName: String(nested['filedByName'] ?? ''),
      filedByRole: String(nested['filedByRole'] ?? ''),
      createdAt: String(nested['createdAt'] ?? rec['createdAt'] ?? ''),
      updatedAt: String(nested['updatedAt'] ?? rec['updatedAt'] ?? ''),
      submittedAt: String(nested['submittedAt'] ?? ''),
      form: this.toRecord(nested['form']) ?? this.toRecord(rec['form']) ?? undefined,
      applicants: parties.applicants,
      respondents: parties.respondents,
      disputedLands: this.toRecordArray(nested['disputedLands'] ?? rec['disputedLands']),
      attachments: this.toRecordArray(nested['attachments'] ?? rec['attachments']),
      documentChecklist:
        (nested['documentChecklist'] as DocumentChecklist | undefined) ??
        (rec['documentChecklist'] as DocumentChecklist | undefined),
      processingStage: proceeding || String(nested['processingStage'] ?? ''),
      currentAssigneeRole: 'PRESIDING_OFFICER'
    };
  }

  private isFilingAccessDeniedError(err: unknown): boolean {
    if (!(err instanceof HttpErrorResponse)) return false;
    const msg = this.formatError(err).toLowerCase();
    return err.status === 403 || msg.includes('not assigned') || msg.includes('officer role');
  }

  private partyDisplayName(row: Record<string, unknown>, fallback: string): string {
    for (const key of ['name', 'fullName', 'partyName', 'applicantName', 'respondentName', 'displayName']) {
      const v = String(row[key] ?? '').trim();
      if (v) return v;
    }
    const composed = [row['firstName'], row['middleName'], row['lastName']]
      .map((v) => String(v ?? '').trim())
      .filter(Boolean)
      .join(' ');
    return composed || fallback;
  }

  private buildNoticePartyRows(
    applicants: Array<Record<string, unknown>>,
    respondents: Array<Record<string, unknown>>
  ): Array<{ key: string; role: 'Applicant' | 'Respondent'; name: string }> {
    const rows: Array<{ key: string; role: 'Applicant' | 'Respondent'; name: string }> = [];
    applicants.forEach((a, i) => {
      const lineNo = String(a['lineNo'] ?? i + 1);
      rows.push({
        key: `APPLICANT:${lineNo}`,
        role: 'Applicant',
        name: this.partyDisplayName(a, `Applicant ${lineNo}`)
      });
    });
    respondents.forEach((r, i) => {
      const lineNo = String(r['lineNo'] ?? i + 1);
      rows.push({
        key: `RESPONDENT:${lineNo}`,
        role: 'Respondent',
        name: this.partyDisplayName(r, `Respondent ${lineNo}`)
      });
    });
    return rows;
  }

  /** Collect applicants/respondents from one or more API payload roots. */
  private extractPartyArraysFromRoots(
    roots: Array<Record<string, unknown>>
  ): { applicants: Array<Record<string, unknown>>; respondents: Array<Record<string, unknown>> } {
    for (const x of roots) {
      const sources: Array<Record<string, unknown>> = [];
      const push = (value: unknown) => {
        const rec = this.toRecord(value);
        if (rec) sources.push(rec);
      };
      push(x);
      push(x['application']);
      push(x['filingApplication']);
      push(x['filing']);
      push(x['filingApplicationDetail']);
      push(x['data']);
      push(x['form']);

      for (const src of sources) {
        const applicants = this.toRecordArray(src['applicants']);
        const respondents = this.toRecordArray(src['respondents']);
        if (applicants.length || respondents.length) {
          return { applicants, respondents };
        }
      }
    }
    return { applicants: [], respondents: [] };
  }

  private extractPartyArrays(): {
    applicants: Array<Record<string, unknown>>;
    respondents: Array<Record<string, unknown>>;
  } {
    const x = this.officerDetail() as Record<string, unknown> | null;
    if (!x) {
      return { applicants: [], respondents: [] };
    }
    const form = this.detailForm();
    const roots = form ? [x, form] : [x];
    return this.extractPartyArraysFromRoots(roots);
  }

  private applyNoticePartyRows(
    applicantRows: Array<Record<string, unknown>>,
    respondentRows: Array<Record<string, unknown>>
  ): void {
    const rows = this.buildNoticePartyRows(applicantRows, respondentRows);
    const rowKeys = rows.map((r) => r.key);
    const previous = this.selectedPartyKeys();
    this.noticePartyRows.set(rows);
    this.noticePartiesError.set(
      rows.length === 0 ? 'No applicant or respondent names found for this case.' : null
    );
    if (rows.length > 0 && this.officerMenu() === 'PENDING_NOTICE') {
      if (previous.length === 0) {
        this.selectedPartyKeys.set(rowKeys);
      } else {
        const kept = previous.filter((k) => rowKeys.includes(k));
        this.selectedPartyKeys.set(kept.length > 0 ? kept : rowKeys);
      }
      if (this.noticePartyValidationError()) {
        const applicantKeys = rows.filter((r) => r.role === 'Applicant').map((r) => r.key);
        const respondentKeys = rows.filter((r) => r.role === 'Respondent').map((r) => r.key);
        const pick = [
          applicantKeys[0],
          respondentKeys[0],
          ...rowKeys.filter((k) => k !== applicantKeys[0] && k !== respondentKeys[0])
        ].filter(Boolean);
        this.selectedPartyKeys.set([...new Set(pick)]);
      }
    }
  }

  private hydrateNoticeParties(applicationId: number, caseId?: number | null): void {
    this.noticePartiesLoading.set(true);
    this.noticePartiesError.set(null);

    const finish = () => this.noticePartiesLoading.set(false);
    const tryApply = (applicants: Array<Record<string, unknown>>, respondents: Array<Record<string, unknown>>) => {
      if (!applicants.length && !respondents.length) return false;
      this.applyNoticePartyRows(applicants, respondents);
      finish();
      return true;
    };

    const fromDetail = this.extractPartyArrays();
    if (tryApply(fromDetail.applicants, fromDetail.respondents)) return;

    const loadFilingDetail = () => {
      this.officerFilings
        .getApplicationDetail(applicationId)
        .pipe(finalize(() => finish()))
        .subscribe({
          next: (row) => {
            const filing = this.unwrapDetail(row) as unknown as Record<string, unknown>;
            const parties = this.extractPartyArraysFromRoots([filing]);
            if (!parties.applicants.length && !parties.respondents.length) {
              this.noticePartyRows.set([]);
              this.noticePartiesError.set(
                'No party names on this application. Check Application Details tab.'
              );
              return;
            }
            if (!this.officerDetail()) {
              this.officerDetail.set(row);
            }
            this.applyNoticePartyRows(parties.applicants, parties.respondents);
          },
          error: () => {
            this.noticePartyRows.set([]);
            this.noticePartiesError.set('Could not load party names. Click Reload parties.');
          }
        });
    };

    const resolvedCaseId =
      caseId ?? this.selectedPendingServe()?.caseId ?? this.caseIdForActions() ?? null;
    if (!resolvedCaseId) {
      loadFilingDetail();
      return;
    }

    this.officerCaseStage.getCaseDetail(resolvedCaseId).subscribe({
      next: (caseRow) => {
        const caseRec = this.unwrapDetail(caseRow) as unknown as Record<string, unknown>;
        const parties = this.extractPartyArraysFromRoots([caseRec]);
        if (tryApply(parties.applicants, parties.respondents)) return;
        loadFilingDetail();
      },
      error: () => loadFilingDetail()
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

  /** Logged-in officer designation for authorization (detail assignee or login). */
  protected officerRole(): 'CLERK' | 'PRESIDING_OFFICER' | '' {
    const r = this.viewerFlowRole();
    if (r === 'CLERK' || r === 'PRESIDING_OFFICER') return r;
    return this.loginRole;
  }

  /** Logged-in PO may act on roznamah / hearings / judgment in this module. */
  protected canActAsPresidingOfficer(): boolean {
    if (this.isPO || this.officerRole() === 'PRESIDING_OFFICER') return true;
    // Officer login without clerk designation — treat as PO for proceedings desks.
    return this.isOfficer && !this.isClerk;
  }

  /** Opened from Roznama (cause list) → Open. */
  protected isRoznamaWorkflow(): boolean {
    return this.workflowPanelOpen() && this.workflowIntent() === 'roznama';
  }

  /** Assign hearing / ACTIVE case before first hearing date. */
  protected isHearingWorkflow(): boolean {
    return this.workflowPanelOpen() && this.workflowIntent() === 'hearing';
  }

  /** Judgment queue — separate from roznamma screen. */
  protected isJudgmentWorkflow(): boolean {
    return this.workflowPanelOpen() && this.workflowIntent() === 'judgment';
  }

  /** Dedicated notice / roznama / judgment / hearing forms — not mixed legacy stack. */
  protected isDedicatedWorkflowForm(): boolean {
    const i = this.workflowIntent();
    return (
      this.workflowPanelOpen() &&
      (i === 'notice' || i === 'roznama' || i === 'judgment' || i === 'hearing')
    );
  }

  private loadProceedingsForGeneralCase(knownCaseId: number, applicationId: number): void {
    this.loadHearings();
    this.loadNotices();
    this.loadWorkflowContext({ syncDedicatedIntent: true });
    if (this.officerMenu() === 'PENDING_NOTICE' || this.selectedPendingServe()) {
      this.hydrateNoticeParties(applicationId, knownCaseId);
    }
  }

  /** Notice workflow until at least one notice is served (then proceedings may start). */
  private isNoticeProceedingStage(): boolean {
    if (!this.isHearingScheduledCase()) return false;
    return !this.isNoticeServed();
  }

  /** True when this officer has at least one action on the Action tab. */
  protected hasAuthorizedActionOnTab(): boolean {
    if (this.loadingOfficerDetail()) return true;
    if (this.isGeneralWorkflow() && this.workflowContextLoading()) return true;
    if (this.isDedicatedWorkflowForm()) {
      if (this.isJudgmentWorkflow()) return this.hasAnyJudgmentAction() || this.judgmentLoading();
      if (this.isHearingWorkflow()) return this.showHearingSection();
      return true;
    }
    return (
      this.canForwardToPo() ||
      this.canPoReviewActions() ||
      this.showHearingSection() ||
      this.showNoticeSection() ||
      this.showNoticeInlinePanel() ||
      this.showOrderSheetSection() ||
      this.showPostRoznamaDecisionPanel() ||
      this.showJudgmentSection()
    );
  }

  /** Label shown on the Action tab — only this officer's next step. */
  protected actionTabLabel(): string {
    if (this.isDedicatedWorkflowForm()) {
      return 'Action';
    }
    if (!this.caseIdForActions()) {
      if (this.canForwardToPo()) return 'Scrutiny & Forward';
      if (this.canPoReviewActions()) return 'Approval Decision';
      return 'Action';
    }
    const s = this.currentCaseStatus();
    const role = this.officerRole();
    if (!this.isHearingScheduledCase() && !!this.caseIdForActions() && role === 'PRESIDING_OFFICER') {
      return 'Assign Hearing Date';
    }
    if (this.isHearingScheduledCase()) {
      if (role === 'CLERK') {
        if (this.isNoticeProceedingStage()) return 'Notice — With PO';
        if (this.judgmentEditable() && this.judgmentActorRole() === 'CLERK') return 'Edit Judgment';
        if (judgmentWorkflowStatus(this.judgmentWorkflow()) === 'PO_SCRUTINY') return 'Judgment with PO';
        return 'No clerk action';
      }
      if (role === 'PRESIDING_OFFICER') {
        if (this.showNoticeSection()) {
          return 'Send notice to party';
        }
        if (this.showOrderSheetSection()) {
          if (this.showPostRoznamaDecisionPanel()) return 'Next: Rehearing or Judgment';
          if (this.postRoznamaPath() === 'rehearing') return 'Schedule Rehearing';
          return 'Order Sheet (Roznama)';
        }
        const jStatus = judgmentWorkflowStatus(this.judgmentWorkflow());
        if (!jStatus && this.isCurrentHearingRoznamaSigned()) return 'Start Judgment';
        if (this.judgmentEditable() && this.judgmentActorRole() === 'PRESIDING_OFFICER') return 'Draft Judgment';
        if (jStatus === 'PO_SCRUTINY') return 'Finalize Judgment';
        if (jStatus === 'PO_FINALIZED') return 'Publish Judgment';
        if (jStatus === 'CLERK_DRAFT') return 'Judgment with Clerk';
      }
      return 'Action';
    }
    if (s === 'DISPOSED') return 'Disposed';
    return 'Action';
  }

  /** @deprecated Clerk does not handle notices — PO only. */
  protected canClerkActOnNotice(): boolean {
    return false;
  }

  /** Presiding Officer handles the full notice workflow (draft → finalize → sign → serve). */
  protected canPoActOnNotice(): boolean {
    return this.showNoticeSection();
  }

  protected canPoDraftNotice(): boolean {
    if (!this.canPoActOnNotice()) return false;
    return this.notices().length === 0;
  }

  protected canPoAdvanceNoticeDraft(): boolean {
    if (!this.canPoActOnNotice()) return false;
    return this.notices().some((n) => this.upStage(n.status) === 'CLERK_DRAFT');
  }

  protected canPoFinalizeNotice(): boolean {
    if (!this.canPoActOnNotice()) return false;
    return this.notices().some((n) => this.upStage(n.status) === 'PO_SCRUTINY');
  }

  protected canPoSignNotice(): boolean {
    if (!this.canPoActOnNotice()) return false;
    return this.notices().some((n) => this.upStage(n.status) === 'PO_FINALIZED');
  }

  protected canPoServeNotice(): boolean {
    if (!this.canPoActOnNotice()) return false;
    return this.notices().some((n) => this.upStage(n.status) === 'PO_SIGNED');
  }

  protected caseIdForActions(): number | null {
    const generated = this.generatedCase();
    if (generated?.caseId) return generated.caseId;
    const selectedCase = this.selectedCaseId();
    if (selectedCase && selectedCase > 0) return selectedCase;
    const appId = this.selectedApplicationId();
    const pending = this.selectedPendingServe();
    if (appId && pending?.filingApplicationId === appId && pending.caseId > 0) {
      return pending.caseId;
    }
    const inboxCaseId = appId ? this.caseMapByAppId().get(appId)?.caseId : undefined;
    if (inboxCaseId && inboxCaseId > 0) return inboxCaseId;
    const detail = this.officerDetail() as unknown as Record<string, unknown> | null;
    const caseId = detail?.['caseId'];
    return typeof caseId === 'number' && caseId > 0 ? caseId : null;
  }

  /** Hearing targeted by the pending-serve queue row or notice form. */
  protected hearingIdForNoticeAction(): number | null {
    const hid =
      this.selectedPendingServe()?.hearingId ?? Number(this.noticeHearingIdInput().trim());
    return hid > 0 ? hid : null;
  }

  /** Null when applicant + respondent selection rules are satisfied. */
  protected noticePartyValidationError(): string | null {
    const rows = this.noticePartyRows();
    if (!rows.length) return null;
    const applicants = rows.filter((p) => p.role === 'Applicant');
    const respondents = rows.filter((p) => p.role === 'Respondent');
    if (!applicants.length || !respondents.length) {
      return 'This case must have at least one applicant and one respondent on file.';
    }
    const selectedApplicants = applicants.filter((p) => this.isPartySelected(p.key)).length;
    const selectedRespondents = respondents.filter((p) => this.isPartySelected(p.key)).length;
    if (selectedApplicants < 1 && selectedRespondents < 1) {
      return 'Select at least one applicant and one respondent.';
    }
    if (selectedApplicants < 1) return 'Select at least one applicant.';
    if (selectedRespondents < 1) return 'Select at least one respondent.';
    return null;
  }

  protected canServeNoticeToParties(): boolean {
    if (this.noticeSubmitting()) return false;
    if (!this.isPO) return false;
    if (!this.caseIdForActions()) return false;
    if (!this.hearingIdForNoticeAction()) return false;
    if (this.noticePartyValidationError() != null || this.selectedPartyKeys().length === 0) {
      return false;
    }
    const ctx = this.workflowContext();
    const noticeActions = ctx?.notice?.allowedActions ?? [];
    const topActions = ctx?.allowedActions ?? [];
    const sources = [...noticeActions, ...topActions];
    if (sources.length) {
      return sources.some((a) => this.upStage(a) === 'SERVE_NOTICE_TO_PARTY');
    }
    return true;
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

  protected canForwardToPoRole(): boolean {
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

  protected canForwardToPo(): boolean {
    return this.canForwardToPoRole() && this.canForwardDocumentsOk();
  }

  protected canForwardDocumentsOk(): boolean {
    const dc = this.officerDetail()?.documentChecklist;
    if (!dc?.documentsConfigured) return true;
    return dc.allRequiredUploaded === true && dc.allRequiredClerkVerified === true;
  }

  protected onDocumentChecklistLoaded(checklist: DocumentChecklist | null): void {
    if (!checklist) return;
    const current = this.officerDetail();
    if (!current) return;
    this.officerDetail.set({ ...current, documentChecklist: checklist });
  }

  protected readonly officerFilingSubjectId = computed(() => {
    const d = this.officerDetail();
    const fromForm = Number(d?.form?.['subjectId'] ?? 0);
    return Number(d?.subjectId || fromForm || 0);
  });

  protected canPoReviewActions(): boolean {
    return !this.caseIdForActions() && this.isAssignedToPo() && this.viewerFlowRole() === 'PRESIDING_OFFICER';
  }

  /** Clerk remarks from the latest forward-to-PO action in application history. */
  protected clerkForwardRemarks(): string | null {
    const entries = this.applicationHistory()?.entries ?? [];
    if (!entries.length) return null;
    const forwards = entries.filter((e) => {
      const action = (e.action || '').toUpperCase();
      return action === 'FORWARDED_TO_PO' || (action.includes('FORWARD') && action.includes('PO'));
    });
    if (!forwards.length) return null;
    const latest = forwards.reduce((a, b) => (a.sequence >= b.sequence ? a : b));
    const text = latest.remarks?.trim();
    return text || null;
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

  /** Case status from caseInbox, with fallback when hearings exist but inbox not refreshed yet. */
  protected currentCaseStatus(): string {
    const inboxCase = this.caseInboxItemForSelection();
    if (inboxCase?.status) {
      const fromInbox = String(inboxCase.status).toUpperCase();
      if (fromInbox === 'DISPOSED') return 'DISPOSED';
      if (this.isCaseProceedingsStatus(fromInbox)) return fromInbox;
    }
    const selectedId = this.selectedApplicationId();
    if (!selectedId) return '';
    const fromMap = String(this.caseMapByAppId().get(selectedId)?.status || '').toUpperCase();
    if (fromMap === 'DISPOSED') return 'DISPOSED';
    if (this.isCaseProceedingsStatus(fromMap)) return fromMap;
    if (this.isHearingScheduledByHearings()) return 'HEARING_SCHEDULED';
    return fromMap;
  }

  /** First hearing date — PO only, before case is HEARING_SCHEDULED. */
  protected showHearingSection(): boolean {
    return this.canScheduleHearing();
  }

  /** Send notice in detail panel only when inline panel is not used. */
  protected showNoticeSection(): boolean {
    if (this.showNoticeInlinePanel()) return false;
    if (this.officerMenu() !== 'PENDING_NOTICE' || !this.isPO || this.isDisposedCase()) {
      return false;
    }
    return this.selectedApplicationId() != null;
  }

  /** Roznamah / order sheet — Presiding Officer only, after notice served. */
  protected showOrderSheetSection(): boolean {
    if (this.isJudgmentWorkflow() || this.isRoznamaWorkflow()) return false;
    if (this.isDisposedCase()) return false;
    if (!this.canActAsPresidingOfficer()) return false;
    if (!this.caseIdForActions()) return false;
    if (!this.isHearingScheduledCase() && this.currentProceedingStage() !== 'NOTICE_SERVED') {
      return false;
    }
    if (!this.canStartProceedings()) return false;
    const stage = this.currentProceedingStage();
    if (!stage) return true;
    return this.isOrderSheetProceedingStage(stage);
  }

  /** Judgment panel is active (dedicated workflow or legacy mixed view). */
  protected showJudgmentSection(): boolean {
    if (this.isRoznamaWorkflow()) return false;
    if (!this.caseIdForActions()) return false;
    if (this.isJudgmentWorkflow() || this.officerMenu() === 'PENDING_JUDGMENT') {
      return true;
    }
    if (this.officerMenu() !== 'PENDING_JUDGMENT' && this.postRoznamaPath() !== 'judgment') {
      return false;
    }
    if (this.isDisposedCase()) {
      return !!judgmentWorkflowStatus(this.judgmentWorkflow());
    }
    if (!this.isHearingScheduledCase()) return false;
    const role = this.officerRole();
    if (role === 'PRESIDING_OFFICER') {
      return (
        this.canPoDraftJudgment() ||
        this.canFinalizeJudgment() ||
        this.canRevertJudgment() ||
        this.canPublishJudgment() ||
        judgmentWorkflowStatus(this.judgmentWorkflow()) === 'CLERK_DRAFT' ||
        (this.postRoznamaPath() === 'judgment' && this.isCurrentHearingRoznamaSigned())
      );
    }
    if (role === 'CLERK') {
      const jSt = judgmentWorkflowStatus(this.judgmentWorkflow());
      return (
        this.canClerkEditJudgment() ||
        this.canClerkSubmitJudgmentToPo() ||
        jSt === 'CLERK_DRAFT' ||
        jSt === 'PO_SCRUTINY' ||
        this.effectiveJudgmentWorkflowStatus() === 'CLERK_DRAFT'
      );
    }
    return false;
  }

  /** Can schedule hearing: ACTIVE only, Presiding Officer only, no hearing yet. */
  protected canScheduleHearing(): boolean {
    return (
      this.viewerFlowRole() === 'PRESIDING_OFFICER' &&
      !this.isHearingScheduledCase() &&
      !this.isDisposedCase() &&
      !!this.caseIdForActions()
    );
  }

  /** PO edits roznamah when workflow allows COMPLETE_ROZNAMA or table row canEdit. */
  protected canPoEditRoznama(): boolean {
    if (!this.canActAsPresidingOfficer() || this.isDisposedCase()) return false;
    if (!this.caseIdForActions()) return false;
    if (this.isRoznamaReadOnly()) return false;
    const tableRow = this.selectedRoznamaTableRow();
    if (tableRow?.proceedingAllowed === false || tableRow?.noticeServed === false) {
      return false;
    }
    const ctx = this.workflowContext();
    if (ctx?.allowedActions?.length) {
      return this.hasAllowedAction('COMPLETE_ROZNAMA');
    }
    if (ctx?.proceedingAllowed === false) return false;
    if (this.isRoznamaWorkflow()) {
      return tableRow?.canEdit !== false || !this.upStage(tableRow?.roznamaStatus);
    }
    if (!this.showOrderSheetSection()) return false;
    const os = this.currentOrderSheet();
    if (!os) return true;
    const st = this.upStage(os.status);
    if (st === 'PO_SIGNED') return false;
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
    if (st === 'PO_FINALIZED') {
      return 'Review saved text, make any last changes, save, then sign.';
    }
    if (st === 'PO_SCRUTINY' || st === 'CLERK_DRAFT') {
      return 'Presiding Officer only: save proceedings, finalize, then sign the roznamah register.';
    }
    return 'Presiding Officer only: create and manage the case roznamah register for this case.';
  }

  /** Roznamah is managed by Presiding Officer only (no clerk edit). */
  protected canClerkEditRoznama(): boolean {
    return false;
  }

  protected canClerkSubmitOrderSheetToPo(): boolean {
    return false;
  }

  /** PO finalize roznamah (no clerk step). */
  protected canFinalizeOrderSheet(): boolean {
    if (this.viewerFlowRole() !== 'PRESIDING_OFFICER' || this.isDisposedCase()) return false;
    const st = this.upStage(this.currentOrderSheet()?.status);
    return st === 'PO_SCRUTINY' || st === 'CLERK_DRAFT';
  }

  /** PO sign roznamah after finalize or from draft. */
  protected canSignOrderSheet(): boolean {
    if (this.viewerFlowRole() !== 'PRESIDING_OFFICER' || this.isDisposedCase()) return false;
    const st = this.upStage(this.currentOrderSheet()?.status);
    return st === 'PO_FINALIZED' || st === 'PO_SCRUTINY' || st === 'CLERK_DRAFT';
  }

  protected canPoDraftOrderSheet(): boolean {
    return this.canPoSaveRoznamaDraft();
  }

  protected canClerkEditOrderSheet(): boolean {
    return this.canClerkEditRoznama();
  }

  /** @deprecated Use canPoDraftNotice — notices are PO-only. */
  protected canDraftNotice(): boolean {
    return this.canPoDraftNotice();
  }

  private judgmentPanelActive(): boolean {
    return this.isJudgmentWorkflow() || this.showJudgmentSection();
  }

  /** Judgment text area always visible on judgment screen (disabled when read-only). */
  protected showJudgmentEditor(): boolean {
    if (!this.judgmentPanelActive()) {
      return false;
    }
    if (this.judgmentLoading() || this.workflowContextLoading()) {
      return true;
    }
    if (this.isJudgmentDisposed()) {
      return this.hasJudgmentContent() || !!this.judgmentWorkflow();
    }
    return true;
  }

  protected showJudgmentReadOnly(): boolean {
    if (this.judgmentEditable() || !this.judgmentPanelActive()) {
      return false;
    }
    const st = this.effectiveJudgmentWorkflowStatus();
    if (this.isJudgmentDisposed() || st === 'PUBLISHED') {
      return true;
    }
    if (st === 'PO_FINALIZED') {
      return true;
    }
    if (st === 'CLERK_DRAFT' && this.judgmentActorRole() === 'PRESIDING_OFFICER') {
      return true;
    }
    return this.hasJudgmentContent();
  }

  protected showJudgmentSaveDraftButton(): boolean {
    if (!this.judgmentEditable() || this.isJudgmentDisposed()) {
      return false;
    }
    if (!this.usesJudgmentAllowedActions()) {
      return true;
    }
    if (this.judgmentActorRole() === 'CLERK' && this.effectiveJudgmentWorkflowStatus() === 'CLERK_DRAFT') {
      return (
        this.hasJudgmentAllowedAction('CLERK_UPDATE_JUDGMENT') || this.hasClerkJudgmentEditAction()
      );
    }
    return (
      this.hasJudgmentAllowedAction('UPDATE_PO_JUDGMENT') ||
      this.hasJudgmentAllowedAction('CLERK_UPDATE_JUDGMENT') ||
      this.hasJudgmentAllowedAction('PO_DRAFT_JUDGMENT') ||
      this.hasJudgmentAllowedAction('DRAFT_JUDGMENT')
    );
  }

  protected showJudgmentSendToClerkButton(): boolean {
    if (this.judgmentActorRole() !== 'PRESIDING_OFFICER' || this.isJudgmentDisposed()) {
      return false;
    }
    if (!this.judgmentPanelActive()) {
      return false;
    }
    return this.hasJudgmentAllowedAction('SEND_JUDGMENT_TO_CLERK');
  }

  protected showJudgmentSubmitToPoButton(): boolean {
    if (this.judgmentActorRole() !== 'CLERK' || this.isJudgmentDisposed()) {
      return false;
    }
    if (!this.judgmentSubmittable()) {
      return false;
    }
    if (!this.usesJudgmentAllowedActions()) {
      return this.effectiveJudgmentWorkflowStatus() === 'CLERK_DRAFT';
    }
    return this.hasJudgmentAllowedAction('SUBMIT_JUDGMENT_TO_PO');
  }

  protected showJudgmentFinalizeButton(): boolean {
    if (this.judgmentActorRole() !== 'PRESIDING_OFFICER' || this.isJudgmentDisposed()) {
      return false;
    }
    return this.hasJudgmentAllowedAction('FINALIZE_JUDGMENT');
  }

  protected showJudgmentRevertButton(): boolean {
    if (this.judgmentActorRole() !== 'PRESIDING_OFFICER' || this.isJudgmentDisposed()) {
      return false;
    }
    return (
      this.hasJudgmentAllowedAction('REVERT_JUDGMENT_TO_CLERK') ||
      this.hasJudgmentAllowedAction('REVERT_TO_CLERK')
    );
  }

  protected showJudgmentPublishButton(): boolean {
    if (this.judgmentActorRole() !== 'PRESIDING_OFFICER' || this.isJudgmentDisposed()) {
      return false;
    }
    return this.hasJudgmentAllowedAction('PUBLISH_JUDGMENT');
  }

  protected showJudgmentSignPublishButton(): boolean {
    if (this.judgmentActorRole() !== 'PRESIDING_OFFICER' || this.isJudgmentDisposed()) {
      return false;
    }
    return this.hasJudgmentAllowedAction('SIGN_AND_PUBLISH_JUDGMENT');
  }

  protected hasAnyJudgmentAction(): boolean {
    return (
      this.showJudgmentEditor() ||
      this.showJudgmentSaveDraftButton() ||
      this.showJudgmentSendToClerkButton() ||
      this.showJudgmentSubmitToPoButton() ||
      this.showJudgmentFinalizeButton() ||
      this.showJudgmentRevertButton() ||
      this.showJudgmentPublishButton() ||
      this.showJudgmentSignPublishButton()
    );
  }

  /** @deprecated use judgmentEditable */
  protected canSaveJudgmentDraft(): boolean {
    return this.judgmentEditable();
  }

  protected canDraftJudgment(): boolean {
    return this.showJudgmentSaveDraftButton();
  }

  protected canSendJudgmentToClerk(): boolean {
    return this.showJudgmentSendToClerkButton();
  }

  protected canClerkSubmitJudgmentToPo(): boolean {
    return this.showJudgmentSubmitToPoButton();
  }

  protected canFinalizeJudgment(): boolean {
    return this.showJudgmentFinalizeButton();
  }

  protected canPublishJudgment(): boolean {
    return this.showJudgmentPublishButton();
  }

  protected canSignAndPublishJudgment(): boolean {
    return this.showJudgmentSignPublishButton();
  }

  protected canRevertJudgment(): boolean {
    return this.showJudgmentRevertButton();
  }

  protected canPoDraftJudgment(): boolean {
    return this.judgmentEditable() && this.judgmentActorRole() === 'PRESIDING_OFFICER';
  }

  protected canClerkEditJudgment(): boolean {
    return this.judgmentEditable() && this.judgmentActorRole() === 'CLERK';
  }

  /** @deprecated kept for template backward compat */
  protected canWriteOrderSheet(): boolean {
    return this.canPoEditRoznama();
  }
  protected canPassFinalJudgment(): boolean {
    return this.canClerkEditJudgment();
  }

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
    if (!this.canForwardDocumentsOk()) {
      this.actionError.set(
        'All required documents must be uploaded and clerk-verified before forwarding to PO.'
      );
      return;
    }
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
    if (this.viewerFlowRole() !== 'PRESIDING_OFFICER') {
      this.actionError.set('Only Presiding Officer can schedule a hearing.');
      return;
    }
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
    if (this.viewerFlowRole() !== 'PRESIDING_OFFICER') {
      this.actionError.set('Only Presiding Officer can schedule a hearing.');
      return;
    }
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
    const scheduleDateErr = this.hearingDateAfterTodayError(hearingDate);
    if (scheduleDateErr) {
      this.actionError.set(scheduleDateErr);
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
          const appId = this.selectedApplicationId();
          const hd = resp.hearingDate?.slice(0, 10) || hearingDate;
          if (appId) {
            this.patchCaseInboxForApplication(appId, {
              status: 'HEARING_SCHEDULED',
              proceedingStage: 'NOTICE_PENDING'
            });
          }
          this.noticeHearingIdInput.set(String(resp.hearingId));
          this.actionMessage.set(
            `Hearing #${resp.hearingNo} scheduled for ${hd}. Open Send notice to party to serve notice when ready.`
          );
          this.hearingRemarksInput.set('');
          this.loadHearings();
          this.loadNotices();
          this.loadTodayCauseList();
          this.loadCaseInbox();
          this.loadPendingServeQueue();
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
    if (!content || !this.primaryRoznamaPlainText()) {
      this.actionError.set('Roznama proceedings text is required.');
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

    this.loadNotices();
    this.loadRoznamaCaseDocuments();

    const query = ref?.hearingId ? { hearingId: ref.hearingId, hearingDate: ref.hearingDate } : undefined;
    this.officerCaseStage.getRoznama(caseId, query).subscribe({
      next: (resp) => {
        const sheet = resp as CaseOrderSheetResponse;
        this.currentOrderSheet.set(sheet);
        this.applyAttendanceFromRoznama(resp);
        this.applyRoznamaFromResponse(resp, defaultDate);
        if (this.isRoznamaWorkflow()) {
          this.syncAssignedHearingDateToRoznama();
        }
        this.roznamaReadOnlyContent.set(this.isRoznamaReadOnly() ? this.roznamaContentForApi() : '');
        const ref = this.latestHearingRef();
        if (ref) {
          this.ensureHearingRowInRegister(ref.hearingDate);
        }
        this.loadOrderSheetHistory();
        this.loadWorkflowContext();
      },
      error: (err: unknown) => {
        this.clearAttendanceState();
        this.currentOrderSheet.set(null);
        this.roznamaEntryRows.set([{ date: defaultDate, content: '' }]);
        this.roznamaReadOnlyContent.set('');
        const msg = this.formatError(err);
        if (/notice.*served|proceeding cannot start/i.test(msg)) {
          this.actionError.set(msg);
        } else if (ref) {
          this.actionMessage.set('No roznamah yet for this case. Use Sign & save to create the register.');
        }
      }
    });
  }

  private clearAttendanceState(): void {
    this.attendanceRequired.set(false);
    this.attendanceComplete.set(false);
    this.attendanceEntries.set([]);
    this.attendanceTouchedKeys.set(new Set());
    this.attendanceValidationError.set(null);
    this.attendancePanelHighlight.set(false);
  }

  private applyAttendanceFromRoznama(resp: RoznamaResponse): void {
    this.attendanceRequired.set(!!resp.attendanceRequired);
    this.attendanceComplete.set(!!resp.attendanceComplete);
    const entries = (resp.attendance ?? []).map((e) => ({ ...e }));
    this.attendanceEntries.set(entries);
    const touched = new Set<string>();
    for (const e of entries) {
      if (e.present !== null) {
        touched.add(this.attendancePartyKey(e));
      }
    }
    this.attendanceTouchedKeys.set(touched);
    this.attendanceValidationError.set(null);
    this.attendancePanelHighlight.set(false);
  }

  private applyAttendanceResponse(resp: {
    attendanceRequired: boolean;
    attendanceComplete: boolean;
    entries: RoznamaAttendanceEntry[];
  }): void {
    this.attendanceRequired.set(!!resp.attendanceRequired);
    this.attendanceComplete.set(!!resp.attendanceComplete);
    const entries = (resp.entries ?? []).map((e) => ({ ...e }));
    this.attendanceEntries.set(entries);
    const touched = new Set<string>();
    for (const e of entries) {
      if (e.present !== null) {
        touched.add(this.attendancePartyKey(e));
      }
    }
    this.attendanceTouchedKeys.set(touched);
    this.attendanceValidationError.set(null);
    this.attendancePanelHighlight.set(false);
  }

  private validateAttendanceBeforeSave(): string | null {
    const mandatory = this.attendanceEntries().filter((e) => e.mandatory);
    if (!mandatory.length) {
      return 'No parties listed for attendance.';
    }
    for (const entry of mandatory) {
      if (entry.partyRefId == null && entry.partyType !== 'OTHER') {
        return `Invalid party reference for ${entry.partyName}. Reload the screen.`;
      }
      const key = this.attendancePartyKey(entry);
      if (entry.present === null && !this.attendanceTouchedKeys().has(key)) {
        return 'Mark attendance for all parties.';
      }
      if (entry.present === null) {
        return 'Mark attendance for all parties.';
      }
    }
    return null;
  }

  private buildAttendanceSaveEntries(): RoznamaAttendanceSaveEntry[] {
    return this.attendanceEntries()
      .filter((e) => e.mandatory && e.partyRefId != null)
      .map((e) => ({
        partyType: e.partyType,
        partyRefId: e.partyRefId as number,
        present: e.present === true
      }));
  }

  private setActionErrorFromHttp(err: unknown): void {
    const msg = this.formatError(err);
    this.actionError.set(msg);
    if (/attendance|applicants and respondents|present is required/i.test(msg)) {
      this.attendancePanelHighlight.set(true);
      this.attendanceValidationError.set(msg);
    }
  }

  protected loadOrderSheetHistory(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.officerCaseStage.getRoznamaHistory(caseId).subscribe({
      next: (rows) => {
        this.orderSheetHistory.set(rows || []);
        this.roznamaEntryRows.update((current) =>
          this.mergeRoznamaRowContent(current, this.currentOrderSheet())
        );
        this.orderSheetContentInput.set(this.roznamaContentForApi());
      },
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
    this.signAndSaveRoznama();
  }

  /** PO: sign and save roznamah via POST /roznama. */
  protected signAndSaveRoznama(): void {
    const caseId = this.caseIdForActions();
    const hearingRef = this.latestHearingRef();
    if (!caseId) {
      this.actionError.set('Case not loaded.');
      return;
    }
    const content = this.roznamaContentForApi().trim();
    if (!content || !this.primaryRoznamaPlainText()) {
      this.actionError.set('Roznama proceedings text is required before sign & save.');
      return;
    }
    const digitalSignatureRef =
      this.orderSheetSignRef().trim() ||
      `PO-DSC-${caseId}-${Date.now()}`;
    const payload = {
      hearingId: hearingRef?.hearingId,
      hearingDate: this.primaryRoznamaDate() || hearingRef?.hearingDate,
      content,
      remarks: this.orderSheetRemarksInput().trim() || undefined,
      digitalSignatureRef
    };
    this.orderSheetSigning.set(true);
    this.actionError.set(null);
    this.officerCaseStage
      .signAndSaveRoznama(caseId, payload)
      .pipe(finalize(() => this.orderSheetSigning.set(false)))
      .subscribe({
        next: (resp) => {
          this.currentOrderSheet.set(resp as CaseOrderSheetResponse);
          this.postRoznamaPath.set(null);
          this.actionMessage.set(
            'Roznama signed and saved. Choose rehearing or final judgment below.'
          );
          this.loadJudgmentWorkflow();
          this.loadCaseInbox();
          this.loadRoznamaTable();
          this.loadHearings();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected canSignAndSaveRoznama(): boolean {
    return (
      this.canPoEditRoznama() &&
      !!this.caseIdForActions() &&
      !!this.primaryRoznamaPlainText() &&
      !this.orderSheetSigning()
    );
  }

  /** Load all reference data for notice / roznamma drafting side panel. */
  protected loadCaseReferenceData(): void {
    this.loadHearings();
    this.loadNotices();
    this.loadOrderSheetHistory();
    this.loadRoznamaCaseDocuments();
  }

  protected loadRoznamaCaseDocuments(): void {
    const appId = this.selectedApplicationId();
    if (!appId) return;
    this.roznamaPreviewLoading.set(true);
    this.filingApplications.getApplicationPreviewForRole(appId, true).subscribe({
      next: (data) => {
        this.roznamaPreviewBundle.set(data);
        this.roznamaPreviewLoading.set(false);
      },
      error: () => {
        this.roznamaPreviewBundle.set(null);
        this.roznamaPreviewLoading.set(false);
      }
    });
  }

  protected setRoznamaDocTab(
    tab:
      | 'summary'
      | 'parties'
      | 'notices'
      | 'hearings'
      | 'land'
      | 'roznama'
      | 'attachments'
      | 'documents'
      | 'history'
  ): void {
    this.caseReferenceCollapsed.set(false);
    this.roznamaDocTab.set(tab);
  }

  protected toggleCaseReferencePanel(): void {
    this.caseReferenceCollapsed.update((v) => !v);
  }

  protected openCaseReferenceTab(
    tab:
      | 'summary'
      | 'parties'
      | 'notices'
      | 'hearings'
      | 'land'
      | 'roznama'
      | 'attachments'
      | 'documents'
      | 'history'
  ): void {
    this.setRoznamaDocTab(tab);
  }

  protected referenceHistoryEntries(): Array<{ action: string; at: string; remarks: string }> {
    const entries = this.applicationHistory()?.entries ?? [];
    return [...entries]
      .sort((a, b) => b.sequence - a.sequence)
      .slice(0, 12)
      .map((e) => ({
        action: e.action || '—',
        at: this.toPrettyDate(e.createdAt),
        remarks: (e.remarks || '').trim()
      }));
  }

  protected isCurrentReferenceHearing(hearingId: number): boolean {
    return this.latestHearingRef()?.hearingId === hearingId;
  }

  protected servedNoticesForRoznama(): CaseNoticeItem[] {
    const fromCase = (this.notices() || []).filter((n) => {
      const st = this.upStage(n.status);
      return st === 'SERVED' || st === 'PO_SIGNED' || st === 'PO_FINALIZED';
    });
    if (fromCase.length) return fromCase;
    const preview = this.roznamaPreviewBundle()?.notices ?? [];
    return preview.map((n) => ({
      noticeId: n.noticeId,
      caseId: this.caseIdForActions() ?? 0,
      hearingId: null,
      noticeType: n.noticeType,
      status: n.status,
      draftContent: null,
      previewContent: n.previewContent,
      finalContent: n.finalContent,
      selectedParties: [],
      digitalSignatureRef: null,
      servedAt: n.servedAt ?? null,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt
    }));
  }

  protected openNoticeDocumentPreview(notice: CaseNoticeItem): void {
    const html =
      notice.finalContent?.trim() ||
      notice.previewContent?.trim() ||
      notice.draftContent?.trim() ||
      '';
    if (!html) {
      this.actionError.set('No notice document content available.');
      return;
    }
    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  protected primaryRoznamaDate(): string {
    if (this.isRoznamaWorkflow()) {
      const assigned = this.assignedHearingDate();
      if (assigned) return assigned;
    }
    const row = this.roznamaEntryRows()[this.editableRoznamaRowIndex()];
    return row?.date?.slice(0, 10) || row?.hearingDate?.slice(0, 10) || this.defaultRoznamaRowDate();
  }

  protected editableRoznamaRowIndex(): number {
    const rows = this.roznamaEntryRows();
    const idx = rows.findIndex((r) => r.readOnly === false);
    return idx >= 0 ? idx : 0;
  }

  protected priorRoznamaTableRows(): RoznamaEntryRow[] {
    return this.roznamaEntryRows().filter((r) => r.readOnly === true);
  }

  protected activeRoznamaHearingLabel(): string {
    const row = this.roznamaEntryRows()[this.editableRoznamaRowIndex()];
    if (row?.hearingNo) {
      return `Hearing #${row.hearingNo} · ${(row.date || row.hearingDate || '').slice(0, 10)}`;
    }
    return this.latestHearingLabel();
  }

  protected roznamaRowDisplayText(row: RoznamaEntryRow): string {
    const merged = this.mergeRoznamaRowContent([row], this.currentOrderSheet())[0];
    const plain = stripHtmlToPlainText(unwrapRoznamaCellContent(merged?.content || row.content || ''));
    return plain || '—';
  }

  protected roznamaRowOutcomeLabel(row: RoznamaEntryRow): string {
    if (!row.hearingOutcome) return '—';
    return row.hearingOutcome === 'ADJOURN' ? 'Adjourned' : row.hearingOutcome === 'FINAL' ? 'Final' : row.hearingOutcome;
  }

  protected roznamaRowTrack(row: RoznamaEntryRow, index: number): string {
    return `${row.lineNo ?? index}-${row.hearingId ?? index}-${row.date}`;
  }

  private mergeRoznamaRowContent(
    rows: RoznamaEntryRow[],
    resp?: RoznamaResponse | null
  ): RoznamaEntryRow[] {
    let merged = rows.map((row) => ({
      ...row,
      content: unwrapRoznamaCellContent(row.content || '')
    }));

    const contentRaw = (resp?.content || resp?.finalContent || '').trim();
    if (contentRaw) {
      const parsed = parseRoznamaContent(contentRaw, '');
      merged = merged.map((row, index) => {
        const current = unwrapRoznamaCellContent(row.content || '');
        if (stripHtmlToPlainText(current).trim()) {
          return { ...row, content: current };
        }
        const match =
          parsed.find((p) => row.lineNo != null && p.lineNo === row.lineNo) ??
          parsed.find((p) => row.hearingId != null && p.hearingId === row.hearingId) ??
          parsed[index];
        if (match && stripHtmlToPlainText(match.content || '').trim()) {
          return { ...row, content: unwrapRoznamaCellContent(match.content || '') };
        }
        return row;
      });
    }

    const history = this.orderSheetHistory();
    if (history.length) {
      merged = merged.map((row) => {
        const current = unwrapRoznamaCellContent(row.content || '');
        if (stripHtmlToPlainText(current).trim()) {
          return { ...row, content: current };
        }
        const hist =
          history.find((h) => row.hearingId != null && h.hearingId === row.hearingId) ??
          history.find((h) => {
            const hd = (h.hearingDate || '').slice(0, 10);
            const rd = (row.date || row.hearingDate || '').slice(0, 10);
            return hd && rd && hd === rd;
          });
        if (hist?.content?.trim()) {
          return { ...row, content: unwrapRoznamaCellContent(hist.content) };
        }
        return row;
      });
    }

    return normalizeRoznamaEntryRows(merged);
  }

  private mapRoznamaTableRow(row: RoznamaTableRow): RoznamaEntryRow {
    return normalizeRoznamaEntryRow({
      lineNo: row.lineNo,
      hearingId: row.hearingId,
      hearingNo: row.hearingNo,
      hearingDate: row.hearingDate?.slice(0, 10),
      date: (row.date || row.hearingDate || '').slice(0, 10),
      content: row.content ?? '',
      status: row.status,
      hearingOutcome: row.hearingOutcome,
      readOnly: row.readOnly
    });
  }

  private applyRoznamaFromResponse(resp: RoznamaResponse, defaultDate: string): void {
    let rows: RoznamaEntryRow[];
    if (resp.tableRows?.length) {
      rows = resp.tableRows.map((row) => this.mapRoznamaTableRow(row));
    } else {
      const content = resp.content || resp.draftContent || resp.finalContent || '';
      rows = normalizeRoznamaEntryRows(parseRoznamaContent(content, defaultDate));
    }

    const draftText = unwrapRoznamaCellContent((resp.draftContent || '').trim());
    if (draftText) {
      const editableIdx = rows.findIndex((r) => r.readOnly === false);
      const targetIdx = editableIdx >= 0 ? editableIdx : rows.length - 1;
      if (targetIdx >= 0 && !stripHtmlToPlainText(rows[targetIdx]?.content || '')) {
        rows[targetIdx] = { ...rows[targetIdx], content: draftText };
      }
    }

    if (!rows.length) {
      rows = [{ date: defaultDate, content: '', readOnly: false }];
    }

    rows = this.mergeRoznamaRowContent(rows, resp);

    this.roznamaEntryRows.set(rows);
    this.orderSheetContentInput.set(this.roznamaContentForApi());

    const editable = rows.find((r) => r.readOnly === false);
    const hearingId = resp.hearingId ?? editable?.hearingId;
    const hearingDate = (editable?.date || editable?.hearingDate || defaultDate).slice(0, 10);
    if (hearingId) {
      this.orderSheetHearingIdInput.set(String(hearingId));
      const appId = this.selectedApplicationId() ?? this.selectedRoznamaHearing()?.filingApplicationId ?? 0;
      this.selectedRoznamaHearing.set({
        hearingId,
        hearingDate,
        filingApplicationId: appId
      });
    }
  }

  protected setPrimaryRoznamaDate(value: string): void {
    const idx = this.editableRoznamaRowIndex();
    this.roznamaEntryRows.update((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, date: value, hearingDate: value } : r))
    );
    this.orderSheetContentInput.set(this.roznamaContentForApi());
  }

  protected primaryRoznamaContent(): string {
    return this.roznamaEntryRows()[this.editableRoznamaRowIndex()]?.content ?? '';
  }

  protected primaryRoznamaPlainText(): string {
    return stripHtmlToPlainText(this.primaryRoznamaContent());
  }

  protected setPrimaryRoznamaContent(value: string): void {
    const idx = this.editableRoznamaRowIndex();
    this.roznamaEntryRows.update((rows) =>
      rows.map((r, i) =>
        i === idx ? { ...r, content: value, date: r.date || this.primaryRoznamaDate() } : r
      )
    );
    this.orderSheetContentInput.set(this.roznamaContentForApi());
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

  protected selectAllNoticeParties(): void {
    this.selectedPartyKeys.set(this.noticePartyRows().map((p) => p.key));
  }

  protected deselectAllNoticeParties(): void {
    this.selectedPartyKeys.set([]);
  }

  protected allNoticePartiesSelected(): boolean {
    const rows = this.noticePartyRows();
    if (!rows.length) return false;
    const selected = this.selectedPartyKeys();
    return rows.every((p) => selected.includes(p.key));
  }

  protected toggleSelectAllNoticeParties(): void {
    if (this.allNoticePartiesSelected()) {
      this.deselectAllNoticeParties();
    } else {
      this.selectAllNoticeParties();
    }
  }

  /** Stable DOM id for party checkbox (keys contain colons). */
  protected noticePartyInputId(key: string): string {
    return `notice-party-${key.replace(/[^a-zA-Z0-9]+/g, '-')}`;
  }

  protected onNoticePartyCheckboxChange(key: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const checked = input.checked;
    const row = this.noticePartyRows().find((p) => p.key === key);
    if (!checked && row) {
      if (row.role === 'Applicant') {
        const otherApplicantSelected = this.noticePartyRows().some(
          (p) => p.role === 'Applicant' && p.key !== key && this.isPartySelected(p.key)
        );
        if (!otherApplicantSelected) {
          input.checked = true;
          this.actionError.set('At least one applicant must be selected.');
          return;
        }
      }
      if (row.role === 'Respondent') {
        const otherRespondentSelected = this.noticePartyRows().some(
          (p) => p.role === 'Respondent' && p.key !== key && this.isPartySelected(p.key)
        );
        if (!otherRespondentSelected) {
          input.checked = true;
          this.actionError.set('At least one respondent must be selected.');
          return;
        }
      }
    }
    const cur = this.selectedPartyKeys();
    if (checked) {
      if (!cur.includes(key)) {
        this.selectedPartyKeys.set([...cur, key]);
      }
      if (!this.noticePartyValidationError()) {
        this.actionError.set(null);
      }
    } else {
      this.selectedPartyKeys.set(cur.filter((k) => k !== key));
    }
  }

  protected isPartySelected(key: string): boolean {
    return this.selectedPartyKeys().includes(key);
  }

  protected selectedPartyNamesForNotice(): string[] {
    return this.noticePartyRows()
      .filter((p) => this.isPartySelected(p.key))
      .map((p) => p.name.trim())
      .filter(Boolean);
  }

  protected pendingServeHearingLabel(): string {
    const row = this.selectedPendingServe();
    if (!row) return '';
    return `Hearing #${row.hearingNo} · ${row.hearingDate?.slice(0, 10) || row.queueDate}`;
  }

  protected noticeIdForPendingServe(): number | null {
    const row = this.selectedPendingServe();
    if (row?.noticeId != null && row.noticeId > 0) return row.noticeId;
    const hid = row?.hearingId ?? Number(this.noticeHearingIdInput().trim());
    if (!hid) return null;
    const n = this.notices().find((x) => x.hearingId === hid);
    return n?.noticeId ?? null;
  }

  /** Generate and open the Marathi notice preview in a new window. */
  /** Builds the fixed Marathi notice HTML from current case data. */
  private hearingForNotice(): CaseHearingResponse | null {
    const hid =
      this.selectedPendingServe()?.hearingId ?? Number(this.noticeHearingIdInput().trim());
    if (hid > 0) {
      return this.hearings().find((h) => h.hearingId === hid) ?? null;
    }
    return this.hearings()[0] ?? null;
  }

  private buildNoticeHtml(): string {
    const hearing = this.hearingForNotice();
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
      applicantNames: this.noticePartyRows()
        .filter((p) => p.role === 'Applicant')
        .map((p) => p.name),
      applicantAddresses: this.detailApplicants().map((a) => String(a['address'] || '')),
      respondentNames: this.noticePartyRows()
        .filter((p) => p.role === 'Respondent')
        .map((p) => p.name),
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
    const rows = normalizeRoznamaEntryRows(parseRoznamaContent(content, date));
    this.roznamaEntryRows.set(rows.length > 0 ? rows : [{ date, content: '' }]);
    this.orderSheetContentInput.set(serializeRoznamaContent(this.roznamaEntryRows()));
  }

  protected roznamaContentForApi(): string {
    const merged = this.mergeRoznamaRowContent(
      this.roznamaEntryRows(),
      this.currentOrderSheet()
    );
    return serializeRoznamaContent(merged);
  }

  protected updateRoznamaRowDate(index: number, event: Event): void {
    const row = this.roznamaEntryRows()[index];
    if (row?.readOnly) return;
    const date = (event.target as HTMLInputElement).value;
    this.roznamaEntryRows.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, date, hearingDate: date } : r))
    );
    this.orderSheetContentInput.set(this.roznamaContentForApi());
  }

  protected updateRoznamaRowContent(index: number, event: Event): void {
    const row = this.roznamaEntryRows()[index];
    if (row?.readOnly) return;
    const content = (event.target as HTMLTextAreaElement).value;
    this.roznamaEntryRows.update((rows) =>
      rows.map((r, i) => (i === index ? { ...r, content } : r))
    );
    this.orderSheetContentInput.set(this.roznamaContentForApi());
  }

  protected isRoznamaRowEditable(index: number): boolean {
    const row = this.roznamaEntryRows()[index];
    return row?.readOnly !== true;
  }

  protected addRoznamaTableRow(): void {
    this.roznamaEntryRows.update((rows) => [...rows, { date: this.defaultRoznamaRowDate(), content: '' }]);
    this.orderSheetContentInput.set(this.roznamaContentForApi());
  }

  protected removeRoznamaTableRow(index: number): void {
    const row = this.roznamaEntryRows()[index];
    if (row?.readOnly) return;
    this.roznamaEntryRows.update((rows) => {
      if (rows.length <= 1) return [{ date: this.defaultRoznamaRowDate(), content: '', readOnly: false }];
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
    const merged = this.mergeRoznamaRowContent(
      this.roznamaEntryRows(),
      this.currentOrderSheet()
    );
    const previewRows = merged
      .map((row) => ({
        date: (row.date || row.hearingDate || '').slice(0, 10),
        content: row.content ?? ''
      }))
      .filter((row) => stripHtmlToPlainText(row.content).trim());

    const vars: RoznamaPreviewVars = {
      phoneNumber: '',
      emailId: '',
      referenceNumber: '',
      referenceYearTwoDigits: '',
      noticeDateDay: '',
      noticeDateMonth: '',
      noticeDateYear: '',
      actSection: '',
      villageNameMoje: '',
      taluka: '',
      district: '',
      hearingDateDisplay: '',
      roznamaRows: previewRows,
      roznamaContent: '',
      signatoryName: '',
      signatoryDesignation: '',
      signatoryOffice: ''
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
    if (this.officerRole() !== 'PRESIDING_OFFICER') {
      this.actionError.set('Only Presiding Officer can draft the hearing notice.');
      return;
    }
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    const hearingIdVal = this.noticeHearingIdInput().trim();
    const hearingId = hearingIdVal ? Number(hearingIdVal) : null;
    const parties = [...this.selectedPartyKeys()];
    // Generate content from the fixed Marathi template — no manual input needed
    const content = this.buildNoticeHtml();
    this.noticeActionLoading.set(true);
    this.actionError.set(null);
    this.officerCaseStage.draftNotice(caseId, {
      hearingId, noticeType: this.noticeType(), draftContent: content, selectedParties: parties
    }).pipe(finalize(() => this.noticeActionLoading.set(false)))
      .subscribe({
        next: (saved) => {
          const noticeId = saved?.noticeId;
          if (!noticeId) {
            this.actionMessage.set('Notice draft saved.');
            this.loadNotices();
            return;
          }
          this.officerCaseStage.submitNoticeToPO(caseId, noticeId).subscribe({
            next: () => {
              this.actionMessage.set('Notice draft saved. You can finalize, sign, and serve it next.');
              this.loadNotices();
            },
            error: (err: unknown) => {
              this.actionMessage.set('Notice draft saved. Use Confirm Draft if finalize is not available yet.');
              this.actionError.set(this.formatError(err));
              this.loadNotices();
            }
          });
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected submitNoticeToPO(noticeId: number): void {
    if (this.officerRole() !== 'PRESIDING_OFFICER') {
      this.actionError.set('Only Presiding Officer can process the hearing notice.');
      return;
    }
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.noticeSubmitting.set(true);
    this.actionError.set(null);
    this.officerCaseStage.submitNoticeToPO(caseId, noticeId)
      .pipe(finalize(() => this.noticeSubmitting.set(false)))
      .subscribe({
        next: () => { this.actionMessage.set('Notice draft confirmed. You can finalize it next.'); this.loadNotices(); },
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
        next: () => { this.actionMessage.set('Notice returned to draft for correction.'); this.noticeRevertReason.set(''); this.loadNotices(); },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  /**
   * Serve notice to selected parties — backend finalizes, signs, and serves in one step.
   */
  protected serveNoticeToParties(): void {
    if (!this.isPO) {
      this.actionError.set('Only Presiding Officer can serve notice.');
      return;
    }
    const caseId = this.caseIdForActions();
    if (!caseId) {
      this.actionError.set('Case not loaded. Open the case from the notice queue and try again.');
      return;
    }
    const hearingId = this.hearingIdForNoticeAction();
    if (!hearingId) {
      this.actionError.set('Hearing not selected. Open the case from the notice queue.');
      return;
    }
    const partyValidation = this.noticePartyValidationError();
    if (partyValidation) {
      this.actionError.set(partyValidation);
      return;
    }
    const partyKeys = this.selectedPartyKeys();
    if (!partyKeys.length) {
      this.actionError.set('Select at least one applicant and one respondent.');
      return;
    }
    const body = {
      hearingId,
      draftContent: this.buildNoticeHtml(),
      selectedParties: partyKeys,
      noticeType: this.noticeType()
    };
    this.noticeSubmitting.set(true);
    this.actionError.set(null);
    this.actionMessage.set(null);
    this.officerCaseStage
      .serveNotice(caseId, body)
      .pipe(finalize(() => this.noticeSubmitting.set(false)))
      .subscribe({
      next: () => {
        const appId = this.selectedApplicationId();
        if (appId) {
          this.patchCaseInboxForApplication(appId, { proceedingStage: 'ORDER_SHEET_PENDING' });
        }
        this.actionMessage.set('Notice served to selected parties.');
        this.selectedPendingServe.set(null);
        this.loadPendingServeQueue();
        this.loadCaseInbox();
        this.loadNotices();
        this.loadHearings();
        this.loadWorkflowContext();
        document.getElementById('application-details-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      error: (err: unknown) => {
        this.actionError.set(this.formatError(err));
        document.getElementById('application-details-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // ── Judgment workflow ──────────────────────────────────────────────────────

  protected loadJudgmentWorkflow(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.judgmentLoading.set(true);
    this.officerCaseStage
      .getJudgmentWorkflow(caseId)
      .pipe(finalize(() => this.judgmentLoading.set(false)))
      .subscribe({
        next: (resp) => this.applyJudgmentWorkflow(resp),
        error: () => this.judgmentWorkflow.set(null)
      });
  }

  protected sendJudgmentToClerk(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    const summary = this.judgmentSummaryInput().trim();
    if (!summary) {
      this.actionError.set('Save judgment draft before sending to clerk.');
      return;
    }
    this.judgmentSubmitting.set(true);
    this.actionError.set(null);
    this.officerCaseStage
      .draftJudgment(caseId, summary)
      .pipe(
        switchMap(() =>
          this.officerCaseStage.sendJudgmentToClerk(
            caseId,
            this.judgmentSendToClerkRemarks().trim() || undefined
          )
        ),
        finalize(() => this.judgmentSubmitting.set(false))
      )
      .subscribe({
        next: (resp) => {
          this.applyJudgmentWorkflow(resp);
          this.actionMessage.set(resp.message || 'Judgment sent to clerk.');
          this.loadWorkflowContext();
          this.loadCaseInboxForMenu();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
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
          this.loadWorkflowContext();
          this.loadJudgmentHistory();
          this.loadCaseInboxForMenu();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected submitJudgmentToPO(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    const summary = this.judgmentSummaryInput().trim();
    if (!summary) {
      this.actionError.set('Enter judgment text, save draft, then send to Presiding Officer for review.');
      return;
    }
    this.judgmentSubmitting.set(true);
    this.actionError.set(null);
    this.officerCaseStage
      .draftJudgment(caseId, summary)
      .pipe(
        switchMap(() => this.officerCaseStage.submitJudgmentToPO(caseId)),
        finalize(() => this.judgmentSubmitting.set(false))
      )
      .subscribe({
        next: (resp) => {
          this.applyJudgmentWorkflow(resp);
          this.actionMessage.set(resp.message || 'Judgment sent to Presiding Officer for review.');
          this.loadWorkflowContext();
          this.loadJudgmentHistory();
          this.loadCaseInboxForMenu();
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
          this.loadWorkflowContext();
          this.loadJudgmentHistory();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected finalizeJudgment(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    const summary = this.judgmentSummaryInput().trim();
    this.judgmentSaving.set(true);
    this.actionError.set(null);
    this.officerCaseStage
      .finalizeJudgment(caseId, summary || undefined)
      .pipe(finalize(() => this.judgmentSaving.set(false)))
      .subscribe({
        next: (resp) => {
          this.applyJudgmentWorkflow(resp);
          this.actionMessage.set(resp.message || 'Judgment finalized.');
          this.loadWorkflowContext();
          this.loadJudgmentHistory();
          this.loadCaseInboxForMenu();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err))
      });
  }

  protected signAndPublishJudgment(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    const summary = this.judgmentSummaryInput().trim();
    const signRef = this.judgmentSignatureRef().trim();
    if (!signRef) {
      this.actionError.set('Digital signature reference is required for Save & sign.');
      return;
    }
    if (!confirm('Sign, publish judgment, and dispose this case? This action is irreversible.')) return;
    this.judgmentSaving.set(true);
    this.actionError.set(null);
    this.officerCaseStage
      .signAndPublishJudgment(
        caseId,
        buildJudgmentSignPublishBody(summary, signRef)
      )
      .pipe(finalize(() => this.judgmentSaving.set(false)))
      .subscribe({
        next: (resp) => {
          this.applyJudgmentWorkflow(resp);
          this.postRoznamaPath.set(null);
          this.judgmentSignatureRef.set('');
          this.actionMessage.set(resp.message || 'Judgment signed, published, and case disposed.');
          this.loadWorkflowContext();
          this.loadJudgmentHistory();
          this.loadOfficerInbox();
          this.loadCaseInboxForMenu();
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
          this.loadWorkflowContext();
          this.loadJudgmentHistory();
          this.loadOfficerInbox();
          this.loadCaseInboxForMenu();
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
    // Logged-in designation is authoritative for who may act in the UI.
    if (this.loginRole === 'PRESIDING_OFFICER') {
      // Notice, roznamah, judgment, and hearings are PO-only in this module.
      return 'PRESIDING_OFFICER';
    }
    if (this.loginRole === 'CLERK') {
      return 'CLERK';
    }

    const designation = String(this.tokenStorage.getDesignationName() || '').toLowerCase();
    if (designation.includes('clerk')) return 'CLERK';
    if (designation.includes('presid') || designation.includes('po')) return 'PRESIDING_OFFICER';

    const stage = String(_detail?.processingStage || '').toUpperCase();
    if (stage === 'CLERK_DRAFT_REVIEW' || stage === 'PO_SENT_BACK_TO_CLERK') return 'CLERK';
    if (stage === 'PO_UNDER_REVIEW' || stage === 'CASE_PROCEEDINGS') return 'PRESIDING_OFFICER';

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
    return this.extractPartyArrays().applicants;
  }

  protected detailRespondents(): Array<Record<string, unknown>> {
    return this.extractPartyArrays().respondents;
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

  protected detailSearchModeLabel(): string {
    const order = this.detailDisputedOrder();
    return formatSearchModeLabel(String(order?.['searchMode'] ?? ''));
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
    return landDetailDisplayFields(payload);
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

