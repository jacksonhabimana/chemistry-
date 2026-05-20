// ═══════════════════════════════════════════════════════════════
// Jackson Habimana Chemistry Portal — Google Apps Script Backend
// Paste this entire file into: script.google.com → New Project
// Then: Deploy → New Deployment → Web App → Execute as: Me
//        → Who has access: Anyone → Deploy → Copy the URL
// ═══════════════════════════════════════════════════════════════

const TEACHER_EMAIL = 'hajackson2020@gmail.com';
const SHEET_NAME_RESULTS  = 'Student Results';
const SHEET_NAME_CHEATING = 'Cheating Flags';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.type === 'result')  handleResult(data);
    if (data.type === 'cheat')   handleCheat(data);
    return ContentService
      .createTextOutput(JSON.stringify({status:'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({status:'error', msg: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({status:'ok', message:'Jackson Chemistry Portal backend running.'}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Handle quiz/test/exam result submission
function handleResult(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME_RESULTS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_RESULTS);
    sheet.appendRow([
      'Timestamp','Student Name','Unit','Assessment Type',
      'Score','Total','Percentage','Grade',
      'Time Taken (min)','Cheat Flags','Answers (JSON)'
    ]);
    sheet.getRange(1,1,1,11).setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  const pct  = Math.round((data.score / data.total) * 100);
  const grade = pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F';
  const row = [
    new Date(),
    data.studentName,
    data.unit,
    data.assessmentType,
    data.score,
    data.total,
    pct + '%',
    grade,
    data.timeTaken || '—',
    data.cheatCount || 0,
    JSON.stringify(data.answers || {})
  ];
  sheet.appendRow(row);

  // Colour row by grade
  const lastRow = sheet.getLastRow();
  const colour = pct>=80?'#d4edda':pct>=60?'#fff3cd':'#f8d7da';
  sheet.getRange(lastRow, 1, 1, 11).setBackground(colour);

  // Email notification
  const subject = `[Chemistry Portal] ${data.studentName} submitted ${data.assessmentType} — ${data.unit}`;
  const body = `
New submission received on your Chemistry Portal.

Student : ${data.studentName}
Unit    : ${data.unit}
Type    : ${data.assessmentType}
Score   : ${data.score} / ${data.total}  (${pct}%)  Grade: ${grade}
Time    : ${data.timeTaken || '—'} min
Cheating flags: ${data.cheatCount || 0}

Submitted at: ${new Date().toLocaleString('en-RW', {timeZone:'Africa/Kigali'})}

View all results: https://docs.google.com/spreadsheets/d/${SpreadsheetApp.getActiveSpreadsheet().getId()}
  `.trim();
  GmailApp.sendEmail(TEACHER_EMAIL, subject, body);
}

// ── Handle cheat event
function handleCheat(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME_CHEATING);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_CHEATING);
    sheet.appendRow(['Timestamp','Student Name','Unit','Assessment Type','Cheat Event','Details']);
    sheet.getRange(1,1,1,6).setFontWeight('bold').setBackground('#7b1d1d').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    new Date(),
    data.studentName || 'Unknown',
    data.unit,
    data.assessmentType,
    data.event,
    data.details || ''
  ]);
  sheet.getRange(sheet.getLastRow(),1,1,6).setBackground('#f8d7da');

  // Email cheat alert
  const subject = `⚠️ CHEAT ALERT — ${data.studentName || 'Unknown'} | ${data.unit}`;
  const body = `
Cheating detected on your Chemistry Portal!

Student   : ${data.studentName || 'Unknown'}
Unit      : ${data.unit}
Type      : ${data.assessmentType}
Event     : ${data.event}
Details   : ${data.details || '—'}
Time      : ${new Date().toLocaleString('en-RW', {timeZone:'Africa/Kigali'})}

View cheat log: https://docs.google.com/spreadsheets/d/${SpreadsheetApp.getActiveSpreadsheet().getId()}
  `.trim();
  GmailApp.sendEmail(TEACHER_EMAIL, subject, body);
}
