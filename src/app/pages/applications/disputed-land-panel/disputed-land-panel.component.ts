import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import {
  LandRecordsService,
  RuralDistrict,
  RuralTaluka,
  RuralVillage,
  RuralSubSurveyRow,
  UrbanDistrict,
  UrbanOffice,
  UrbanVillage,
  UrbanCtsRow
} from '../../../services/land-records.service';

export type DisputedLandType = 'RURAL_7_12' | 'URBAN_PROPERTY_CARD';

export type DisputedLandRow =
  | {
      type: 'RURAL_7_12';
      districtCode: string;
      districtName: string;
      talukaCode: string;
      talukaName: string;
      villageLgdCode: string;
      villageName: string;
      pin: string;
      pinParts: Omit<RuralSubSurveyRow, 'pin'>;
      /** Mahabhumi land area / 7/12 detail rows from land-detail-survey-wise API. */
      landDetail?: Record<string, unknown>[];
    }
  | {
      type: 'URBAN_PROPERTY_CARD';
      districtCode: string;
      districtName: string;
      officeCode: string;
      officeName: string;
      villageCode: string;
      villageName: string;
      parentCtsNo: string;
      ctsNo: string;
      subCtsNo?: string;
      propertyDetail?: Record<string, unknown>;
    };

@Component({
  selector: 'app-disputed-land-panel',
  imports: [],
  templateUrl: './disputed-land-panel.component.html',
  styleUrl: './disputed-land-panel.component.css'
})
export class DisputedLandPanelComponent implements OnInit {
  private readonly api = inject(LandRecordsService);

  /** Disputed lands list owned by parent; emit when user adds/removes. */
  disputedLands = input<DisputedLandRow[]>([]);
  disputedLandsChange = output<DisputedLandRow[]>();

  // ── Pre-fill inputs from Step 1 ePICS urban search ────────────────────────
  // The parent binds these from its live form controls. On a page refresh the
  // values come from sessionStorage via readStoredEpicsFields() instead.
  prefilledDistrictCode = input<string>('');
  prefilledOfficeCode   = input<string>('');
  prefilledVillageCode  = input<string>('');
  prefilledCtsNo        = input<string>('');
  prefilledSubCtsNo     = input<string>('');
  isEpicsSubject        = input<boolean>(false);

  protected readonly mode = signal<DisputedLandType>('RURAL_7_12');

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  // Rural chain
  protected readonly ruralDistricts = signal<RuralDistrict[]>([]);
  protected readonly ruralTalukas = signal<RuralTaluka[]>([]);
  protected readonly ruralVillages = signal<RuralVillage[]>([]);
  protected readonly ruralSubSurveyRows = signal<RuralSubSurveyRow[]>([]);
  protected readonly ruralDistrictCode = signal('');
  protected readonly ruralTalukaCode = signal('');
  protected readonly ruralVillageLgdCode = signal('');
  protected readonly ruralPin = signal('');

  // Urban chain
  protected readonly urbanDistricts = signal<UrbanDistrict[]>([]);
  protected readonly urbanOffices = signal<UrbanOffice[]>([]);
  protected readonly urbanVillages = signal<UrbanVillage[]>([]);
  protected readonly urbanSubCtsRows = signal<UrbanCtsRow[]>([]);
  protected readonly urbanPropertyDetails = signal<Record<string, unknown>[]>([]);
  protected readonly urbanDistrictCode = signal('');
  protected readonly urbanOfficeCode = signal('');
  protected readonly urbanVillageCode = signal('');
  protected readonly urbanParentCts = signal('');
  protected readonly urbanSelectedSubCts = signal('');
  protected readonly loadingSubCts = signal(false);
  protected readonly loadingPropertyDetails = signal(false);

  /**
   * Stores the user-entered disputed_area value for each property detail row.
   * Key is the row index (as string). Cleared whenever urbanPropertyDetails resets.
   */
  protected readonly disputedAreaMap = signal<Record<string, string>>({});

  protected getDisputedArea(rowIndex: number): string {
    return this.disputedAreaMap()[String(rowIndex)] ?? '';
  }

  protected setDisputedArea(rowIndex: number, value: string): void {
    this.disputedAreaMap.update((prev) => ({ ...prev, [String(rowIndex)]: value }));
  }

  protected readonly ruralLandDetailPreview = signal<Record<string, unknown>[]>([]);
  protected readonly loadingRuralLandDetail = signal(false);
  protected readonly ruralLandDetailPreviewKey = signal<string | null>(null);

