import { Component, inject, OnInit, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { TokenStorageService } from '../../services/token-storage.service';
import { FilingApplicationService, MyApplicationItem } from '../../services/filing-application.service';

@Component({
  selector: 'app-portal-home',
  imports: [RouterLink, SlicePipe],
  templateUrl: './portal-home.component.html',
  styleUrl: './portal-home.component.css'
})
export class PortalHomeComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly filingService = inject(FilingApplicationService);
  private readonly router = inject(Router);

  protected readonly displayName = this.tokenStorage.getDisplayName() || 'User';
  protected readonly role = this.tokenStorage.getRole() || '-';
  protected readonly isAdvocate = this.tokenStorage.isAdvocate();
  protected isLoggingOut = false;

  protected readonly applications = signal<MyApplicationItem[]>([]);
  protected readonly applicationsLoading = signal(false);
  protected readonly applicationsError = signal<string | null>(null);

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
        next: (list) => this.applications.set(list),
        error: () => this.applicationsError.set('Could not load applications.')
      });
  }

  protected logout(): void {
    this.isLoggingOut = true;
    this.authService
      .logout()
      .pipe(finalize(() => (this.isLoggingOut = false)))
      .subscribe({
        next: () => { this.tokenStorage.clear(); void this.router.navigate(['/']); },
        error: () => { this.tokenStorage.clear(); void this.router.navigate(['/']); }
      });
  }
}
