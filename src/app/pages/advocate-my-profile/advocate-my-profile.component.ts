import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AdvocateProfile, AdvocateService } from '../../services/advocate.service';

@Component({
  selector: 'app-advocate-my-profile',
  imports: [CommonModule, RouterLink],
  templateUrl: './advocate-my-profile.component.html',
  styleUrl: './advocate-my-profile.component.css'
})
export class AdvocateMyProfileComponent implements OnInit {
  private readonly advocateService = inject(AdvocateService);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly profile = signal<AdvocateProfile | null>(null);

  ngOnInit(): void {
    this.loadProfile();
  }

  protected reload(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.loadProfile();
  }

  protected displayName(p: AdvocateProfile): string {
    return (
      p.fullName?.trim() ||
      [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ').trim() ||
      'Advocate'
    );
  }

  protected initials(p: AdvocateProfile): string {
    const name = this.displayName(p);
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  protected val(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  }

  protected genderLabel(gender: AdvocateProfile['gender']): string {
    if (!gender) return '—';
    const map: Record<string, string> = {
      MALE: 'Male',
      FEMALE: 'Female',
      OTHER: 'Other'
    };
    return map[gender] || gender;
  }

  protected formatDate(iso: string | undefined): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  protected hasAddress(p: AdvocateProfile): boolean {
    return !!(p.pinCode || p.stateName || p.addressLine1 || p.address);
  }

  private loadProfile(): void {
    this.advocateService
      .getMyProfile()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.profile.set(data),
        error: (err) => this.errorMessage.set(this.extractApiError(err))
      });
  }

  private extractApiError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'object' && error.error?.error) return String(error.error.error);
      if (typeof error.error === 'object' && error.error?.message) return String(error.error.message);
      return error.message || 'Request failed.';
    }
    return 'Unexpected error occurred.';
  }
}
