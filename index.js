require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { appendRow } = require('./sheets');
const { getDashboardGrid, cell } = require('./dashboard');
const { ACCOUNTS, CATEGORIES, SUBCATEGORY_MAP, DEBTS, PLAN_502030 } = require('./categories');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID; // ixtiyoriy: faqat shu ID ishlata oladi

if (!TOKEN) {
  console.error('XATOLIK: TELEGRAM_BOT_TOKEN topilmadi. .env faylini tekshiring.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
console.log('Bot ishga tushdi...');

// Telegram'ning "/" tugmasi ostidagi rasmiy komandalar menyusi
bot.setMyCommands([
  { command: 'yangi', description: 'Yangi tranzaksiya kiritish' },
  { command: 'balans', description: 'Umumiy balans va oylik o‘zgarish' },
  { command: 'hisoblar', description: 'Har bir hisobning joriy qoldig‘i' },
  { command: 'aktivlar', description: 'Har bir hisobdagi aktiv tafsiloti' },
  { command: 'qarzlar', description: 'Qarz daftari' },
  { command: 'budjet', description: '50/30/20 taqsimoti' },
  { command: 'cancel', description: 'Joriy jarayonni bekor qilish' }
]).catch((err) => console.error('Komandalar menyusini o‘rnatishda xato:', err.message));

// ---------- sonlarni formatlash ----------

function fmtNum(n, decimals = 2) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function fmtPercent(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  return `${(Number(n) * 100).toFixed(2)}%`;
}

// chatId -> { step, data: {} }
const sessions = {};

const NONE_LABEL = '➖ Yo‘q';

// ---------- yordamchi funksiyalar ----------

function isAllowed(fromId) {
  if (!ALLOWED_USER_ID) return true;
  return String(fromId) === String(ALLOWED_USER_ID);
}

function chunk(arr, size) {
  const rows = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
}

// list - variantlar ro'yxati, prefix - callback_data prefiksi, columns - qatordagi tugmalar soni
// withNone - true bo'lsa, oxiriga "➖ Yo'q" tugmasi qo'shiladi (callback_data: `${prefix}_none`)
function listKeyboard(list, prefix, columns, withNone = false) {
  const buttons = list.map((item, idx) => ({ text: item, callback_data: `${prefix}_${idx}` }));
  const rows = chunk(buttons, columns);
  if (withNone) rows.push([{ text: NONE_LABEL, callback_data: `${prefix}_none` }]);
  return { reply_markup: { inline_keyboard: rows } };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// Google Sheets'ning standart M/D/YYYY H:MM:SS formatiga mos: oy/kun/soat oldida nol bo'lmaydi,
// daqiqa/soniya esa doim 2 xonali.
function formatNow() {
  const d = new Date();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  return `${month}/${day}/${d.getFullYear()} ${hour}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const DATE_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

function resetSession(chatId) {
  sessions[chatId] = { step: 'DATE', data: {} };
}

// ---------- har bir bosqichni so'rash ----------

function askDate(chatId) {
  bot.sendMessage(
    chatId,
    '📅 Sana va vaqtni kiriting.\nFormat: OY/KUN/YIL SOAT:DAQIQA:SONIYA\nMasalan: 7/4/2026 10:01:00',
    { reply_markup: { inline_keyboard: [[{ text: '🕐 Hozirgi vaqt', callback_data: 'date_now' }]] } }
  );
}

function askType(chatId) {
  bot.sendMessage(chatId, '💰 Kirim yoki chiqim?', listKeyboard(['Kirim', 'Chiqim'], 'type', 2));
}

function askAmount(chatId) {
  bot.sendMessage(chatId, '🔢 Miqdorni kiriting (faqat raqam), masalan: 20000');
}

function askAccount(chatId) {
  bot.sendMessage(chatId, '🏦 Hisobni tanlang:', listKeyboard(ACCOUNTS, 'acc', 2));
}

function askCategory(chatId) {
  const session = sessions[chatId];
  const list = CATEGORIES[session.data.type] || [];
  bot.sendMessage(chatId, '📂 Kategoriyani tanlang:', listKeyboard(list, 'cat', 2, true));
}

function askSubcategory(chatId) {
  const session = sessions[chatId];
  const list = SUBCATEGORY_MAP[session.data.category] || [];
  session.step = 'SUBCATEGORY';
  if (list.length === 0) {
    session.data.subcategory = '-';
    session.step = 'DEBT';
    return askDebt(chatId);
  }
  bot.sendMessage(chatId, '🏷 Sub-kategoriyani tanlang:', listKeyboard(list, 'sub', 1, true));
}

function askDebt(chatId) {
  bot.sendMessage(chatId, '🤝 Qarzga aloqadormi?', listKeyboard(DEBTS, 'debt', 2, true));
}

function askPlan(chatId) {
  bot.sendMessage(chatId, '📊 50/30/20 bo‘yicha qaysi guruhga tegishli?', listKeyboard(PLAN_502030, 'plan', 2, true));
}

function askComment(chatId) {
  bot.sendMessage(chatId, '📝 Izoh yozing (yoki o‘tkazib yuboring):', {
    reply_markup: { inline_keyboard: [[{ text: '➖ O‘tkazib yuborish', callback_data: 'comment_skip' }]] }
  });
}

function askConfirm(chatId) {
  const d = sessions[chatId].data;
  const text = [
    '✅ Quyidagi ma’lumotni saqlaymizmi?',
    '',
    `📅 Sana: ${d.date}`,
    `💰 Turi: ${d.type}`,
    `🔢 Miqdor: ${d.amount}`,
    `🏦 Hisob: ${d.account}`,
    `📂 Kategoriya: ${d.category}`,
    `🏷 Sub-kategoriya: ${d.subcategory}`,
    `🤝 Qarz: ${d.debt}`,
    `📊 50/30/20: ${d.plan}`,
    `📝 Izoh: ${d.comment || '-'}`,
    '🔢 Raqam: avtomatik (formula orqali hisoblanadi)'
  ].join('\n');

  bot.sendMessage(chatId, text, {
    reply_markup: { inline_keyboard: [[{ text: '✅ Saqlash', callback_data: 'confirm_yes' }]] }
  });
}

// ---------- komandalar ----------

bot.onText(/\/start|\/yangi/, (msg) => {
  const chatId = msg.chat.id;
  if (!isAllowed(msg.from.id)) return bot.sendMessage(chatId, '⛔️ Sizda ruxsat yo‘q.');
  resetSession(chatId);
  bot.sendMessage(chatId, '👋 Yangi tranzaksiya qo‘shamiz. Istalgan vaqtda /cancel bilan bekor qilishingiz mumkin.');
  askDate(chatId);
});

bot.onText(/\/cancel/, (msg) => {
  const chatId = msg.chat.id;
  delete sessions[chatId];
  bot.sendMessage(chatId, '❌ Bekor qilindi. Qayta boshlash uchun /yangi yozing.');
});

// ---------- Dashboard'ni o'qiydigan komandalar (faqat o'qish, hech narsa yozmaydi) ----------

bot.onText(/\/balans/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAllowed(msg.from.id)) return;
  try {
    const grid = await getDashboardGrid();
    const total = cell(grid, 'C', 2);
    const changePct = cell(grid, 'C', 5);
    const changeAmt = cell(grid, 'E', 5);
    const emoji = Number(changePct) >= 0 ? '🟢' : '🔴';
    const text = [
      '💰 Umumiy balans',
      '',
      `💵 Jami summa: ${fmtNum(total)} so'm`,
      `${emoji} Oylik o‘zgarish: ${fmtPercent(changePct)} (${fmtNum(changeAmt)} so'm)`
    ].join('\n');
    bot.sendMessage(chatId, text);
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, '⚠️ Ma’lumotni olishda xatolik yuz berdi.');
  }
});

