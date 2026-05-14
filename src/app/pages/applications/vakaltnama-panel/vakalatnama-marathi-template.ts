/**
 * Marathi vakalatnama (वकीलपत्र) HTML used for view / download / print.
 * Layout matches court-style template; dynamic parts are escaped for safety.
 */

export interface VakalatnamaMarathiVars {
  applicationNo: string;
  /** e.g. court / bench location line */
  courtPlace: string;
  /** Office / कार्यालय name before "यांचे कोर्टात" (step 1). */
  courtOfficeName: string;
  caseNumber: string;
  /** Last two digits of year, e.g. "26" */
  caseYearTwoDigits: string;
  /** वादी / अर्जदार line */
  applicantLine: string;
  /** First respondent line */
  respondentLine1: string;
  respondentLine2: string;
  /** "मी / आम्ही …" self-identification lines */
  representativeSelfLine: string;
  /** Matter / proceeding description inside legal paragraph */
  matterDescription: string;
  /** Advocate(s) empowered — shown in legal body */
  advocateEmpoweredLine: string;
  /** "या लेखावरून" line */
  deedLine: string;
  dateDay: string;
  monthMah: string;
  yearTwoDigits: string;
}

export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildMarathiVakalatnamaHtml(v: VakalatnamaMarathiVars): string {
  const e = escapeHtml;
  return `<!DOCTYPE html>
<html lang="mr">
<head>
    <meta charset="UTF-8">
    <title>वकीलपत्र</title>
    <style>
        @page { size: A4; margin: 20mm; }
        body {
            font-family: 'Segoe UI', Tahoma, 'Noto Sans Devanagari', Devanagari, sans-serif;
            line-height: 1.8;
            color: #1a1a1a;
            max-width: 800px;
            margin: auto;
            padding: 30px;
            border: 2px solid #000;
        }
        .header { text-align: center; font-size: 26pt; font-weight: 800; text-decoration: underline; margin-bottom: 10px; }
        .ni-no { text-align: right; font-size: 14pt; margin-bottom: 20px; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        .stamp-box {
            border: 1.5px solid #000;
            width: 110px;
            height: 150px;
            text-align: center;
            font-size: 9pt;
            color: #666;
        }
        .content-cell { padding-left: 25px; vertical-align: bottom; }
        .dotted-line {
            border-bottom: 1px dotted #000;
            display: inline-block;
            flex-grow: 1;
            margin-left: 5px;
            min-width: 50px;
        }
        .flex-row { display: flex; align-items: flex-end; margin-bottom: 8px; flex-wrap: wrap; }
        .vs-divider { text-align: center; font-weight: bold; font-size: 16pt; padding: 15px 0; }

        .legal-body { text-align: justify; text-indent: 50px; font-size: 13pt; margin-top: 30px; }
        .footer-section { display: flex; justify-content: space-between; margin-top: 60px; flex-wrap: wrap; gap: 16px; }
        .sig-list { list-style: none; padding: 0; }
        .sig-list li { margin-bottom: 12px; border-bottom: 1px solid #000; width: 250px; max-width: 100%; min-height: 25px; }
        .fill-inline { display: inline-block; min-width: 120px; padding: 0 4px; }
    </style>
</head>
<body>

<div class="header">वकीलपत्र</div>
<div class="ni-no">अर्ज क्र. &nbsp;<span class="fill-inline">${e(v.applicationNo) || '__________'}</span></div>

<table>
    <tr>
        <td class="stamp-box">कोर्ट फी स्टॅम्पसाठी जागा</td>
        <td class="content-cell">
            <div class="flex-row"><span class="fill-inline">${e(v.courtPlace) || '_____________________'}</span> येथील मे. <span class="dotted-line"></span> <span class="fill-inline">${e(v.courtOfficeName) || '________________'}</span> यांचे कोर्टात</div>
            <div class="flex-row"><span class="fill-inline">${e(v.caseNumber) || '________'}</span> क्रमांक , सन २०<span class="fill-inline">${e(v.caseYearTwoDigits) || '__'}</span></div>
<br>
            <div class="flex-row"><span class="fill-inline">${e(v.applicantLine) || '________'}</span> वादी / अर्जदार / पिटीशनर</div>
        </td>
    </tr>
</table>

<div class="vs-divider">।। विरुद्ध ।।</div>

<table>
    <tr>
        <td class="stamp-box">स्टॅम्पसाठी जागा</td>
        <td class="content-cell">
            <div class="flex-row"><span class="fill-inline">${e(v.respondentLine1) || '________'}</span> प्रतिवादी / जवाब देणार /</div>
            <div class="flex-row"><span class="fill-inline">${e(v.respondentLine2) || '________'}</span> रिस्पॉडंट / आरोपी / सामनेवाला</div>
<br><br><br>
            <div class="flex-row">मी / आम्ही <span class="fill-inline">${e(v.representativeSelfLine) || '________'}</span></div><br>
            <div class="flex-row"><span class="dotted-line"></span></div><br>
       <div class="flex-row"><span class="dotted-line"></span></div>
        </td>
    </tr>
</table>

 <div class="flex-row">
    यांनी या लेखावरून
  <span class="fill-inline">${e(v.deedLine) || '________'}</span>
</div>

<div class="legal-body">
    यांस / माझे आमचे तर्फे हजर राहून वर लिहिलेल्या <span class="fill-inline" style="min-width: 200px;">${e(v.matterDescription) || '________'}</span> चे काम चालविण्यास आमचेतर्फे <span class="fill-inline">${e(v.advocateEmpoweredLine) || '________'}</span> यांना वकील नेमले आहे. या गोष्टीचे साक्षीकरिता आज दिनांक <span class="fill-inline">${e(v.dateDay) || '__'}</span> माहे <span class="fill-inline">${e(v.monthMah) || '________'}</span> सन २०<span class="fill-inline">${e(v.yearTwoDigits) || '__'}</span> इसवी रोजी मी / आम्ही आपली सही केली आहे / अंगठा केला आहे.
</div>

<div class="footer-section">
    <div>
        <p><strong>कबल करून दाखल.</strong></p>
        <br>
        <p>दिनांक: &nbsp;&nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;&nbsp; / २०<span class="fill-inline">${e(v.yearTwoDigits) || '__'}</span></p>
    </div>
    <div>
        <ul class="sig-list">
            <li>१.</li>
            <li>२.</li>
            <li>३.</li>
            <li>४.</li>
        </ul>
    </div>
</div>

</body>
</html>`;
}
