import { Component, inject, OnInit, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { FilingApplicationService, MyApplicationItem } from '../../../services/filing-application.service';
import { TokenStorageService } from '../../../services/token-storage.service';

@Component({
  selector: 'app-my-applications',
  imports: [RouterLink, SlicePipe],
  templateUrl: './my-applications.component.html',
  styleUrl: './my-applications.component.css'
})
export class MyApplicationsComponent implements OnInit {
  private readonly filingService = inject(FilingApplicationService);
  private readonly tokenStorage = inject(TokenStorageService);

  protected readonly isAdvocate = this.tokenStorage.isAdvocate();
  protected readonly applications = signal<MyApplicationItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.filingService
      .getMyApplications()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => this.applications.set(list),
        error: (err: unknown) => {
          const msg =
            typeof err === 'object' && err !== null && 'status' in err && (err as { status: number }).status === 404
              ? 'Application history API is not available yet.'
              : 'Could not load application history.';
          this.error.set(msg);
        }
      });
  }
}
