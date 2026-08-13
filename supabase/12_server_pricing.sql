-- ============================================================
-- SHUGAR MOMMY — ЦЕНУ ЗАЯВКИ СЧИТАЕТ СЕРВЕР
--
-- Выполните ВЕСЬ этот файл в Supabase → SQL Editor → Run.
-- Скрипт безопасно перезапускать.
--
-- ЭТОТ ФАЙЛ СОЗДАН АВТОМАТИЧЕСКИ — `npm run pricing:sql`.
-- Источники: src/data.ts (цены) и scripts/pricing.sql.tpl (расчёт).
-- Править руками бессмысленно: следующая генерация всё перезапишет,
-- а `npm run build` упадёт раньше — на проверке pricing:check.
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

-- ------------------------------------------------------------
-- СПРАВОЧНИК ЦЕН — КОПИЯ src/data.ts
--
-- Эти пять таблиц заполняет генератор (npm run pricing:sql), а не человек.
-- Цену правят В ОДНОМ МЕСТЕ — в src/data.ts; SQL из него порождается.
-- Если поправить цену здесь руками, следующая генерация её сотрёт, а
-- `npm run build` упадёт раньше — на проверке pricing:check.
--
-- RLS включён, политик нет: через REST таблицы недоступны никому. Читает
-- их только функция расчёта — она SECURITY DEFINER и работает от владельца.
-- ------------------------------------------------------------

create table if not exists public.pricing_zones (
  zone_id      text primary key,
  -- Самая низкая цена зоны среди всех прайсов — то самое «от», которое сайт
  -- показывает для «любого мастера». NULL = цены нет ни у кого («по запросу»),
  -- и такая зона НЕ входит в сумму.
  floor_price  bigint,
  -- Оценка длительности. Сумма по зонам решает, сколько получасовых ячеек
  -- занимает визит, поэтому завышенная длительность с клиента — это захват
  -- чужого времени, а не косметика.
  duration_min integer not null default 0
);

create table if not exists public.pricing_masters (
  -- RU-написание имени: ровно то, что лежит в bookings.master.
  master_key         text primary key,
  -- Порядок из MASTERS. Нужен, чтобы «любой мастер» при равной сумме выбирал
  -- того же мастера, что и сайт: там перебор идёт по массиву и побеждает первый.
  sort_order         integer not null,
  -- NULL = процентной скидки у неё нет вовсе (Рената). Это позиция студии,
  -- а не «ноль по умолчанию».
  discount_min_zones integer,
  discount_pct       integer
);

create table if not exists public.pricing_master_zones (
  master_key text not null references public.pricing_masters(master_key) on delete cascade,
  zone_id    text not null references public.pricing_zones(zone_id) on delete cascade,
  -- NULL = мастер зону ДЕЛАЕТ, но цены студия не дала («по запросу»).
  -- Строки нет вовсе = мастер эту зону не делает. Разница важна: в первом
  -- случае зону можно записать к ней, во втором — нет.
  price      bigint,
  primary key (master_key, zone_id)
);

create table if not exists public.pricing_sets (
  set_id     text primary key,
  master_key text not null references public.pricing_masters(master_key) on delete cascade,
  price      bigint not null
);

create table if not exists public.pricing_set_zones (
  set_id  text not null references public.pricing_sets(set_id) on delete cascade,
  zone_id text not null references public.pricing_zones(zone_id) on delete cascade,
  primary key (set_id, zone_id)
);

alter table public.pricing_zones        enable row level security;
alter table public.pricing_masters      enable row level security;
alter table public.pricing_master_zones enable row level security;
alter table public.pricing_sets         enable row level security;
alter table public.pricing_set_zones    enable row level security;

revoke all on table
  public.pricing_zones,
  public.pricing_masters,
  public.pricing_master_zones,
  public.pricing_sets,
  public.pricing_set_zones
from anon, authenticated;

-- ------------------------------------------------------------
-- САМ ПРАЙС (сгенерирован из src/data.ts)
-- ------------------------------------------------------------

-- Порядок удаления обратен ссылкам: сначала дети, потом родители.
delete from public.pricing_set_zones;
delete from public.pricing_sets;
delete from public.pricing_master_zones;
delete from public.pricing_masters;
delete from public.pricing_zones;

