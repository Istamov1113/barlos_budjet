const { google } = require('googleapis');

function getAuth() {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error('GOOGLE_CLIENT_EMAIL yoki GOOGLE_PRIVATE_KEY .env da topilmadi');
  }

  key = key.replace(/\\n/g, '\n');

  return new google.auth.JWT(email, null, key, [
    'https://www.googleapis.com/auth/spreadsheets.readonly'
  ]);
}

// 'C' -> 2 (0-asosli ustun indeksi)
function colIndex(letter) {
  return letter.charCodeAt(0) - 65;
}

// grid - values.get natijasidagi 2 o'lchamli massiv, row - 1 dan boshlanadigan qator raqami
function cell(grid, colLetter, row) {
  const r = grid[row - 1];
  if (!r) return null;
  const v = r[colIndex(colLetter)];
  return v === undefined || v === '' ? null : v;
}

// Dashboard varag'ining A1:W50 diapazonini bir martada o'qiydi (barcha komandalar shundan foydalanadi)
async function getDashboardGrid() {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const dashboardSheet = process.env.DASHBOARD_SHEET_NAME || 'Dashboard';

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${dashboardSheet}!A1:W50`,
    valueRenderOption: 'UNFORMATTED_VALUE'
  });

  return res.data.values || [];
}

module.exports = { getDashboardGrid, cell };
