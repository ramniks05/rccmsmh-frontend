import { Component, computed, inject, input, output, signal } from '@angular/core';
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
    }
  | {
      type: 'URBAN_PROPERTY_CARD';
      districtCode: string;
      districtName: string;
      officeCode: string;
      officeName: string;
      villageCode: string;
      villageName: string;
      ctsNo: string;
    };

@Component({
  selector: 'app-disputed-land-panel',
  imports: [],
  templateUrl: './disputed-land-panel.component.html',
  styleUrl: './disputed-land-panel.component.css'
})
export class DisputedLandPanelComponent {
  private readonly api = inject(LandRecordsService);

  /** Disputed lands list owned by parent; emit when user adds/removes. */
  disputedLands = input<DisputedLandRow[]>([]);
  disputedLandsChange = output<DisputedLandRow[]>();

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
  protected readonly urbanCtsRows = signal<UrbanCtsRow[]>([]);
  protected readonly urbanDistrictCode = signal('');
  protected readonly urbanOfficeCode = signal('');
  protected readonly urbanVillageCode = signal('');
  protected readonly urbanCtsFilter = signal('');

  protected readonly canSearchRural = computed(() => {
    return this.ruralDistrictCode().trim() !== '' && this.ruralTalukaCode().trim() !== '' && this.ruralVillageLgdCode().trim() !== '' && this.ruralPin().trim().length > 0;
  });

  protected readonly canSearchUrban = computed(() => {
    return this.urbanDistrictCode().trim() !== '' && this.urbanOfficeCode().trim() !== '' && this.urbanVillageCode().trim() !== '';
  });

  constructor() {
    this.loadMasters();
  }

  protected setMode(next: DisputedLandType): void {
    const hasModeChanged = this.mode() !== next;
    this.mode.set(next);
    this.error.set(null);
    this.ruralSubSurveyRows.set([]);
    this.urbanCtsRows.set([]);
    this.ruralDistrictCode.set('');
    this.ruralTalukaCode.set('');
    this.ruralVillageLgdCode.set('');
    this.ruralPin.set('');
    this.ruralTalukas.set([]);
    this.ruralVillages.set([]);
    this.urbanDistrictCode.set('');
    this.urbanOfficeCode.set('');
    this.urbanVillageCode.set('');
    this.urbanCtsFilter.set('');
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
  }

  protected setRuralPin(v: string): void {
    this.ruralPin.set(v);
  }

  protected searchRural(): void {
    if (!this.canSearchRural()) {
      this.error.set('Select district/taluka/village and enter survey number (pin).');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.getRuralSubSurveyList(this.ruralVillageLgdCode(), this.ruralPin().trim()).subscribe({
      next: (rows) => this.ruralSubSurveyRows.set(rows),
      error: (e) => this.error.set(this.formatError(e)),
      complete: () => this.loading.set(false)
    });
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
    this.urbanCtsRows.set([]);
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
    this.urbanCtsRows.set([]);
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
    this.urbanCtsRows.set([]);
  }

  protected setUrbanCtsFilter(v: string): void {
    this.urbanCtsFilter.set(v);
  }

  protected searchUrban(): void {
    if (!this.canSearchUrban()) {
      this.error.set('Select district/office/village to search CTS.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const filter = this.urbanCtsFilter().trim();
    this.api.getUrbanCtsList(this.urbanVillageCode(), filter || undefined).subscribe({
      next: (rows) => this.urbanCtsRows.set(rows),
      error: (e) => this.error.set(this.formatError(e)),
      complete: () => this.loading.set(false)
    });
  }

  protected addUrbanRow(r: UrbanCtsRow): void {
    const dist = this.urbanDistricts().find((d) => d.district_code.trim() === this.urbanDistrictCode().trim());
    const off = this.urbanOffices().find((o) => o.office_code.trim() === this.urbanOfficeCode().trim());
    const vil = this.urbanVillages().find((v) => v.village_code.trim() === this.urbanVillageCode().trim());
    if (!dist || !off || !vil) return;
    const key = `URBAN|${vil.village_code.trim()}|${r.cts_no.trim()}`;
    const existing = this.disputedLands();
    if (existing.some((x) => this.keyOf(x) === key)) {
      this.error.set('This CTS is already added.');
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
        ctsNo: r.cts_no
      }
    ]);
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
    return `URBAN|${row.villageCode}|${row.ctsNo}`;
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