insert into public.pricing_zones (zone_id, floor_price, duration_min) values
  ('arms-full', 120000, 40),
  ('arms-half', 80000, 30),
  ('hands', 30000, 15),
  ('underarms', 50000, 15),
  ('legs-full', 170000, 60),
  ('legs-half', 130000, 40),
  ('thighs', 90000, 30),
  ('bikini-deep', 110000, 40),
  ('back', 60000, 30),
  ('chest', 60000, 20),
  ('buttocks', 50000, 20),
  ('lower-back', 50000, 15),
  ('belly', 60000, 20),
  ('face-full', 120000, 30),
  ('mustache', 30000, 10),
  ('forehead', 30000, 10),
  ('sideburns', 50000, 10),
  ('chin', 30000, 10),
  ('neck-nape', 50000, 15),
  ('brow-shape', 100000, 30),
  ('brow-tint', 100000, 30),
  ('brow-lamination', 200000, 60),
  ('lash-lamination', 200000, 60),
  ('polymer-mustache', 40000, 10),
  ('polymer-forehead', 50000, 10);

insert into public.pricing_masters (master_key, sort_order, discount_min_zones, discount_pct) values
  ('Рената', 0, null, null),
  ('Ангелина', 1, 3, 20),
  ('Муслима', 2, 3, 20);

insert into public.pricing_master_zones (master_key, zone_id, price) values
  ('Рената', 'arms-full', 140000),
  ('Рената', 'arms-half', 100000),
  ('Рената', 'hands', 40000),
  ('Рената', 'underarms', 60000),
  ('Рената', 'legs-full', 200000),
  ('Рената', 'legs-half', 150000),
  ('Рената', 'thighs', 100000),
  ('Рената', 'bikini-deep', 130000),
  ('Рената', 'back', 70000),
  ('Рената', 'chest', 70000),
  ('Рената', 'buttocks', 70000),
  ('Рената', 'lower-back', 70000),
  ('Рената', 'belly', 70000),
  ('Рената', 'face-full', 120000),
  ('Рената', 'mustache', 30000),
  ('Рената', 'forehead', 30000),
  ('Рената', 'sideburns', 50000),
  ('Рената', 'chin', 30000),
  ('Рената', 'neck-nape', 50000),
  ('Рената', 'brow-shape', 100000),
  ('Рената', 'brow-tint', 100000),
  ('Рената', 'brow-lamination', 200000),
  ('Рената', 'lash-lamination', 200000),
  ('Рената', 'polymer-mustache', 40000),
  ('Рената', 'polymer-forehead', 50000),
  ('Ангелина', 'arms-full', 120000),
  ('Ангелина', 'arms-half', 80000),
  ('Ангелина', 'hands', 30000),
  ('Ангелина', 'underarms', 50000),
  ('Ангелина', 'legs-full', 170000),
  ('Ангелина', 'legs-half', 130000),
  ('Ангелина', 'thighs', 90000),
  ('Ангелина', 'bikini-deep', 110000),
  ('Ангелина', 'back', 60000),
  ('Ангелина', 'chest', 60000),
  ('Ангелина', 'buttocks', 50000),
  ('Ангелина', 'lower-back', 50000),
  ('Ангелина', 'belly', 60000),
  ('Муслима', 'arms-full', 120000),
  ('Муслима', 'arms-half', 80000),
  ('Муслима', 'hands', 30000),
  ('Муслима', 'underarms', 50000),
  ('Муслима', 'legs-full', 170000),
  ('Муслима', 'legs-half', 130000),
  ('Муслима', 'thighs', 90000),
  ('Муслима', 'bikini-deep', 110000),
  ('Муслима', 'back', 60000),
  ('Муслима', 'chest', 60000),
  ('Муслима', 'buttocks', 50000),
  ('Муслима', 'lower-back', 50000),
  ('Муслима', 'belly', 60000);

insert into public.pricing_sets (set_id, master_key, price) values
  ('set-bikini-underarms', 'Рената', 180000),
  ('set-bikini-underarms-shins', 'Рената', 320000),
  ('set-bikini-underarms-legs', 'Рената', 380000),
  ('set-bikini-underarms-legs-arms', 'Рената', 500000);

