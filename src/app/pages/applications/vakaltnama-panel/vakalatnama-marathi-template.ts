/**
 * Marathi vakalatnama (वकीलपत्र) HTML used for view / download / print.
 * Layout matches court-style template; dynamic parts are escaped for safety.
 */

export interface VakalatnamaMarathiVars {
  // Existing fields (kept for backward compatibility during testing)
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

  // New fields for updated template
  applicantNames?: string[];       // numbered list १.२.३.४. under अर्जदार / वादी
  respondentNames?: string[];      // numbered list १.२.३.४. under प्रतिवादी / जवाबदार
  representativeAddress?: string;  // रा. [address]
  advocateName?: string;           // अधिवक्ता श्री. [name]
  advocateRegistrationNo?: string; // अधिवक्ता नोंदणी क्र. [reg]
  footerPlace?: string;            // ठिकाण : [place]
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
  const matterDescription =v.matterDescription ?? '';
  const advocateBarCouncilNumber =
  matterDescription.match(/\(([^()]+)\)\s*$/)?.[1] || '';

  const appNo = orBlank(v.applicationNo);
  const courtPlace = orBlank(v.courtPlace);
  const courtOffice = orBlank(v.courtOfficeName);
  const caseNo = orBlank(v.caseNumber);
  const caseYy = orBlank(v.caseYearTwoDigits);
  const selfLine = orBlank(v.representativeSelfLine);
  const pronoun = v.representativePronoun === 'आम्ही' ? 'आम्ही' : 'मी';
  const addressLine = orBlank(v.representativeAddress ?? '');
  const advocateName = orBlank(v.advocateName ?? v.advocateEmpoweredLine);
  const advocateReg = orBlank(v.advocateRegistrationNo ?? '');
  const matter = orBlank(v.matterDescription);
  const deed = orBlank(v.deedLine);
  const day = orBlank(v.dateDay);
  const month = orBlank(v.monthMah);
  const yy = orBlank(v.yearTwoDigits);
  const place = orBlank(v.footerPlace ?? '');
  const yearFull = yy ? `२०${toDevanagariDigits(yy)}` : '';
  const dayDev = day ? toDevanagariDigits(day) : '';
  const monthDev = month ? escDev(month) : '';

  // Exact same logic as original courtLineParts
  const courtLineParts: string[] = [];
  if (courtPlace) courtLineParts.push(`<strong>${escDev(courtPlace)}</strong> येथील मा.`);
  else courtLineParts.push('येथील मा.');
  if (courtOffice) courtLineParts.push(`<strong>${escDev(courtOffice)}</strong> येथे`);
  else courtLineParts.push('येथे');
  const courtLine = courtLineParts.join(' ');

  const caseLine = [
    caseNo ? `प्रकरण क्र. <strong>${escDev(caseNo)}</strong>` : 'प्रकरण क्र.',
    yearFull ? `सन ${yearFull}` : '',
  ].filter(Boolean).join(' / ');

  // Splits "A, B" into ["A", "B"] as safety net
  const normalizeNames = (names: string[]): string[] =>
    names.length === 1 && names[0].includes(',')
      ? names[0].split(',').map(n => n.trim()).filter(Boolean)
      : names;

  const applicants: string[] = normalizeNames(
    v.applicantNames ?? (v.applicantLine ? [v.applicantLine] : [])
  );
  const respondents: string[] = normalizeNames(
    v.respondentNames ?? ([v.respondentLine1, v.respondentLine2].filter(Boolean) as string[])
  );

  const devanagariNums = ['१', '२', '३', '४', '५', '६', '७', '८', '९'];

  // No empty underlines — only render rows that have data; blank form shows 4 empty numbered rows
  const buildPartyRows = (names: string[]): string => {
    const rows = names.length > 0 ? names : ['', '', '', ''];
    return rows.map((name, i) => {
      const num = devanagariNums[i] ?? `${i + 1}`;
      return `<div>${num}. ${name ? `<strong>${escDev(name)}</strong>` : ''}</div>`;
    }).join('\n');
  };

  const buildSigRows = (names: string[]): string => {
    const rows = names.length > 0 ? names : ['', '', '', ''];
    return rows.map((name, i) => {
      const num = devanagariNums[i] ?? `${i + 1}`;
      return `<div class="sig-row">${num}. ${name ? `<strong>${escDev(name)}</strong>` : ''}</div>`;
    }).join('\n');
  };

