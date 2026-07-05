# Budjet Telegram Bot

Telegram orqali tugmalar (dropdown) bilan ma'lumot kiritib, to'g'ridan-to'g'ri Google Sheets'dagi
**"Budjet tranzaksiya"** varag'iga qator qo'shadigan bot.

Endi Google Apps Script'dagi `SubmitData()` funksiyasi shart emas — bot ma'lumotni
to'g'ridan-to'g'ri jadvalga yozadi.

## Fayllar

- `index.js` — botning asosiy logikasi (savol-javob ketma-ketligi)
- `categories.js` — barcha dropdown ro'yxatlari (Hisob, Kategoriya, Sub-kategoriya va h.k.)
- `sheets.js` — Google Sheets bilan bog'lanish
- `.env.example` — qanday sozlamalar kerakligi namunasi

Ustunlar tartibi (A:K, jami 11 ta): Sana, Kirim/chiqim, Miqdor, Hisob, Kategoriya,
Sub-kategoriya, Qarz, 50/30/20, Obuna, Izoh, Raqam — bu sizning eski kodingizdagi
B,C,D,E,F,G,H,I,J,K,M ustunlariga mos keladi.

> **Muhim:** Sub-kategoriya ro'yxati Kategoriyaga qarab avtomatik filtrlanadi.
> Men bu bog'lanishni mantiqan taxmin qildim (`categories.js` ichidagi
> `SUBCATEGORY_MAP`). Agar haqiqiy bog'lanishingiz boshqacha bo'lsa, shu faylni
> ochib, ro'yxatlarni xohlagan kategoriya ostiga ko'chiring — kod avtomatik moslashadi,
> boshqa hech narsani o'zgartirish shart emas.

---

## 1-QADAM: Google Sheets uchun Service Account yaratish

Bot Google Sheetsga yozishi uchun "xizmat hisobi" (service account) kerak.

1. https://console.cloud.google.com ga kiring va yangi loyiha yarating (masalan `budget-bot`).
2. Chap menyudan **APIs & Services → Library** ga o'ting, qidiruvga **Google Sheets API**
   deb yozing va **Enable** tugmasini bosing.
3. **APIs & Services → Credentials** ga o'ting.
4. **Create Credentials → Service Account** ni tanlang.
5. Nom bering (masalan `budget-bot`), **Create and Continue**, keyin **Done** bosing.
6. Yaratilgan service account nomiga bosing → **Keys** bo'limi → **Add Key → Create new key**
   → format sifatida **JSON** ni tanlang → **Create**.
7. Kompyuteringizga bir `.json` fayl yuklab olinadi. Uni oching (matn muharrirda) —
   ichidan 2 ta qiymat kerak bo'ladi:
   - `"client_email"` — bu `GOOGLE_CLIENT_EMAIL`
   - `"private_key"` — bu `GOOGLE_PRIVATE_KEY` (butun qatorni, `-----BEGIN PRIVATE KEY-----`
     dan `-----END PRIVATE KEY-----\n` gacha, tirnoqlar ichidagi holicha nusxa oling)

8. Endi Google Sheets faylingizni (spreadsheetni) oching → yuqori o'ngdagi
   **Share (Ulashish)** tugmasini bosing → 6-qadamdagi `client_email` manzilini qo'shing
   va unga **Editor** huquqini bering → **Send/Share**.

9. Spreadsheet ID'ni oling — brauzer manzilidan:
   `https://docs.google.com/spreadsheets/d/BU_YERDAGI_QISM/edit`

---

## 2-QADAM: Telegram bot yaratish

1. Telegramda **@BotFather** ga yozing.
2. `/newbot` buyrug'ini yuboring, botga nom va username bering.
3. BotFather sizga **token** beradi (masalan `123456:ABC-DEF...`) — buni saqlab qo'ying,
   bu `TELEGRAM_BOT_TOKEN`.

