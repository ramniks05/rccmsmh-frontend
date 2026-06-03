import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
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
import {
  buildUrbanPropertyTableLayout,
  formatLandDisplayValue,
  formatRuralPinParts,
  readLandRowValue
} from '../../../shared/land-display.util';

export type DisputedLandType = 'RURAL_7_12' | 'URBAN_PROPERTY_CARD';

/** Rural location + survey from filing step 1 (no re-search on disputed land step). */
export interface RuralDisputedLandContext {
  districtCode: string;
  districtName: string;
  talukaCode: string;
  talukaName: string;
  villageLgdCode: string;
  villageName: string;
  surveyPin: string;
}

/** Stable per-table-row id stored in propertyDetail when a row is added. */
const PROPERTY_ROW_ID_KEY = '__propertyRowKey';

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

export interface EpicsMutationPropertyLookup {
  villageCode: string;
  ctsNo: string;
  districtName: string;
}

@Component({
  selector: 'app-disputed-land-panel',
  imports: [],
  templateUrl: './disputed-land-panel.component.html',
  styleUrl: './disputed-land-panel.component.css'
})
export class DisputedLandPanelComponent {
  private readonly api = inject(LandRecordsService);
  private urbanPrefillStarted = false;

  /** Disputed lands list owned by parent; emit when user adds/removes. */
  disputedLands = input<DisputedLandRow[]>([]);
  disputedLandsChange = output<DisputedLandRow[]>();

  /** Land type fixed from step 1 — no selection on this step. */
  landModeFromStep1 = input.required<DisputedLandType>();

  /** Rural: plots returned by the land search step. */
  ruralPlotsFromStep1 = input<RuralSubSurveyRow[]>([]);

  /** Rural: district / taluka / village / pin from step 1. */
  ruralContext = input<RuralDisputedLandContext | null>(null);

  // Urban pre-fill from step 1 (live form or sessionStorage on refresh).
  prefilledDistrictCode = input<string>('');
  prefilledOfficeCode = input<string>('');
  prefilledVillageCode = input<string>('');
  prefilledCtsNo = input<string>('');
  prefilledSubCtsNo = input<string>('');
  isEpicsSubject = input<boolean>(false);
  /** Inward-number mutation search: village + CTS when urban location fields are empty. */
  epicsMutationPropertyLookup = input<EpicsMutationPropertyLookup | null>(null);

  protected readonly mode = signal<DisputedLandType>('URBAN_PROPERTY_CARD');
  /** True when property rows were loaded from step-1 inward mutation (no district/office on form). */
  private readonly inwardMutationLandMode = signal(false);

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
  protected readonly disputedAreaErrors = signal<Record<string, string>>({});

  protected getDisputedArea(rowIndex: number, row?: Record<string, unknown>): string {
    const mapped = this.disputedAreaMap()[String(rowIndex)];
    if (mapped != null && mapped !== '') return mapped;
    const source = row ?? this.urbanPropertyDetails()[rowIndex];
    return source ? this.extractTotalArea(source) : '';
  }

  protected getDisputedAreaError(rowIndex: number): string | null {
    return this.disputedAreaErrors()[String(rowIndex)] ?? null;
  }

  protected isDisputedAreaInvalid(rowIndex: number, _row: Record<string, unknown>): boolean {
    return !!this.getDisputedAreaError(rowIndex);
  }

  protected setDisputedArea(rowIndex: number, value: string, row?: Record<string, unknown>): void {
    this.disputedAreaMap.update((prev) => ({ ...prev, [String(rowIndex)]: value }));
    const sourceRow = row ?? this.urbanPropertyDetails()[rowIndex];
    const err = sourceRow ? this.validateDisputedAreaAgainstTotal(value, sourceRow) : null;
    this.disputedAreaErrors.update((prev) => {
      const next = { ...prev };
      if (err) next[String(rowIndex)] = err;
      else delete next[String(rowIndex)];
      return next;
    });
  }

  private parseAreaNumber(value: string): number | null {
    const trimmed = value.trim().replace(/,/g, '');
    if (!trimmed) return null;
    const match = trimmed.match(/-?\d+(\.\d+)?/);
    if (!match) return null;
    const n = Number(match[0]);
    return Number.isFinite(n) ? n : null;
  }

