/**
 * Прайс для сервера — порождается из src/data.ts, не пишется руками.
 *
 * ЗАЧЕМ. Сервер обязан сам считать цену заявки, иначе её присылает клиент и
 * ей нельзя верить. Но как только прайс появляется и в базе, появляется и
 * второй экземпляр цен — а два экземпляра расходятся на первой же правке.
 * Поэтому цену правят ровно в одном месте, в src/data.ts, а SQL порождается
 * из него: `npm run pricing:sql`.
 *
 * ЧЕМ ГРУЗИТСЯ data.ts. Это TypeScript с импортом './types' без расширения —
 * ни node --experimental-strip-types, ни голый import такого не разрешат.
 * Загрузчик берётся у vite (server.ssrLoadModule): vite уже в devDependencies,
 * новых зависимостей не добавляется, а модуль разбирается ТЕМ ЖЕ резолвером,
 * которым его собирает сайт — то есть загрузить то, что не соберётся, нельзя.
 *
 * ЧТО ПИШЕТСЯ:
 *   supabase/12_server_pricing.sql — отдельный файл для обновления базы;
 *   supabase/setup-all.sql         — тот же блок между маркерами, чтобы
 *                                    установка с нуля давала то же самое.
 *
 * ПРОВЕРКА: `npm run pricing:check` (он же внутри `npm run build`) собирает
 * файлы заново и падает, если на диске лежит другое. Расхождение прайса на
 * боевом сайте так становится ошибкой сборки, а не сюрпризом в отчётах.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_FILE = path.join(ROOT, 'scripts', 'pricing.sql.tpl');
const STANDALONE_FILE = path.join(ROOT, 'supabase', '12_server_pricing.sql');
const SETUP_FILE = path.join(ROOT, 'supabase', 'setup-all.sql');

const DATA_PLACEHOLDER = '-- @@PRICING_DATA@@';
const BEGIN_MARKER = '-- >>> НАЧАЛО СГЕНЕРИРОВАННОГО БЛОКА — npm run pricing:sql >>>';
const END_MARKER = '-- <<< КОНЕЦ СГЕНЕРИРОВАННОГО БЛОКА <<<';

const STANDALONE_HEADER = `-- ============================================================
-- SHUGAR MOMMY — ЦЕНУ ЗАЯВКИ СЧИТАЕТ СЕРВЕР
--
-- Выполните ВЕСЬ этот файл в Supabase → SQL Editor → Run.
-- Скрипт безопасно перезапускать.
--
-- ЭТОТ ФАЙЛ СОЗДАН АВТОМАТИЧЕСКИ — \`npm run pricing:sql\`.
-- Источники: src/data.ts (цены) и scripts/pricing.sql.tpl (расчёт).
-- Править руками бессмысленно: следующая генерация всё перезапишет,
-- а \`npm run build\` упадёт раньше — на проверке pricing:check.
--
-- ЧТО БЫЛО НЕ ТАК
-- total_price приходил с сайта и вставлялся как есть: RLS проверял только
-- status = 'new'. Заявку с суммой 0 или 99 999 999 мог отправить кто угодно.
-- На деньги это не влияет — студия берёт их на месте, — но выручка и отчёты
-- в админ-панели считают total_price правдой, и врали бы вместе с ним.
-- Длительность визита с клиента приходила так же, а она резервирует слоты:
-- завышенная длительность — это уже захват чужого времени.
--
-- ЧТО ИЗМЕНИЛОСЬ
-- 1. Прайс, скидки и сеты появились в базе — копией из src/data.ts,
--    порождённой генератором, а не переписанной руками.
-- 2. create_booking(...) принимает СОСТАВ ЗОН и мастера, а цену и
--    длительность считает сама, по тем же правилам, что и сайт.
-- 3. Заявка по-прежнему проходит через анти-спам и уникальный индекс слота,
--    а её id по-прежнему задаёт клиент.
--
-- ПОРЯДОК. Этот файл НЕ закрывает прямую вставку в bookings — старый сайт
-- продолжает работать, пока не выкачен новый. Закрывает её отдельный
-- 13_lock_anon_insert.sql, и выполнять его нужно ПОСЛЕ выкладки сайта.
-- ============================================================
`;

const SETUP_SECTION_HEADER = `-- ============================================================
-- 5. ЦЕНУ ЗАЯВКИ СЧИТАЕТ СЕРВЕР
--
-- Прайс, скидки и сеты живут в src/data.ts. Блок ниже — их копия в базе,
-- порождённая генератором (\`npm run pricing:sql\`) из того же файла, плюс
-- сам расчёт. Руками этот блок не правят: генерация перезапишет, а
-- \`npm run build\` упадёт раньше — на проверке pricing:check.
-- ============================================================
`;

/** Строковый литерал SQL: одинарные кавычки удваиваются. */
function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

