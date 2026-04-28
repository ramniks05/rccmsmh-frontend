import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

import { TokenStorageService } from '../../../services/token-storage.service';
import {
  AdvocateByBarCouncilService,
  AdvocateLookupResponse
} from '../../../services/advocate-by-bar-council.service';

export interface ApplicantOption {
  id: string;
  name: string;
}

export interface VakaltnamaAssignment {
  id: string;
  advocate: AdvocateLookupResponse;
  coAdvocates: AdvocateLookupResponse[];
  applicantIds: string[];
}

@Component({
  selector: 'app-vakaltnama-panel',
  imports: [],
  templateUrl: './vakaltnama-panel.component.html',
  styleUrl: './vakaltnama-panel.component.css'
})
export class VakaltnamaPanelComponent {
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly advocateLookup = inject(AdvocateByBarCouncilService);

  /** Co-advocates list owned by parent; emit when user adds/removes. */
  coAdvocates = input<AdvocateLookupResponse[]>([]);
  coAdvocatesChange = output<AdvocateLookupResponse[]>();

  /**
   * Optional: if provided, panel switches to "assignment mode":
   * map applicants -> advocate, and create multiple vakaltnama groups.
   */
  applicants = input<ApplicantOption[]>([]);
  assignments = input<VakaltnamaAssignment[]>([]);
  assignmentsChange = output<VakaltnamaAssignment[]>();

  /** Fired when user clicks Generate VAKALTNAMA (wire PDF/API later). */
  generateVakaltnamaRequest = output<void>();

  protected readonly filingAdvocate = computed(() => ({
    displayName: this.tokenStorage.getDisplayName() || '—',
    role: this.tokenStorage.getRole() || '—'
  }));

  protected readonly barCouncilQuery = signal('');
  protected readonly barCouncilSearchLoading = signal(false);
  protected readonly barCouncilSearchError = signal<string | null>(null);

  // Assignment mode state
  protected readonly selectedApplicantIds = signal<string[]>([]);
  protected readonly selectedAdvocate = signal<AdvocateLookupResponse | null>(null);
  protected readonly groupCoAdvocates = signal<AdvocateLookupResponse[]>([]);

  protected readonly advocateLookupQuery = signal('');
  protected readonly advocateLookupLoading = signal(false);
  protected readonly advocateLookupError = signal<string | null>(null);

  protected setBarCouncilQuery(value: string): void {
    this.barCouncilQuery.set(value);
    this.barCouncilSearchError.set(null);
  }

  protected setAdvocateLookupQuery(value: string): void {
    this.advocateLookupQuery.set(value);
    this.advocateLookupError.set(null);
  }

  protected lookupAdvocate(): void {
    const raw = this.advocateLookupQuery().trim();
    if (raw.length < 2) {
      this.advocateLookupError.set('Enter a bar council number to search.');
      return;
    }
    this.advocateLookupError.set(null);
    this.advocateLookupLoading.set(true);
    this.advocateLookup
      .searchByBarCouncilNumber(raw)
      .pipe(finalize(() => this.advocateLookupLoading.set(false)))
      .subscribe({
        next: (adv) => {
          this.selectedAdvocate.set(adv);
          this.advocateLookupQuery.set(adv.barCouncilNumber);
        },
        error: (err: unknown) => {
          this.advocateLookupError.set(this.formatHttpError(err));
        }
      });
  }

