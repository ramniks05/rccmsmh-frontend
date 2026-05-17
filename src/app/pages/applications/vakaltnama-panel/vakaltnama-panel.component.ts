import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

import { TokenStorageService } from '../../../services/token-storage.service';
import {
  AdvocateByBarCouncilService,
  AdvocateLookupResponse
} from '../../../services/advocate-by-bar-council.service';
import { buildMarathiVakalatnamaHtml, type VakalatnamaMarathiVars } from './vakalatnama-marathi-template';

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
  respondents = input<ApplicantOption[]>([]);
  assignments = input<VakaltnamaAssignment[]>([]);
  assignmentsChange = output<VakaltnamaAssignment[]>();

  /** Fired when user clicks Generate VAKALTNAMA (optional parent hook). */
  generateVakaltnamaRequest = output<void>();

  /** Client / filing ref shown as अर्ज क्र. */
  applicationRef = input<string>('');

  /** Court / district line: e.g. first-tab ePICS district (________ येथील मे.). */
  courtPlace = input<string>('');

  /** Office name before यांचे कोर्टात (ePICS urban office or registry office). */
  courtOfficeName = input<string>('');

  protected readonly filingAdvocate = computed(() => ({
    displayName: this.tokenStorage.getDisplayName() || '—',
    role: this.tokenStorage.getRole() || '—'
  }));

  /** True when the logged-in user is an advocate — they are always the primary. */
  protected readonly isFilingAdvocate = computed(() => this.tokenStorage.isAdvocate());

  protected readonly barCouncilQuery = signal('');
  protected readonly barCouncilSearchLoading = signal(false);
  protected readonly barCouncilSearchError = signal<string | null>(null);

  // Assignment mode state
  protected readonly selectedApplicantIds = signal<string[]>([]);
  protected readonly selectedAdvocate = signal<AdvocateLookupResponse | null>(null);
  protected readonly groupCoAdvocates = signal<AdvocateLookupResponse[]>([]);

  protected readonly advocateLookupLoading = signal(false);
  protected readonly advocateLookupError = signal<string | null>(null);
  protected readonly documentActionError = signal<string | null>(null);

  /**
   * Advocates the user has looked up (or loaded from saved groups) this session.
   * Lets you pick a primary advocate from a list when building several applicant groups.
   */
  protected readonly advocatePickList = signal<AdvocateLookupResponse[]>([]);

  constructor() {
    effect(() => {
      const rows = this.assignments() ?? [];
      untracked(() => {
        for (const g of rows) {
          this.addToAdvocatePickList(g.advocate);
          for (const c of g.coAdvocates) {
            this.addToAdvocatePickList(c);
          }
        }
      });
    });

  }

  protected setBarCouncilQuery(value: string): void {
    this.barCouncilQuery.set(value);
    this.barCouncilSearchError.set(null);
    this.advocateLookupError.set(null);
  }

  protected lookupAdvocate(): void {
    const raw = this.barCouncilQuery().trim();
    if (raw.length < 2) {
      this.advocateLookupError.set('Enter a bar council number to search.');
      return;
    }
    this.advocateLookupError.set(null);
    this.barCouncilSearchError.set(null);
    this.advocateLookupLoading.set(true);
    this.advocateLookup
      .searchByBarCouncilNumber(raw)
      .pipe(finalize(() => this.advocateLookupLoading.set(false)))
      .subscribe({
        next: (adv) => {
          this.addToAdvocatePickList(adv);
          this.selectedAdvocate.set(adv);
          this.barCouncilQuery.set(adv.barCouncilNumber?.trim() ?? '');
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
    this.advocateLookupError.set(null);
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
            const primary = this.selectedAdvocate();
            const primaryNorm = primary?.barCouncilNumber?.trim().toUpperCase() ?? '';
            if (primaryNorm && primaryNorm === norm) {
              this.barCouncilSearchError.set('This advocate is already the primary advocate for this group.');
              return;
            }
            this.addToAdvocatePickList(adv);
            this.groupCoAdvocates.set([...list, adv]);
          } else {
            this.addToAdvocatePickList(adv);
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

  /** Opens Marathi vakalatnama (template) in a new tab for the filing advocate. */
  protected generateVakaltnama(): void {
    this.documentActionError.set(null);
    this.generateVakaltnamaRequest.emit();
    const filing = this.filingAdvocate();
    const html = buildMarathiVakalatnamaHtml(this.buildVarsForFilingOnly(filing.displayName));
    this.openVakalatnamaView(html);
  }

  protected isAssignmentMode(): boolean {
    return (this.applicants()?.length ?? 0) > 0 || (this.assignments()?.length ?? 0) > 0;
  }

  protected isApplicantAssigned(applicantId: string): boolean {
    return (this.assignments() ?? []).some((a) => a.applicantIds.includes(applicantId));
  }

  protected onPickPrimaryFromList(barCouncilNumber: string): void {
    this.advocateLookupError.set(null);
    this.barCouncilSearchError.set(null);
    const v = (barCouncilNumber || '').trim();
    if (!v) {
      this.selectedAdvocate.set(null);
      return;
    }
    const found = this.advocatePickList().find(
      (a) => a.barCouncilNumber.trim().toUpperCase() === v.toUpperCase()
    );
    if (found) {
      this.selectedAdvocate.set(found);
      this.barCouncilQuery.set(found.barCouncilNumber.trim());
    }
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
    this.barCouncilQuery.set('');
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

  protected coAdvocateNames(group: VakaltnamaAssignment): string {
    return group.coAdvocates.map((c) => c.fullName).filter(Boolean).join(', ');
  }

  protected viewGroupDocument(group: VakaltnamaAssignment, index: number): void {
    this.documentActionError.set(null);
    this.openVakalatnamaView(buildMarathiVakalatnamaHtml(this.buildVarsForGroup(group, index)));
  }

  protected downloadGroupHtml(group: VakaltnamaAssignment, index: number): void {
    this.documentActionError.set(null);
    const html = buildMarathiVakalatnamaHtml(this.buildVarsForGroup(group, index));
    const fileName = this.toFileName(`vakalatnama-group-${index + 1}-${group.advocate.fullName}.html`);
    this.downloadHtmlFile(html, fileName);
  }

  protected printGroupDocument(group: VakaltnamaAssignment, index: number): void {
    this.documentActionError.set(null);
    this.printHtmlDocument(buildMarathiVakalatnamaHtml(this.buildVarsForGroup(group, index)));
  }

  private buildVarsForFilingOnly(filingDisplayName: string): VakalatnamaMarathiVars {
    const now = new Date();
    const mah = this.maharashtraMonthName(now.getMonth());
    const yy = String(now.getFullYear()).slice(-2);
    const place = (this.courtPlace() || '').trim();
    const officeName = (this.courtOfficeName() || '').trim();
    const respondentNames = this.getRespondentNames();
    const respLines = this.splitRespondentLines(respondentNames);
    return {
      applicationNo: (this.applicationRef() || '').trim(),
      courtPlace: place,
      courtOfficeName: officeName,
      caseNumber: '',
      caseYearTwoDigits: yy,
      applicantLine: filingDisplayName,
      respondentLine1: respLines.line1,
      respondentLine2: respLines.line2,
      representativeSelfLine: filingDisplayName,
      representativePronoun: 'मी',
      signatureNames: filingDisplayName ? [filingDisplayName] : [],
      matterDescription: 'अर्ज दाखल केलेल्या प्रकरणाचे कामकाज',
      advocateEmpoweredLine: filingDisplayName,
      dateDay: String(now.getDate()),
      monthMah: mah,
      yearTwoDigits: yy,
      deedLine: filingDisplayName || 'वकीलपत्र'
    };
  }

  private buildVarsForGroup(group: VakaltnamaAssignment, index: number): VakalatnamaMarathiVars {
    const applicantNames = this.getApplicantNames(group.applicantIds);
    const adv = group.advocate.fullName;
    const advBar = group.advocate.barCouncilNumber;
    const coNames = group.coAdvocates.map((c) => `${c.fullName} (${c.barCouncilNumber})`).filter(Boolean);
    const advocateEmpowered = [adv, ...group.coAdvocates.map((c) => c.fullName)].filter(Boolean).join(', ');
    const now = new Date();
    const mah = this.maharashtraMonthName(now.getMonth());
    const yy = String(now.getFullYear()).slice(-2);
    const appNo = (this.applicationRef() || '').trim() || `G${index + 1}`;
    const place = (this.courtPlace() || '').trim();
    const officeName = (this.courtOfficeName() || '').trim();
    const respondentNames = this.getRespondentNames();
    const respLines = this.splitRespondentLines(respondentNames);
    const applicantLine = applicantNames.join(', ') || 'अर्जदार';
    return {
      applicationNo: appNo,
      courtPlace: place,
      courtOfficeName: officeName,
      caseNumber: '',
      caseYearTwoDigits: yy,
      applicantLine,
      respondentLine1: respLines.line1,
      respondentLine2: respLines.line2,
      representativeSelfLine: applicantLine,
      representativePronoun: applicantNames.length > 1 ? 'आम्ही' : 'मी',
      signatureNames: applicantNames,
      matterDescription: `वरील प्रकरण (अर्ज क्र. ${appNo}) — नेमलेले वकील: ${adv} (${advBar})`,
      advocateEmpoweredLine: advocateEmpowered || adv,
      dateDay: String(now.getDate()),
      monthMah: mah,
      yearTwoDigits: yy,
      deedLine: applicantLine
    };
  }

  private maharashtraMonthName(monthIndex: number): string {
    const names = [
      'जानेवारी',
      'फेब्रुवारी',
      'मार्च',
      'एप्रिल',
      'मे',
      'जून',
      'जुलै',
      'ऑगस्ट',
      'सप्टेंबर',
      'ऑक्टोबर',
      'नोव्हेंबर',
      'डिसेंबर'
    ];
    return names[monthIndex] ?? '';
  }

  private openVakalatnamaView(html: string): void {
    const w = this.openHtmlDocument(html);
    if (!w) {
      this.documentActionError.set('Pop-up blocked. Allow pop-ups to view the vakalatnama.');
    }
  }

  /** Opens HTML in a blank tab (avoids blob: URL in browser print header/footer). */
  private openHtmlDocument(html: string): Window | null {
    const w = window.open('', '_blank');
    if (!w) return null;
    w.document.open();
    w.document.write(html);
    w.document.close();
    return w;
  }

  private downloadHtmlFile(html: string, fileName: string): void {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private printHtmlDocument(html: string): void {
    const w = this.openHtmlDocument(html);
    if (!w) {
      this.documentActionError.set('Pop-up blocked. Allow pop-ups to print.');
      return;
    }

    let printed = false;
    const tryPrint = (): void => {
      if (printed) return;
      printed = true;
      try {
        w.focus();
        w.print();
      } catch {
        //
      }
    };
    w.addEventListener('load', () => setTimeout(tryPrint, 300));
    setTimeout(tryPrint, 1200);
  }

  private getApplicantNames(ids: string[]): string[] {
    const map = new Map((this.applicants() ?? []).map((a) => [a.id, a.name]));
    return ids.map((id) => map.get(id) ?? `Applicant ${id}`).filter((n) => n.trim());
  }

  private getRespondentNames(): string[] {
    return (this.respondents() ?? []).map((r) => (r.name || '').trim()).filter(Boolean);
  }

  private splitRespondentLines(names: string[]): { line1: string; line2: string } {
    if (!names.length) return { line1: '', line2: '' };
    if (names.length === 1) return { line1: names[0], line2: '' };
    if (names.length === 2) return { line1: names[0], line2: names[1] };
    const half = Math.ceil(names.length / 2);
    return {
      line1: names.slice(0, half).join(', '),
      line2: names.slice(half).join(', ')
    };
  }

  private toFileName(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  }

  private makeId(): string {
    const cryptoObj = globalThis.crypto as Crypto | undefined;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
    return `vak-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private addToAdvocatePickList(adv: AdvocateLookupResponse): void {
    const norm = adv.barCouncilNumber?.trim().toUpperCase() ?? '';
    if (!norm) return;
    const list = this.advocatePickList();
    if (list.some((a) => a.barCouncilNumber.trim().toUpperCase() === norm)) return;
    const next = [...list, adv].sort((a, b) =>
      (a.fullName || '').localeCompare(b.fullName || '', undefined, { sensitivity: 'base' })
    );
    this.advocatePickList.set(next);
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
