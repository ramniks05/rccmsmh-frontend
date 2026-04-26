import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { OriginalFileMutationComponent } from '../original-file-mutation/original-file-mutation.component';
import { Category1ObjectionComponent } from '../category1-objection/category1-objection.component';
import { CaseCategoryRecord, CaseCategoryService } from '../../../services/case-category.service';

type ApplicationType = 'ORIGINAL_FILE_MUTATION';

@Component({
  selector: 'app-new-application',
  imports: [RouterLink, OriginalFileMutationComponent, Category1ObjectionComponent],
  templateUrl: './new-application.component.html',
  styleUrl: './new-application.component.css'
})
export class NewApplicationComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly caseCategories = inject(CaseCategoryService);

  protected readonly selectedType = signal<ApplicationType | ''>('');
  protected readonly selectedCaseCategory = signal<CaseCategoryRecord | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly title = computed(() => {
    if (this.selectedType() === 'ORIGINAL_FILE_MUTATION') return 'Original File (Mutation)';
    return 'New Application';
  });

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const id = Number(params.get('caseCategoryId') || 0);
      if (!id || id < 1) {
        this.selectedCaseCategory.set(null);
        this.selectedType.set('');
        this.error.set(null);
        return;
      }
      this.loadCaseCategory(id);
    });
  }

  protected backToCategorySelect(): void {
    void this.router.navigate(['/cases/new']);
  }

  private loadCaseCategory(id: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.caseCategories.getCaseCategory(id).subscribe({
      next: (cat) => {
        this.selectedCaseCategory.set(cat);
        if (cat.id === 2) {
          // Category 2 objection stepper form
          this.selectedType.set('');
        } else if (cat.code === 'ORIGINAL') {
          this.selectedType.set('ORIGINAL_FILE_MUTATION');
        } else {
          this.selectedType.set('');
        }
      },
      error: (err: unknown) => {
        this.error.set(this.formatError(err));
        this.selectedCaseCategory.set(null);
        this.selectedType.set('');
      },
      complete: () => this.loading.set(false)
    });
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