bot.onText(/\/hisoblar/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAllowed(msg.from.id)) return;
  try {
    const grid = await getDashboardGrid();
    const lines = ['🏦 Hisoblar ro‘yxati', ''];
    for (let row = 13; row <= 27; row++) {
      const name = cell(grid, 'B', row);
      if (!name) continue;
      const amount = cell(grid, 'C', row);
      const currency = cell(grid, 'D', row);
      const uzs = cell(grid, 'E', row);
      if (currency === 'UZS') {
        lines.push(`• ${name}: ${fmtNum(amount)} so'm`);
      } else {
        lines.push(`• ${name}: ${fmtNum(amount)} ${currency} (~${fmtNum(uzs)} so'm)`);
      }
    }
    bot.sendMessage(chatId, lines.join('\n'));
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, '⚠️ Ma’lumotni olishda xatolik yuz berdi.');
  }
});

bot.onText(/\/aktivlar/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAllowed(msg.from.id)) return;
  try {
    const grid = await getDashboardGrid();
    const lines = ['📉 Har bir hisobdagi aktiv tafsiloti', ''];
    for (let row = 13; row <= 26; row++) {
      const account = cell(grid, 'B', row);
      const asset = cell(grid, 'P', row);
      if (!account || !asset) continue;
      const price = cell(grid, 'S', row);
      const avgPrice = cell(grid, 'T', row);
      const pnl = cell(grid, 'U', row);
      const pnlPct = cell(grid, 'V', row);
      const ratio = cell(grid, 'W', row);
      lines.push(`• ${account} → ${asset}`);
      lines.push(`   Narx: ${fmtNum(price)} | O‘rt: ${fmtNum(avgPrice)}`);
      lines.push(`   PNL: ${fmtNum(pnl)} so'm (${fmtPercent(pnlPct)}) | Ratio: ${fmtNum(ratio, 3)}`);
    }
    bot.sendMessage(chatId, lines.join('\n'));
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, '⚠️ Ma’lumotni olishda xatolik yuz berdi.');
  }
});