insert into public.pricing_set_zones (set_id, zone_id) values
  ('set-bikini-underarms', 'bikini-deep'),
  ('set-bikini-underarms', 'underarms'),
  ('set-bikini-underarms-shins', 'bikini-deep'),
  ('set-bikini-underarms-shins', 'underarms'),
  ('set-bikini-underarms-shins', 'legs-half'),
  ('set-bikini-underarms-legs', 'bikini-deep'),
  ('set-bikini-underarms-legs', 'underarms'),
  ('set-bikini-underarms-legs', 'legs-full'),
  ('set-bikini-underarms-legs-arms', 'bikini-deep'),
  ('set-bikini-underarms-legs-arms', 'underarms'),
  ('set-bikini-underarms-legs-arms', 'legs-full'),
  ('set-bikini-underarms-legs-arms', 'arms-full');

-- ------------------------------------------------------------
-- ИЗ ЧЕГО СЧИТАЛАСЬ ЦЕНА
--
-- services — это текст для админа на языке клиентки, он нужен глазам.
-- Считается цена не по нему, а по кодам зон, поэтому коды сохраняются
-- рядом: по ним цену любой записи можно пересчитать и проверить.
-- ------------------------------------------------------------

alter table public.bookings
  add column if not exists zone_ids text[];

comment on column public.bookings.zone_ids is
  'Коды зон, из которых сервер посчитал total_price и duration_min. Заполняет create_booking().';

-- ------------------------------------------------------------
-- РАСЧЁТ ЦЕНЫ И ДЛИТЕЛЬНОСТИ
--
-- Те же правила, что в calcTotal() из src/utils.ts, в том же порядке:
--
--   1. Зона без цены не входит НИ В ОДНО число. Она не «стоит ноль» —
--      её просто нет в сумме.
--   2. Фиксированный сет ПОБЕЖДАЕТ процентную скидку. Совпадение только
--      точное (весь состав, ничего лишнего) и только у своего мастера:
--      сет — это уже сниженная студией цена, вторая скидка сверху увела бы
--      итог ниже того, что студия берёт.
--   3. Иначе — скидка ВЫБРАННОГО мастера, и считается она по числу зон
--      С ЦЕНОЙ: зона, которой нет в сумме, не может дать скидку.
--
-- «Любой мастер» (master пустой) получает НИЖНЮЮ цену и НИ скидки, НИ сета.
-- Нижняя цена — это цена самого дешёвого мастера, который делает ВСЮ
-- корзину, а не сумма минимумов по зонам: ламинацию ресниц делает только
-- Рената, и «её ламинация + бикини по цене Ангелины» — сумма, которую не
-- возьмёт никто. Скидка же принадлежит конкретному мастеру, поэтому до
-- выбора мастера она не обещается.
-- ------------------------------------------------------------

-- DROP перед CREATE: create or replace не умеет менять набор возвращаемых
-- колонок, а этот файл должен оставаться перезапускаемым и после правок
-- расчёта. DROP снимает и права, поэтому REVOKE/GRANT ниже обязательны.
drop function if exists public.quote_booking(text, text[]);

