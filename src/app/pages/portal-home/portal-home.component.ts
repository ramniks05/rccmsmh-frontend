import { Component, inject, OnInit, signal } from '@angular/core';
import { SlicePipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { TokenStorageService } from '../../services/token-storage.service';
import { FilingApplicationService, MyApplicationItem } from '../../services/filing-application.service';

interface StatCard {
  label: string;
  value: string | number;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
  trend?: string;
  trendDir?: 'up' | 'down' | 'flat';
}

@Component({
  selector: 'app-portal-home',
  imports: [RouterLink, SlicePipe, DatePipe],
  templateUrl: './portal-home.component.html',
  styleUrl: './portal-home.component.css'
})
export class PortalHomeComponent implements OnInit {
  private readonly authService      = inject(AuthService);
  private readonly tokenStorage     = inject(TokenStorageService);
  private readonly filingService    = inject(FilingApplicationService);
  private readonly router           = inject(Router);

  protected readonly displayName  = this.tokenStorage.getDisplayName() || 'User';
  protected readonly role         = this.tokenStorage.getRole() || '-';
  protected readonly isAdvocate   = this.tokenStorage.isAdvocate();
  protected isLoggingOut          = false;

  /** Today's date — shown in hero */
  protected readonly today = new Date();

  /** Human-readable role label */
  protected get roleLabel(): string {
    switch (this.role) {
      case 'ADVOCATE':        return 'Legal Advocate';
      case 'PARTY_IN_PERSON': return 'Party Representative';
      case 'ADMIN':           return 'Administrator';
      case 'OFFICER':         return 'Revenue Officer';
      default:                return this.role;
    }
  }

  /** Derive up to 2 uppercase initials from a display name */
  protected getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  protected readonly applications        = signal<MyApplicationItem[]>([]);
  protected readonly applicationsLoading = signal(false);
  protected readonly applicationsError   = signal<string | null>(null);

  protected readonly statCards = signal<StatCard[]>([
    {
      label: 'Active Cases',
      value: 12,
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'blue',
      trend: '+2 this month',
      trendDir: 'up'
    },
    {
      label: 'Pending Hearings',
      value: 3,
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      color: 'orange',
      trend: 'Next: Tomorrow',
      trendDir: 'flat'
    },
    {
      label: 'Applications',
      value: 28,
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'green',
      trend: '+5 this week',
      trendDir: 'up'
    },
    {
      label: 'Total Filed',
      value: 45,
      icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
      color: 'purple',
      trend: 'All time',
      trendDir: 'flat'
    }
  ]);

  constructor() {
    if (!this.tokenStorage.getAccessToken()) {
      void this.router.navigate(['/']);
      return;
    }
    if (this.tokenStorage.isOfficer()) {
      void this.router.navigate(['/cases']);
    }
  }

  ngOnInit(): void {
    this.loadApplications();
  }

  protected loadApplications(): void {
    this.applicationsLoading.set(true);
    this.applicationsError.set(null);
    this.filingService.getMyApplications()
      .pipe(finalize(() => this.applicationsLoading.set(false)))
      .subscribe({
        next:  (list) => this.applications.set(list),
        error: ()     => this.applicationsError.set('Could not load applications. Please try again.')
      });
  }

  protected logout(): void {
    this.isLoggingOut = true;
    this.authService
      .logout()
      .pipe(finalize(() => (this.isLoggingOut = false)))
      .subscribe({
        next:  () => this.handlePostLogout(),
        error: () => this.handlePostLogout()
      });
  }

  private handlePostLogout(): void {
    this.tokenStorage.clear();
    void this.router.navigate(['/']);
  }
}
