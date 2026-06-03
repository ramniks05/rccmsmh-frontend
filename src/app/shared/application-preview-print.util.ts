import { filingDocumentBodyHtml, isFilingDocumentHtml } from './filing-affidavit-prayer.util';
import { PreviewInfoItem } from './application-preview.util';

export interface ApplicationPreviewPrintParty {
  title: string;
  lines: Array<{ label: string; value: string }>;
}

export interface ApplicationPreviewPrintLand {
  lineNo: string;
  landType: string;
  district: string;
  officeTaluka: string;
  village: string;
  ctsSurvey: string;
  plotFlat: string;
  totalArea: string;
  disputedArea: string;
}

export interface ApplicationPreviewPrintAttachment {
  kind: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
}

export interface ApplicationPreviewPrintModel {
  title: string;
  caseNo?: string;
  status: string;
  summaryRows: Array<{ label: string; value: string }>;
  searchCriteria: PreviewInfoItem[];
  applicants: ApplicationPreviewPrintParty[];
  respondents: ApplicationPreviewPrintParty[];
  disputedLands: ApplicationPreviewPrintLand[];
  vakaltnamaGroups: Array<{ title: string; advocate: string; barCouncil: string; applicants: string }>;
  descriptionParagraphs: string[];
  affidavitHtml?: string;
  prayerHtml?: string;
  attachments: ApplicationPreviewPrintAttachment[];
}

function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function infoGrid(rows: Array<{ label: string; value: string }>): string {
  if (!rows.length) return '';
  const items = rows
    .filter((r) => r.value.trim())
    .map(
      (r) =>
        `<div class="info-item"><span class="label">${escapeHtml(r.label)}</span><span class="value">${escapeHtml(r.value)}</span></div>`
    )
    .join('');
  return items ? `<div class="info-grid">${items}</div>` : '';
}

