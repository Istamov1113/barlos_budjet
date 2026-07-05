require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { appendRow } = require('./sheets');
const { ACCOUNTS, CATEGORIES, SUBCATEGORY_MAP, DEBTS, PLAN_502030 } = require('./categories');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID; // ixtiyoriy: faqat shu ID ishlata oladi

if (!TOKEN) {
  console.error('XATOLIK: TELEGRAM_BOT_TOKEN topilmadi. .env faylini tekshiring.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
console.log('Bot ishga tushdi...');

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

function formatNow() {
  const d = new Date();
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const DATE_REGEX = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/;

function resetSession(chatId) {
  sessions[chatId] = { step: 'DATE', data: {} };
}

// ---------- har bir bosqichni so'rash ----------

function askDate(chatId) {
  bot.sendMessage(
    chatId,
    '📅 Sana va vaqtni kiriting.\nFormat: KK.OO.YYYY SS:DD:SS\nMasalan: 04.07.2026 10:01:00',
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
  bot.sendMessage(chatId, '📂 Kategoriyani tanlang:', listKeyboard(CATEGORIES, 'cat', 2, true));
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

function askNumber(chatId) {
  bot.sendMessage(chatId, '🔢 Qo‘shimcha raqam kiriting (masalan valyuta kursi), yoki o‘tkazib yuboring:', {
    reply_markup: { inline_keyboard: [[{ text: '➖ O‘tkazib yuborish', callback_data: 'number_skip' }]] }
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
    `🔢 Raqam: ${d.number || '-'}`
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

// ---------- oddiy matn xabarlar (sana, miqdor, izoh, raqam) ----------

bot.on('message', (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;
  const chatId = msg.chat.id;
  if (!isAllowed(msg.from.id)) return;

  const session = sessions[chatId];
  if (!session) return; // /yangi bosilmagan, e'tibor bermaymiz

  const text = msg.text.trim();

  if (session.step === 'DATE') {
    if (!DATE_REGEX.test(text)) {
      return bot.sendMessage(chatId, '⚠️ Format noto‘g‘ri. Namuna: 04.07.2026 10:01:00');
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
    session.step = 'NUMBER';
    return askNumber(chatId);
  }

  if (session.step === 'NUMBER') {
    const num = Number(text.replace(/\s/g, '').replace(',', '.'));
    if (Number.isNaN(num)) {
      return bot.sendMessage(chatId, '⚠️ Iltimos faqat raqam kiriting, yoki tugmani bosing.');
    }
    session.data.number = num;
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
    session.data.category = CATEGORIES[idx];
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
    session.step = 'NUMBER';
    return askNumber(chatId);
  }

  // NUMBER skip
  if (data === 'number_skip' && session.step === 'NUMBER') {
    session.data.number = '';
    session.step = 'CONFIRM';
    return askConfirm(chatId);
  }

  // CONFIRM
  if (data === 'confirm_yes' && session.step === 'CONFIRM') {
    const d = session.data;
    const row = [
      d.date, d.type, d.amount, d.account, d.category,
      d.subcategory, d.debt, d.plan, d.subscription, d.comment, d.number
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
