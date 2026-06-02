/**
 * Marathi Satyapan Namuna (सत्यापन नमुना) HTML used for view / download / print.
 * Verification format accompanying अर्ज / अपील ज्ञापन.
 * Layout matches court-style template; dynamic parts are escaped for safety.
 */

const DEVANAGARI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'] as const;

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

function orBlank(value: string | undefined | null): string {
  return (value || '').trim();
}

export interface SatyapanNamunaVars {
  // Opening statement
  deponentName: string;       // मी [name]
  deponentAge: string;        // वय सुमारे [age] वर्षे
  deponentOccupation: string; // धंदा: [occupation]
  deponentAddress: string;    // राहणार: [address]
  deponentTaluka: string;     // तालुका: [taluka]
  deponentDistrict: string;   // जिल्हा: [district]

  // Footer left
  dateDay: string;            // दिनांक
  dateMonth: string;          // month e.g. मे
  dateYear: string;           // two digit e.g. 26
  footerPlace: string;        // ठिकाण

  // Footer left — advocate
  advocateName: string;       // वकिलाचे नाव व स्वाक्षरी

  // Footer right — deponent
  signatoryName: string;      // प्रतिज्ञा करणार / सत्यापन करणार — नांव
}

export function buildMarathiSatyapanNamunaHtml(v: SatyapanNamunaVars): string {
  const deponentName       = orBlank(v.deponentName);
  const deponentAge        = orBlank(v.deponentAge);
  const deponentOccupation = orBlank(v.deponentOccupation);
  const deponentAddress    = orBlank(v.deponentAddress);
  const deponentTaluka     = orBlank(v.deponentTaluka);
  const deponentDistrict   = orBlank(v.deponentDistrict);
  const day                = orBlank(v.dateDay);
  const month              = orBlank(v.dateMonth);
  const yy                 = orBlank(v.dateYear);
  const place              = orBlank(v.footerPlace);
  const advocateName       = orBlank(v.advocateName);
  const sigName            = orBlank(v.signatoryName);

  const dateFull = [
    day   ? toDevanagariDigits(day)   : '',
    month ? escDev(month)             : '',
    yy    ? `२०${toDevanagariDigits(yy)}` : '',
  ].filter(Boolean).join(' / ');

  return `<!DOCTYPE html>
<html lang="mr">
<head>
    <meta charset="UTF-8">
    <title>सत्यापन नमुना</title>
    <style>
        @page {
            size: A4;
            margin: 25mm 20mm 25mm 20mm;
        }
        html, body {
            margin: 0;
            padding: 0;
            background: #fff;
        }
        body {
            font-family: 'Noto Serif Devanagari', 'Mangal', serif;
            font-size: 12pt;
            line-height: 1.8;
            color: #000;
            max-width: 800px;
            margin: auto;
            padding: 20px;
        }
        @media screen {
            body { margin: 20px auto; }
        }
        .section-title {
            text-align: center;
            font-size: 16pt;
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 30px;
        }
        .statement {
            text-indent: 50px;
            text-align: justify;
            font-size: 12pt;
            margin-bottom: 30px;
            line-height: 1.9;
        }
        .footer-section {
            width: 100%;
            margin-top: 50px;
            page-break-inside: avoid;
        }
        .footer-table {
            width: 100%;
            border-collapse: collapse;
        }
        .footer-table td {
            vertical-align: top;
            padding: 10px 0;
        }
        .sign-box {
            display: inline-block;
            text-align: center;
            float: right;
            line-height: 1.6;
        }
        .advocate-block {
            font-size: 12pt;
            margin-top: 40px;
        }
        .advocate-line {
            border-top: 1px solid #000;
            padding-top: 4px;
            display: inline-block;
            min-width: 220px;
        }
        strong.val {
            font-weight: 600;
        }
    </style>
</head>
<body>

    <div class="section-title">सत्यापन नमुना</div>

    <!-- Main Statement — all static legal text, only opening fields are dynamic -->
    <p class="statement">
        मी ${deponentName ? `<strong class="val">${escDev(deponentName)}</strong>` : ''},
        वय सुमारे ${deponentAge ? `<strong class="val">${escDev(deponentAge)}</strong>` : ''} वर्षे,
        धंदा: ${deponentOccupation ? `<strong class="val">${escDev(deponentOccupation)}</strong>` : ''},
        राहणार: ${deponentAddress ? `<strong class="val">${escDev(deponentAddress)}</strong>` : ''},
        तालुका: ${deponentTaluka ? `<strong class="val">${escDev(deponentTaluka)}</strong>` : ''},
        जिल्हा: ${deponentDistrict ? `<strong class="val">${escDev(deponentDistrict)}</strong>` : ''}.
        मी यापुढे जाहीर करतो की, उपरोक्त अर्ज / अपील ज्ञापन यामध्ये नमूद केलेले तथ्ये, वस्तुस्थिती अथवा माहिती ही माझ्या समजुतीप्रमाणे खरी व बरोबर आहे. उपरोक्त अर्ज / अपील ज्ञापन, यामध्ये नमूद केलेली कोणतीही तथ्ये, वस्तुस्थिती अथवा माहिती लपवण्यात आलेली नाही अथवा दाबून टाकलेली नाही. मला जाणीव आहे की, या कार्यवाहीच्या कोणत्याही टप्प्यावर मी उद्देशपूर्वक खोटा पुरावा देणार नाही / दिलेला नाही किंवा खोटा पुरावा रचणार नाही. मी कोणतेही अधिकथन खोटे आहे अथवा खोटे असल्याचे मला स्वतःला माहित असूनही अथवा तसे खोटे असल्याचे मी स्वतः समजतो किंवा खरे आहे असे मी स्वतः समजत नाही, असे अधिकथन मी करणार नाही अथवा केलेले नाही. तसेच या कार्यवाहीत पीठासीन असलेल्या लोकसेवकाचा उद्देशपूर्वक अपमान करणार नाही किंवा त्यांच्या कामात व्यत्यय आणणार नाही. मला जाणीव आहे की, उपरोक्त बाबींचा भंग झाल्यास <strong>भारतीय न्याय संहिता, २०२३</strong> ची कलमे २२९, २३० व २६७ अन्वये होणाऱ्या शिक्षेस पात्र राहीन.
    </p>

    <!-- Footer -->
    <div class="footer-section">
        <table class="footer-table">
            <tr>
                <td style="width: 50%;">
                    <p style="font-size: 12pt; margin: 0 0 10px 0;">
                        <strong>दिनांक:</strong> ${dateFull ? `<strong class="val">${dateFull}</strong>` : ''}
                    </p>
                    <p style="font-size: 12pt; margin: 0 0 40px 0;">
                        <strong>ठिकाण:</strong> ${place ? `<strong class="val">${escDev(place)}</strong>` : ''}
                    </p>
                    <br><br>
                    <div class="advocate-block">
                        <div class="advocate-line">
                            ${advocateName ? `<strong class="val">${escDev(advocateName)}</strong>` : ''}
                        </div><br>
                        <strong>वकिलाचे नाव व स्वाक्षरी</strong>
                    </div>
                </td>

                <td style="width: 50%; text-align: right;">
                    <div class="sign-box">
                        <br><br><br><br>
                        <strong>प्रतिज्ञा करणार / सत्यापन करणार</strong><br>
                        नांव: ${sigName ? `<strong class="val">${escDev(sigName)}</strong>` : ''}<br>
                        <strong>(सही / अंगठा)</strong>
                    </div>
                </td>
            </tr>
        </table>
    </div>

</body>
</html>`;
}
