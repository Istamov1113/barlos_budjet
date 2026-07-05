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

// Ustun A dagi band qatorlar sonini hisoblab, jadvaldagi keyingi bo'sh qator raqamini topadi.
// Google Sheets API'ning avtomatik "append" funksiyasi ba'zan bo'sh kataklar borligida
// jadval chegarasini noto'g'ri aniqlab, ma'lumotni noto'g'ri ustundan boshlab yozib yuborishi
// mumkin edi - shu sababli bu yerda qator raqamini o'zimiz aniq hisoblaymiz.
async function getNextRow(sheets, spreadsheetId, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`
  });
  const rowCount = res.data.values ? res.data.values.length : 0;
  return rowCount + 1;
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

  const nextRow = await getNextRow(sheets, spreadsheetId, sheetName);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${nextRow}:K${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] }
  });
}

module.exports = { appendRow };