  protected readonly ruralLandDetailColumns = computed(() => {
    const rows = this.ruralLandDetailPreview();
    if (!rows.length) return [] as string[];
    const keys = new Set<string>();
    for (const row of rows.slice(0, 10)) {
      Object.keys(row).forEach((k) => keys.add(k));
    }
    return Array.from(keys);
  });

  protected readonly canLoadUrbanSubCts = computed(() => {
    return (
      this.urbanDistrictCode().trim() !== '' &&
      this.urbanOfficeCode().trim() !== '' &&
      this.urbanVillageCode().trim() !== '' &&
      this.urbanParentCts().trim() !== ''
    );
  });

  protected readonly urbanPropertyColumns = computed(() => {
    const rows = this.urbanPropertyDetails();
    if (!rows.length) return [] as string[];
    const keys = new Set<string>();
    for (const row of rows.slice(0, 10)) {
      Object.keys(row).forEach((k) => keys.add(k));
    }
    return Array.from(keys);
  });

  constructor() {
    this.loadMasters();
  }

  // ── ngOnInit: run prefill exactly once after inputs are set ───────────────
  ngOnInit(): void {
    // Prefer live input() values (normal navigation); fall back to
    // sessionStorage so a page refresh / direct URL still works.
    const stored   = this.readStoredEpicsFields();
    const district = (this.prefilledDistrictCode().trim() || stored.districtCode).trim();
    const office   = (this.prefilledOfficeCode().trim()   || stored.officeCode).trim();
    const village  = (this.prefilledVillageCode().trim()  || stored.villageCode).trim();
    const cts      = (this.prefilledCtsNo().trim()        || stored.ctsNo).trim();
    const subCts   = (this.prefilledSubCtsNo().trim()     || stored.subCtsNo).trim();
    const isEpics  =  this.isEpicsSubject() || stored.isEpics;

    if (!isEpics || !district || !office || !village) return;

    this.applyUrbanPrefill(district, office, village, cts, subCts);
  }

  // ── Read ePICS fields from the parent's sessionStorage snapshot ───────────
  private readStoredEpicsFields(): {
    districtCode: string;
    officeCode: string;
    villageCode: string;
    ctsNo: string;
    subCtsNo: string;
    isEpics: boolean;
  } {
    const empty = {
      districtCode: '',
      officeCode: '',
      villageCode: '',
      ctsNo: '',
      subCtsNo: '',
      isEpics: false
    };
    try {
      // The parent writes keys like: rccms.category1.filing.v2.case2
      const prefix = 'rccms.category1.filing.v';
      const key = Object.keys(sessionStorage).find((k) => k.startsWith(prefix));
      if (!key) return empty;

      const raw = sessionStorage.getItem(key);
      if (!raw) return empty;

      const snap = JSON.parse(raw) as {
        form?: {
          urbanDistrictCode?: string;
          urbanOfficeCode?: string;
          urbanVillageCode?: string;
          ctsNoInput?: string;
          selectedSubCtsNo?: string;
        };
        selectedSubject?: { subjectCode?: string; subjectName?: string } | null;
      };

      const f = snap?.form ?? {};

      // Mirror the parent's isEpicsSubject() computed logic exactly
      const subjectCode = String(snap?.selectedSubject?.subjectCode ?? '').trim().toUpperCase();
      const subjectName = String(snap?.selectedSubject?.subjectName ?? '').trim().toUpperCase();
      const isEpics =
        subjectCode === '002' ||
        subjectName.includes('EPICS') ||
        subjectName.includes('EPCS');

      return {
        districtCode: String(f.urbanDistrictCode ?? '').trim(),
        officeCode:   String(f.urbanOfficeCode   ?? '').trim(),
        villageCode:  String(f.urbanVillageCode  ?? '').trim(),
        ctsNo:        String(f.ctsNoInput        ?? '').trim(),
        subCtsNo:     String(f.selectedSubCtsNo  ?? '').trim(),
        isEpics,
      };
    } catch {
      return empty;
    }
  }

  // ── Prefill chain ─────────────────────────────────────────────────────────

