import { useRef } from 'react';
import { m, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import SectionHead from './ui/SectionHead';
import { Stagger, StaggerItem } from './ui/Stagger';
import { STAGGER } from '../lib/motion';
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

/* h-px, not h-[2px]: in this system 1px is the rule and 2px is what a PRESS
   makes of it. A step marker drawn at press weight by default was the one place
   the signature contradicted itself. */
const RULE_CLS = 'absolute left-0 top-0 h-px w-full origin-left bg-ink';

/* Each rule owns a window of the list's scroll progress. The windows overlap
   (0.17 apart, 0.30 wide) so the ink never stops moving between steps — one
   continuous line advancing through the five stages, which is the journey the
   section is describing. */
const STEP_PITCH = 0.17;
const STEP_SPAN = 0.3;

function StepRule({ progress, index, reduced }: { progress: MotionValue<number>; index: number; reduced: boolean }) {
  const start = index * STEP_PITCH;
  const scaleX = useTransform(progress, [start, start + STEP_SPAN], [0, 1]);
  if (reduced) return <span aria-hidden className={RULE_CLS} />;
  return <m.span aria-hidden className={RULE_CLS} style={{ scaleX }} />;
}

export default function Process({ language }: ProcessProps) {
  const reduced = useReducedMotion() === true;
  const listRef = useRef<HTMLOListElement>(null);

  // The page's one scroll-DRIVEN moment. Everything else here is scroll-
  // TRIGGERED: it fires once and then runs on its own clock, which is exactly
  // what makes a page read as a template. Mapping position to progress — and
  // only here, on the section that is literally about a sequence — is the
  // difference between a page that reacts and a page that was authored.
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 0.85', 'end 0.55'] });

  return (
    <section id="process" className="px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHead eyebrow={getLocalized(TR.eyebrow, language)} title={getLocalized(TR.title, language)} />

        <Stagger
          as="ol"
          ref={listRef}
          className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-5"
          step={STAGGER.base}
          delay={0.1}
        >
          {TR.steps.map((step, i) => (
            // The rule sits OUTSIDE the fading wrapper on purpose: it used to be
            // a child of the container that faded in over it, so an 800ms brand
            // gesture spent its first 600ms being watched through a blur.
            <li key={step.number} className="relative pt-5">
              <StepRule progress={scrollYProgress} index={i} reduced={reduced} />
              <StaggerItem>
                <span className="text-xs font-semibold tracking-[0.18em] text-primary-dark">{step.number}</span>
                <h3 className="mt-3 text-base font-semibold text-ink">{getLocalized(step.title, language)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{getLocalized(step.text, language)}</p>
              </StaggerItem>
            </li>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