  private validateDisputedAreaAgainstTotal(
    disputed: string,
    row: Record<string, unknown>
  ): string | null {
    const disputedTrim = disputed.trim();
    if (!disputedTrim) return 'Enter disputed area.';

    const disputedNum = this.parseAreaNumber(disputedTrim);
    if (disputedNum == null) return 'Enter a valid disputed area.';
    if (disputedNum <= 0) return 'Disputed area must be greater than zero.';

    const totalStr = this.extractTotalArea(row);
    if (!totalStr) return null;

    const totalNum = this.parseAreaNumber(totalStr);
    if (totalNum == null) return null;

    if (disputedNum > totalNum) {
      return `Disputed area cannot exceed total area (${totalStr}).`;
    }
    return null;
  }

  /** Default disputed_area from API total_area (user may edit before Add). */
  protected extractTotalArea(row: Record<string, unknown>): string {
    const keys = [
      'total_area',
      'totalArea',
      'TOTAL_AREA',
      'built_up_area',
      'builtUpArea',
      'carpet_area',
      'carpetArea',
      'open_area',
      'openArea',
      'area',
      'AREA'
    ];
    for (const key of keys) {
      const v = row[key];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }

  private seedDisputedAreaDefaults(rows: Record<string, unknown>[]): void {
    const next: Record<string, string> = {};
    rows.forEach((row, index) => {
      const area = this.extractTotalArea(row);
      if (area) next[String(index)] = area;
    });
    this.disputedAreaMap.set(next);
    this.disputedAreaErrors.set({});
  }

  private clearDisputedAreaState(): void {
    this.disputedAreaMap.set({});
    this.disputedAreaErrors.set({});
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

  protected readonly urbanPropertyTableLayout = computed(() =>
    buildUrbanPropertyTableLayout(this.urbanPropertyDetails())
  );

  protected readonly addedUrbanEntries = computed(() => {
    const entries: Array<{ landIndex: number; detail: Record<string, unknown> }> = [];
    this.disputedLands().forEach((x, landIndex) => {
      if (x.type !== 'URBAN_PROPERTY_CARD') return;
      const detail = x.propertyDetail;
      if (!detail || !Object.keys(detail).length) return;
      entries.push({ landIndex, detail });
    });
    return entries;
  });

  protected readonly addedRuralEntries = computed(() => {
    const entries: Array<{ landIndex: number; row: Extract<DisputedLandRow, { type: 'RURAL_7_12' }> }> = [];
    this.disputedLands().forEach((x, landIndex) => {
      if (x.type === 'RURAL_7_12') {
        entries.push({ landIndex, row: x });
      }
    });
    return entries;
  });

  protected urbanPropertyCell(row: Record<string, unknown>, key: string): string {
    const v = readLandRowValue(row, key);
    return v || '—';
  }

  protected urbanPropertyTotalArea(row: Record<string, unknown>): string {
    const v = this.extractTotalArea(row);
    return v || '—';
  }

  protected urbanTableColumnsWithoutTotalArea(columns: { key: string; label: string }[]): { key: string; label: string }[] {
    const skipLabels = new Set(['total area', 'office', 'village', 'district', 'taluka']);
    return columns.filter((c) => {
      const label = c.label.trim().toLowerCase();
      if (skipLabels.has(label)) return false;
      const key = c.key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (key === 'totalarea') return false;
      if (key.includes('office') || key.includes('village') || key === 'district' || key.includes('districtname')) {
        return false;
      }
      if (key.includes('taluka')) return false;
      return true;
    });
  }

  protected formatPropertyCell(value: unknown): string {
    return formatLandDisplayValue(value);
  }

  protected ruralSubSurveyLabel(parts: Omit<RuralSubSurveyRow, 'pin'>): string {
    return formatRuralPinParts(parts) || '—';
  }

  protected addedUrbanDisputedArea(detail: Record<string, unknown>): string {
    const v = formatLandDisplayValue(detail['disputed_area']);
    return v || '—';
  }

  constructor() {
    effect(() => {
      if (this.urbanPrefillStarted) return;

      const mode = this.landModeFromStep1();
      this.mode.set(mode);
      if (mode === 'RURAL_7_12') return;

      const stored = this.readStoredEpicsFields();
      const isEpics = this.isEpicsSubject() || stored.isEpics;
      if (!isEpics) {
        this.error.set('Select an ePICS subject and complete step 1 before adding disputed land.');
        return;
      }

      const district = (this.prefilledDistrictCode().trim() || stored.districtCode).trim();
      const office = (this.prefilledOfficeCode().trim() || stored.officeCode).trim();
      const village = (this.prefilledVillageCode().trim() || stored.villageCode).trim();
      const cts = (this.prefilledCtsNo().trim() || stored.ctsNo).trim();
      const subCts = (this.prefilledSubCtsNo().trim() || stored.subCtsNo).trim();

      const mutationLookup =
        this.epicsMutationPropertyLookup() ?? stored.mutationPropertyLookup;

      if (district && office && village) {
        this.urbanPrefillStarted = true;
        this.inwardMutationLandMode.set(false);
        this.applyUrbanPrefill(district, office, village, cts, subCts);
        return;
      }

      if (mutationLookup?.villageCode && mutationLookup.ctsNo) {
        this.urbanPrefillStarted = true;
        this.applyInwardMutationPrefill(mutationLookup);
        return;
      }

      this.error.set(
        'Complete urban property search on step 1, or search by inward number so village and CTS are available.'
      );
    });
  }

  // ── Read ePICS fields from the parent's sessionStorage snapshot ───────────
  private readStoredEpicsFields(): {
    districtCode: string;
    officeCode: string;
    villageCode: string;
    ctsNo: string;
    subCtsNo: string;
    isEpics: boolean;
    mutationPropertyLookup: EpicsMutationPropertyLookup | null;
  } {
    const empty = {
      districtCode: '',
      officeCode: '',
      villageCode: '',
      ctsNo: '',
      subCtsNo: '',
      isEpics: false,
      mutationPropertyLookup: null as EpicsMutationPropertyLookup | null
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
        mutationDetails?: {
          villageCode?: string;
          ctsNumber?: string;
          districtName?: string;
        } | null;
        mutationFound?: boolean;
      };

      const f = snap?.form ?? {};

      // Mirror the parent's isEpicsSubject() computed logic exactly
      const subjectCode = String(snap?.selectedSubject?.subjectCode ?? '').trim().toUpperCase();
      const subjectName = String(snap?.selectedSubject?.subjectName ?? '').trim().toUpperCase();
      const isEpics =
        subjectCode === '002' ||
        subjectName.includes('EPICS') ||
        subjectName.includes('EPCS');

      const md = snap?.mutationDetails;
      const mutationVillage = String(md?.villageCode ?? '').trim();
      const mutationCts = String(md?.ctsNumber ?? '').trim();
      const mutationPropertyLookup =
        snap?.mutationFound && mutationVillage && mutationCts
          ? {
              villageCode: mutationVillage,
              ctsNo: mutationCts,
              districtName: String(md?.districtName ?? '').trim()
            }
          : null;

      return {
        districtCode: String(f.urbanDistrictCode ?? '').trim(),
        officeCode:   String(f.urbanOfficeCode   ?? '').trim(),
        villageCode:  String(f.urbanVillageCode  ?? '').trim(),
        ctsNo:        String(f.ctsNoInput        ?? '').trim(),
        subCtsNo:     String(f.selectedSubCtsNo  ?? '').trim(),
        isEpics,
        mutationPropertyLookup
      };
    } catch {
      return empty;
    }
  }

  // ── Prefill chain ─────────────────────────────────────────────────────────

  /** Step-1 inward mutation search: load property table using village + CTS only. */
  private applyInwardMutationPrefill(lookup: EpicsMutationPropertyLookup): void {
    this.mode.set('URBAN_PROPERTY_CARD');
    this.inwardMutationLandMode.set(true);
    this.error.set(null);
    this.urbanVillageCode.set(lookup.villageCode);
    this.urbanParentCts.set(lookup.ctsNo);
    this.urbanSelectedSubCts.set(lookup.ctsNo);
    this.urbanPropertyDetails.set([]);
    this.clearDisputedAreaState();
    this.prefillLoadPropertyDetails(lookup.villageCode, lookup.ctsNo);
  }

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
          const list = rows ?? [];
          this.urbanPropertyDetails.set(list);
          this.seedDisputedAreaDefaults(list);
          if (!list.length) {
            this.error.set('No property details found for the pre-selected sub-CTS.');
          }
        },
        error: (e) => this.error.set(this.formatError(e))
      });
  }

  // ── All original methods below — unchanged ────────────────────────────────

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
    return formatRuralPinParts(r) || '—';
  }

  protected ruralRowPreviewKey(r: RuralSubSurveyRow): string {
    const v = this.ruralVillageLgdCode().trim();
    return `${v}|${r.pin}|${r.pin1}|${r.pin2}|${r.pin3}|${r.pin4}|${r.pin5}|${r.pin6}|${r.pin7}|${r.pin8}`;
  }

  protected loadRuralLandDetailPreview(_r: RuralSubSurveyRow): void {
    this.error.set('Land area details (G2B) are temporarily disabled.');
  }

  protected isRuralPlotAdded(r: RuralSubSurveyRow): boolean {
    const key = this.buildRuralPlotAddKey(r);
    return !!key && this.disputedLands().some((x) => this.keyOf(x) === key);
  }

  private buildRuralPlotAddKey(r: RuralSubSurveyRow): string | null {
    const ctx = this.ruralContext();
    const village = ctx?.villageLgdCode?.trim();
    if (!village) return null;
    return `RURAL|${village}|${r.pin}|${r.pin1}|${r.pin2}|${r.pin3}|${r.pin4}|${r.pin5}|${r.pin6}|${r.pin7}|${r.pin8}`;
  }

  protected addRuralRow(r: RuralSubSurveyRow): void {
    const ctx = this.ruralContext();
    if (!ctx?.villageLgdCode?.trim()) {
      this.error.set('Complete 7/12 search before adding disputed land.');
      return;
    }
    const key = this.buildRuralPlotAddKey(r);
    if (!key) return;
    const existing = this.disputedLands();
    if (existing.some((x) => this.keyOf(x) === key)) {
      this.error.set('This plot is already added.');
      return;
    }
    this.disputedLandsChange.emit([
      ...existing,
      {
        type: 'RURAL_7_12',
        districtCode: ctx.districtCode.trim(),
        districtName: ctx.districtName,
        talukaCode: ctx.talukaCode.trim(),
        talukaName: ctx.talukaName,
        villageLgdCode: ctx.villageLgdCode.trim(),
        villageName: ctx.villageName,
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
    this.clearDisputedAreaState();
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
    this.clearDisputedAreaState();
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
    this.clearDisputedAreaState();
    this.urbanParentCts.set('');
    this.urbanSelectedSubCts.set('');
  }

  protected setUrbanParentCts(v: string): void {
    this.urbanParentCts.set(v);
    this.urbanSubCtsRows.set([]);
    this.urbanPropertyDetails.set([]);
    this.clearDisputedAreaState();
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
    this.clearDisputedAreaState();
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
    this.clearDisputedAreaState();
    if (!subCtsNo.trim()) return;
    const villageCode = this.urbanVillageCode().trim();
    this.loadingPropertyDetails.set(true);
    this.error.set(null);
    this.api
      .getUrbanPropertyDetails(villageCode, subCtsNo.trim())
      .pipe(finalize(() => this.loadingPropertyDetails.set(false)))
      .subscribe({
        next: (rows) => {
          const list = rows || [];
          this.urbanPropertyDetails.set(list);
          this.seedDisputedAreaDefaults(list);
          if (!list.length) {
            this.error.set('No property / area details found for selected sub-CTS.');
          }
        },
        error: (e) => this.error.set(this.formatError(e))
      });
  }

  protected ctsRowLabel(row: UrbanCtsRow): string {
    return (row.new_cts_numb_2000 || row.cts_no || '').trim();
  }

  protected isUrbanPropertyRowAdded(row: Record<string, unknown>, index: number): boolean {
    const key = this.buildUrbanPropertyAddKey(row, index);
    return !!key && this.disputedLands().some((x) => this.keyOf(x) === key);
  }

  private buildUrbanPropertyAddKey(row: Record<string, unknown>, index: number): string | null {
    const villageCode = this.urbanVillageCode().trim() || this.prefilledVillageCode().trim();
    const parentCts = this.urbanParentCts().trim() || this.prefilledCtsNo().trim();
    const subCts =
      this.urbanSelectedSubCts().trim() ||
      this.prefilledSubCtsNo().trim() ||
      parentCts ||
      this.epicsMutationPropertyLookup()?.ctsNo.trim() ||
      '';
    if (!villageCode || !subCts) return null;
    const parentKey = parentCts || subCts;
    return `URBAN|${villageCode}|${parentKey}|${subCts}|${this.urbanPropertyRowIdentity(row, index)}`;
  }

  protected addUrbanPropertyRow(row: Record<string, unknown>, index: number): void {
    const area = this.getDisputedArea(index, row).trim() || this.extractTotalArea(row);
    const err = this.validateDisputedAreaAgainstTotal(area, row);
    if (err) {
      this.disputedAreaErrors.update((prev) => ({ ...prev, [String(index)]: err }));
      this.error.set(err);
      return;
    }
    this.pushUrbanDisputedLand(row, index, area);
  }

  protected addUrbanSelection(): void {
    const rows = this.urbanPropertyDetails();
    if (rows.length === 1) {
      this.addUrbanPropertyRow(rows[0], 0);
      return;
    }
    if (rows.length > 1) {
      this.error.set('Select Add on the property row you want to include.');
      return;
    }
    this.pushUrbanDisputedLand({}, 0, '');
  }

  private pushUrbanDisputedLand(row: Record<string, unknown>, index: number, disputedAreaInput: string): void {
    const disputedArea = disputedAreaInput.trim() || this.extractTotalArea(row);
    const areaErr = this.validateDisputedAreaAgainstTotal(disputedArea, row);
    if (areaErr) {
      this.disputedAreaErrors.update((prev) => ({ ...prev, [String(index)]: areaErr }));
      this.error.set(areaErr);
      return;
    }
    const districtCode = this.urbanDistrictCode().trim() || this.prefilledDistrictCode().trim();
    const officeCode = this.urbanOfficeCode().trim() || this.prefilledOfficeCode().trim();
    const villageCode = this.urbanVillageCode().trim() || this.prefilledVillageCode().trim();
    const parentCts = this.urbanParentCts().trim() || this.prefilledCtsNo().trim();
    const subCts = this.urbanSelectedSubCts().trim() || this.prefilledSubCtsNo().trim();
    const inwardMode = this.inwardMutationLandMode();
    const mutationLookup = this.epicsMutationPropertyLookup();

    if (!villageCode) {
      this.error.set('Village is required from step 1 (urban search or inward mutation).');
      return;
    }
    const resolvedSubCts = subCts || parentCts || mutationLookup?.ctsNo.trim() || '';
    if (!resolvedSubCts) {
      this.error.set('CTS number is required from step 1.');
      return;
    }
    if (!inwardMode && (!districtCode || !officeCode)) {
      this.error.set('Complete district, office and village on step 1 first.');
      return;
    }
    if (!inwardMode && !parentCts) {
      this.error.set('Enter parent CTS number on step 1 first.');
      return;
    }
    if (!inwardMode && !subCts) {
      this.error.set('Select sub-CTS number on step 1 first.');
      return;
    }

    const dist = districtCode
      ? this.urbanDistricts().find((d) => d.district_code.trim() === districtCode)
      : undefined;
    const off = officeCode
      ? this.urbanOffices().find((o) => o.office_code.trim() === officeCode)
      : undefined;
    const vil = this.urbanVillages().find((v) => v.village_code.trim() === villageCode);
    const resolvedParentCts = parentCts || resolvedSubCts;
    const districtName =
      dist?.district_name ?? mutationLookup?.districtName ?? (districtCode || '—');
    const officeName = off ? off.office_english_name || off.office_name : officeCode || '—';

    const key = this.buildUrbanPropertyAddKey(row, index);
    if (!key) return;
    const existing = this.disputedLands();
    if (existing.some((x) => this.keyOf(x) === key)) {
      this.error.set('This property row is already added.');
      return;
    }
    this.disputedLandsChange.emit([
      ...existing,
      {
        type: 'URBAN_PROPERTY_CARD',
        districtCode: districtCode || '—',
        districtName,
        officeCode: officeCode || '—',
        officeName,
        villageCode,
        villageName: vil ? vil.village_english_name || vil.village_name : villageCode,
        parentCtsNo: resolvedParentCts,
        ctsNo: resolvedSubCts,
        subCtsNo: resolvedSubCts,
        propertyDetail: {
          ...(Object.keys(row).length ? row : {}),
          disputed_area: disputedArea,
          disputedArea,
          [PROPERTY_ROW_ID_KEY]: this.urbanPropertyRowIdentity(row, index)
        } as Record<string, unknown>
      }
    ]);
    this.error.set(null);
  }

  /**
   * Unique key for one property-detail table row (same sub-CTS).
   * Always includes row index so multiple API rows with identical fields do not collide.
   */
  private urbanPropertyRowIdentity(row: Record<string, unknown>, index: number): string {
    const stored = row[PROPERTY_ROW_ID_KEY];
    if (typeof stored === 'string' && stored.trim()) {
      return stored.trim();
    }
    const prefer = [
      'id',
      'sr_no',
      'srNo',
      'flat_no',
      'flatNo',
      'unit_no',
      'unitNo',
      'plot_no',
      'plotNo',
      'area'
    ];
    for (const k of prefer) {
      const v = row[k];
      if (v != null && String(v).trim()) {
        return `${k}:${String(v).trim()}@${index}`;
      }
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
    const detailKey = detail ? this.urbanPropertyRowIdentity(detail, 0) : '';
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
