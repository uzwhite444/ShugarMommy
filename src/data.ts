import { FaqItem, Master, Review, ServiceZone } from './types';

/**
 * Price list. Цены — стартовые, редактируются здесь в одном месте.
 * Duration is used by the calculator to estimate the visit length.
 */
export const SERVICE_ZONES: ServiceZone[] = [
  // Лицо
  { id: 'upper-lip', category: 'face', name: { RU: 'Верхняя губа', UZ: 'Ustki lab', EN: 'Upper lip' }, price: 30_000, durationMin: 10 },
  { id: 'chin', category: 'face', name: { RU: 'Подбородок', UZ: 'Iyak', EN: 'Chin' }, price: 30_000, durationMin: 10 },
  { id: 'face-full', category: 'face', name: { RU: 'Лицо полностью', UZ: "Yuz to'liq", EN: 'Full face' }, price: 70_000, durationMin: 25 },
  // Руки
  { id: 'underarms', category: 'arms', name: { RU: 'Подмышки', UZ: "Qo'ltiq osti", EN: 'Underarms' }, price: 50_000, durationMin: 15, popular: true },
  { id: 'arms-half', category: 'arms', name: { RU: 'Руки до локтя', UZ: "Qo'llar tirsakkacha", EN: 'Half arms' }, price: 70_000, durationMin: 25 },
  { id: 'arms-full', category: 'arms', name: { RU: 'Руки полностью', UZ: "Qo'llar to'liq", EN: 'Full arms' }, price: 100_000, durationMin: 35 },
  // Ноги
  { id: 'legs-half', category: 'legs', name: { RU: 'Ноги до колена', UZ: 'Oyoqlar tizzagacha', EN: 'Half legs' }, price: 100_000, durationMin: 30, popular: true },
  { id: 'legs-full', category: 'legs', name: { RU: 'Ноги полностью', UZ: "Oyoqlar to'liq", EN: 'Full legs' }, price: 160_000, durationMin: 50, popular: true },
  // Бикини
  { id: 'bikini-classic', category: 'bikini', name: { RU: 'Бикини классическое', UZ: 'Klassik bikini', EN: 'Classic bikini' }, price: 100_000, durationMin: 25 },
  { id: 'bikini-deep', category: 'bikini', name: { RU: 'Бикини глубокое', UZ: 'Chuqur bikini', EN: 'Deep bikini' }, price: 150_000, durationMin: 40, popular: true },
  // Тело
  { id: 'belly', category: 'body', name: { RU: 'Живот', UZ: 'Qorin', EN: 'Belly' }, price: 40_000, durationMin: 15 },
  { id: 'back', category: 'body', name: { RU: 'Спина', UZ: 'Bel', EN: 'Back' }, price: 80_000, durationMin: 30 },
];

export const CATEGORY_LABELS = {
  face: { RU: 'Лицо', UZ: 'Yuz', EN: 'Face' },
  arms: { RU: 'Руки', UZ: "Qo'llar", EN: 'Arms' },
  legs: { RU: 'Ноги', UZ: 'Oyoqlar', EN: 'Legs' },
  bikini: { RU: 'Бикини', UZ: 'Bikini', EN: 'Bikini' },
  body: { RU: 'Тело', UZ: 'Tana', EN: 'Body' },
} as const;

/**
 * Мастера. Базовые цены прайса — цены топ-мастера; у остальных ниже
 * на discountPct. Суммарный опыт команды = 7 лет.
 */
export const MASTERS: Master[] = [
  {
    id: 'master-1',
    name: 'Мадина',
    initials: 'М',
    experienceYears: 3,
    discountPct: 0,
    role: { RU: 'Топ-мастер', UZ: 'Top-usta', EN: 'Top master' },
    description: {
      RU: 'Специалист по чувствительной коже. Работает быстро и деликатно.',
      UZ: 'Sezgir teri bo‘yicha mutaxassis. Tez va ehtiyotkor ishlaydi.',
      EN: 'Sensitive-skin specialist. Fast and delicate technique.',
    },
  },
  {
    id: 'master-2',
    name: 'Севара',
    initials: 'С',
    experienceYears: 2,
    discountPct: 25,
    role: { RU: 'Мастер шугаринга', UZ: 'Shugaring ustasi', EN: 'Sugaring master' },
    description: {
      RU: 'Сертифицированный мастер. Идеальная гладкость даже на сложных зонах.',
      UZ: 'Sertifikatlangan usta. Murakkab zonalarda ham mukammal silliqlik.',
      EN: 'Certified master. Perfect smoothness even on tricky zones.',
    },
  },
  {
    id: 'master-3',
    name: 'Нилюфар',
    initials: 'Н',
    experienceYears: 2,
    discountPct: 25,
    role: { RU: 'Мастер шугаринга', UZ: 'Shugaring ustasi', EN: 'Sugaring master' },
    description: {
      RU: 'Внимательна к деталям, подберёт уход после процедуры под ваш тип кожи.',
      UZ: 'Tafsilotlarga e’tiborli, teringizga mos parvarishni tanlaydi.',
      EN: 'Detail-oriented; picks the right aftercare for your skin type.',
    },
  },
];