  protected searchAndAddAdvocate(): void {
    const raw = this.barCouncilQuery().trim();
    if (raw.length < 2) {
      this.barCouncilSearchError.set('Enter a bar council number to search.');
      return;
    }
    this.barCouncilSearchError.set(null);
    this.barCouncilSearchLoading.set(true);
    this.advocateLookup
      .searchByBarCouncilNumber(raw)
      .pipe(finalize(() => this.barCouncilSearchLoading.set(false)))
      .subscribe({
        next: (adv) => {
          const norm = adv.barCouncilNumber?.trim().toUpperCase() ?? '';
          const list = this.isAssignmentMode() ? this.groupCoAdvocates() : this.coAdvocates();
          if (list.some((a) => a.barCouncilNumber.trim().toUpperCase() === norm)) {
            this.barCouncilSearchError.set('This advocate is already added.');
            return;
          }
          if (this.isAssignmentMode()) {
            this.groupCoAdvocates.set([...list, adv]);
          } else {
            this.coAdvocatesChange.emit([...list, adv]);
          }
          this.barCouncilQuery.set('');
        },
        error: (err: unknown) => {
          this.barCouncilSearchError.set(this.formatHttpError(err));
        }
      });
  }

  protected removeCoAdvocate(index: number): void {
    if (this.isAssignmentMode()) {
      const list = [...this.groupCoAdvocates()];
      list.splice(index, 1);
      this.groupCoAdvocates.set(list);
      return;
    }
    const list = [...this.coAdvocates()];
    list.splice(index, 1);
    this.coAdvocatesChange.emit(list);
  }

  /** Placeholder: document generation / download will be implemented later. */
  protected generateVakaltnama(): void {
    this.generateVakaltnamaRequest.emit();
  }

  protected isAssignmentMode(): boolean {
    return (this.applicants()?.length ?? 0) > 0 || (this.assignments()?.length ?? 0) > 0;
  }

  protected isApplicantAssigned(applicantId: string): boolean {
    return (this.assignments() ?? []).some((a) => a.applicantIds.includes(applicantId));
  }

  protected toggleApplicant(applicantId: string, checked: boolean): void {
    const current = this.selectedApplicantIds();
    if (checked) {
      if (!current.includes(applicantId)) this.selectedApplicantIds.set([...current, applicantId]);
      return;
    }
    this.selectedApplicantIds.set(current.filter((x) => x !== applicantId));
  }

  protected createAssignment(): void {
    const advocate = this.selectedAdvocate();
    const applicantIds = this.selectedApplicantIds();
    if (!advocate) {
      this.advocateLookupError.set('Please select an advocate for this group.');
      return;
    }
    if (applicantIds.length === 0) {
      this.advocateLookupError.set('Please select at least one applicant.');
      return;
    }
    // Enforce: each applicant belongs to only one vakaltnama group.
    const alreadyAssigned = applicantIds.some((id) => this.isApplicantAssigned(id));
    if (alreadyAssigned) {
      this.advocateLookupError.set('One or more selected applicants are already assigned to another vakaltnama.');
      return;
    }

    const next: VakaltnamaAssignment = {
      id: this.makeId(),
      advocate,
      coAdvocates: this.groupCoAdvocates(),
      applicantIds
    };
    this.assignmentsChange.emit([...(this.assignments() ?? []), next]);

    // Reset selection for next group
    this.selectedApplicantIds.set([]);
    this.groupCoAdvocates.set([]);
    this.selectedAdvocate.set(null);
    this.advocateLookupQuery.set('');
    this.advocateLookupError.set(null);
    this.barCouncilSearchError.set(null);
  }

  protected removeAssignment(index: number): void {
    const list = [...(this.assignments() ?? [])];
    list.splice(index, 1);
    this.assignmentsChange.emit(list);
  }

  protected applicantsLabel(ids: string[]): string {
    const map = new Map((this.applicants() ?? []).map((a) => [a.id, a.name]));
    const names = ids.map((id) => map.get(id) ?? id).filter(Boolean);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} (+${names.length - 2} more)`;
  }

  private makeId(): string {
    const cryptoObj = globalThis.crypto as Crypto | undefined;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
    return `vak-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private formatHttpError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { error?: string; message?: string } | null;
      if (body && typeof body.error === 'string') return body.error;
      if (body && typeof body.message === 'string') return body.message;
      if (err.status === 404) return 'No advocate found for this bar council number.';
      return `Request failed (${err.status}).`;
    }
    if (err instanceof Error) return err.message;
    return 'Request failed.';
  }
}
