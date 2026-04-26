import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { CaseCategoryRecord, CaseCategoryService } from '../../../services/case-category.service';

@Component({
  selector: 'app-new-case',
  imports: [RouterLink],
  templateUrl: './new-case.component.html',
  styleUrl: './new-case.component.css'
})
export class NewCaseComponent {
  private readonly caseCategoryService = inject(CaseCategoryService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly categories = signal<CaseCategoryRecord[]>([]);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.caseCategoryService.listCaseCategories().subscribe({
      next: (rows) => this.categories.set(rows),
      error: (err: unknown) => this.error.set(this.formatError(err)),
      complete: () => this.loading.set(false)
    });
  }

  protected selectCategory(id: number): void {
    void this.router.navigate(['/applications/new'], { queryParams: { caseCategoryId: id } });
  }

  private formatError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const msg =
        err.error && typeof err.error.error === 'string'
          ? err.error.error
          : err.error && typeof err.error.message === 'string'
            ? err.error.message
            : null;
      return msg || `Request failed (${err.status}).`;
    }
    return 'Request failed.';
  }
}

