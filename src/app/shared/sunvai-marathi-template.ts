
export interface SunvaniNoticeVars {
  // Header
  phoneNumber: string;
  emailId: string;

  // Reference number & date
  referenceNumber: string;        // क्र. [ref] / २०[yy]
  referenceYearTwoDigits: string; // the yy after २०
  noticeDateDay: string;
  noticeDateMonth: string;        // e.g. मे
  noticeDateYear: string;         // two digit e.g. 26

  // Applicant / Appellant (अर्जदार / वादी)
  applicantNames: string[];       // १. २. list
  applicantAddress: string;       // पूर्ण पत्ता

  // Respondent (जाबदार / प्रतिवादी)
  respondentNames: string[];      // १. २. list
  respondentAddress: string;      // पूर्ण पत्ता

  // Subject box
  actSection: string;             // कलम ___
  villageNameMoje: string;        // मौजे ___
  taluka: string;                 // ता. ___
  district: string;               // जि. ___

  // Hearing details
  hearingOfficerName: string;     // यांचेसमोर
  hearingDateDay: string;
  hearingDateMonth: string;
  hearingDateYear: string;
  hearingTime: string;            // वेळ ___ वाजता
  hearingAddress: string;         // सुनावणीचा पत्ता

  // Footer / signature
  signatoryName: string;          // ( ___ )
  signatoryDesignation: string;   // पदनाम
  signatoryOffice: string;        // कार्यालय

