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
async function getNextRow(sheets, spreadsheetId, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`
  });
  const rowCount = res.data.values ? res.data.values.length : 0;
  return rowCount + 1;
}

// Agar jadvalda kerakli qator hali mavjud bo'lmasa (ya'ni varaq oxirigacha to'lgan bo'lsa),
// varaqqa yetarlicha bo'sh qator qo'shib, kengaytiradi.
async function ensureRowCapacity(sheets, spreadsheetId, sheetName, neededRow) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title,gridProperties))'
  });
  const sheet = meta.data.sheets.find((s) => s.properties.title === sheetName);
  if (!sheet) {
    throw new Error(`"${sheetName}" nomli varaq topilmadi`);
  }
  const currentRows = sheet.properties.gridProperties.rowCount;
  if (neededRow > currentRows) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            appendDimension: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              length: neededRow - currentRows
            }
          }
        ]
      }
    });
  }
}

// M9 (Raqam) uchun formula. Faqat shu qatorning Miqdor (C) va Hisob (D) katakchalariga
// bog'lanadi, qolgan qismi siz bergan formuladan aynan olingan.
function buildNumberFormula(row) {
  return `=ROUND(C${row} * IFS(OR(D${row}="Binance", D${row}="Bitget"), 'Dashboard'!U5, D${row}="Payeer", 'Dashboard'!W5, TRUE, 1), 2)`;
}

// values - 10 ta elementli massiv: [Sana, Kirim/chiqim, Miqdor, Hisob,
// Kategoriya, Sub-kategoriya, Qarz, 50/30/20, Fond (I ustun), Izoh]
// K ustuni (raqam) formuladan avtomatik hisoblanadi.
async function appendRow(values) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheetId = process.env.SPREADSHEET_ID;
  const sheetName = process.env.SHEET_NAME || 'Budjet tranzaksiya';

  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID .env da topilmadi');
  }

  const nextRow = await getNextRow(sheets, spreadsheetId, sheetName);
  await ensureRowCapacity(sheets, spreadsheetId, sheetName, nextRow);

  const fullRow = [...values, buildNumberFormula(nextRow)];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${nextRow}:K${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [fullRow] }
  });
}

module.exports = { appendRow };
