import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  OfficerApplicationDetail,
  OfficerFilingService,
  OfficerInboxItem
} from '../../../services/officer-filing.service';
import {
  CaseHearingResponse,
  CaseJudgmentResponse,
  OfficerCaseInboxItem,
  OfficerAssignmentActionResponse,
  CaseOrderSheetHistoryResponse,
  CaseOrderSheetResponse,
  OfficerApproveResponse,
  OfficerCaseStageService
} from '../../../services/officer-case-stage.service';
import { LandRecordsService, NoticeNineViewResponse, RuralSubSurveyRow, UrbanCtsRow } from '../../../services/land-records.service';
import { TokenStorageService } from '../../../services/token-storage.service';

@Component({
  selector: 'app-case-list',
  imports: [RouterLink],
  templateUrl: './case-list.component.html',
  styleUrl: './case-list.component.css'
})
export class CaseListComponent {
  private readonly officerFilings = inject(OfficerFilingService);
  private readonly officerCaseStage = inject(OfficerCaseStageService);
  private readonly landRecords = inject(LandRecordsService);
  private readonly tokenStorage = inject(TokenStorageService);

  protected readonly role = this.tokenStorage.getRole() || '-';
  protected readonly isAdvocate = this.tokenStorage.isAdvocate();
  protected readonly isOfficer = this.tokenStorage.isOfficer();

  protected readonly loadingOfficerInbox = signal(false);
  protected readonly officerInboxError = signal<string | null>(null);
  protected readonly officerInbox = signal<OfficerInboxItem[]>([]);
  protected readonly caseInboxLoading = signal(false);
  protected readonly caseInboxError = signal<string | null>(null);
  protected readonly caseInbox = signal<OfficerCaseInboxItem[]>([]);
  protected readonly officerMenu = signal<'ALL' | 'CLERK_DESK' | 'PO_DESK' | 'HEARING' | 'ORDERSHEET' | 'JUDGMENT'>(
    'ALL'
  );
  protected readonly selectedApplicationId = signal<number | null>(null);
  protected readonly loadingOfficerDetail = signal(false);
  protected readonly officerDetailError = signal<string | null>(null);
  protected readonly officerDetail = signal<OfficerApplicationDetail | null>(null);
  protected readonly generatedCase = signal<OfficerApproveResponse | null>(null);
  protected readonly officerTab = signal<'summary' | 'decision' | 'proceedings'>('summary');
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
  protected readonly orderSheetRemarksInput = signal('');
  protected readonly orderSheetSaving = signal(false);
  protected readonly currentOrderSheet = signal<CaseOrderSheetResponse | null>(null);
  protected readonly orderSheetHistory = signal<CaseOrderSheetHistoryResponse[]>([]);