function section(title: string, body: string): string {
  if (!body.trim()) return '';
  return `<section class="section"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function partyBlock(parties: ApplicationPreviewPrintParty[]): string {
  if (!parties.length) return '';
  return parties
    .map((p) => {
      const lines = p.lines
        .filter((l) => l.value.trim())
        .map((l) => `<p><strong>${escapeHtml(l.label)}:</strong> ${escapeHtml(l.value)}</p>`)
        .join('');
      return `<article class="party"><h3>${escapeHtml(p.title)}</h3>${lines}</article>`;
    })
    .join('');
}

function documentEmbed(title: string, raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const inner = isFilingDocumentHtml(t)
    ? filingDocumentBodyHtml(t)
    : `<pre class="plain-doc">${escapeHtml(t)}</pre>`;
  return `<section class="section doc-section"><h2>${escapeHtml(title)}</h2><div class="doc-embed">${inner}</div></section>`;
}

export function buildApplicationPreviewPrintHtml(model: ApplicationPreviewPrintModel): string {
  const landsTable =
    model.disputedLands.length > 0
      ? `<table class="data-table"><thead><tr>
          <th>#</th><th>Type</th><th>District</th><th>Office / Taluka</th><th>Village</th>
          <th>CTS / Survey</th><th>Plot / flat</th><th>Total area</th><th>Disputed area</th>
        </tr></thead><tbody>${model.disputedLands
          .map(
            (l) =>
              `<tr><td>${escapeHtml(l.lineNo)}</td><td>${escapeHtml(l.landType)}</td><td>${escapeHtml(l.district)}</td>
              <td>${escapeHtml(l.officeTaluka)}</td><td>${escapeHtml(l.village)}</td><td>${escapeHtml(l.ctsSurvey)}</td>
              <td>${escapeHtml(l.plotFlat)}</td><td>${escapeHtml(l.totalArea)}</td><td>${escapeHtml(l.disputedArea)}</td></tr>`
          )
          .join('')}</tbody></table>`
      : '';

  const vakaltnama =
    model.vakaltnamaGroups.length > 0
      ? model.vakaltnamaGroups
          .map(
            (g) =>
              `<article class="party"><h3>${escapeHtml(g.title)}</h3>
              <p><strong>Advocate:</strong> ${escapeHtml(g.advocate)}</p>
              <p><strong>Bar council:</strong> ${escapeHtml(g.barCouncil)}</p>
              <p><strong>Applicants:</strong> ${escapeHtml(g.applicants)}</p></article>`
          )
          .join('')
      : '';

  const description =
    model.descriptionParagraphs.length > 0
      ? model.descriptionParagraphs.map((p) => `<p class="para">${escapeHtml(p)}</p>`).join('')
      : '';

  const attachments =
    model.attachments.length > 0
      ? `<ul class="attach-list">${model.attachments
          .map(
            (a) =>
              `<li><strong>${escapeHtml(a.kind)}</strong> — ${escapeHtml(a.fileName)} (${escapeHtml(a.mimeType)})${a.uploadedAt ? ` · ${escapeHtml(a.uploadedAt)}` : ''}</li>`
          )
          .join('')}</ul>`
      : '';

  const searchBody =
    model.searchCriteria.length > 0 ? infoGrid(model.searchCriteria.map((i) => ({ label: i.label, value: i.value }))) : '';

  const caseLine = model.caseNo?.trim() ? `<p class="sub">Case: ${escapeHtml(model.caseNo)}</p>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(model.title)} — Application preview</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0f172a; margin: 0; padding: 24px 28px; font-size: 13px; line-height: 1.5; }
    h1 { margin: 0 0 6px; font-size: 1.35rem; color: #0b3d91; }
    .sub { margin: 0 0 4px; color: #64748b; font-size: 0.9rem; }
    .status { display: inline-block; margin: 8px 0 20px; padding: 4px 12px; background: #e0e7ff; color: #1e3a8a; border-radius: 999px; font-size: 0.8rem; font-weight: 600; }
    .section { margin-bottom: 22px; page-break-inside: avoid; }
    .section h2 { margin: 0 0 10px; font-size: 1rem; color: #0b3d91; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
    .section h3 { margin: 0 0 8px; font-size: 0.92rem; }
    .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 20px; }
    .info-item .label { display: block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
    .info-item .value { font-weight: 500; }
    .party { margin-bottom: 12px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; }
    .party p { margin: 4px 0; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    .data-table th { background: #f1f5f9; }
    .para { margin: 0 0 10px; white-space: pre-wrap; }
    .doc-section .doc-embed { border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; }
    .doc-embed .title, .doc-embed .sub-title, .doc-embed .section-title { text-align: center; }
    .plain-doc { white-space: pre-wrap; font-family: inherit; margin: 0; }
    .attach-list { margin: 0; padding-left: 1.2rem; }
    @media print {
      body { padding: 12px 16px; }
      .section { page-break-inside: auto; }
      .doc-section { page-break-before: auto; }
    }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(model.title)}</h1>
    ${caseLine}
    <p class="status">${escapeHtml(model.status)}</p>
  </header>
  ${section('Application summary', infoGrid(model.summaryRows))}
  ${section('Search criteria (as entered)', searchBody)}
  ${section('Applicants', partyBlock(model.applicants))}
  ${section('Respondents', partyBlock(model.respondents))}
  ${section('Disputed lands', landsTable)}
  ${section('Vakaltnama', vakaltnama)}
  ${section('Application description (ज्ञापन)', description)}
  ${documentEmbed('Affidavit (शपथपत्र)', model.affidavitHtml ?? '')}
  ${documentEmbed('Prayer / Verification (सत्यापन नमुना)', model.prayerHtml ?? '')}
  ${section('Attachments', attachments)}
  <script>window.addEventListener('load', function() { /* optional auto-print */ });</script>
</body>
</html>`;
}

export function downloadHtmlFile(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function openPrintWindow(html: string, autoPrint: boolean): Window | null {
  const w = window.open('', '_blank');
  if (!w) return null;
  w.document.open();
  w.document.write(html);
  w.document.close();
  if (autoPrint) {
    const trigger = () => {
      w.focus();
      w.print();
    };
    if (w.document.readyState === 'complete') {
      setTimeout(trigger, 250);
    } else {
      w.addEventListener('load', () => setTimeout(trigger, 250));
    }
  }
  return w;
}