/** Целое или NULL — прайс не знает дробных сумм. */
function num(value) {
  if (value === null || value === undefined) return 'null';
  if (!Number.isInteger(value)) {
    throw new Error(`Ожидалось целое, получено ${JSON.stringify(value)}`);
  }
  return String(value);
}

/** `insert ... values (…), (…);` либо честный комментарий, если строк нет. */
function insert(table, columns, rows) {
  if (rows.length === 0) {
    return `-- ${table}: строк нет`;
  }
  const values = rows.map((row) => `  (${row.join(', ')})`).join(',\n');
  return `insert into public.${table} (${columns.join(', ')}) values\n${values};`;
}

/** Загружает src/data.ts резолвером vite — тем же, которым собирается сайт. */
async function loadData() {
  const server = await createServer({
    configFile: false,
    root: ROOT,
    logLevel: 'silent',
    appType: 'custom',
    // Ни оптимизации зависимостей, ни вотчера: нужен один модуль, а не сайт.
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null, preTransformRequests: false },
  });
  try {
    return await server.ssrLoadModule('/src/data.ts');
  } finally {
    await server.close();
  }
}

function buildPricingData(data) {
  const { ALL_SERVICE_ZONES, MASTERS, ZONE_DURATION_ESTIMATE_MIN } = data;

  const zones = ALL_SERVICE_ZONES.map((zone) => [
    q(zone.id),
    num(zone.price ?? null),
    num(ZONE_DURATION_ESTIMATE_MIN[zone.id] ?? 0),
  ]);

  const masters = MASTERS.map((master, index) => [
    q(master.name.RU),
    num(index),
    num(master.discount?.minZones ?? null),
    num(master.discount?.pct ?? null),
  ]);

  const masterZones = MASTERS.flatMap((master) =>
    master.zoneIds.map((zoneId) => [
      q(master.name.RU),
      q(zoneId),
      num(master.prices[zoneId] ?? null),
    ]),
  );

  const sets = MASTERS.flatMap((master) =>
    (master.sets ?? []).map((set) => [q(set.id), q(master.name.RU), num(set.price)]),
  );

  const setZones = MASTERS.flatMap((master) =>
    (master.sets ?? []).flatMap((set) => set.zoneIds.map((zoneId) => [q(set.id), q(zoneId)])),
  );

  // Зона, которой нет в справочнике, сделала бы цену мастера невидимой для
  // расчёта — а внешний ключ поймал бы это только при выполнении SQL, у
  // владелицы студии в SQL Editor. Ловим здесь.
  const knownZones = new Set(ALL_SERVICE_ZONES.map((zone) => zone.id));
  for (const master of MASTERS) {
    for (const zoneId of master.zoneIds) {
      if (!knownZones.has(zoneId)) {
        throw new Error(`Мастер ${master.name.RU}: зона "${zoneId}" отсутствует в ALL_SERVICE_ZONES`);
      }
    }
    for (const set of master.sets ?? []) {
      for (const zoneId of set.zoneIds) {
        if (!knownZones.has(zoneId)) {
          throw new Error(`Сет ${set.id}: зона "${zoneId}" отсутствует в ALL_SERVICE_ZONES`);
        }
      }
    }
  }

  return [
    '-- Порядок удаления обратен ссылкам: сначала дети, потом родители.',
    'delete from public.pricing_set_zones;',
    'delete from public.pricing_sets;',
    'delete from public.pricing_master_zones;',
    'delete from public.pricing_masters;',
    'delete from public.pricing_zones;',
    '',
    insert('pricing_zones', ['zone_id', 'floor_price', 'duration_min'], zones),
    '',
    insert(
      'pricing_masters',
      ['master_key', 'sort_order', 'discount_min_zones', 'discount_pct'],
      masters,
    ),
    '',
    insert('pricing_master_zones', ['master_key', 'zone_id', 'price'], masterZones),
    '',
    insert('pricing_sets', ['set_id', 'master_key', 'price'], sets),
    '',
    insert('pricing_set_zones', ['set_id', 'zone_id'], setZones),
  ].join('\n');
}

