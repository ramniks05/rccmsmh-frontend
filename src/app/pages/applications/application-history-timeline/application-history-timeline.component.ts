import { Component, computed, input, output } from '@angular/core';

import {
  ApplicationHistoryEntry,
  ApplicationHistoryResponse
} from '../../../services/filing-application.service';

const ACTION_LABELS: Record<string, string> = {
  DRAFT_SAVED: 'Draft saved',
  SUBMITTED: 'Application submitted',
  FORWARDED_TO_PO: 'Forwarded to Presiding Officer',
  RETURNED_TO_CLERK: 'Returned to clerk',
  PO_REJECTED: 'Rejected by Presiding Officer',
  CASE_REGISTERED: 'Case registered',
  HEARING_SCHEDULED: 'Hearing scheduled',
  NOTICE_DRAFTED: 'Notice drafted',
  NOTICE_IN_PO_SCRUTINY: 'Notice in PO scrutiny',
  NOTICE_FINALIZED: 'Notice finalized',
  NOTICE_SIGNED: 'Notice signed',
  NOTICE_SERVED: 'Notice served',
  ORDER_SHEET_RECORDED: 'Order sheet recorded',
  JUDGMENT_DRAFT_SAVED: 'Judgment draft saved',
  JUDGMENT_SUBMITTED_TO_PO: 'Judgment submitted to PO',
  JUDGMENT_FINALIZED: 'Judgment finalized',
  JUDGMENT_PUBLISHED: 'Judgment published'
};

@Component({
  selector: 'app-application-history-timeline',
  imports: [],
  templateUrl: './application-history-timeline.component.html',
  styleUrl: './application-history-timeline.component.css'
})
export class ApplicationHistoryTimelineComponent {
  readonly history = input<ApplicationHistoryResponse | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  /** When true, entries with referenceType + referenceId emit entrySelect for detail navigation */
  readonly linkable = input(true);

  readonly entrySelect = output<ApplicationHistoryEntry>();

  protected readonly sortedEntries = computed(() => {
    const entries = this.history()?.entries ?? [];
    return [...entries].sort((a, b) => {
      if (a.sequence !== b.sequence) return a.sequence - b.sequence;
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return ta - tb;
    });
  });

  protected entryTrack(entry: ApplicationHistoryEntry): string {
    return `${entry.phase}-${entry.sequence}-${entry.action}-${entry.referenceId ?? entry.historyId ?? ''}`;
  }

  protected entryTitle(entry: ApplicationHistoryEntry): string {
    return entry.actionLabel?.trim() || ACTION_LABELS[entry.action] || entry.action.replace(/_/g, ' ');
  }

  protected isLinkable(entry: ApplicationHistoryEntry): boolean {
    return this.linkable() && !!entry.referenceType && entry.referenceId != null;
  }

  protected onEntryClick(entry: ApplicationHistoryEntry): void {
    if (this.isLinkable(entry)) {
      this.entrySelect.emit(entry);
    }
  }

  protected formatDate(iso: string | undefined): string {
    if (!iso) return '-';
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

  protected assigneeLabel(role: string | null | undefined): string {
    switch ((role || '').toUpperCase()) {
      case 'FILER':
        return 'With filer';
      case 'CLERK':
        return 'With clerk';
      case 'PRESIDING_OFFICER':
        return 'With Presiding Officer';
      default:
        return role || '';
    }
  }

  protected proceedingDetail(entry: ApplicationHistoryEntry): string | null {
    const parts: string[] = [];
    if (entry.hearingNo != null && entry.hearingDate) {
      parts.push(`Hearing #${entry.hearingNo} on ${entry.hearingDate}`);
    } else if (entry.hearingDate) {
      parts.push(`Hearing on ${entry.hearingDate}`);
    }
    if (entry.noticeType) {
      parts.push(entry.noticeType.replace(/_/g, ' '));
    }
    if (entry.referenceType && entry.referenceId != null) {
      parts.push(`${entry.referenceType.replace(/_/g, ' ')} #${entry.referenceId}`);
    }
    return parts.length ? parts.join(' · ') : null;
  }
}