export const REVIEWS: Review[] = [
  {
    id: 'r1',
    author: 'Диана',
    rating: 5,
    service: { RU: 'Глубокое бикини', UZ: 'Chuqur bikini', EN: 'Deep bikini' },
    text: {
      RU: 'Хожу уже полгода — ни одного вросшего волоска, кожа идеальная. Мастера очень деликатные.',
      UZ: 'Yarim yildan beri kelaman — teri ideal, ustalar juda ehtiyotkor.',
      EN: 'Six months in — zero ingrown hairs, perfect skin. Very delicate masters.',
    },
  },
  {
    id: 'r2',
    author: 'Азиза',
    rating: 5,
    service: { RU: 'Ноги полностью', UZ: "Oyoqlar to'liq", EN: 'Full legs' },
    text: {
      RU: 'Боялась, что будет больно, но всё прошло легко. Атмосфера уютная, всё стерильно.',
      UZ: 'Og‘riqdan qo‘rqdim, lekin hammasi oson o‘tdi. Muhit shinam, hammasi steril.',
      EN: 'I feared the pain, but it was easy. Cosy atmosphere, everything sterile.',
    },
  },
  {
    id: 'r3',
    author: 'Камила',
    rating: 5,
    service: { RU: 'Комплекс', UZ: 'Kompleks', EN: 'Combo' },
    text: {
      RU: 'Беру комплекс из трёх зон — со скидкой выходит очень выгодно. Запись через сайт удобная.',
      UZ: 'Uch zonali kompleks olaman — chegirma bilan juda foydali. Sayt orqali yozilish qulay.',
      EN: 'I book a 3-zone combo — great value with the discount. Online booking is handy.',
    },
  },
  {
    id: 'r4',
    author: 'Лола',
    rating: 5,
    service: { RU: 'Подмышки', UZ: "Qo'ltiq osti", EN: 'Underarms' },
    text: {
      RU: 'Быстро, аккуратно, без раздражения. Больше не вернусь к бритве!',
      UZ: 'Tez, ozoda, ta’sirlanishsiz. Ustaraga qaytmayman!',
      EN: 'Quick, neat, no irritation. Never going back to razors!',
    },
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: { RU: 'Это больно?', UZ: 'Bu og‘riqlimi?', EN: 'Does it hurt?' },
    answer: {
      RU: 'Ощущения индивидуальны, но шугаринг мягче воска: паста захватывает только волоски, а не кожу. С каждой процедурой волосы истончаются и дискомфорт снижается.',
      UZ: 'Sezgi har kimda har xil, lekin shugaring mumdan yumshoqroq: pasta faqat tuklarni oladi. Har safar og‘riq kamayadi.',
      EN: 'Sensation varies, but sugaring is gentler than wax: the paste grips hair, not skin. Discomfort decreases with each visit.',
    },
  },
  {
    question: { RU: 'Какая длина волос нужна?', UZ: 'Tuk qancha uzun bo‘lishi kerak?', EN: 'How long should hair be?' },
    answer: {
      RU: 'Оптимально от 8 мм до 1 см — примерно 2–3 недели после бритвы. Если длиннее, мастер всё равно всё сделает.',
      UZ: 'Eng maqbul 8 mm dan 1 sm gacha — ustaradan keyin taxminan 2–3 hafta. Uzunroq bo‘lsa ham usta hammasini qiladi.',
      EN: 'Ideally 8 mm to 1 cm — about 2–3 weeks after shaving. Longer is fine, the master will handle it.',
    },
  },
  {
    question: { RU: 'Как подготовиться к процедуре?', UZ: 'Muolajaga qanday tayyorlanish kerak?', EN: 'How do I prepare?' },
    answer: {
      RU: 'Скрабом пользоваться можно — он даже помогает против вросших волосков. За сутки не загорайте, а в день процедуры не наносите кремы и масла на зону.',
      UZ: 'Skrabdan foydalanish mumkin — u hatto ichki o‘sgan tuklarga qarshi yordam beradi. Bir kun oldin quyoshda toblanmang, muolaja kuni krem yoki moy surtmang.',
      EN: 'A scrub is fine — it even helps against ingrown hairs. Just avoid sunbathing for 24h and skip creams and oils on the day.',
    },
  },
  {
    question: { RU: 'Сколько держится эффект?', UZ: 'Natija qancha davom etadi?', EN: 'How long does it last?' },
    answer: {
      RU: 'В среднем 2–3 недели гладкой кожи. При регулярных процедурах волосы растут медленнее и реже.',
      UZ: 'O‘rtacha 2–3 hafta silliq teri. Muntazam muolajada tuklar sekinroq o‘sadi.',
      EN: 'On average 2–3 weeks of smooth skin. With regular visits hair grows back slower and thinner.',
    },
  },
  {
    question: { RU: 'Всё ли стерильно?', UZ: 'Hammasi sterilmi?', EN: 'Is everything sterile?' },
    answer: {
      RU: 'Да. Одноразовые шпатели, перчатки и простыни, паста набирается только один раз. Инструменты проходят полную дезинфекцию.',
      UZ: 'Ha. Bir martalik shpatel, qo‘lqop va choyshablar. Asboblar to‘liq dezinfeksiya qilinadi.',
      EN: 'Yes. Single-use spatulas, gloves and sheets; instruments are fully disinfected.',
    },
  },
];