create function public.quote_booking(p_master text, p_zone_ids text[])
returns table (
  quoted_master   text,
  quoted_total    bigint,
  quoted_duration integer,
  -- Состав, из которого посчитана цена: без неизвестных кодов и без повторов.
  -- Возвращается, чтобы create_booking() записала в заявку РОВНО то, за что
  -- выставлен счёт, а не свою версию того же списка.
  quoted_zones    text[]
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  -- Самый длинный реальный заказ — все зоны прайса. Всё сверх этого прислано
  -- не формой; обрезаем, чтобы огромный массив не превращался в нагрузку.
  max_zones   constant integer := 100;
  -- Одна ячейка сетки: даже пустая заявка занимает полчаса.
  min_minutes constant integer := 30;
  -- Верхняя граница колонки duration_min. Она же чинит давнюю мелочь: выбрать
  -- все зоны прайса — это 660 минут по оценкам, и такую запись CHECK отвергал.
  -- 720 = самое длинное рабочее окно студии (Муслима, 08:00–20:00). Сайт
  -- не даёт выбрать время, куда процедура не помещается до закрытия, поэтому
  -- всё, что он вообще способен записать, укладывается в эту границу. Прежние
  -- 600 обрезали длинный комплекс, и последний час визита оставался
  -- «свободным» в сетке занятости.
  max_minutes constant integer := 720;
  v_input     text[];
  v_master    text;
  v_zones     text[];
  v_known     integer;
  v_requested integer;
  v_quote_by  text;
  v_subtotal  bigint  := 0;
  v_priced    integer := 0;
  v_set_price bigint;
  v_min_zones integer;
  v_pct       integer;
  v_total     bigint;
  v_duration  integer := 0;
begin
  v_input := coalesce(p_zone_ids, '{}'::text[]);
  if coalesce(array_length(v_input, 1), 0) > max_zones then
    v_input := v_input[1:max_zones];
  end if;

  -- Мастер опознаётся ТОЧНЫМ совпадением имени. Незнакомое имя (переименовали
  -- мастера, а вкладка у клиентки открыта со вчера) — это не отказ в записи:
  -- заявка проходит как «любой мастер», по нижней цене, и админ назначит сам.
  select m.master_key into v_master
  from public.pricing_masters m
  where m.master_key = btrim(coalesce(p_master, ''));

  -- Только зоны, которые студия действительно знает.
  select coalesce(array_agg(distinct z.zone_id), '{}'::text[])
    into v_zones
  from public.pricing_zones z
  where z.zone_id = any (v_input);

  v_known := coalesce(array_length(v_zones, 1), 0);

  select count(distinct t.id)::integer into v_requested
  from unnest(v_input) as t(id);

  -- Длительность считается по ВСЕМ выбранным зонам, и по бесплатным тоже:
  -- кресло занято независимо от того, назвала ли студия цену.
  select coalesce(sum(z.duration_min), 0)::integer into v_duration
  from public.pricing_zones z
  where z.zone_id = any (v_zones);
  v_duration := least(greatest(v_duration, min_minutes), max_minutes);

  -- Чьими ценами считаем.
  if v_master is not null then
    v_quote_by := v_master;
  else
    select c.master_key into v_quote_by
    from (
      select mz.master_key, sum(mz.price) as sum_price
      from public.pricing_master_zones mz
      join public.pricing_zones z on z.zone_id = mz.zone_id
      where mz.zone_id = any (v_zones)
        and z.floor_price is not null
        and mz.price is not null
      group by mz.master_key
      -- Мастер годится, только если у неё есть цена на КАЖДУЮ зону корзины,
      -- у которой цена вообще существует.
      having count(*) = (
        select count(*)
        from public.pricing_zones z2
        where z2.zone_id = any (v_zones)
          and z2.floor_price is not null
      )
    ) c
    join public.pricing_masters m on m.master_key = c.master_key
    order by c.sum_price asc, m.sort_order asc
    limit 1;
    -- v_quote_by остаётся NULL, если корзину целиком не покрывает никто —
    -- тогда каждая зона берётся по своей нижней цене, ровно как на сайте.
  end if;

  select coalesce(sum(p.price), 0)::bigint, count(p.price)::integer
    into v_subtotal, v_priced
  from (
    select case when v_quote_by is null then z.floor_price else mz.price end as price
    from public.pricing_zones z
    left join public.pricing_master_zones mz
      on mz.master_key = v_quote_by
     and mz.zone_id = z.zone_id
    where z.zone_id = any (v_zones)
  ) p;

  -- Сет — только у своего мастера и только при ТОЧНОМ составе. Неизвестный код
  -- зоны в заявке означает, что состав не равен сету: сайт такого не пришлёт,
  -- а подделанный запрос не должен получать сетовую цену за лишнюю зону.
  if v_master is not null and v_requested = v_known then
    select s.price into v_set_price
    from public.pricing_sets s
    where s.master_key = v_master
      and (
        select count(*) from public.pricing_set_zones sz where sz.set_id = s.set_id
      ) = v_known
      and not exists (
        select 1
        from public.pricing_set_zones sz
        where sz.set_id = s.set_id
          and not (sz.zone_id = any (v_zones))
      )
    order by s.price asc, s.set_id asc
    limit 1;
  end if;

  if v_set_price is not null then
    v_total := v_set_price;
  else
    -- Скидка ВЫБРАННОГО мастера. При «любом мастере» строка не найдётся и
    -- переменные останутся NULL — скидки не будет, как и на сайте.
    select m.discount_min_zones, m.discount_pct
      into v_min_zones, v_pct
    from public.pricing_masters m
    where m.master_key = v_master;

    if v_pct is not null and v_min_zones is not null and v_priced >= v_min_zones then
      v_total := v_subtotal - round(v_subtotal::numeric * v_pct / 100)::bigint;
    else
      v_total := v_subtotal;
    end if;
  end if;

  quoted_master   := v_master;
  quoted_total    := greatest(coalesce(v_total, 0), 0);
  quoted_duration := v_duration;
  quoted_zones    := v_zones;
  return next;
end;
$function$;

revoke all on function public.quote_booking(text, text[]) from public;
-- Снаружи не вызывается: цену клиентке показывает сайт, а в базу её пишет
-- только create_booking() ниже — она SECURITY DEFINER и вызывает эту от
-- имени владельца.
revoke execute on function public.quote_booking(text, text[]) from anon, authenticated;

-- ------------------------------------------------------------
-- СОЗДАНИЕ ЗАЯВКИ
--
-- Единственная дверь в bookings для сайта. Цену и длительность клиент
-- больше НЕ присылает — он присылает состав зон и мастера, остальное
-- считает сервер.
--
-- Что сохраняется как было:
--   * id задаёт клиент — RLS не даёт anon прочитать созданную строку,
--     а экран подтверждения должен знать код заявки сразу;
--   * анти-спам (trg_bookings_antiflood) и уникальный индекс слота
--     (bookings_slot_uniq) срабатывают ровно так же: вставка обычная,
--     триггеры и индексы её видят;
--   * SQLSTATE доходит до сайта нетронутым, поэтому «занято» (23505),
--     «слишком часто» (P0001) и «отклонено» (23514) по-прежнему
--     различаются и показываются разными сообщениями.
--
-- SECURITY DEFINER: функция работает от владельца таблицы, поэтому
-- политика на INSERT для anon больше не нужна — и её снимает
-- 13_lock_anon_insert.sql.
-- ------------------------------------------------------------

drop function if exists public.create_booking(uuid, text, text, text, text, date, text, text[], text, text);

create function public.create_booking(
  p_id            uuid,
  p_customer_name text,
  p_phone         text,
  p_services      text,
  p_master        text,
  p_visit_date    date,
  p_visit_time    text,
  p_zone_ids      text[],
  p_comment       text,
  p_source        text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  q    record;
  v_id uuid;
begin
  select * into q from public.quote_booking(p_master, p_zone_ids);

  v_id := coalesce(p_id, gen_random_uuid());

  insert into public.bookings (
    id, customer_name, phone, services, master,
    visit_date, visit_time, total_price, duration_min,
    comment, source, status, zone_ids
  ) values (
    v_id,
    btrim(coalesce(p_customer_name, '')),
    btrim(coalesce(p_phone, '')),
    -- Текст для глаз админа, приходит с сайта: у сервера нет переводов, а
    -- клиентка должна видеть в подтверждении свой язык. На цену он не влияет —
    -- она считается по кодам зон. Обрезка и «—» здесь только чтобы подделанный
    -- запрос упирался в отказ по существу, а не в CHECK на длину строки
    -- (весь прайс целиком — 476 знаков, форма в тысячу не упирается).
    left(coalesce(nullif(btrim(coalesce(p_services, '')), ''), '—'), 1000),
    q.quoted_master,
    p_visit_date,
    p_visit_time,
    q.quoted_total,
    q.quoted_duration,
    nullif(left(btrim(coalesce(p_comment, '')), 1000), ''),
    nullif(left(btrim(coalesce(p_source, '')), 120), ''),
    'new',
    q.quoted_zones
  );

  -- total_price возвращается не для показа, а для сверки: сайт сравнивает его
  -- со своим числом и пишет в консоль, если они разошлись. Разойтись они могут
  -- только одним способом — прайс в базе отстал от src/data.ts.
  return jsonb_build_object(
    'id', v_id,
    'master', q.quoted_master,
    'total_price', q.quoted_total,
    'duration_min', q.quoted_duration
  );
end;
$function$;

revoke all on function public.create_booking(uuid, text, text, text, text, date, text, text[], text, text) from public;
-- Вызывается формой записи без входа. Публичный доступ здесь безопасен:
-- функция не читает чужие заявки и не принимает цену.
grant execute on function public.create_booking(uuid, text, text, text, text, date, text, text[], text, text) to anon, authenticated;

notify pgrst, 'reload schema';
