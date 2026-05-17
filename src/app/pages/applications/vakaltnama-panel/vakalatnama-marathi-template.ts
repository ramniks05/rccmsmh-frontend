/**
 * Marathi vakalatnama (वकीलपत्र) HTML used for view / download / print.
 * Layout matches court-style template; dynamic parts are escaped for safety.
 */

export interface VakalatnamaMarathiVars {
  applicationNo: string;
  courtPlace: string;
  courtOfficeName: string;
  caseNumber: string;
  caseYearTwoDigits: string;
  applicantLine: string;
  respondentLine1: string;
  respondentLine2: string;
  representativeSelfLine: string;
  representativePronoun: 'मी' | 'आम्ही';
  signatureNames: string[];
  matterDescription: string;
  advocateEmpoweredLine: string;
  deedLine: string;
  dateDay: string;
  monthMah: string;
  yearTwoDigits: string;
}

const DEVANAGARI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'] as const;

/** Latin digits → Devanagari (०–९) for uniform court-document typography. */
export function toDevanagariDigits(text: string): string {
  if (!text) return '';
  return String(text).replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[Number(d)] ?? d);
}

export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escDev(text: string): string {
  return escapeHtml(toDevanagariDigits(text));
}

function devanagariListNumber(n: number): string {
  if (n <= 0) return '';
  return String(n)
    .split('')
    .map((d) => DEVANAGARI_DIGITS[Number(d)] ?? d)
    .join('');
}

function orBlank(value: string): string {
  return (value || '').trim();
}

function buildSignatureListHtml(names: string[]): string {
  const list = names.map((n) => n.trim()).filter(Boolean);
  if (list.length === 0) {
    return '<li class="sig-empty">&nbsp;</li>';
  }
  return list
    .map(
      (name, i) =>
        `<li><span class="sig-num">${devanagariListNumber(i + 1)}.</span> <span class="sig-name">${escDev(name)}</span></li>`
    )
    .join('\n            ');
}