  // Copy sent to
  copyRecipients: string[];       // प्रत माहितीसाठी रवाना १. २.
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

export function buildMarathiSunvaniNoticeHtml(v: any): string {
  console.log(v);

  const phone = orBlank(v.phoneNumber);
  const email = orBlank(v.emailId);
  const refNo = orBlank(v.referenceNumber);
  const refYy = orBlank(v.referenceYearTwoDigits);
  const noticeDay = orBlank(v.noticeDateDay);
  const noticeMonth = orBlank(v.noticeDateMonth);
  const noticeYear = orBlank(v.noticeDateYear);
  const applicantAddress = orBlank(v.applicantAddress);
  const respondentAddress = orBlank(v.respondentAddress);
  const actSection = orBlank(v.actSection);
  const village = orBlank(v.villageNameMoje);
  const taluka = orBlank(v.taluka);
  const district = orBlank(v.district);
  const hearingOfficer = orBlank(v.hearingOfficerName);
  const hearingDay = orBlank(v.hearingDateDay);
  const hearingMonth = orBlank(v.hearingDateMonth);
  const hearingYear = orBlank(v.hearingDateYear);
  const hearingTime = orBlank(v.hearingTime);
  const hearingAddress = orBlank(v.hearingAddress);
  const sigName = orBlank(v.signatoryName);
  const sigDesig = orBlank(v.signatoryDesignation);
  const sigOffice = orBlank(v.signatoryOffice);

  const noticeDateFull = [noticeDay, noticeMonth, noticeYear ? `२०${toDevanagariDigits(noticeYear)}` : ''].filter(Boolean).join(' / ');
  const hearingDateFull = [hearingDay, hearingMonth, hearingYear ? `२०${toDevanagariDigits(hearingYear)}` : ''].filter(Boolean).join(' / ');
  const refYyFull = refYy ? toDevanagariDigits(refYy) : '';

  const devanagariNums = ['१', '२', '३', '४', '५', '६', '७', '८', '९'];

  const buildNameRows = (names: string[], minRows = 2): string => {
    const rows = names.length > 0 ? names : Array(minRows).fill('');
    return rows.map((name, i) => {
      const num = devanagariNums[i] ?? `${i + 1}`;
      return `<div class="party-row">${num}. ${name ? `<strong>${escDev(name)}</strong>` : ''}</div>`;
    }).join('\n');
  };

  const buildCopyRows = (names: string[]): string => {
    const rows = names.length > 0 ? names : ['', ''];
    return rows.map((name, i) => {
      const num = devanagariNums[i] ?? `${i + 1}`;
      return `<div class="copy-row">${num}. ${name ? `<strong>${escDev(name)}</strong>` : ''}</div>`;
    }).join('\n');
  };

  return `<!DOCTYPE html>
<html lang="mr">
<head>
    <meta charset="UTF-8">
    <title>सुनावणीची नोटीस</title>
    <style>
        @page { size: A4; margin: 10mm 12mm; }
        html, body {
            margin: 0;
            padding: 0;
            background: #fff;
        }
        body {
            font-family: 'Noto Serif Devanagari', 'Mangal', serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #000;
        }
        .container {
            width: 182mm;
            margin: 0 auto;
            border: 1px solid #000;
            padding: 6mm 8mm;
            box-sizing: border-box;
        }
        @media screen {
            .container { margin: 10px auto; }
        }

        /* Header */
        .gov-header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
        }
        .dept-name {
            font-size: 18pt;
            font-weight: bold;
            margin-bottom: 2px;
        }
        .dept-sub {
            font-size: 12pt;
        }
        .office-name {
            font-size: 14pt;
            font-weight: bold;
            margin: 8px auto;
        }
        .office-address {
            font-size: 11pt;
            line-height: 1.4;
        }

        /* Contact row */
        .contact-info {
            display: flex;
            justify-content: space-between;
            font-size: 10pt;
            border-top: 1px solid #ccc;
            padding-top: 4px;
            margin-bottom: 6px;
        }

        /* Ref + date row */
        .ref-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 12pt;
        }

        /* Notice title */
        .notice-title {
            text-align: center;
            font-size: 18pt;
            font-weight: bold;
            text-decoration: underline;
            margin: 14px 0;
        }

        /* Party sections */
        .prati {
            margin-bottom: 6px;
        }
        .party-row {
            margin-bottom: 2px;
            line-height: 1.7;
        }
        .party-address {
            font-size: 11pt;
            margin-top: 2px;
        }
        .party-label {
            text-align: right;
            font-weight: bold;
            margin-top: 2px;
            font-size: 11pt;
        }
        .versus {
            text-align: center;
            font-weight: bold;
            font-size: 14pt;
            margin: 8px 0;
        }

        /* Subject box */
        .subject-box {
            background-color: #f2f2f2;
            border: 1px solid #333;
            padding: 10px 12px;
            margin: 12px 0;
            font-size: 12pt;
            line-height: 1.8;
        }

        /* Main content */
        .main-content {
            text-align: justify;
            margin-bottom: 12px;
            font-size: 12pt;
            line-height: 1.7;
        }

        /* Ex-parte notice box */
        .ex-parte-notice {
            border: 1px solid #000;
            padding: 10px 12px;
            font-weight: bold;
            margin-bottom: 14px;
            font-size: 12pt;
            line-height: 1.7;
            text-align: justify;
        }

        /* Hearing address */
        .hearing-address {
            font-weight: bold;
            margin-bottom: 14px;
            font-size: 12pt;
        }

        /* Footer */
        .footer-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 30px;
        }
        .copy-section {
            font-size: 11pt;
            line-height: 1.8;
        }
        .copy-row {
            margin-bottom: 2px;
        }
        .sig-block {
            text-align: center;
            min-width: 200px;
        }
        .sig-name {
            border-top: 1px solid #000;
            padding-top: 4px;
            font-weight: bold;
            font-size: 12pt;
            margin-bottom: 4px;
        }
        .sig-detail {
            font-size: 11pt;
            text-align: left;
            line-height: 1.8;
        }
    </style>
</head>
<body>
<div class="container">

    <!-- Government Header -->
    <div class="gov-header">
        <div class="dept-name">महाराष्ट्र शासन</div>
        <div class="dept-sub">महसूल व वन विभाग</div>
        <div class="office-name">जमाबंदी आयुक्त आणि संचालक भूमी अभिलेख (म.राज्य), पुणे</div>
        <div class="office-address">दूसरा व तिसरा मजला, नवीन प्रशासकीय इमारत, विधान भवन समोर, कॅम्प, पुणे - ४११००१</div>
    </div>

    <!-- Contact Info -->
    <div class="contact-info">
        <div>दूरध्वनी क्र. : ${phone ? `<strong>${escapeHtml(phone)}</strong>` : ''}</div>
        <div>Email ID : ${email ? `<strong>${escapeHtml(email)}</strong>` : ''}</div>
    </div>

    <!-- Reference & Date -->
    <div class="ref-row">
        <div>क्र. ${refNo ? `<strong>${escapeHtml(refNo)}</strong>` : ''} / २०${refYyFull}</div>
        <div>दिनांक : ${noticeDateFull ? `<strong>${noticeDateFull}</strong>` : ''}</div>
    </div>

    <!-- Notice Title -->
    <div class="notice-title">सुनावणीची नोटीस</div>

    <!-- Applicant / Appellant -->
    <div class="prati">
        <strong>प्रति,</strong>
        ${buildNameRows(v.applicantNames)}
        ${applicantAddress ? `<div class="party-address">(पूर्ण पत्ता : <strong>${escDev(applicantAddress)}</strong>)</div>` : '<div class="party-address">(पूर्ण पत्ता : )</div>'}
        <div class="party-label">...अपीलदार / अर्जदार / वादी</div>
    </div>

    <!-- Versus -->
    <div class="versus">विरुद्ध</div>

    <!-- Respondent -->
    <div>
        ${buildNameRows(v.respondentNames)}
        ${respondentAddress ? `<div class="party-address">(पूर्ण पत्ता : <strong>${escDev(respondentAddress)}</strong>)</div>` : '<div class="party-address">(पूर्ण पत्ता : )</div>'}
        <div class="party-label">...जाबदार / प्रतिवादी</div>
    </div>

    <!-- Subject Box -->
    <div class="subject-box">
        <strong>विषय :</strong> महाराष्ट्र जमीन महसूल अधिनियम, १९६६ चे कलम ${actSection ? `<strong>${escDev(actSection)}</strong>` : ''} अन्वये दाखल अर्जाबाबत.<br>
        मिळकत : मौजे ${village ? `<strong>${escDev(village)}</strong>` : ''}, ता. ${taluka ? `<strong>${escDev(taluka)}</strong>` : ''}, जि. ${district ? `<strong>${escDev(district)}</strong>` : ''}.
    </div>

    <!-- Main Content -->
    <div class="main-content">
        वरील संदर्भानुसार, प्रस्तुत अर्जाची सुनावणी ${hearingOfficer ? `<strong>${escDev(hearingOfficer)}</strong>` : ''} यांचेसमोर खालील नमूद पत्त्यावर दिनांक ${hearingDateFull ? `<strong>${hearingDateFull}</strong>` : ''} रोजी वेळ ${hearingTime ? `<strong>${escDev(hearingTime)}</strong>` : ''} वाजता निश्चित करण्यात आली आहे.
    </div>

    <!-- Ex-parte Notice -->
    <div class="ex-parte-notice">
        सदर सुनावणीस संबंधित पक्षांनी स्वतः किंवा त्यांच्या अधिकृत प्रतिनिधीमार्फत उपस्थित राहून आपले म्हणणे / युक्तिवाद मांडावेत. जर कोणताही पक्ष विनाकारण अनुपस्थित राहिला, तर सदर प्रकरण उपलब्ध नोंदी व पुराव्यांच्या आधारे एकतर्फी निकाली काढण्यात येईल.
    </div>

    <!-- Hearing Address -->
    <div class="hearing-address">
        सुनावणीचा पत्ता : ${hearingAddress ? `<strong>${escDev(hearingAddress)}</strong>` : ''}
    </div>

    <!-- Footer: copy recipients left, signature right -->
    <div class="footer-row">
        <div class="copy-section">
            <strong>प्रत माहितीसाठी रवाना :</strong><br>
            ${buildCopyRows(v.copyRecipients)}
        </div>
        <div class="sig-block">
            <div class="sig-name">( ${sigName ? escDev(sigName) : ''} )</div>
            <div class="sig-detail">
                पदनाम : ${sigDesig ? `<strong>${escDev(sigDesig)}</strong>` : ''}<br>
                कार्यालय : ${sigOffice ? `<strong>${escDev(sigOffice)}</strong>` : ''}
            </div>
        </div>
    </div>

</div>
</body>
</html>`;
}