  /**
   * Step 1: Switch to urban mode, set all code signals, restore the office
   * and village dropdown lists (so <select> renders the correct option),
   * then kick off the sub-CTS load.
   */
  private applyUrbanPrefill(
    districtCode: string,
    officeCode: string,
    villageCode: string,
    ctsNo: string,
    subCtsNo: string
  ): void {
    this.mode.set('URBAN_PROPERTY_CARD');
    this.error.set(null);
    this.urbanDistrictCode.set(districtCode);
    this.urbanOfficeCode.set(officeCode);
    this.urbanVillageCode.set(villageCode);
    this.urbanParentCts.set(ctsNo);
    this.urbanSelectedSubCts.set('');
    this.urbanSubCtsRows.set([]);
    this.urbanPropertyDetails.set([]);

    this.loading.set(true);

    // Restore office dropdown (fire-and-forget; village load drives the chain)
    this.api.getUrbanOffices(districtCode).subscribe({
      next:  (rows) => this.urbanOffices.set(rows ?? []),
      error: (e)    => this.error.set(this.formatError(e))
    });

    // Restore village dropdown, then continue chain
    this.api.getUrbanVillages(officeCode).subscribe({
      next: (rows) => {
        this.urbanVillages.set(rows ?? []);
        this.loading.set(false);
        if (ctsNo) {
          this.prefillLoadSubCts(villageCode, ctsNo, subCtsNo);
        }
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(this.formatError(e));
      }
    });
  }

  /**
   * Step 2: Load the sub-CTS list for the village + parent CTS.
   * If a subCtsNo was already selected in Step 1, resolve and select it,
   * then immediately fetch property details.
   */
  private prefillLoadSubCts(
    villageCode: string,
    ctsNo: string,
    subCtsNo: string
  ): void {
    this.loadingSubCts.set(true);
    this.api
      .getUrbanSubCtsList(villageCode, ctsNo)
      .pipe(finalize(() => this.loadingSubCts.set(false)))
      .subscribe({
        next: (rows) => {
          this.urbanSubCtsRows.set(rows ?? []);

          if (!rows?.length) {
            // Sub-CTS list is empty — still show the selects, user can retry
            return;
          }

          if (!subCtsNo) {
            // No sub-CTS was chosen in Step 1 — show the populated dropdown
            // and let the user pick manually
            return;
          }

          // Find the matching row by label (same logic as ctsRowLabel)
          const match    = rows.find((r) => this.ctsRowLabel(r) === subCtsNo);
          const resolved = match ? this.ctsRowLabel(match) : subCtsNo;
          this.urbanSelectedSubCts.set(resolved);

          // Auto-trigger property details fetch → table renders automatically
          this.prefillLoadPropertyDetails(villageCode, resolved);
        },
        error: (e) => this.error.set(this.formatError(e))
      });
  }

  /**
   * Step 3: Fetch the property detail rows for the resolved sub-CTS.
   * This is what populates the table — same API as onUrbanSubCtsChange().
   */
  private prefillLoadPropertyDetails(
    villageCode: string,
    subCtsNo: string
  ): void {
    this.loadingPropertyDetails.set(true);
    this.api
      .getUrbanPropertyDetails(villageCode, subCtsNo)
      .pipe(finalize(() => this.loadingPropertyDetails.set(false)))
      .subscribe({
        next: (rows) => {
          this.urbanPropertyDetails.set(rows ?? []);
          if (!rows?.length) {
            this.error.set('No property details found for the pre-selected sub-CTS.');
          }
        },
        error: (e) => this.error.set(this.formatError(e))
      });
  }

  // ── All original methods below — unchanged ────────────────────────────────

  protected setMode(next: DisputedLandType): void {
    const hasModeChanged = this.mode() !== next;
    this.mode.set(next);
    this.error.set(null);
    this.ruralSubSurveyRows.set([]);
    this.ruralLandDetailPreview.set([]);
    this.ruralLandDetailPreviewKey.set(null);
    this.urbanSubCtsRows.set([]);
    this.urbanPropertyDetails.set([]);
    this.disputedAreaMap.set({});
    this.ruralDistrictCode.set('');
    this.ruralTalukaCode.set('');
    this.ruralVillageLgdCode.set('');
    this.ruralPin.set('');
    this.ruralTalukas.set([]);
    this.ruralVillages.set([]);
    this.urbanDistrictCode.set('');
    this.urbanOfficeCode.set('');
    this.urbanVillageCode.set('');
    this.urbanParentCts.set('');
    this.urbanSelectedSubCts.set('');
    this.urbanOffices.set([]);
    this.urbanVillages.set([]);

    // If disputed land type changes, previously added rows should be cleared.
    if (hasModeChanged && this.disputedLands().length > 0) {
      this.disputedLandsChange.emit([]);
    }
  }

