// Google Sheets'dagi dropdownlar bilan bir xil bo'lishi shart.
// Agar Sheetsda dropdown ro'yxatini o'zgartirsangiz, shu yerni ham yangilang.

// E9 - Hisob
const ACCOUNTS = [
  'Multicard', 'Uznex', 'BRB', 'Aloqabank_002', 'Trastbank',
  'Naqd', 'Aloqabank_003', 'Zoomrad', 'Uzumbank', 'Tanga',
  'Paynet', 'UzCSD', 'Tengebank', 'Binance', 'Bitget'
];

// F9 - Kategoriya, Kirim/chiqim turiga qarab guruhlangan.
// "Chiqim" ro'yxati 🔻Boshqa chiqim bilan tugaydi, undan keyingilari "Kirim" hisoblanadi.
const CATEGORIES = {
  Chiqim: [
    '🛻Transport',
    '🥐Ovqatlanish',
    '📱Telefon',
    "🎓Ta'lim",
    '🟡Istaklar',
    '🙋Shaxsiy xarajatlar',
    '🪙Komissiya',
    '🔻Boshqa chiqim'
  ],
  Kirim: [
    '💵Maosh',
    '📊Omonat',
    '💴 Dividend',
    '🪙Keshbek',
    '🟢Boshqa kirim'
  ]
};

// G9 - Sub-kategoriya, F9 (Kategoriya) ga bog'liq.
// DIQQAT: bu moslashuvni men mantiqan taxmin qilib taqsimladim.
// Agar sizning haqiqiy bog'lanishingiz boshqacha bo'lsa - shu yerdagi
// massivlarni xohlagancha o'zgartiring/ko'chiring, kod avtomatik moslashadi.
const SUBCATEGORY_MAP = {
  '🛻Transport': ['🚌 Avtobus', '🚕 Taxi', '🚄Poyezd', '🚕 Gentra'],
  '🥐Ovqatlanish': ['🍳Nonushta', '🍖Tushlik', '🍜Kechlik'],
  '📱Telefon': ['📱Galaxy A03', '📱Redmi 13C', '📱iPhone 11 pro'],
  "🎓Ta'lim": ['📖Kitob', '✒️O‘quv qurollari', '📃Kontrakt'],
  '🟡Istaklar': ['🧑‍🤝‍🧑Do‘stlar davrasi', '✂️Tashqi ko‘rinish', '🎊Bayramlar', '🫀Qalbim'],
  '🙋Shaxsiy xarajatlar': ['🥸Shaxsiy xarajat'],
  '🪙Komissiya': [],
  '🔻Boshqa chiqim': [],
  '💵Maosh': ['🧑‍⚖️F.T.Kadirov', '🧑‍⚖️L.Haydarov', '👩🏻‍⚖️D.S.Maqsudova', '💲Boshqa ish haqi'],
  '📊Omonat': ['🌳Siz uchun', '🌳Intellekt', '🌳Qulay online', '🌳Online-standart', '🌳Jamg‘armali'],
  '💴 Dividend': ['🟦 UzCSD'],
  '🪙Keshbek': ['🟢Paynet', '💎Zoomrad', '💎Uzumbank'],
  '🟢Boshqa kirim': [ ]
};

// H9 - Qarz
const DEBTS = [
  '🤱Nanam', '👦🏼Akam', '👨🏼‍🍼Dadam', '👨🏼‍🦰Nurali Ortiqov',
  '🙎🏼‍♂️Baxtiyorov Bobur', '🙆🏼‍♂️Nusrat Bekmurodov', '⚖️Alibek Barnoyev',
  '🫀Qalbim', 'Kamolani onasi', 'Peta amaki'
];

// I9 - 50/30/20
const PLAN_502030 = ['Xarajatlar', 'Istaklar', 'Jamg‘arma', 'Daromad'];

// J9 - Fond (Budjet tranzaksiya varag'ining I ustuniga yoziladi).
// Kirim ham, chiqim ham uchun bir xil ro'yxat.
const FUNDS = [
  'Xarajatlar fondi',
  'Istaklar fondi',
  'Jamg‘arma fondi',
  'FVV',
  'Ota-onamga fondi'
];

module.exports = { ACCOUNTS, CATEGORIES, SUBCATEGORY_MAP, DEBTS, PLAN_502030, FUNDS };
