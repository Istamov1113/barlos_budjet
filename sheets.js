const { google } = require('googleapis');

function getAuth() {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error('GOOGLE_CLIENT_EMAIL yoki GOOGLE_PRIVATE_KEY .env da topilmadi');
  }

  // Railway/`.env` da \n literal bo'lib saqlanadi, uni haqiqiy newline'ga aylantiramiz
  key = key.replace(/\\n/g, '\n');

  return new google.auth.JWT(email, null, key, [
    'https://www.googleapis.com/auth/spreadsheets'
  ]);
}

// values - 11 ta elementli massiv: [Sana, Kirim/chiqim, Miqdor, Hisob,
// Kategoriya, Sub-kategoriya, Qarz, 50/30/20, Obuna, Izoh, raqam]
async function appendRow(values) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName = process.env.SHEET_NAME || 'Budjet tranzaksiya';

  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID .env da topilmadi');
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:K`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] }
  });
}

module.exports = { appendRow };
