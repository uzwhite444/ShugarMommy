import { ArrowLeft } from 'lucide-react';
import { LanguageCode, Localized } from '../types';
import { ADDRESS, getLocalized, MANAGER_TELEGRAM, PHONE } from '../utils';

interface PrivacyPageProps {
  language: LanguageCode;
}

interface Section {
  title: Localized;
  body: Localized[];
}

const TR = {
  back: { RU: 'На главную', UZ: 'Bosh sahifaga', EN: 'Back to home' },
  title: { RU: 'Политика конфиденциальности', UZ: 'Maxfiylik siyosati', EN: 'Privacy policy' },
  updated: { RU: 'Обновлено', UZ: 'Yangilangan', EN: 'Updated' },
  contactTitle: { RU: 'Контакты для обращений', UZ: 'Murojaat uchun aloqa', EN: 'Contact us' },
};

const SECTIONS: Section[] = [
  {
    title: { RU: '1. Какие данные мы собираем', UZ: "1. Qanday ma'lumotlarni yig'amiz", EN: '1. What data we collect' },
    body: [
      {
        RU: 'При онлайн-записи вы указываете: имя, номер телефона, выбранные зоны, мастера, желаемые дату и время, а также комментарий, если решите его оставить. Других персональных данных мы не запрашиваем и не храним.',
        UZ: "Onlayn yozilishda siz quyidagilarni ko'rsatasiz: ism, telefon raqami, tanlangan zonalar, usta, sana va vaqt hamda ixtiyoriy izoh. Boshqa shaxsiy ma'lumotlarni so'ramaymiz va saqlamaymiz.",
        EN: 'When booking online you provide: your name, phone number, selected zones, master, preferred date and time, and an optional comment. We do not request or store any other personal data.',
      },
      {
        RU: 'Сайт не использует рекламные трекеры и не передаёт ваши данные третьим лицам для маркетинга.',
        UZ: "Sayt reklama trekerlaridan foydalanmaydi va ma'lumotlaringizni marketing uchun uchinchi shaxslarga bermaydi.",
        EN: 'The site uses no advertising trackers and never shares your data with third parties for marketing.',
      },
    ],
  },
  {
    title: { RU: '2. Зачем мы их используем', UZ: '2. Nima uchun ishlatamiz', EN: '2. Why we use it' },
    body: [
      {
        RU: 'Только чтобы связаться с вами, подтвердить свободное время, напомнить о визите и оказать услугу. Мы не звоним и не пишем с рекламой без вашего согласия.',
        UZ: "Faqat siz bilan bog'lanish, vaqtni tasdiqlash, tashrifni eslatish va xizmat ko'rsatish uchun. Roziligingizsiz reklama yubormaymiz.",
        EN: 'Only to contact you, confirm an available slot, remind you about the visit and provide the service. We never send marketing without your consent.',
      },
    ],
  },
  {
    title: { RU: '3. Где они хранятся', UZ: '3. Qayerda saqlanadi', EN: '3. Where it is stored' },
    body: [
      {
        RU: 'Заявки хранятся в защищённой базе данных Supabase с шифрованием при передаче. Доступ к ним имеет только администратор студии по паролю. Уведомление о новой записи дублируется администратору в Telegram.',
        UZ: "Arizalar Supabase himoyalangan ma'lumotlar bazasida shifrlangan holda saqlanadi. Ularga faqat studiya administratori parol bilan kira oladi. Yangi yozuv haqida xabar Telegramga ham yuboriladi.",
        EN: 'Bookings are stored in a secured Supabase database with encryption in transit. Only the studio administrator can access them with a password. A copy of each new booking is sent to the administrator on Telegram.',
      },
    ],
  },
  {
    title: { RU: '4. Сколько мы их храним', UZ: '4. Qancha muddat saqlaymiz', EN: '4. How long we keep it' },
    body: [
      {
        RU: 'Записи храним не дольше, чем это нужно для обслуживания и ведения истории визитов. Вы в любой момент можете попросить удалить ваши данные — сделаем это в течение трёх рабочих дней.',
        UZ: "Yozuvlarni xizmat ko'rsatish uchun zarur muddatdan ortiq saqlamaymiz. Istalgan vaqtda ma'lumotlaringizni o'chirishni so'rashingiz mumkin — uch ish kuni ichida bajaramiz.",
        EN: 'We keep records no longer than needed to serve you and maintain visit history. You may request deletion at any time — we will comply within three business days.',
      },
    ],
  },
  {
    title: { RU: '5. Ваши права', UZ: '5. Sizning huquqlaringiz', EN: '5. Your rights' },
    body: [
      {
        RU: 'Вы можете узнать, какие данные о вас у нас есть, исправить их или потребовать удаления. Для этого напишите нам в Telegram или позвоните по телефону, указанному ниже.',
        UZ: "Siz o'zingiz haqingizdagi ma'lumotlarni bilish, tuzatish yoki o'chirishni talab qilish huquqiga egasiz. Buning uchun Telegramga yozing yoki quyidagi raqamga qo'ng'iroq qiling.",
        EN: 'You can ask what data we hold about you, correct it, or request its deletion. Write to us on Telegram or call the number below.',
      },
    ],
  },
  {
    title: { RU: '6. Согласие', UZ: '6. Rozilik', EN: '6. Consent' },
    body: [
      {
        RU: 'Отправляя заявку на запись, вы подтверждаете, что ознакомились с этой политикой и согласны на обработку указанных данных для оказания услуги.',
        UZ: "Ariza yuborish orqali siz ushbu siyosat bilan tanishganingizni va ma'lumotlaringizni qayta ishlashga rozi ekaningizni tasdiqlaysiz.",
        EN: 'By submitting a booking request you confirm that you have read this policy and agree to the processing of the listed data in order to provide the service.',
      },
    ],
  },
];

/** Standalone legal page rendered at #/privacy. */
export default function PrivacyPage({ language }: PrivacyPageProps) {
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} /> {getLocalized(TR.back, language)}
        </a>

        <h1 className="display mt-8 text-4xl text-ink sm:text-5xl">{getLocalized(TR.title, language)}</h1>
        <p className="mt-3 text-sm text-faint">
          {getLocalized(TR.updated, language)}:{' '}
          {new Date('2026-08-04T00:00:00').toLocaleDateString(
            language === 'EN' ? 'en-US' : language === 'UZ' ? 'uz-Latn-UZ' : 'ru-RU',
            { day: 'numeric', month: 'long', year: 'numeric' },
          )}
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.title.EN}>
              <h2 className="text-base font-semibold text-ink">{getLocalized(section.title, language)}</h2>
              {section.body.map((paragraph, i) => (
                <p key={i} className="mt-2.5 text-sm leading-relaxed text-body">
                  {getLocalized(paragraph, language)}
                </p>
              ))}
            </section>
          ))}

          <section className="rounded-xl bg-surface p-6">
            <h2 className="text-base font-semibold text-ink">{getLocalized(TR.contactTitle, language)}</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-body">
              <li>Shugar Mommy — {getLocalized(ADDRESS, language)}</li>
              <li>
                <a href={`tel:${PHONE.replace(/[^+\d]/g, '')}`} className="font-semibold text-primary-dark hover:underline">
                  {PHONE}
                </a>
              </li>
              <li>
                <a
                  href={`https://t.me/${MANAGER_TELEGRAM}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary-dark hover:underline"
                >
                  Telegram: @{MANAGER_TELEGRAM}
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