export function buildMarathiVakalatnamaHtml(v: VakalatnamaMarathiVars): string {
  const appNo = orBlank(v.applicationNo);
  const courtPlace = orBlank(v.courtPlace);
  const courtOffice = orBlank(v.courtOfficeName);
  const caseNo = orBlank(v.caseNumber);
  const caseYy = orBlank(v.caseYearTwoDigits);
  const applicant = orBlank(v.applicantLine);
  const resp1 = orBlank(v.respondentLine1);
  const resp2 = orBlank(v.respondentLine2);
  const selfLine = orBlank(v.representativeSelfLine);
  const pronoun = v.representativePronoun === 'आम्ही' ? 'आम्ही' : 'मी';
  const matter = orBlank(v.matterDescription);
  const advocates = orBlank(v.advocateEmpoweredLine);
  const deed = orBlank(v.deedLine);
  const day = orBlank(v.dateDay);
  const month = orBlank(v.monthMah);
  const yy = orBlank(v.yearTwoDigits);
  const yearFull = yy ? `२०${toDevanagariDigits(yy)}` : '२०';
  const dayDev = day ? toDevanagariDigits(day) : '';
  const monthDev = month ? escDev(month) : '';
  const dateFooter = [dayDev || '—', monthDev || '—', yearFull].join(' / ');

  const courtLineParts: string[] = [];
  if (courtPlace) courtLineParts.push(`<span class="fill-inline">${escDev(courtPlace)}</span> येथील मे.`);
  else courtLineParts.push('येथील मे.');
  if (courtOffice) courtLineParts.push(`<span class="fill-inline">${escDev(courtOffice)}</span> यांचे कोर्टात`);
  else courtLineParts.push('यांचे कोर्टात');

  const caseLine =
    caseNo || caseYy
      ? `<div class="flex-row">${caseNo ? `<span class="fill-inline">${escDev(caseNo)}</span> क्रमांक ,` : ''} सन ${caseYy ? yearFull : '२०'}</div>`
      : '';

  return `<!DOCTYPE html>
<html lang="mr">
<head>
    <meta charset="UTF-8">
    <title> </title>
    <style>
        @page { size: A4; margin: 4mm 0; }
        html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            overflow-x: hidden;
        }
        body {
            font-family: 'Noto Sans Devanagari', 'Mangal', 'Arial Unicode MS', sans-serif;
            line-height: 1.75;
            color: #1a1a1a;
        }
        .vakalatnama-sheet {
            max-width: 800px;
            margin: 8px auto;
            padding: 12px 28px;
            border: 2px solid #000;
            box-sizing: border-box;
            background: #fff;
        }
        @media print {
            @page { size: A4; margin: 4mm 0; }
            html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 210mm;
                min-height: 297mm;
                background: #fff;
            }
            body * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .vakalatnama-sheet {
                max-width: none;
                width: 200mm;
                min-height: calc(289mm - 4px);
                margin: 0 auto;
                padding: 6mm 12mm;
                border: 2px solid #000;
                box-sizing: border-box;
                page-break-after: avoid;
                page-break-inside: avoid;
            }
        }
        .header {
            text-align: center;
            font-size: 26pt;
            font-weight: 800;
            text-decoration: underline;
            margin-bottom: 12px;
        }
        .ni-no { text-align: right; font-size: 14pt; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .stamp-box {
            border: 1.5px solid #000;
            width: 110px;
            height: 150px;
            text-align: center;
            font-size: 9pt;
            color: #444;
            vertical-align: top;
            padding: 8px 4px;
        }
        .content-cell { padding-left: 24px; vertical-align: top; text-align: left; }
        .virudh-table .content-cell { padding-left: 24px; vertical-align: top; text-align: left; }
        .virudh-table .flex-row { text-align: left; }
        .flex-row {
            display: block;
            margin-bottom: 10px;
            line-height: 1.85;
            font-size: 13pt;
        }
        .fill-inline { display: inline; font-weight: 600; padding: 0 2px; }
        .vs-divider {
            text-align: center;
            font-weight: bold;
            font-size: 16pt;
            padding: 18px 0;
            margin: 8px 0;
        }
        .legal-body {
            text-align: justify;
            text-indent: 50px;
            font-size: 13pt;
            margin-top: 28px;
            line-height: 1.9;
        }
        .deed-row { margin-top: 20px; font-size: 13pt; line-height: 1.85; }
        .footer-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-top: 56px;
            flex-wrap: wrap;
            gap: 24px;
        }
        .sig-list { list-style: none; padding: 0; margin: 0; min-width: 280px; }
        .sig-list li {
            margin-bottom: 14px;
            padding-bottom: 6px;
            border-bottom: 1px solid #333;
            font-size: 13pt;
            line-height: 1.5;
            min-height: 28px;
        }
        .sig-list .sig-num { font-weight: 700; margin-right: 6px; }
        .sig-list .sig-name { font-weight: 600; }
        .sig-empty { min-height: 28px; border-bottom: 1px solid #333; }
        .muted-label { color: #444; }
    </style>
</head>
<body>
<div class="vakalatnama-sheet">

<div class="header">वकीलपत्र</div>
<div class="ni-no">अर्ज क्र. &nbsp;${appNo ? `<span class="fill-inline">${escapeHtml(appNo)}</span>` : ''}</div>

<table>
    <tr>
        <td class="stamp-box">कोर्ट फी स्टॅम्पसाठी जागा</td>
        <td class="content-cell">
            <div class="flex-row">${courtLineParts.join(' ')}</div>
            ${caseLine}
            ${applicant ? `<div class="flex-row"><span class="fill-inline">${escDev(applicant)}</span> <span class="muted-label">वादी / अर्जदार</span></div>` : ''}
        </td>
    </tr>
</table>

<div class="vs-divider">।। विरुद्ध ।।</div>

<table class="virudh-table">
    <tr>
        <td class="stamp-box">स्टॅम्पसाठी जागा</td>
        <td class="content-cell">
            ${resp1 ? `<div class="flex-row"><span class="fill-inline">${escDev(resp1)}</span> <span class="muted-label">प्रतिवादी / जवाबदार</span></div>` : ''}
            ${resp2 ? `<div class="flex-row"><span class="fill-inline">${escDev(resp2)}</span> <span class="muted-label">आरोपी / सामनेवाला</span></div>` : ''}
            ${selfLine ? `<div class="flex-row" style="margin-top: 16px;">${pronoun} <span class="fill-inline">${escDev(selfLine)}</span></div>` : ''}
        </td>
    </tr>
</table>

<div class="deed-row">
    यांनी या लेखावरून ${deed ? `<span class="fill-inline">${escDev(deed)}</span>` : ''}
</div>

<div class="legal-body">
    यांस / माझे आमचे तर्फे हजर राहून वर लिहिलेल्या ${matter ? `<span class="fill-inline">${escDev(matter)}</span>` : 'प्रकरणाचे'} चे काम चालविण्यास आमचेतर्फे ${advocates ? `<span class="fill-inline">${escDev(advocates)}</span>` : ''} यांना वकील नेमले आहे. या गोष्टीचे साक्षीकरिता आज दिनांक ${day ? `<span class="fill-inline">${escDev(day)}</span>` : ''} माहे ${month ? `<span class="fill-inline">${escDev(month)}</span>` : ''} सन ${yearFull} इसवी रोजी ${pronoun} आपली सही केली आहे / अंगठा केला आहे.
</div>

<div class="footer-section">
    <div>
        <p><strong>कबूल करून दाखल.</strong></p>
        <p style="margin-top: 24px;">दिनांक: ${dateFooter}</p>
    </div>
    <div>
        <ul class="sig-list">
            ${buildSignatureListHtml(v.signatureNames)}
        </ul>
    </div>
</div>

</div>
</body>
</html>`;
}