  protected readonly judgmentSummaryInput = signal('');
  protected readonly judgmentSaving = signal(false);
  protected readonly lastJudgment = signal<CaseJudgmentResponse | null>(null);

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
    menu: 'ALL' | 'CLERK_DESK' | 'PO_DESK' | 'HEARING' | 'ORDERSHEET' | 'JUDGMENT'
  ): void {
    this.officerMenu.set(menu);
    // No refetch needed — filteredCaseInbox() and filteredOfficerInbox() do client-side
    // filtering on the already-loaded data. Refetching with a status filter was causing
    // the list to appear empty when the backend filtered endpoint returned no rows.
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

  /** Case status for a given applicationId (from the joined caseInbox). */
  protected caseStatusFor(applicationId: number): string {
    return this.caseMapByAppId().get(applicationId)?.status || '';
  }

  /** Case number for a given applicationId (from the joined caseInbox). */
  protected caseNoFor(applicationId: number): string {
    return this.caseMapByAppId().get(applicationId)?.caseNo || '-';
  }

  /**
   * ALL menus now use this single filtered list from officerInbox.
   * Case-level menus (HEARING, ORDERSHEET, JUDGMENT) join with caseInbox
   * client-side via filingApplicationId so no extra API call is needed.
   */
  protected filteredOfficerInbox(): OfficerInboxItem[] {
    const rows = this.officerInbox() || [];
    const menu = this.officerMenu();
    const up = (v: unknown) => String(v || '').toUpperCase();

    if (menu === 'ALL') return rows;

    if (menu === 'CLERK_DESK') {
      return rows.filter((r) => up(r.currentAssigneeRole) === 'CLERK');
    }

    if (menu === 'PO_DESK') {
      return rows.filter((r) => up(r.currentAssigneeRole) === 'PRESIDING_OFFICER');
    }

    // For case-level menus, join with caseInbox by applicationId ↔ filingApplicationId
    const caseMap = this.caseMapByAppId();

    if (menu === 'HEARING') {
      return rows.filter((r) => {
        const cs = up(caseMap.get(r.applicationId)?.status);
        return cs === 'HEARING_SCHEDULED' || cs === 'ACTIVE';
      });
    }

    if (menu === 'ORDERSHEET') {
      return rows.filter((r) => {
        const cs = up(caseMap.get(r.applicationId)?.status);
        return !!cs && cs !== 'DISPOSED';
      });
    }

    if (menu === 'JUDGMENT') {
      return rows.filter((r) => {
        const cs = up(caseMap.get(r.applicationId)?.status);
        return !!cs && cs !== 'DISPOSED';
      });
    }

    return rows;
  }

  /** Count for each menu badge — always derived from the same filter logic. */
  protected menuCount(
    menu: 'ALL' | 'CLERK_DESK' | 'PO_DESK' | 'HEARING' | 'ORDERSHEET' | 'JUDGMENT'
  ): number {
    const rows = this.officerInbox() || [];
    const up = (v: unknown) => String(v || '').toUpperCase();

    if (menu === 'ALL') return rows.length;
    if (menu === 'CLERK_DESK') {
      return rows.filter((r) => up(r.currentAssigneeRole) === 'CLERK').length;
    }
    if (menu === 'PO_DESK') {
      return rows.filter((r) => up(r.currentAssigneeRole) === 'PRESIDING_OFFICER').length;
    }

    const caseMap = this.caseMapByAppId();

    if (menu === 'HEARING') {
      return rows.filter((r) => {
        const cs = up(caseMap.get(r.applicationId)?.status);
        return cs === 'HEARING_SCHEDULED' || cs === 'ACTIVE';
      }).length;
    }
    if (menu === 'ORDERSHEET') {
      return rows.filter((r) => {
        const cs = up(caseMap.get(r.applicationId)?.status);
        return !!cs && cs !== 'DISPOSED';
      }).length;
    }
    // JUDGMENT
    return rows.filter((r) => {
      const cs = up(caseMap.get(r.applicationId)?.status);
      return !!cs && cs !== 'DISPOSED';
    }).length;
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
    this.lastJudgment.set(null);
    this.officerTab.set('summary');
    this.viewerFlowRole.set('');
    this.officerFilings.getApplicationDetail(applicationId).subscribe({
      next: (row) => {
        const detail = this.unwrapDetail(row);
        this.officerDetail.set(detail);
        this.viewerFlowRole.set(this.resolveAssigneeRole(detail));
        const caseId = (detail as unknown as Record<string, unknown>)['caseId'];
        const caseNo = (detail as unknown as Record<string, unknown>)['caseNo'];
        if (typeof caseId === 'number' && caseId > 0) {
          this.generatedCase.set({
            applicationId,
            applicationNo: String((detail as unknown as Record<string, unknown>)['applicationNo'] || ''),
            caseId,
            caseNo: typeof caseNo === 'string' ? caseNo : '',
            message: 'Case already generated.'
          });
          this.loadHearings();
          this.loadCurrentOrderSheet();
          this.loadOrderSheetHistory();
        }
      },
      error: (err: unknown) => this.officerDetailError.set(this.formatError(err)),
      complete: () => this.loadingOfficerDetail.set(false)
    });
  }

  protected selectOfficerTab(tab: 'summary' | 'decision' | 'proceedings'): void {
    this.officerTab.set(tab);
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
    const judgmentStatus = (this.lastJudgment()?.status || '').toUpperCase();
    if (judgmentStatus === 'DISPOSED') return true;
    const detailStatus = (this.officerDetail()?.status || '').toUpperCase();
    return detailStatus === 'DISPOSED';
  }

  protected canRunCaseActions(): boolean {
    return !!this.caseIdForActions() && !this.isDisposedCase();
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
      next: (rows) => this.hearings.set(rows || []),
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
    if (!caseId) {
      this.actionError.set('Approve application first to get case ID.');
      return;
    }
    const content = this.orderSheetContentInput().trim();
    if (!content) {
      this.actionError.set('Order sheet content is required.');
      return;
    }
    const hearingIdValue = this.orderSheetHearingIdInput().trim();
    const hearingId = hearingIdValue ? Number(hearingIdValue) : null;
    this.orderSheetSaving.set(true);
    this.actionError.set(null);
    this.officerCaseStage
      .upsertOrderSheet(caseId, {
        hearingId: hearingId && hearingId > 0 ? hearingId : null,
        content,
        remarks: this.orderSheetRemarksInput().trim()
      })
      .subscribe({
        next: (resp) => {
          this.currentOrderSheet.set(resp);
          this.actionMessage.set('Order sheet saved.');
          this.loadOrderSheetHistory();
          this.loadHearings();
          this.loadTodayCauseList();
        },
        error: (err: unknown) => this.actionError.set(this.formatError(err)),
        complete: () => this.orderSheetSaving.set(false)
      });
  }

  protected loadCurrentOrderSheet(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.officerCaseStage.getCurrentOrderSheet(caseId).subscribe({
      next: (resp) => {
        this.currentOrderSheet.set(resp);
        this.orderSheetContentInput.set(resp.content || '');
      },
      error: () => {
        this.currentOrderSheet.set(null);
      }
    });
  }

  protected loadOrderSheetHistory(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) return;
    this.officerCaseStage.getOrderSheetHistory(caseId).subscribe({
      next: (rows) => this.orderSheetHistory.set(rows || []),
      error: () => this.orderSheetHistory.set([])
    });
  }

  protected passFinalJudgment(): void {
    const caseId = this.caseIdForActions();
    if (!caseId) {
      this.actionError.set('Approve application first to get case ID.');
      return;
    }
    const judgmentSummary = this.judgmentSummaryInput().trim();
    if (!judgmentSummary) {
      this.actionError.set('Judgment summary is required.');
      return;
    }
    if (!confirm('Pass final judgment and dispose this case? This action marks case as DISPOSED.')) {
      return;
    }
    this.judgmentSaving.set(true);
    this.actionError.set(null);
    this.officerCaseStage.passFinalJudgment(caseId, { judgmentSummary }).subscribe({
      next: (resp) => {
        this.lastJudgment.set(resp);
        this.actionMessage.set(resp.message || 'Final judgment saved.');
        this.loadHearings();
        this.loadCurrentOrderSheet();
        this.loadOrderSheetHistory();
        this.loadTodayCauseList();
        this.loadOfficerInbox();
      },
      error: (err: unknown) => this.actionError.set(this.formatError(err)),
      complete: () => this.judgmentSaving.set(false)
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

  private resolveAssigneeRole(detail: OfficerApplicationDetail | null): 'CLERK' | 'PRESIDING_OFFICER' | '' {
    const fromDetail = String(detail?.currentAssigneeRole || '').toUpperCase();
    if (fromDetail === 'CLERK' || fromDetail === 'PRESIDING_OFFICER') {
      return fromDetail;
    }
    const selectedId = this.selectedApplicationId();
    const fromInbox = String(
      this.officerInbox().find((x) => x.applicationId === selectedId)?.currentAssigneeRole || ''
    ).toUpperCase();
    if (fromInbox === 'CLERK' || fromInbox === 'PRESIDING_OFFICER') {
      return fromInbox;
    }
    const stage = String(detail?.processingStage || '').toUpperCase();
    if (stage.includes('CLERK')) return 'CLERK';
    if (stage.includes('PO')) return 'PRESIDING_OFFICER';
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

