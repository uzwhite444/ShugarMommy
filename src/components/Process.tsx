import { motion, useReducedMotion } from 'motion/react';
import Reveal from './ui/Reveal';
import { LanguageCode, Localized } from '../types';
import { getLocalized } from '../utils';

interface ProcessProps {
  language: LanguageCode;
}

interface Step {
  number: string;
  title: Localized;
  text: Localized;
}

const TR = {
  eyebrow: { RU: 'Как проходит визит', UZ: "Tashrif qanday o'tadi", EN: 'How a visit goes' },
  title: {
    RU: 'Путь к идеальной гладкости',
    UZ: "Mukammal silliqlikka yo'l",
    EN: 'The path to perfect smoothness',
  },
  steps: [
    {
      number: '01',
      title: { RU: 'Онлайн-запись', UZ: 'Onlayn yozilish', EN: 'Online booking' },
      text: {
        RU: 'Выбираете зоны, мастера и время на сайте — заявка сразу у администратора.',
        UZ: 'Saytda zona, usta va vaqtni tanlaysiz — ariza darhol administratorda.',
        EN: 'Pick zones, master and time on the site — the request reaches our admin instantly.',
      },
    },
    {
      number: '02',
      title: { RU: 'Консультация', UZ: 'Konsultatsiya', EN: 'Consultation' },
      text: {
        RU: 'Мастер отвечает на вопросы и подбирает плотность пасты под вашу кожу.',
        UZ: 'Usta savollarga javob berib, teringizga mos pasta zichligini tanlaydi.',
        EN: 'The master answers questions and picks the paste density for your skin.',
      },
    },
    {
      number: '03',
      title: { RU: 'Стерильная подготовка', UZ: 'Steril tayyorgarlik', EN: 'Sterile prep' },
      text: {
        RU: 'Одноразовые материалы, антисептика, паста набирается один раз.',
        UZ: 'Bir martalik materiallar, antiseptika, pasta faqat bir marta olinadi.',
        EN: 'Single-use materials, antiseptics, and paste scooped only once.',
      },
    },
    {
      number: '04',
      title: { RU: 'Процедура', UZ: 'Muolaja', EN: 'The procedure' },
      text: {
        RU: 'Мануальная техника по росту волос — деликатно даже для чувствительных зон.',
        UZ: "Tuklar o'sishi yo'nalishida manual texnika — sezgir zonalar uchun ham yumshoq.",
        EN: 'Manual technique along hair growth — gentle even on sensitive areas.',
      },
    },
    {
      number: '05',
      title: { RU: 'Уход и рекомендации', UZ: 'Parvarish va tavsiyalar', EN: 'Aftercare & tips' },
      text: {
        RU: 'Советы по уходу, чтобы гладкость держалась до 3 недель.',
        UZ: "Silliqlik 3 haftagacha saqlanishi uchun parvarish bo'yicha maslahatlar.",
        EN: 'Aftercare advice so smoothness lasts up to 3 weeks.',
      },
    },
  ] as Step[],
};

export default function Process({ language }: ProcessProps) {
  const reduced = useReducedMotion();
  return (
    <section id="process" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {getLocalized(TR.eyebrow, language)}
          </p>
          <h2 className="display mt-4 text-4xl text-ink sm:text-5xl">{getLocalized(TR.title, language)}</h2>
        </Reveal>

        <ol className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
          {TR.steps.map((step, i) => (
            <li key={step.number}>
              <Reveal delay={i * 0.06}>
                <div className="relative pt-5">
                  {/* Top rule draws in from the left as the step enters view. */}
                  <motion.span
                    aria-hidden
                    className="absolute left-0 top-0 h-[2px] w-full origin-left bg-ink"
                    initial={reduced ? { scaleX: 1 } : { scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.8, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <span className="text-xs font-semibold tracking-[0.18em] text-primary-dark">{step.number}</span>
                  <h3 className="mt-3 text-base font-semibold text-ink">{getLocalized(step.title, language)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{getLocalized(step.text, language)}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