**Ixtiyoriy, lekin tavsiya etiladi (moliyaviy ma'lumot uchun himoya):**
4. Telegramda **@userinfobot** ga yozing — u sizning Telegram ID raqamingizni beradi.
   Buni `ALLOWED_USER_ID` sifatida ishlatasiz — shunda faqat siz botdan foydalana olasiz,
   boshqa hech kim emas.

---

## 3-QADAM: Kodni GitHub'ga yuklash

**Eng oson yo'l (brauzer orqali, terminal shart emas):**

1. https://github.com da yangi repository yarating (masalan `budget-bot`), **Private** qilib
   qo'yish tavsiya etiladi.
2. **Add file → Upload files** tugmasini bosing.
3. Ushbu chatdagi barcha fayllarni (`index.js`, `categories.js`, `sheets.js`, `package.json`,
   `.gitignore`, `.env.example`, `README.md`) shu yerga tashlang.
4. **Commit changes** tugmasini bosing.

> `.env` faylini hech qachon GitHub'ga yuklamang — u shaxsiy tokenlaringizni o'z ichiga oladi.
> Barcha maxfiy qiymatlar Railway'ning "Variables" bo'limida kiritiladi (quyida ko'rsatiladi).

**Yoki terminal orqali:**
```bash
git init
git add .
git commit -m "Budjet telegram bot"
git branch -M main
git remote add origin https://github.com/FOYDALANUVCHI_NOMI/budget-bot.git
git push -u origin main
```

---

## 4-QADAM: Railway'da deploy qilish

1. https://railway.app ga kiring, **Login with GitHub** orqali kiring.
2. **New Project → Deploy from GitHub repo** ni tanlang.
3. Yuqorida yaratgan `budget-bot` repositoriyangizni tanlang.
4. Railway avtomatik ravishda `package.json`ni aniqlab, `npm install` va `npm start`
   buyruqlarini o'zi ishga tushiradi — qo'shimcha sozlash shart emas.
5. Loyiha ochilgach, **Variables** bo'limiga o'ting va quyidagilarni bittalab qo'shing
   (nomi va qiymati — `.env.example` dagi kabi):

   | Nomi | Qiymati |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | BotFather'dan olgan token |
   | `SPREADSHEET_ID` | 1-qadamdagi spreadsheet ID |
   | `SHEET_NAME` | `Budjet tranzaksiya` |
   | `GOOGLE_CLIENT_EMAIL` | JSON fayldagi `client_email` |
   | `GOOGLE_PRIVATE_KEY` | JSON fayldagi `private_key` (butunligicha) |
   | `ALLOWED_USER_ID` | (ixtiyoriy) sizning Telegram ID raqamingiz |

   `GOOGLE_PRIVATE_KEY` ni kiritishda qatorlar ko'chishi (`\n`) haqida xavotir olmang —
   ikkala holat ham (asl ko'p qatorli matn yoki `\n` bilan yozilgan bitta qator) kod
   tomonidan to'g'ri o'qiladi.

6. Barcha o'zgaruvchilarni saqlagach, Railway avtomatik ravishda botni qayta ishga tushiradi.
7. **Deployments** bo'limidan loglarni oching — pastda `Bot ishga tushdi...` degan
   yozuvni ko'rsangiz, hammasi tayyor.

---

## 5-QADAM: Botni sinash

1. Telegramda botingizni toping va `/yangi` (yoki `/start`) yuboring.
2. Bot ketma-ket so'raydi: Sana → Kirim/chiqim → Miqdor → Hisob → Kategoriya →
   Sub-kategoriya → Qarz → 50/30/20 → Izoh → Raqam.
3. Oxirida barcha kiritilgan ma'lumotlar xulosasi chiqadi — **✅ Saqlash** tugmasini
   bosing.
4. Google Sheets'dagi **"Budjet tranzaksiya"** varag'ini oching — yangi qator qo'shilgan
   bo'lishi kerak.

Istalgan vaqtda `/cancel` bilan jarayonni bekor qilish mumkin.

---

## Muammolarni bartaraf etish

- **Bot umuman javob bermayapti** — Railway'ning "Deployments → Logs" bo'limida xato
  bor-yo'qligini tekshiring; ko'pincha `TELEGRAM_BOT_TOKEN` xato kiritilgan bo'ladi.
- **"Google Sheetsga yozishda xatolik"** degan xabar chiqsa** — quyidagilarni tekshiring:
  - Spreadsheet `GOOGLE_CLIENT_EMAIL` manziliga **Editor** huquqi bilan ulashilganmi?
  - `SPREADSHEET_ID` to'g'ri nusxalanganmi (URL'dagi uzun harf-raqamlar ketma-ketligi)?
  - `SHEET_NAME` varaq nomi bilan harfma-harf mos keladimi (`Budjet tranzaksiya`)?
- **Sub-kategoriya ro'yxati noto'g'ri chiqyapti** — `categories.js` faylidagi
  `SUBCATEGORY_MAP` ob'ektini tahrirlang, GitHub'ga qayta yuklang — Railway avtomatik
  qayta deploy qiladi.
- **Boshqa odam ham botdan foydalanmoqchi bo'lsa** — `ALLOWED_USER_ID` ni Railway
  Variables'dan o'chirib tashlang (yoki bo'sh qoldiring), shunda cheklov bo'lmaydi.
