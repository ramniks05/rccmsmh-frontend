import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import {
  FilingApplicationService,
  ApplicationPreviewResponse,
  ApplicationPreviewNotice,
} from '../../../services/filing-application.service';

type PreviewTab = 'application' | 'notices' | 'hearings' | 'ordersheet' | 'judgment';

@Component({
  selector: 'app-application-preview',
  imports: [RouterLink],
  templateUrl: './application-preview.component.html',
  styleUrl: './application-preview.component.css'
})
export class ApplicationPreviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(FilingApplicationService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<ApplicationPreviewResponse | null>(null);
  protected readonly activeTab = signal<PreviewTab>('application');

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) { this.error.set('Invalid application ID.'); this.loading.set(false); return; }
    this.service.getApplicationPreview(id).subscribe({
      next: (resp) => { this.data.set(resp); this.loading.set(false); },
      error: () => { this.error.set('Failed to load application details.'); this.loading.set(false); }
    });
  }

  protected setTab(tab: PreviewTab): void { this.activeTab.set(tab); }

  protected noticeHtml(notice: ApplicationPreviewNotice): SafeHtml {
    const html = notice.finalContent || notice.previewContent || '';
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  protected app(): ApplicationPreviewResponse['application'] | null { return this.data()?.application ?? null; }
  protected arr(v: unknown): Record<string, unknown>[] {
    return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
  }
  protected str(v: unknown): string { return v != null ? String(v) : '-'; }
}