  return `<!DOCTYPE html>
<html lang="mr">
<head>
    <meta charset="UTF-8">
    <title>वकीलपत्र</title>
    <style>
        @page { size: A4; margin: 8mm 6mm; }
        html, body {
            margin: 0;
            padding: 0;
            background: #fff;
        }
        body {
            font-family: 'Noto Serif Devanagari', 'Mangal', serif;
            font-size: 13pt;
            line-height: 1.6;
            color: #000;
        }
        .container {
            width: 190mm;
            margin: 0 auto;
            border: 2px solid #000;
            padding: 6mm 10mm;
            box-sizing: border-box;
        }
        @media screen {
            .container { margin: 10px auto; }
        }
        .title {
            text-align: center;
            font-size: 26pt;
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 6px;
        }
        .application {
            text-align: right;
            font-size: 13pt;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .section {
            display: flex;
            align-items: flex-start;
            margin-top: 8px;
        }
        .stamp {
            width: 100px;
            min-height: 120px;
            border: 1.5px solid #000;
            text-align: center;
            padding-top: 20px;
            font-size: 10pt;
            margin-right: 16px;
            flex-shrink: 0;
            line-height: 1.8;
        }
        .content {
            flex: 1;
            font-size: 13pt;
        }
        .court-line {
            margin-bottom: 4px;
            line-height: 1.7;
        }
        .case-line {
            margin-top: 4px;
            margin-bottom: 4px;
        }
        .party-title {
            margin-top: 6px;
            font-weight: bold;
        }
        .party-list {
            margin-top: 2px;
            padding-left: 16px;
        }
        .party-list div {
            margin-bottom: 3px;
            line-height: 1.6;
        }
        .versus {
            text-align: center;
            font-size: 20pt;
            font-weight: bold;
            margin: 10px 0;
        }
        .intro {
            margin-top: 8px;
            font-size: 13pt;
            line-height: 1.8;
        }
        .deed-row {
            margin-top: 8px;
            font-size: 13pt;
            line-height: 1.7;
        }
        .paragraph {
            margin-top: 10px;
            text-align: justify;
            text-indent: 40px;
            font-size: 13pt;
            line-height: 1.7;
        }
        .advocate-block {
            margin-top: 8px;
            margin-left: 60px;
            font-size: 13pt;
            line-height: 1.9;
            font-weight: bold;
        }
        .accept {
            margin-top: 10px;
            font-size: 13pt;
            font-weight: bold;
        }
        .footer {
            margin-top: 14px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        .date {
            font-size: 13pt;
            line-height: 2;
        }
        .sig-section {
            width: 44%;
        }
        .sig-row {
            border-bottom: 1px solid #000;
            margin-top: 8px;
            min-height: 24px;
            text-align: left;
            padding-left: 4px;
            line-height: 1.6;
        }
        .signature-title {
            margin-top: 6px;
            font-weight: bold;
            font-size: 13pt;
        }
        .advocate-sign {
            margin-top: 30px;
            text-align: center;
        }
        .advocate-line {
            border-top: 1.5px solid #000;
            width: 65%;
            margin: 0 auto;
            padding-top: 4px;
            font-weight: bold;
            font-size: 13pt;
        }
    </style>
</head>
<body>
<div class="container">

    <div class="title">वकीलपत्र</div>

    <div class="application">
        अर्ज क्र. : ${appNo ? `<strong>${escapeHtml(appNo)}</strong>` : ''}
    </div>

    <!-- Applicant Section -->
    <div class="section">
        <div class="stamp">कोर्ट फी<br>स्टॅम्पसाठी<br>जागा</div>
        <div class="content">
            <div class="court-line">${courtLine}</div>
            ${caseLine ? `<div class="case-line">${caseLine}</div>` : ''}
            <div class="party-title">अर्जदार / वादी</div>
            <div class="party-list">
                ${buildPartyRows(applicants)}
            </div>
        </div>
    </div>

    <!-- Versus -->
    <div class="versus">॥ विरुद्ध ॥</div>

    <!-- Respondent Section -->
    <div class="section">
        <div class="stamp">स्टॅम्पसाठी<br>जागा</div>
        <div class="content">
            <div class="party-title">प्रतिवादी / जवाबदार</div>
            <div class="party-list">
                ${buildPartyRows(respondents)}
            </div>
        </div>
    </div>

    <!-- Intro -->
    <div class="intro">
        ${pronoun} ${selfLine ? `<strong>${escDev(selfLine)}</strong>` : ''}
        ${`रा. <strong>${escDev(addressLine)}</strong>`}
    </div>


    <!-- Main Paragraph -->
    <div class="paragraph">
        यांनी या लेखावरून माझेतर्फे / आमचेतर्फे हजर राहून वरील ${matter ? `<strong>${escDev(matter)}</strong> ` : 'प्रकरणामध्ये '}कामकाज चालविणेस, आवश्यक ते अर्ज, पुरावे, कागदपत्रे सादर करण्यासाठी तसेच सदर प्रकरणासंबंधी सर्व आवश्यक कार्यवाही करण्यासाठी खालील अधिवक्ता यांची नेमणूक केलेली आहे.
    </div>

    <!-- Advocate -->
    <div class="advocate-block">
        ${advocateName ? `अधिवक्ता श्री. ${escDev(advocateName)}` : 'अधिवक्ता श्री.'}
        ${`<br>अधिवक्ता नोंदणी क्र. ${escDev(advocateBarCouncilNumber)}`}
    </div>

    <!-- Declaration -->
    <div class="paragraph">
        या गोष्टीचे साक्षीकरिता आज दिनांक${dayDev ? ` <strong>${dayDev}</strong>` : ''} माहे${monthDev ? ` <strong>${monthDev}</strong>` : ''}${yearFull ? ` सन <strong>${yearFull}</strong>` : ''} रोजी ${pronoun} सही / अंगठा केलेला आहे.
    </div>

    <!-- Accept -->
    <div class="accept">कबूल करून दाखल.</div>

    <!-- Footer -->
    <div class="footer">
        <div class="date">
            दिनांक : ${dayDev} / ${monthDev} / ${yearFull}
            ${`<br>ठिकाण : ${escDev(courtPlace)}`}
        </div>
        <div class="sig-section">
            ${buildSigRows(v.signatureNames)}
            <div class="signature-title">अर्जदार / वादी यांची सही</div>
            <div class="advocate-sign">
                <div class="advocate-line">अधिवक्ता</div>
            </div>
        </div>
    </div>

</div>
</body>
</html>`;
}