bot.onText(/\/qarzlar/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAllowed(msg.from.id)) return;
  try {
    const grid = await getDashboardGrid();
    const lines = ['🤝 Qarz daftari', ''];
    for (let row = 36; row <= 45; row++) {
      const name = cell(grid, 'B', row);
      if (!name) continue;
      const amount = cell(grid, 'C', row);
      lines.push(`• ${name}: ${fmtNum(amount)} so'm`);
    }
    const total = cell(grid, 'C', 49);
    lines.push('', `Jami: ${fmtNum(total)} so'm`);
    bot.sendMessage(chatId, lines.join('\n'));
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, '⚠️ Ma’lumotni olishda xatolik yuz berdi.');
  }
});

bot.onText(/\/budjet/, async (msg) => {
  const chatId = msg.chat.id;
  if (!isAllowed(msg.from.id)) return;
  try {
    const grid = await getDashboardGrid();
    const lines = ['📊 50/30/20 holati', ''];
    for (let row = 36; row <= 38; row++) {
      const label = cell(grid, 'E', row);
      if (!label) continue;
      const amount = cell(grid, 'F', row);
      const ratio = cell(grid, 'G', row);
      lines.push(`• ${label}: ${fmtNum(amount)} so'm (Ratio: ${fmtNum(ratio, 3)})`);
    }
    const incomeLabel = cell(grid, 'E', 40);
    const incomeAmount = cell(grid, 'F', 40);
    if (incomeLabel) lines.push(`• ${incomeLabel}: ${fmtNum(incomeAmount)} so'm`);
    bot.sendMessage(chatId, lines.join('\n'));
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, '⚠️ Ma’lumotni olishda xatolik yuz berdi.');
  }
});

// ---------- oddiy matn xabarlar (sana, miqdor, izoh) ----------

bot.on('message', (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const chatId = msg.chat.id;
  if (!isAllowed(msg.from.id)) return;

  const session = sessions[chatId];
  if (!session) return; // /yangi bosilmagan, e'tibor bermaymiz

  const text = msg.text.trim();

  if (session.step === 'DATE') {
    if (!DATE_REGEX.test(text)) {
      return bot.sendMessage(chatId, '⚠️ Format noto‘g‘ri. Namuna: 7/4/2026 10:01:00');
    }
    session.data.date = text;
    session.step = 'TYPE';
    return askType(chatId);
  }

  if (session.step === 'AMOUNT') {
    const num = Number(text.replace(/\s/g, '').replace(',', '.'));
    if (Number.isNaN(num)) {
      return bot.sendMessage(chatId, '⚠️ Iltimos faqat raqam kiriting. Masalan: 20000');
    }
    session.data.amount = num;
    session.step = 'ACCOUNT';
    return askAccount(chatId);
  }

  if (session.step === 'COMMENT') {
    session.data.comment = text;
    session.step = 'CONFIRM';
    return askConfirm(chatId);
  }
});

