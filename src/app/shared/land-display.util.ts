/**
 * One label per concept — API may send cts_no, cts_number, "Cts Number", etc.
 * First non-empty alias in the row wins.
 */
const LAND_CANONICAL_FIELDS: Array<{ id: string; label: string; keys: string[] }> = [
  {
    id: 'cts',
    label: 'CTS number',
    keys: [
      'cts_no',
      'ctsNo',
      'cts_number',
      'ctsNumber',
      'CTS_NO',
      'CTS_NUMBER',
      'Cts Number',
      'CTS Number',
      'cts number',
      'new_cts_numb_2000',
      'newCtsNumb2000'
    ]
  },
  {
    id: 'sub_cts',
    label: 'Sub-CTS',
    keys: ['sub_cts_no', 'subCtsNo', 'sub_cts_number', 'subCtsNumber', 'Sub CTS', 'sub cts']
  },
  {
    id: 'parent_cts',
    label: 'Parent CTS',
    keys: ['parent_cts_no', 'parentCtsNo', 'parent_cts', 'parentCts', 'Parent CTS']
  }
];

/** Priority fields shown first (urban / property card). */
const PRIORITY_PROPERTY_FIELDS: Array<{ keys: string[]; label: string }> = [
  { keys: ['owner_name', 'ownername', 'ownerName', 'OWNER_NAME'], label: 'Owner' },
  { keys: ['occupant_name', 'occupantName', 'tenant_name'], label: 'Occupant' },
  { keys: ['name', 'holder_name', 'holderName'], label: 'Name' },
  { keys: ['flat_no', 'flatNo', 'flat_number'], label: 'Flat / unit' },
  { keys: ['unit_no', 'unitNo'], label: 'Unit' },
  { keys: ['plot_no', 'plotNo', 'plot_number'], label: 'Plot' },
  { keys: ['sr_no', 'srNo', 'serial_no'], label: 'Sr. no.' },
  { keys: ['property_type', 'propertyType', 'type'], label: 'Type' },
  { keys: ['total_area', 'totalArea', 'TOTAL_AREA'], label: 'Total area' },
  { keys: ['built_up_area', 'builtUpArea'], label: 'Built-up area' },
  { keys: ['carpet_area', 'carpetArea'], label: 'Carpet area' },
  { keys: ['open_area', 'openArea'], label: 'Open area' },
  { keys: ['area', 'AREA'], label: 'Area' },
  { keys: ['disputed_area', 'disputedArea'], label: 'Disputed area' },
  { keys: ['description', 'remarks', 'remark'], label: 'Remarks' }
];

/** Keys never shown in UI (internal / duplicate pin parts). */
const HIDDEN_DETAIL_KEYS = new Set([
  '__propertyRowKey',
  'pin1',
  'pin2',
  'pin3',
  'pin4',
  'pin5',
  'pin6',
  'pin7',
  'pin8',
  'found',
  'returnedCount',
  'returned_count',
  'tenure',
  'tenure_naz',
  'tenure_area',
  'tenureNaz',
  'tenureArea',
  'Tenure',
  'अ'
]);

/** Internal-only keys (not end-user land facts). */
const HIDDEN_DETAIL_PATTERN = /^(id|_.*|raw|data|payload|tenure)/i;

export interface LandDisplayField {
  key: string;
  label: string;
  value: string;
}

