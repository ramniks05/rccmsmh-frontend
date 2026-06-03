import {
  buildMarathiShapathPatraHtml,
  type ShapathPatraVars
} from './affidivit-marathi-template';
import {
  buildMarathiSatyapanNamunaHtml,
  type SatyapanNamunaVars
} from './satyapan-marathi-template';

const DEVANAGARI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'] as const;

const MAHARASHTRA_MONTHS = [
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
] as const;

export interface FilingDescriptionTemplateContext {
  representativeSelfLine: string;
  representativeAddress?: string;
  deponentAge?: string;
  deponentOccupation?: string;
  deponentTaluka?: string;
  deponentDistrict?: string;
  applicantPhone?: string;
  applicantEmail?: string;
  advocateEmpoweredLine: string;
  advocateRegistrationNo?: string;
  advocatePhone?: string;
  advocateEmail?: string;
  signatureNames: string[];
  descriptionParagraphCount: number;
  footerPlace?: string;
}

export interface FilingDescriptionTemplateSource {
  applicantRow?: Record<string, unknown> | null;
  advocateFullName?: string;
  advocateRegistrationNo?: string;
  descriptionParagraphCount: number;
  hearingDistrictName?: string;
}

function fieldStr(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function buildFilingDescriptionTemplateContext(
  src: FilingDescriptionTemplateSource
): FilingDescriptionTemplateContext {
  const row = src.applicantRow ?? {};
  const name = [row['firstName'], row['middleName'], row['lastName']]
    .map((p) => fieldStr(p))
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    representativeSelfLine: name,
    representativeAddress: fieldStr(row['address']),
    deponentAge: fieldStr(row['age']),
    deponentOccupation: fieldStr(row['occupationMr']) || fieldStr(row['occupation']),
    deponentTaluka: fieldStr(row['taluka']),
    deponentDistrict: fieldStr(row['district']),
    applicantPhone: fieldStr(row['mobile']),
    applicantEmail: fieldStr(row['email']),
    advocateEmpoweredLine: fieldStr(src.advocateFullName),
    advocateRegistrationNo: fieldStr(src.advocateRegistrationNo),
    signatureNames: name ? [name] : [],
    descriptionParagraphCount: src.descriptionParagraphCount,
    footerPlace: fieldStr(src.hearingDistrictName) || fieldStr(row['district'])
  };
}

function toDevanagariNumber(n: number): string {
  if (n < 1) return '';
  return String(n)
    .split('')
    .map((d) => DEVANAGARI_DIGITS[Number(d)] ?? d)
    .join('');
}

function paragraphRange(count: number): { from: string; to: string } {
  if (count < 1) return { from: '', to: '' };
  return { from: '१', to: toDevanagariNumber(count) };
}

function maharashtraMonthName(monthIndex: number): string {
  return MAHARASHTRA_MONTHS[monthIndex] ?? '';
}

export function buildShapathPatraVars(ctx: FilingDescriptionTemplateContext): ShapathPatraVars {
  const range = paragraphRange(ctx.descriptionParagraphCount);
  const reg = (ctx.advocateRegistrationNo || '').trim();
  const matterDescription = reg
    ? `अर्ज दाखल केलेल्या प्रकरणाचे कामकाज (${reg})`
    : 'अर्ज दाखल केलेल्या प्रकरणाचे कामकाज';

  return {
    representativeSelfLine: ctx.representativeSelfLine,
    representativeAddress: ctx.representativeAddress,
    deponentAge: ctx.deponentAge,
    paraRangeFrom2: range.from,
    paraRangeTo2: range.to,
    paraRangeFrom3: range.from,
    paraRangeTo3: range.to,
    advocateEmpoweredLine: ctx.advocateEmpoweredLine,
    matterDescription,
    signatureNames: ctx.signatureNames,
    applicantPhone: ctx.applicantPhone,
    advocatePhone: ctx.advocatePhone,
    applicantEmail: ctx.applicantEmail,
    advocateEmail: ctx.advocateEmail
  };
}

export function buildSatyapanNamunaVars(ctx: FilingDescriptionTemplateContext): SatyapanNamunaVars {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  return {
    representativeSelfLine: ctx.representativeSelfLine,
    deponentAge: ctx.deponentAge || '',
    deponentOccupation: ctx.deponentOccupation || '',
    representativeAddress: ctx.representativeAddress || '',
    deponentTaluka: ctx.deponentTaluka || '',
    deponentDistrict: ctx.deponentDistrict || '',
    dateDay: String(now.getDate()),
    dateMonth: maharashtraMonthName(now.getMonth()),
    dateYear: yy,
    footerPlace: ctx.footerPlace || '',
    advocateEmpoweredLine: ctx.advocateEmpoweredLine,
    signatureNames: ctx.signatureNames
  };
}

/** Affidavit — अर्ज / अपील ज्ञापनासमवेतचे शपथपत्र */
export function buildAffidavitTemplateHtml(ctx: FilingDescriptionTemplateContext): string {
  return buildMarathiShapathPatraHtml(buildShapathPatraVars(ctx));
}

/** Prayer / verification — सत्यापन नमुना */
export function buildPrayerTemplateHtml(ctx: FilingDescriptionTemplateContext): string {
  return buildMarathiSatyapanNamunaHtml(buildSatyapanNamunaVars(ctx));
}

/** True when value was saved from a Marathi court HTML template. */
export function isFilingDocumentHtml(value: string): boolean {
  const t = (value || '').trim();
  return t.startsWith('<!DOCTYPE') || t.startsWith('<html') || t.includes('<body');
}

/** Body inner HTML for in-page preview (full documents are stored in form fields). */
export function filingDocumentBodyHtml(fullHtml: string): string {
  const t = (fullHtml || '').trim();
  if (!t) return '';
  const match = t.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1].trim() : t;
}

export function openFilingDocumentHtml(html: string): Window | null {
  const w = window.open('', '_blank');
  if (!w) return null;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return w;
}
