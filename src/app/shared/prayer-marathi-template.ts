export interface SatyaPratijnalekhVars {
  signatoryName: string; // श्री / श्रीमती ___
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

function orBlank(value: string): string {
  return (value || '').trim();
}


export function buildMarathiSatyaPratijnalekhHtml(v: SatyaPratijnalekhVars): string {
  const sigName = orBlank(v.signatoryName);

  return `<!DOCTYPE html>
<html lang="mr">
<head>
    <meta charset="UTF-8">
    <title>सत्य प्रतिज्ञालेख</title>
    <style>
        @page { size: A4; margin: 20mm; }
        html, body {
            margin: 0;
            padding: 0;
            background: #fff;
        }
        body {
            font-family: 'Noto Serif Devanagari', 'Mangal', serif;
            font-size: 13pt;
            line-height: 1.9;
            color: #000;
        }
        .container {
            width: 170mm;
            margin: 0 auto;
            padding: 10mm;
            box-sizing: border-box;
        }
        @media screen {
            .container { margin: 30px auto; }
        }
        .title {
            font-size: 15pt;
            font-weight: bold;
            text-align: center;
            margin-bottom: 24px;
            text-decoration: underline;
        }
        .body-text {
            text-align: justify;
            text-indent: 50px;
            font-size: 13pt;
            line-height: 2;
            margin-bottom: 40px;
        }
        .closing {
            text-align: right;
            margin-right: 12%;
            font-size: 13pt;
            margin-bottom: 16px;
        }
        .signature-line {
            text-align: center;
            font-size: 13pt;
            margin-top: 8px;
            border-top: 1px solid #000;
            display: inline-block;
            padding-top: 6px;
            min-width: 260px;
        }
        .signature-wrap {
            text-align: right;
        }
    </style>
</head>
<body>
<div class="container">

    <div class="title">सत्य प्रतिज्ञालेख</div>

    <div class="body-text">
        वर नमूद केलेली सर्व माहिती खरी असून त्यांचे सत्यतेबाबत मी खात्री केली असून यामध्ये काहीही खोटे आढळून आल्यास मी भारतीय दंड संहिता १८६० चे कलम १९९ (२) १९९, २०० च्या तरतुदीनुसार होणाऱ्या कायदेशीर कारवाईस पात्र राहील याची मला जाणीव आहे.
    </div>

    <div class="closing">आपला विश्वासू</div>

    <div class="signature-wrap">
        <div class="signature-line">
            ( श्री / श्रीमती ${sigName ? `<strong>${escDev(sigName)}</strong>` : ''} )
        </div>
    </div>

</div>
</body>
</html>`;
}