export function formatLandDisplayValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    if (!value.length) return '';
    return value.every((x) => x == null || typeof x !== 'object')
      ? value.map((x) => formatLandDisplayValue(x)).filter(Boolean).join(', ')
      : `${value.length} record(s)`;
  }
  if (typeof value === 'object') {
    try {
      const s = JSON.stringify(value);
      return s.length > 160 ? `${s.slice(0, 157)}…` : s;
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function isHiddenLandLabel(label: string): boolean {
  const t = label.trim();
  if (!t) return true;
  if (/^tenure\b/i.test(t) || t.toLowerCase() === 'tenure') return true;
  if (t === 'अ') return true;
  return false;
}

function isHiddenLandKey(key: string, options?: { hideDisputedArea?: boolean }): boolean {
  if (HIDDEN_DETAIL_KEYS.has(key)) return true;
  if (options?.hideDisputedArea && (key === 'disputed_area' || key === 'disputedArea')) return true;
  if (HIDDEN_DETAIL_PATTERN.test(key)) return true;
  if (/^tenure/i.test(key.replace(/_/g, ''))) return true;
  if (key.trim() === 'अ') return true;
  if (isHiddenLandLabel(humanizeLandKey(key))) return true;
  return false;
}

function normalizeLandKeyToken(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function landKeysMatch(a: string, b: string): boolean {
  return normalizeLandKeyToken(a) === normalizeLandKeyToken(b);
}

function findCanonicalField(key: string): (typeof LAND_CANONICAL_FIELDS)[number] | null {
  for (const group of LAND_CANONICAL_FIELDS) {
    if (group.keys.some((alias) => landKeysMatch(alias, key))) return group;
  }
  return null;
}

/** Read a display field using canonical id (e.g. `cts`) or a raw row key. */
export function readLandRowValue(row: Record<string, unknown>, keyOrCanonicalId: string): string {
  const byId = LAND_CANONICAL_FIELDS.find((g) => g.id === keyOrCanonicalId);
  const group = byId ?? findCanonicalField(keyOrCanonicalId);
  if (group) {
    for (const alias of group.keys) {
      const v = formatLandDisplayValue(row[alias]);
      if (v) return v;
    }
    for (const rowKey of Object.keys(row)) {
      if (group.keys.some((alias) => landKeysMatch(alias, rowKey))) {
        const v = formatLandDisplayValue(row[rowKey]);
        if (v) return v;
      }
    }
    return '';
  }
  return formatLandDisplayValue(row[keyOrCanonicalId]);
}

function isCanonicalAliasKey(key: string): boolean {
  return findCanonicalField(key) != null;
}

/**
 * All displayable fields from a property / land API row.
 * Priority labels first, then remaining keys (sorted).
 */
export function landRecordDisplayFields(
  row: Record<string, unknown>,
  options?: { hideDisputedArea?: boolean; maxFields?: number }
): LandDisplayField[] {
  const out: LandDisplayField[] = [];
  const used = new Set<string>();

  for (const spec of PRIORITY_PROPERTY_FIELDS) {
    for (const key of spec.keys) {
      if (used.has(key) || isHiddenLandKey(key, options)) continue;
      const value = formatLandDisplayValue(row[key]);
      if (!value) continue;
      out.push({ key, label: spec.label, value });
      used.add(key);
      spec.keys.forEach((k) => used.add(k));
      break;
    }
  }

  for (const group of LAND_CANONICAL_FIELDS) {
    if (used.has(group.id)) continue;
    const value = readLandRowValue(row, group.id);
    if (!value) continue;
    out.push({ key: group.id, label: group.label, value });
    used.add(group.id);
    group.keys.forEach((k) => used.add(k));
    for (const rowKey of Object.keys(row)) {
      if (group.keys.some((alias) => landKeysMatch(alias, rowKey))) used.add(rowKey);
    }
  }

  const rest = Object.keys(row)
    .filter(
      (key) =>
        !used.has(key) &&
        !isHiddenLandKey(key, options) &&
        !isCanonicalAliasKey(key)
    )
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  for (const key of rest) {
    const value = formatLandDisplayValue(row[key]);
    if (!value) continue;
    const label = humanizeLandKey(key);
    if (isHiddenLandLabel(label)) continue;
    out.push({ key, label, value });
    used.add(key);
  }

  const filtered = out.filter((f) => !isHiddenLandLabel(f.label));
  const max = options?.maxFields;
  return max != null && max > 0 ? filtered.slice(0, max) : filtered;
}

/** Urban property row while selecting — show all useful API fields. */
export function urbanPropertyDisplayFields(row: Record<string, unknown>): LandDisplayField[] {
  return landRecordDisplayFields(row, { hideDisputedArea: true });
}

export interface LandTableColumn {
  key: string;
  label: string;
}

export interface UrbanPropertyTableLayout {
  /** Fields identical on every row (shown once above the table). */
  commonFields: LandDisplayField[];
  /** Per-row columns (vary between units / flats). */
  columns: LandTableColumn[];
}

function collectUrbanPropertyKeyLabels(rows: Record<string, unknown>[]): Map<string, string> {
  const keyLabel = new Map<string, string>();
  for (const row of rows) {
    for (const f of landRecordDisplayFields(row, { hideDisputedArea: true })) {
      if (!keyLabel.has(f.key)) keyLabel.set(f.key, f.label);
    }
  }
  return keyLabel;
}

function orderedUrbanPropertyKeys(keyLabel: Map<string, string>): string[] {
  const ordered: string[] = [];
  const used = new Set<string>();
  for (const spec of PRIORITY_PROPERTY_FIELDS) {
    for (const key of spec.keys) {
      if (keyLabel.has(key) && !used.has(key)) {
        ordered.push(key);
        used.add(key);
      }
    }
  }
  for (const key of [...keyLabel.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))) {
    if (!used.has(key)) ordered.push(key);
  }
  return ordered;
}

/**
 * Split urban property API rows into shared summary (top) and tabular per-row columns.
 * With a single row, all fields stay in the table; with multiple rows, identical values move to common.
 */
export function buildUrbanPropertyTableLayout(rows: Record<string, unknown>[]): UrbanPropertyTableLayout {
  if (!rows.length) return { commonFields: [], columns: [] };

  const keyLabel = collectUrbanPropertyKeyLabels(rows);
  const keys = orderedUrbanPropertyKeys(keyLabel);
  const commonFields: LandDisplayField[] = [];
  const columns: LandTableColumn[] = [];
  const usedLabels = new Set<string>();

  for (const key of keys) {
    const label = keyLabel.get(key) ?? humanizeLandKey(key);
    if (isHiddenLandLabel(label)) continue;
    const labelKey = label.toLowerCase();
    if (usedLabels.has(labelKey)) continue;

    const values = rows.map((row) => readLandRowValue(row, key));
    const nonEmpty = values.filter((v) => v !== '');
    const allSame =
      rows.length > 1 && nonEmpty.length === rows.length && new Set(nonEmpty).size === 1;

    if (allSame) {
      commonFields.push({ key, label, value: nonEmpty[0] });
      usedLabels.add(labelKey);
    } else if (nonEmpty.length > 0 || rows.length === 1) {
      columns.push({ key, label });
      usedLabels.add(labelKey);
    }
  }

  return { commonFields, columns };
}

/** Added urban row — includes disputed area and full property detail. */
export function urbanAddedLandDisplayFields(propertyDetail: Record<string, unknown> | undefined): LandDisplayField[] {
  if (!propertyDetail || !Object.keys(propertyDetail).length) return [];
  return landRecordDisplayFields(propertyDetail);
}

/** Officer land detail panel — hide pin parts when main pin exists. */
export function landDetailDisplayFields(payload: Record<string, unknown>): LandDisplayField[] {
  const hasPin = !!formatLandDisplayValue(payload['pin']);
  const fields = landRecordDisplayFields(payload, { maxFields: 32 });
  if (!hasPin) return fields;
  return fields.filter((f) => !/^pin[1-8]$/i.test(f.key));
}

export function humanizeLandKey(key: string): string {
  const labels: Record<string, string> = {
    pin: 'Survey pin',
    ctsNo: 'CTS number',
    cts_no: 'CTS number',
    parentCtsNo: 'Parent CTS',
    subCtsNo: 'Sub-CTS',
    sub_cts_no: 'Sub-CTS',
    surveyPin: 'Survey pin',
    total_area: 'Total area',
    totalArea: 'Total area',
    disputed_area: 'Disputed area',
    villageName: 'Village',
    village_name: 'Village',
    districtName: 'District',
    district_name: 'District',
    talukaName: 'Taluka',
    taluka_name: 'Taluka',
    officeName: 'Office',
    office_name: 'Office',
    new_cts_numb_2000: 'CTS (2000)'
  };
  if (labels[key]) return labels[key];
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Compact sub-survey label (only non-empty parts, grouped). */
export function formatRuralPinParts(parts: {
  pin1?: string;
  pin2?: string;
  pin3?: string;
  pin4?: string;
  pin5?: string;
  pin6?: string;
  pin7?: string;
  pin8?: string;
}): string {
  const vals = [parts.pin1, parts.pin2, parts.pin3, parts.pin4, parts.pin5, parts.pin6, parts.pin7, parts.pin8]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean);
  if (!vals.length) return '';
  const joined = vals.join('');
  return joined.length > 48 ? `${joined.slice(0, 45)}…` : joined;
}