// ---------- inline tugmalar ----------

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  bot.answerCallbackQuery(query.id).catch(() => {});

  if (!isAllowed(query.from.id)) return;

  const session = sessions[chatId];
  if (!session) return;

  // DATE
  if (data === 'date_now' && session.step === 'DATE') {
    session.data.date = formatNow();
    session.step = 'TYPE';
    return askType(chatId);
  }

  // TYPE
  if (session.step === 'TYPE' && data.startsWith('type_')) {
    const idx = Number(data.split('_')[1]);
    session.data.type = ['Kirim', 'Chiqim'][idx];
    session.step = 'AMOUNT';
    return askAmount(chatId);
  }

  // ACCOUNT
  if (session.step === 'ACCOUNT' && data.startsWith('acc_')) {
    const idx = Number(data.split('_')[1]);
    session.data.account = ACCOUNTS[idx];
    session.step = 'CATEGORY';
    return askCategory(chatId);
  }

  // CATEGORY
  if (session.step === 'CATEGORY' && data.startsWith('cat_')) {
    if (data === 'cat_none') {
      session.data.category = '-';
      session.data.subcategory = '-';
      session.step = 'DEBT';
      return askDebt(chatId);
    }
    const idx = Number(data.split('_')[1]);
    const list = CATEGORIES[session.data.type] || [];
    session.data.category = list[idx];
    return askSubcategory(chatId);
  }

  // SUBCATEGORY
  if (session.step === 'SUBCATEGORY' && data.startsWith('sub_')) {
    if (data === 'sub_none') {
      session.data.subcategory = '-';
    } else {
      const idx = Number(data.split('_')[1]);
      const list = SUBCATEGORY_MAP[session.data.category] || [];
      session.data.subcategory = list[idx];
    }
    session.step = 'DEBT';
    return askDebt(chatId);
  }

  // DEBT
  if (session.step === 'DEBT' && data.startsWith('debt_')) {
    if (data === 'debt_none') {
      session.data.debt = '-';
    } else {
      const idx = Number(data.split('_')[1]);
      session.data.debt = DEBTS[idx];
    }
    session.step = 'PLAN';
    return askPlan(chatId);
  }

  // PLAN (50/30/20)
  if (session.step === 'PLAN' && data.startsWith('plan_')) {
    if (data === 'plan_none') {
      session.data.plan = '-';
    } else {
      const idx = Number(data.split('_')[1]);
      session.data.plan = PLAN_502030[idx];
    }
    session.data.subscription = ''; // J9 - Obuna, hozircha bo'sh
    session.step = 'COMMENT';
    return askComment(chatId);
  }

  // COMMENT skip
  if (data === 'comment_skip' && session.step === 'COMMENT') {
    session.data.comment = '';
    session.step = 'CONFIRM';
    return askConfirm(chatId);
  }

  // CONFIRM
  if (data === 'confirm_yes' && session.step === 'CONFIRM') {
    const d = session.data;
    const row = [
      d.date, d.type, d.amount, d.account, d.category,
      d.subcategory, d.debt, d.plan, d.subscription, d.comment
    ];
    try {
      await appendRow(row);
      bot.sendMessage(chatId, '✅ Saqlandi! Yangi tranzaksiya uchun /yangi yozing.');
    } catch (err) {
      console.error(err);
      bot.sendMessage(chatId, '⚠️ Google Sheetsga yozishda xatolik yuz berdi. Keyinroq qayta urinib ko‘ring.');
    }
    delete sessions[chatId];
  }
});

bot.on('polling_error', (err) => console.error('Polling xatosi:', err.message));