  protected loadMasters(): void {
    this.loading.set(true);
    this.error.set(null);
    // Parallel loads
    this.api.getRuralDistricts().subscribe({
      next: (rows) => this.ruralDistricts.set(rows),
      error: (e) => this.error.set(this.formatError(e))
    });
    this.api.getUrbanDistricts().subscribe({
      next: (rows) => this.urbanDistricts.set(rows),
      error: (e) => this.error.set(this.formatError(e)),
      complete: () => this.loading.set(false)
    });
  }

  protected onRuralDistrictChange(code: string): void {
    this.ruralDistrictCode.set(code);
    this.ruralTalukaCode.set('');
    this.ruralVillageLgdCode.set('');
    this.ruralTalukas.set([]);
    this.ruralVillages.set([]);
    this.ruralSubSurveyRows.set([]);
    if (!code) return;
    this.loading.set(true);
    this.api.getRuralTalukas(code).subscribe({
      next: (rows) => this.ruralTalukas.set(rows),
      error: (e) => this.error.set(this.formatError(e)),
      complete: () => this.loading.set(false)
    });
  }

  protected onRuralTalukaChange(code: string): void {
    this.ruralTalukaCode.set(code);
    this.ruralVillageLgdCode.set('');
    this.ruralVillages.set([]);
    this.ruralSubSurveyRows.set([]);
    const dist = this.ruralDistrictCode();
    if (!dist || !code) return;
    this.loading.set(true);
    this.api.getRuralVillages(dist, code).subscribe({
      next: (rows) => this.ruralVillages.set(rows),
      error: (e) => this.error.set(this.formatError(e)),
      complete: () => this.loading.set(false)
    });
  }

  protected onRuralVillageChange(lgdCode: string): void {
    this.ruralVillageLgdCode.set(lgdCode);
    this.ruralSubSurveyRows.set([]);
    this.ruralLandDetailPreview.set([]);
    this.ruralLandDetailPreviewKey.set(null);
  }

  protected setRuralPin(v: string): void {
    this.ruralPin.set(v);
  }

