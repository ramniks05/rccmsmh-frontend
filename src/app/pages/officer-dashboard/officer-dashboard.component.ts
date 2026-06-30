import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { matchesOfficerDeskAssignee } from '../../shared/officer-role.util';

import {
  OfficerCaseStageService,
  OfficerDashboardResponse,
  OfficerRoznamaTableRow
} from '../../services/officer-case-stage.service';
import { OfficerFilingService, OfficerInboxItem } from '../../services/officer-filing.service';
import { TokenStorageService } from '../../services/token-storage.service';

export type DashboardTileId =
  | 'FILING_PENDING'
  | 'PENDING_NOTICE'
  | 'TODAY_HEARINGS'
  | 'ROZNAMA_TODAY'
  | 'READY_JUDGMENT'
  | 'JUDGMENT_CLERK'
  | 'ADJOURNED'
  | 'ACTIVE_CASES';

interface DashboardTile {
  id: DashboardTileId;
  label: string;
  description: string;
  count: number;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'rose' | 'cyan' | 'amber' | 'slate';
  icon: string;
  poOnly?: boolean;
  clerkOnly?: boolean;
  menu?: string;
  caseStatus?: string;
}

@Component({
  selector: 'app-officer-dashboard',
  imports: [RouterLink, DatePipe],
  templateUrl: './officer-dashboard.component.html',
  styleUrl: './officer-dashboard.component.css'
})
export class OfficerDashboardComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly caseStage = inject(OfficerCaseStageService);
  private readonly filing = inject(OfficerFilingService);

  protected readonly today = new Date();
  protected readonly displayName = this.tokenStorage.getDisplayName() || 'Officer';
  protected readonly officeName = this.tokenStorage.getOfficeName() || '—';
  protected readonly designationName = this.tokenStorage.getDesignationName() || '—';
  protected readonly isPO = this.tokenStorage.isPresidingOfficer();
  protected readonly isClerk = this.tokenStorage.isClerkOfficer();

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly dashboard = signal<OfficerDashboardResponse | null>(null);

  protected readonly pendingNoticeCount = signal(0);
  protected readonly roznamaTodayCount = signal(0);
  protected readonly readyJudgmentCount = signal(0);
  protected readonly adjournedCount = signal(0);
  protected readonly clerkJudgmentCount = signal(0);
  protected readonly filingPendingCount = signal(0);

  protected readonly recentPending = signal<OfficerInboxItem[]>([]);
  protected readonly recentHearings = signal<OfficerDashboardResponse['todayHearings']>([]);
  protected readonly recentActive = signal<OfficerDashboardResponse['activeCases']>([]);

  protected readonly roleLabel = computed(() =>
    this.isPO ? 'Presiding Officer' : this.isClerk ? 'Clerk' : 'Officer'
  );

  protected readonly tiles = computed(() => {
    const list: DashboardTile[] = [
      {
        id: 'FILING_PENDING',
        label: 'Applications with me',
        description: 'Filing scrutiny & approval',
        count: this.filingPendingCount(),
        color: 'blue',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        menu: this.isClerk ? 'CLERK_DESK' : 'PO_DESK'
      },
      {
        id: 'PENDING_NOTICE',
        label: 'Pending notice serve',
        description: 'Hearings dated, notice not served',
        count: this.pendingNoticeCount(),
        color: 'orange',
        icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v4.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
        poOnly: true,
        menu: 'PENDING_NOTICE'
      },
      {
        id: 'TODAY_HEARINGS',
        label: "Today's hearings",
        description: 'Cause list for today',
        count: this.dashboard()?.todayHearings?.length ?? 0,
        color: 'cyan',
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
        menu: 'CAUSE_LIST'
      },
      {
        id: 'ROZNAMA_TODAY',
        label: 'Roznamma today',
        description: 'Notice served, roznamma pending',
        count: this.roznamaTodayCount(),
        color: 'green',
        icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
        poOnly: true,
        menu: 'CAUSE_LIST'
      },
      {
        id: 'READY_JUDGMENT',
        label: 'Ready for judgment',
        description: 'Final roznamma — draft judgment',
        count: this.readyJudgmentCount(),
        color: 'purple',
        icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0H15',
        poOnly: true,
        menu: 'PENDING_JUDGMENT'
      },
      {
        id: 'JUDGMENT_CLERK',
        label: 'Judgment with clerk',
        description: 'Clerk draft / submit to PO',
        count: this.clerkJudgmentCount(),
        color: 'rose',
        icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
        clerkOnly: true,
        menu: 'PENDING_JUDGMENT'
      },
      {
        id: 'ADJOURNED',
        label: 'Adjourned — set date',
        description: 'Reschedule next hearing',
        count: this.adjournedCount(),
        color: 'amber',
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
        poOnly: true,
        menu: 'ADJOURNED_QUEUE'
      },
      {
        id: 'ACTIVE_CASES',
        label: 'All active cases',
        description: 'Non-disposed in your office',
        count: this.dashboard()?.activeCases?.length ?? 0,
        color: 'slate',
        icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
        menu: 'ACTIVE_CASES'
      }
    ];
    return list.filter((t) => {
      if (t.poOnly && !this.isPO) return false;
      if (t.clerkOnly && !this.isClerk) return false;
      return true;
    });
  });

  ngOnInit(): void {
    if (!this.tokenStorage.isOfficer()) {
      void this.router.navigate(['/portal-home']);
      return;
    }
    this.loadDashboard();
  }

  protected getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  protected openTile(tile: DashboardTile): void {
    const queryParams: Record<string, string> = {};
    if (tile.menu) queryParams['menu'] = tile.menu;
    if (tile.caseStatus) queryParams['caseStatus'] = tile.caseStatus;
    void this.router.navigate(['/cases'], { queryParams });
  }

  protected openTileById(id: DashboardTileId): void {
    const tile = this.tiles().find((t) => t.id === id);
    if (tile) this.openTile(tile);
  }

  protected openApplication(applicationId: number): void {
    void this.router.navigate(['/cases'], {
      queryParams: { menu: this.isClerk ? 'CLERK_DESK' : 'PO_DESK', applicationId: String(applicationId) }
    });
  }

  protected openCase(caseId: number, filingApplicationId: number): void {
    void this.router.navigate(['/cases'], {
      queryParams: {
        menu: 'ACTIVE_CASES',
        caseId: String(caseId),
        applicationId: String(filingApplicationId)
      }
    });
  }

  protected proceedingBadge(stage: string | null | undefined): string {
    return this.formatStageLabel(stage);
  }

  protected formatStageLabel(value: string | null | undefined): string {
    const raw = String(value || '').trim();
    if (!raw) return '—';
    return raw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  protected formatHearingDate(value: string | null | undefined): string {
    const raw = String(value || '').slice(0, 10);
    if (!raw) return '—';
    const [y, m, d] = raw.split('-');
    if (!y || !m || !d) return raw;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${Number(d)} ${months[Number(m) - 1] ?? m} ${y}`;
  }

  protected statusChipClass(status: string | null | undefined): string {
    const s = String(status || '').toUpperCase();
    if (s.includes('READY') || s.includes('APPROVED')) return 'chip chip-success';
    if (s.includes('ADJOURN') || s.includes('PENDING')) return 'chip chip-warning';
    if (s.includes('DISPOSED') || s.includes('REJECT')) return 'chip chip-muted';
    if (s.includes('HEARING') || s.includes('NOTICE') || s.includes('SCHEDULED')) return 'chip chip-info';
    return 'chip chip-default';
  }

  protected stageChipClass(stage: string | null | undefined): string {
    const s = String(stage || '').toUpperCase();
    if (s.includes('JUDGMENT')) return 'chip chip-purple';
    if (s.includes('ROZNAMA') || s.includes('ORDER')) return 'chip chip-green';
    if (s.includes('NOTICE')) return 'chip chip-orange';
    if (s.includes('ADJOURN')) return 'chip chip-warning';
    return 'chip chip-default';
  }

  protected totalQueueCount(): number {
    return this.tiles().reduce((sum, t) => sum + t.count, 0);
  }

  protected refresh(): void {
    this.loadDashboard();
  }

  private todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);
    const today = this.todayIso();
    const assignee = this.isPO ? 'PRESIDING_OFFICER' : 'CLERK';

    forkJoin({
      dashboard: this.caseStage.getOfficerDashboard().pipe(catchError(() => of(null))),
      filingInbox: this.filing.getInbox().pipe(catchError(() => of([]))),
      pendingNotice: this.isPO
        ? this.caseStage.getPendingServeNotices().pipe(catchError(() => of({ totalRows: 0, rows: [] })))
        : of({ totalRows: 0, rows: [] }),
      roznamaTable: this.isPO
        ? this.caseStage.getRoznamaTable(today).pipe(catchError(() => of({ rows: [], totalRows: 0, hearingDate: today })))
        : of({ rows: [], totalRows: 0, hearingDate: today }),
      readyJudgment: this.isPO
        ? this.caseStage.getCaseInbox('READY_FOR_JUDGMENT').pipe(catchError(() => of([])))
        : of([]),
      adjourned: this.isPO
        ? this.caseStage.getCaseInbox('ADJOURNED').pipe(catchError(() => of([])))
        : of([])
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (r) => {
          const dash = r.dashboard ?? {
            pendingApplications: [],
            activeCases: [],
            todayHearings: []
          };
          this.dashboard.set(dash);

          const filingFiltered = (r.filingInbox || []).filter((a) =>
            matchesOfficerDeskAssignee(a, assignee)
          );
          this.filingPendingCount.set(filingFiltered.length);
          this.recentPending.set(filingFiltered.slice(0, 6));

          const pendingApps = (dash.pendingApplications || []).filter((a) =>
            matchesOfficerDeskAssignee(a, assignee)
          );
          if (!filingFiltered.length && pendingApps.length) {
            this.filingPendingCount.set(pendingApps.length);
            this.recentPending.set(pendingApps.slice(0, 6));
          }

          this.pendingNoticeCount.set(r.pendingNotice.rows?.length ?? 0);

          const roznRows = r.roznamaTable.rows || [];
          this.roznamaTodayCount.set(this.countRoznamaPending(roznRows));

          this.readyJudgmentCount.set(
            r.readyJudgment.length || this.countByStatus(dash.activeCases, 'READY_FOR_JUDGMENT')
          );
          this.adjournedCount.set(
            r.adjourned.length || this.countByStatus(dash.activeCases, 'ADJOURNED')
          );

          this.clerkJudgmentCount.set(this.countClerkJudgmentCases(dash.activeCases));

          this.recentHearings.set((dash.todayHearings || []).slice(0, 6));
          this.recentActive.set((dash.activeCases || []).slice(0, 6));
        },
        error: (err: unknown) => {
          this.error.set(this.formatError(err));
        }
      });
  }

  private countRoznamaPending(rows: OfficerRoznamaTableRow[]): number {
    return rows.filter((row) => {
      if (row.noticeServed === false) return false;
      const st = String(row.proceedingStage || row.roznamaStatus || '').toUpperCase();
      return st !== 'ROZNAMA_PO_SIGNED' && st !== 'PO_SIGNED';
    }).length;
  }

  private countByStatus(
    cases: OfficerDashboardResponse['activeCases'],
    status: string
  ): number {
    const want = status.toUpperCase();
    return (cases || []).filter((c) => String(c.status || '').toUpperCase() === want).length;
  }

  private countClerkJudgmentCases(cases: OfficerDashboardResponse['activeCases']): number {
    return (cases || []).filter((c) => {
      const stage = String(c.proceedingStage || '').toUpperCase();
      return stage === 'JUDGMENT_PENDING' || stage === 'JUDGMENT_IN_PROGRESS' || stage.includes('CLERK');
    }).length;
  }

  private formatError(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const e = (err as { error?: { error?: string; message?: string } }).error;
      if (e?.error) return e.error;
      if (e?.message) return e.message;
    }
    return 'Could not load dashboard. Try again.';
  }
}