/** Одинаковые переводы строк по обе стороны сравнения — иначе CRLF даст ложное расхождение. */
function normalize(text) {
  return text.replaceAll('\r\n', '\n');
}

function injectIntoSetup(current, body) {
  const begin = current.indexOf(BEGIN_MARKER);
  const end = current.indexOf(END_MARKER);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(
      `В supabase/setup-all.sql не найдены маркеры сгенерированного блока.\n` +
        `Ожидались строки:\n  ${BEGIN_MARKER}\n  ${END_MARKER}`,
    );
  }
  const head = current.slice(0, begin);
  const tail = current.slice(end + END_MARKER.length);
  return `${head}${BEGIN_MARKER}\n\n${body}\n${END_MARKER}${tail}`;
}

async function main() {
  const check = process.argv.includes('--check');

  const template = normalize(await readFile(TEMPLATE_FILE, 'utf8'));
  if (!template.includes(DATA_PLACEHOLDER)) {
    throw new Error(`В ${path.relative(ROOT, TEMPLATE_FILE)} нет метки ${DATA_PLACEHOLDER}`);
  }

  const data = await loadData();
  const body = template.replace(DATA_PLACEHOLDER, buildPricingData(data));

  const standalone = `${STANDALONE_HEADER}\n${body}`;
  const setupCurrent = normalize(await readFile(SETUP_FILE, 'utf8'));
  const setupNext = injectIntoSetup(setupCurrent, `${SETUP_SECTION_HEADER}\n${body}`);

  const targets = [
    { file: STANDALONE_FILE, next: standalone },
    { file: SETUP_FILE, next: setupNext },
  ];

  const stale = [];
  for (const target of targets) {
    let current = null;
    try {
      current = normalize(await readFile(target.file, 'utf8'));
    } catch {
      current = null;
    }
    if (current !== target.next) stale.push(target.file);
  }

  if (check) {
    if (stale.length === 0) {
      console.log('pricing: SQL соответствует src/data.ts');
      return;
    }
    console.error(
      'pricing: SQL РАЗОШЁЛСЯ с src/data.ts.\n' +
        stale.map((file) => `  устарел: ${path.relative(ROOT, file)}`).join('\n') +
        '\n\nВыполните `npm run pricing:sql`, проверьте diff и закоммитьте результат.\n' +
        'Затем выполните обновлённый supabase/12_server_pricing.sql в Supabase —\n' +
        'иначе сайт и база будут считать цену по-разному.',
    );
    process.exitCode = 1;
    return;
  }

  for (const target of targets) {
    await writeFile(target.file, target.next, 'utf8');
  }
  if (stale.length === 0) {
    console.log('pricing: изменений нет');
  } else {
    console.log(
      'pricing: обновлено\n' + stale.map((file) => `  ${path.relative(ROOT, file)}`).join('\n'),
    );
  }
}

main().catch((error) => {
  console.error(`pricing: ${error.message}`);
  process.exitCode = 1;
});