  protected searchRural(): void {
    const village = this.ruralVillageLgdCode().trim();
    const pin = this.ruralPin().trim();
    if (!this.ruralDistrictCode().trim()) {
      this.error.set('Please select district.');
      return;
    }
    if (!this.ruralTalukaCode().trim()) {
      this.error.set('Please select taluka.');
      return;
    }
    if (!village) {
      this.error.set('Please select village.');
      return;
    }
    if (!pin) {
      this.error.set('Please enter survey number (pin).');
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    this.ruralSubSurveyRows.set([]);
    this.ruralLandDetailPreview.set([]);
    this.ruralLandDetailPreviewKey.set(null);
    this.api
      .getRuralSubSurveyList(village, pin)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (rows) => {
          this.ruralSubSurveyRows.set(rows || []);
          if (!rows?.length) {
            this.error.set('No 7/12 records found for this survey number.');
          }
        },
        error: (e) => this.error.set(this.formatError(e))
      });
  }

  protected ruralPinLabel(r: RuralSubSurveyRow): string {
    const parts = [r.pin1, r.pin2, r.pin3, r.pin4, r.pin5, r.pin6, r.pin7, r.pin8]
      .map((x) => String(x || '').trim())
      .filter(Boolean);
    return parts.length ? parts.join('') : '—';
  }

  protected ruralRowPreviewKey(r: RuralSubSurveyRow): string {
    const v = this.ruralVillageLgdCode().trim();
    return `${v}|${r.pin}|${r.pin1}|${r.pin2}|${r.pin3}|${r.pin4}|${r.pin5}|${r.pin6}|${r.pin7}|${r.pin8}`;
  }

  protected loadRuralLandDetailPreview(_r: RuralSubSurveyRow): void {
    this.error.set('Land area details (G2B) are temporarily disabled.');
  }

  protected addRuralRow(r: RuralSubSurveyRow): void {
    const dist = this.ruralDistricts().find((d) => d.district_code.trim() === this.ruralDistrictCode().trim());
    const tal = this.ruralTalukas().find((t) => t.taluka_code.trim() === this.ruralTalukaCode().trim());
    const vil = this.ruralVillages().find((v) => v.lgd_village_code.trim() === this.ruralVillageLgdCode().trim());
    if (!dist || !tal || !vil) return;
    const key = `RURAL|${this.ruralVillageLgdCode().trim()}|${r.pin}|${r.pin1}|${r.pin2}|${r.pin3}|${r.pin4}|${r.pin5}|${r.pin6}|${r.pin7}|${r.pin8}`;
    const existing = this.disputedLands();
    if (existing.some((x) => this.keyOf(x) === key)) {
      this.error.set('This plot is already added.');
      return;
    }
    this.disputedLandsChange.emit([
      ...existing,
      {
        type: 'RURAL_7_12',
        districtCode: dist.district_code.trim(),
        districtName: dist.district_name,
        talukaCode: tal.taluka_code.trim(),
        talukaName: tal.taluka_name,
        villageLgdCode: vil.lgd_village_code.trim(),
        villageName: vil.village_name,
        pin: r.pin,
        pinParts: {
          pin1: r.pin1,
          pin2: r.pin2,
          pin3: r.pin3,
          pin4: r.pin4,
          pin5: r.pin5,
          pin6: r.pin6,
          pin7: r.pin7,
          pin8: r.pin8
        }
      }
    ]);
  }

  protected onUrbanDistrictChange(code: string): void {
    this.urbanDistrictCode.set(code);
    this.urbanOfficeCode.set('');
    this.urbanVillageCode.set('');
    this.urbanOffices.set([]);
    this.urbanVillages.set([]);
    this.urbanSubCtsRows.set([]);
    this.urbanPropertyDetails.set([]);
    this.disputedAreaMap.set({});
    this.urbanParentCts.set('');
    this.urbanSelectedSubCts.set('');
    if (!code) return;
    this.loading.set(true);
    this.api.getUrbanOffices(code).subscribe({
      next: (rows) => this.urbanOffices.set(rows),
      error: (e) => this.error.set(this.formatError(e)),
      complete: () => this.loading.set(false)
    });
  }

  protected onUrbanOfficeChange(code: string): void {
    this.urbanOfficeCode.set(code);
    this.urbanVillageCode.set('');
    this.urbanVillages.set([]);
    this.urbanSubCtsRows.set([]);
    this.urbanPropertyDetails.set([]);
    this.disputedAreaMap.set({});
    this.urbanParentCts.set('');
    this.urbanSelectedSubCts.set('');
    if (!code) return;
    this.loading.set(true);
    this.api.getUrbanVillages(code).subscribe({
      next: (rows) => this.urbanVillages.set(rows),
      error: (e) => this.error.set(this.formatError(e)),
      complete: () => this.loading.set(false)
    });
  }

  protected onUrbanVillageChange(code: string): void {
    this.urbanVillageCode.set(code);
    this.urbanSubCtsRows.set([]);
    this.urbanPropertyDetails.set([]);
    this.disputedAreaMap.set({});
    this.urbanParentCts.set('');
    this.urbanSelectedSubCts.set('');
  }

  protected setUrbanParentCts(v: string): void {
    this.urbanParentCts.set(v);
    this.urbanSubCtsRows.set([]);
    this.urbanPropertyDetails.set([]);
    this.disputedAreaMap.set({});
    this.urbanSelectedSubCts.set('');
  }

  protected loadUrbanSubCts(): void {
    if (!this.canLoadUrbanSubCts()) {
      this.error.set('Select district, office, village and enter CTS number.');
      return;
    }
    const villageCode = this.urbanVillageCode().trim();
    const parentCts = this.urbanParentCts().trim();
    this.loadingSubCts.set(true);
    this.error.set(null);
    this.urbanSubCtsRows.set([]);
    this.urbanPropertyDetails.set([]);
    this.disputedAreaMap.set({});
    this.urbanSelectedSubCts.set('');
    this.api
      .getUrbanSubCtsList(villageCode, parentCts)
      .pipe(finalize(() => this.loadingSubCts.set(false)))
      .subscribe({
        next: (rows) => {
          this.urbanSubCtsRows.set(rows || []);
          if (!rows?.length) {
            this.error.set('No sub-CTS found for this CTS number.');
          }
        },
        error: (e) => this.error.set(this.formatError(e))
      });
  }

  protected onUrbanSubCtsChange(subCtsNo: string): void {
    this.urbanSelectedSubCts.set(subCtsNo);
    this.urbanPropertyDetails.set([]);
    this.disputedAreaMap.set({});
    if (!subCtsNo.trim()) return;
    const villageCode = this.urbanVillageCode().trim();
    this.loadingPropertyDetails.set(true);
    this.error.set(null);
    this.api
      .getUrbanPropertyDetails(villageCode, subCtsNo.trim())
      .pipe(finalize(() => this.loadingPropertyDetails.set(false)))
      .subscribe({
        next: (rows) => {
          this.urbanPropertyDetails.set(rows || []);
          if (!rows?.length) {
            this.error.set('No property / area details found for selected sub-CTS.');
          }
        },
        error: (e) => this.error.set(this.formatError(e))
      });
  }

  protected ctsRowLabel(row: UrbanCtsRow): string {
    return (row.new_cts_numb_2000 || row.cts_no || '').trim();
  }

  protected formatPropertyCell(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  protected addUrbanPropertyRow(row: Record<string, unknown>, index: number): void {
    this.pushUrbanDisputedLand(row, index, this.getDisputedArea(index));
  }

  protected addUrbanSelection(): void {
    const rows = this.urbanPropertyDetails();
    if (rows.length === 1) {
      this.pushUrbanDisputedLand(rows[0], 0, this.getDisputedArea(0));
      return;
    }
    if (rows.length > 1) {
      this.error.set('Select Add on the property row you want to include.');
      return;
    }
    this.pushUrbanDisputedLand({}, 0, '');
  }

  private pushUrbanDisputedLand(row: Record<string, unknown>, index: number, disputedArea: string): void {
    const dist = this.urbanDistricts().find((d) => d.district_code.trim() === this.urbanDistrictCode().trim());
    const off = this.urbanOffices().find((o) => o.office_code.trim() === this.urbanOfficeCode().trim());
    const vil = this.urbanVillages().find((v) => v.village_code.trim() === this.urbanVillageCode().trim());
    const parentCts = this.urbanParentCts().trim();
    const subCts = this.urbanSelectedSubCts().trim();
    if (!dist || !off || !vil) {
      this.error.set('Select district, office and village.');
      return;
    }
    if (!parentCts) {
      this.error.set('Enter CTS number.');
      return;
    }
    if (!subCts) {
      this.error.set('Select sub-CTS number.');
      return;
    }
    const rowKey = this.propertyRowKey(row, index);
    const key = `URBAN|${vil.village_code.trim()}|${parentCts}|${subCts}|${rowKey}`;
    const existing = this.disputedLands();
    if (existing.some((x) => this.keyOf(x) === key)) {
      this.error.set('This property row is already added.');
      return;
    }
    this.disputedLandsChange.emit([
      ...existing,
      {
        type: 'URBAN_PROPERTY_CARD',
        districtCode: dist.district_code.trim(),
        districtName: dist.district_name,
        officeCode: off.office_code.trim(),
        officeName: off.office_english_name || off.office_name,
        villageCode: vil.village_code.trim(),
        villageName: vil.village_english_name || vil.village_name,
        parentCtsNo: parentCts,
        ctsNo: subCts,
        subCtsNo: subCts,
        propertyDetail: {
          ...(Object.keys(row).length ? row : {}),
          ...(disputedArea.trim() ? { disputed_area: disputedArea.trim() } : {})
        } as Record<string, unknown>
      }
    ]);
    this.error.set(null);
  }

  private propertyRowKey(row: Record<string, unknown>, index: number): string {
    const prefer = ['id', 'sr_no', 'srNo', 'flat_no', 'flatNo', 'unit_no', 'unitNo', 'area', 'plot_no', 'plotNo'];
    for (const k of prefer) {
      const v = row[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return `row-${index}`;
  }

  protected remove(index: number): void {
    const list = [...this.disputedLands()];
    list.splice(index, 1);
    this.disputedLandsChange.emit(list);
  }

  protected keyOf(row: DisputedLandRow): string {
    if (row.type === 'RURAL_7_12') {
      const p = row.pinParts;
      return `RURAL|${row.villageLgdCode}|${row.pin}|${p.pin1}|${p.pin2}|${p.pin3}|${p.pin4}|${p.pin5}|${p.pin6}|${p.pin7}|${p.pin8}`;
    }
    const parent = row.parentCtsNo || row.ctsNo;
    const sub = row.subCtsNo || row.ctsNo;
    const detail = row.propertyDetail;
    const detailKey = detail ? this.propertyRowKey(detail, 0) : '';
    return `URBAN|${row.villageCode}|${parent}|${sub}|${detailKey}`;
  }

  private formatError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { error?: string; message?: string } | null;
      if (body && typeof body.error === 'string') return body.error;
      if (body && typeof body.message === 'string') return body.message;
      return `Request failed (${err.status}).`;
    }
    return 'Request failed.';
  }
}

/* disputed_area column appended — no other styles changed */
