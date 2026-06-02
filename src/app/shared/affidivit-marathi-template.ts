/**
 * Marathi Affidavit (शपथपत्र) HTML used for view / download / print.
 * अर्ज / अपील ज्ञापनासमवेतचे शपथपत्र
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

export interface ShapathPatraVars {
  // Opening statement
  deponentName: string;         // मी [name]
  deponentAge: string;          // वय [age] वर्षे
  deponentAddress: string;      // राहणार: [address]

  // Point 2 & 3 — paragraph range
  paraRangeFrom2: string;       // परिच्छेद क्र. [from] ते — point 2
  paraRangeTo2: string;         // ते [to] — point 2
  paraRangeFrom3: string;       // परिच्छेद क्र. [from] ते — point 3
  paraRangeTo3: string;         // ते [to] — point 3

  // Point 12 — pending case details (optional)
  pendingCaseDetails: string;   // प्रलंबित असल्यास तपशील

  // Point 11 — advocate name
  advocateName: string;         // विधीज्ञ श्री. [name]

  // Point 13 — contact info
  applicantPhone: string;       // अर्जदार भ्रमणध्वनी
  advocatePhone: string;        // विधीज्ञ भ्रमणध्वनी
  applicantEmail: string;       // अर्जदार ईमेल
  advocateEmail: string;        // विधीज्ञ ईमेल

  // Footer
  signatoryName: string;        // श्री. [name] यांनी माझ्यासमोर...
}

export function buildMarathiShapathPatraHtml(v: ShapathPatraVars): string {
  const deponentName    = orBlank(v.deponentName);
  const deponentAge     = orBlank(v.deponentAge);
  const deponentAddress = orBlank(v.deponentAddress);
  const paraFrom2       = orBlank(v.paraRangeFrom2);
  const paraTo2         = orBlank(v.paraRangeTo2);
  const paraFrom3       = orBlank(v.paraRangeFrom3);
  const paraTo3         = orBlank(v.paraRangeTo3);
  const pendingDetails  = orBlank(v.pendingCaseDetails);
  const advocateName    = orBlank(v.advocateName);
  const appPhone        = orBlank(v.applicantPhone);
  const advPhone        = orBlank(v.advocatePhone);
  const appEmail        = orBlank(v.applicantEmail);
  const advEmail        = orBlank(v.advocateEmail);
  const sigName         = orBlank(v.signatoryName);

  return `<!DOCTYPE html>
<html lang="mr">
<head>
    <meta charset="UTF-8">
    <title>अर्ज / अपील ज्ञापनासमवेतचे शपथपत्र</title>
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
        .sub-title {
            text-align: center;
            font-size: 14pt;
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 30px;
        }
        .statement-opening {
            text-align: justify;
            font-size: 12pt;
            margin-bottom: 20px;
            line-height: 1.9;
        }
        .point-list {
            list-style-type: none;
            padding-left: 0;
            margin-top: 10px;
        }
        .point-list li {
            text-align: justify;
            font-size: 12pt;
            margin-bottom: 15px;
            display: flex;
        }
        .point-number {
            min-width: 36px;
            font-weight: bold;
            flex-shrink: 0;
        }
        .point-content {
            flex-grow: 1;
        }
        .info-table {
            width: 100%;
            margin-top: 15px;
            margin-bottom: 15px;
            border-collapse: collapse;
        }
        .info-table td {
            padding: 5px;
            vertical-align: top;
            font-size: 12pt;
        }
        .footer-section {
            width: 100%;
            margin-top: 50px;
            page-break-inside: avoid;
        }
        .footer-table {
            width: 100%;
        }
        .footer-table td {
            vertical-align: bottom;
        }
        strong.val {
            font-weight: 600;
        }
    </style>
</head>
<body>

    <div class="sub-title">अर्ज / अपील ज्ञापनासमवेतचे शपथपत्र</div>

    <!-- Opening statement -->
    <p class="statement-opening">
        मी ${deponentName ? `<strong class="val">${escDev(deponentName)}</strong>` : ''},
        वय ${deponentAge ? `<strong class="val">${escDev(deponentAge)}</strong>` : ''} वर्षे,
        राहणार: ${deponentAddress ? `<strong class="val">${escDev(deponentAddress)}</strong>` : ''}
        दृढपूर्वक खालीलप्रमाणे कथन करतो की,
    </p>

    <ul class="point-list">

        <li>
            <div class="point-number">१.</div>
            <div class="point-content">मी या प्रकरणातील अर्जदार / अपीलकार अथवा प्राधिकृत प्रतिनिधी असून अर्ज / अपील ज्ञापनावरील सर्व तथ्ये, कथने अथवा वस्तुस्थिती याबाबत मला पूर्ण माहिती आहे.</div>
        </li>

        <li>
            <div class="point-number">२.</div>
            <div class="point-content">
                सोबत जोडलेल्या अर्जातील / अपील ज्ञापनातील, परिच्छेद क्र.
                ${paraFrom2 ? `<strong class="val">${escDev(paraFrom2)}</strong>` : ''}
                ते
                ${paraTo2 ? `<strong class="val">${escDev(paraTo2)}</strong>` : ''}
                मधील वस्तुस्थिती, तथ्ये व कथने हे माझ्या माहितीप्रमाणे व वैयक्तिक ज्ञानाप्रमाणे, खरे व बरोबर आहेत.
            </div>
        </li>

        <li>
            <div class="point-number">३.</div>
            <div class="point-content">
                सोबत जोडलेल्या अर्जातील / अपील ज्ञापनातील, परिच्छेद क्र.
                ${paraFrom3 ? `<strong class="val">${escDev(paraFrom3)}</strong>` : ''}
                ते
                ${paraTo3 ? `<strong class="val">${escDev(paraTo3)}</strong>` : ''}
                मधील वस्तुस्थिती, तथ्ये व कथने हे माझ्या ताब्यात असलेल्या कागदपत्रांवरून खरे असल्याबाबत माझी खात्री झालेली आहे.
            </div>
        </li>

        <li>
            <div class="point-number">४.</div>
            <div class="point-content">अर्ज / अपील ज्ञापनातील, वस्तुस्थिती, तथ्ये व कथने याच्याशी संबंधित सर्व अभिलेख मी उघड केलेले आहेत व सोबत जोडलेले आहेत. याव्यतिरिक्त माझ्याकडे कोणतीही कागदपत्रे / अभिलेख जे अर्ज / अपीलावर परिणाम करू शकतील असे नाहीत.</div>
        </li>

        <li>
            <div class="point-number">५.</div>
            <div class="point-content">अर्ज / अपील ज्ञापन यामध्ये नमूद केलेले तथ्ये, वस्तुस्थिती अथवा माहिती ही माझ्या समजुतीप्रमाणे खरी व बरोबर आहे. उपरोक्त अर्ज / अपील ज्ञापन, यामध्ये नमूद केलेली कोणतीही तथ्ये, वस्तुस्थिती अथवा माहिती लपवण्यात आलेली नाही अथवा दाबून टाकलेली नाही. मला जाणीव आहे की, या कार्यवाहीच्या कोणत्याही टप्प्यावर मी उद्देशपूर्वक खोटा पुरावा देणार नाही / दिलेला नाही किंवा खोटा पुरावा रचणार नाही. मी कोणतेही अधिकथन खोटे आहे अथवा खोटे असल्याचे मला स्वतःला माहित असूनही अथवा तसे खोटे असल्याचे मी स्वतः समजतो किंवा खरे आहे असे मी स्वतः समजत नाही, असे अधिकथन मी करणार नाही अथवा केलेली नाही. तसेच या कार्यवाहीत पीठासीन असलेल्या लोकसेवकाचा उद्देशपूर्वक अपमान करणार नाही किंवा त्यांच्या कामात व्यत्यय आणणार नाही.</div>
        </li>

        <li>
            <div class="point-number">६.</div>
            <div class="point-content">मी या शपथपत्राद्वारे हमी देतो की, इलेक्ट्रॉनिक माध्यमाद्वारे केलेला पत्रव्यवहार / पाठवलेली नोटीस, ही वैधरीत्या मला करण्यात आलेला पत्रव्यवहार / नोटीस बजावणी झाली असल्याचे समजेल.</div>
        </li>

        <li>
            <div class="point-number">७.</div>
            <div class="point-content">अर्ज / अपीलासमवेत वाद मिळकतीशी संदर्भातील हस्तांतराचा / व्यवहारांचा / फेरफारांचा तपशील जोडपत्र-चार मधील नमुन्यात कालक्रमानुसार नमूद करण्यात आलेला आहे व तो बरोबर व खरा आहे.</div>
        </li>

        <li>
            <div class="point-number">८.</div>
            <div class="point-content">अर्ज / अपीलासमवेत सर्व आवश्यक अभिलेख तसेच फेरफाराच्या प्रमाणित व वाचनीय प्रती सादर करण्यात आलेल्या आहेत.</div>
        </li>

        <li>
            <div class="point-number">९.</div>
            <div class="point-content">जाबदार / उत्तरवादी यांना नोटीस बजावण्यासाठी आवश्यक ते डाकेचे पाकीट व डाक मुद्रांकासह सोबत जोडलेले आहे.</div>
        </li>

        <li>
            <div class="point-number">१०.</div>
            <div class="point-content">अर्ज / अपील ज्ञापनामध्ये नमूद करण्यात आलेले, अर्जदार / जाबदार / उत्तरवादी / अपीलकार यांचे पत्ते हे खरे व बरोबर असल्याची मी खात्री केलेली आहे.</div>
        </li>

        <li>
            <div class="point-number">११.</div>
            <div class="point-content">
                प्रस्तुत प्रकरणात, उपरोक्त काम माझ्यावतीने पाहण्यासाठी विधीज्ञ श्री.
                ${advocateName ? `<strong class="val">${escDev(advocateName)}</strong>` : ''}
                यांना प्राधिकृत करण्यात आलेले आहे. त्याबाबतचे वकीलपत्र / प्राधिकार पत्र सोबत जोडलेले आहे.
            </div>
        </li>

        <li>
            <div class="point-number">१२.</div>
            <div class="point-content">
                या न्यायपीठाशिवाय अन्य महसूल न्यायपीठाकडे / मा. दिवाणी न्यायालयाकडे / अन्य अभिन्यायीक प्राधिकाऱ्याकडे / मा. उच्च न्यायालयामध्ये कोणताही अर्ज / अपील / रिट याचिका / विशेष अनुमती याचिका प्रलंबित नाही. प्रलंबित असल्यास त्याचा तपशील नमूद करावा:
                ${pendingDetails ? `<strong class="val">${escDev(pendingDetails)}</strong>` : ''}
            </div>
        </li>

        <li>
            <div class="point-number">१३.</div>
            <div class="point-content">संपर्कासाठी माझा व माझ्या विधीज्ञांचा भ्रमणध्वनी क्रमांक व ईमेल आयडी खालीलप्रमाणे आहे.</div>
        </li>

    </ul>

    <!-- Contact Info Table -->
    <table class="info-table">
        <tr>
            <td style="width: 25%;"><strong>भ्रमणध्वनी क्रमांक:</strong></td>
            <td>१. अर्जदार: ${appPhone ? `<strong class="val">${escapeHtml(appPhone)}</strong>` : ''}</td>
            <td>२. विधीज्ञ: ${advPhone ? `<strong class="val">${escapeHtml(advPhone)}</strong>` : ''}</td>
        </tr>
        <tr>
            <td><strong>ईमेल आयडी:</strong></td>
            <td>१. अर्जदार: ${appEmail ? `<strong class="val">${escapeHtml(appEmail)}</strong>` : ''}</td>
            <td>२. विधीज्ञ: ${advEmail ? `<strong class="val">${escapeHtml(advEmail)}</strong>` : ''}</td>
        </tr>
    </table>

    <!-- Footer -->
    <div class="footer-section">
        <p style="text-align: justify; font-size: 12pt;">
            श्री. ${sigName ? `<strong class="val">${escDev(sigName)}</strong>` : ''} यांनी माझ्यासमोर उपरोक्त शपथपत्र स्वाक्षरीकृत केलेले आहे.
        </p>

        <br><br>

        <table class="footer-table">
            <tr>
                <td style="width: 50%; font-size: 12pt;">
                    &nbsp;
                </td>
                <td style="text-align: right; font-size: 12pt;">
                    <div style="display: inline-block; text-align: center;">
                        <br><br>
                        <strong>कार्यकारी दंडाधिकारी / नोटरी</strong>
                    </div>
                </td>
            </tr>
        </table>
    </div>

</body>
</html>`;
}
