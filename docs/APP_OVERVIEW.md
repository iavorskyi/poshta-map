# Поштар (poshta-map) — повний опис застосунку

Сервіс для рутинних задач сільського/міського листоноші: облік пенсіонерів дільниці, типів виплат, щоденних обходів (пенсійних та по-адресних), а також керування будинками й парадними зони обслуговування.

Production: https://poshta-map.vercel.app

---

## 1. Технологічний стек

- **Next.js 16.2.4** (App Router, Server Components, Server Actions, Turbopack)
- **React 19.2.4**
- **Prisma 6.19.3** + **PostgreSQL** (база у Vercel/Neon)
- **Tailwind CSS v4** з `@theme inline` та `@custom-variant dark (&:where(.dark, .dark *))`
- **ExcelJS 4.4** — генерація та парсинг XLSX (шаблони + імпорт)
- **TypeScript 5**, ESLint 9
- Деплой: **Vercel** (production)

### Скрипти (package.json)
- `npm run dev` — локальна розробка
- `npm run build` — `prisma generate && prisma db push --skip-generate && next build`
- `npm run start` — production-сервер
- `npm run db:seed` — наповнення БД через `prisma/seed.ts`
- `postinstall` — `prisma generate`

### Налаштування UI
- Брендова палітра Укрпошти: `#FFD200` (yellow) для primary CTA, `#0f172a` (dark slate) як `brand-fg`
- Семантичні токени: `bg`, `surface`, `elevated`, `border`, `fg`, `fg-muted`, `fg-subtle`, `brand`, `link`, `success`, `warning`, `danger` (+ `*-bg`, `*-border`)
- Helper-класи у `@layer components`: `.input`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.card`, `.link`
- Темна тема: керується класом `.dark` на `<html>`. FOUC-prevention — inline-скрипт у `<head>` ([src/app/layout.tsx](src/app/layout.tsx)) читає `localStorage.theme` + `prefers-color-scheme`
- Перемикач теми у шапці ([src/components/ThemeToggle.tsx](src/components/ThemeToggle.tsx)): зберігає вибір у `localStorage`, рендерить нейтральну іконку до маунту щоб уникнути hydration-mismatch
- Print-сторінка обходу навмисно **залишається світлою** через `.print-area` + `@media print`

---

## 2. Модель даних (Prisma → PostgreSQL)

Файл: [prisma/schema.prisma](prisma/schema.prisma)

### Postman — листоноша
- `id`, `name`
- Зв'язки: `rounds[]`, `addressRounds[]`, `pensioners[]`

### Pensioner — пенсіонер
- `fullName`, `buildingId` (обов'язково), `apartment?`, `phone?`, `passportNumber?`
- `pensionPaymentDay: Int` — день місяця (1–31), коли пенсіонер отримує пенсію
- `postmanId?` — постійний листоноша (опційно)
- `notes?`, `createdAt`, `updatedAt`
- `building` — `onDelete: Restrict` (будинок не видалити, якщо є пенсіонери)
- `postman` — `onDelete: SetNull`
- `currentPayments[]`
- Індекси: `buildingId`, `postmanId`

### Payment — тип виплати (довідник)
- `name`, `code` (унікальний)
- Зв'язки: `currentPayments[]`

### Round — пенсійний обхід
- `date`, `postmanId?`, `notes?`, `closedAt?`, `createdAt`
- `currentPayments[]` (виплати, привʼязані до цього обходу)
- `postman` — `onDelete: SetNull`

### Building — будинок
- `street`, `number`, `notes?`
- `@@unique([street, number])`, індекс по `street`
- `entrances[]`, `pensioners[]`, `addressRounds[]` (через AddressRoundBuilding)

### Entrance — парадне
- `buildingId`, `number: Int`, `aptFrom?`, `aptTo?`, `notes?`
- `@@unique([buildingId, number])`
- `building` — `onDelete: Cascade`

### AddressRound — по-адресний обхід
- `date`, `postmanId?`, `notes?`, `closedAt?`, `createdAt`, `updatedAt`
- `items[]` (AddressRoundBuilding)

### AddressRoundBuilding — позиція в по-адресному обході
- `roundId`, `buildingId`, `notes?`, `done: Boolean`, `position: Int`
- `@@unique([roundId, buildingId])` — один будинок не може двічі бути в обході
- `round` — `onDelete: Cascade`; `building` — `onDelete: Restrict`

### CurrentPayment — поточна виплата
- `roundId?` (може існувати без обходу), `pensionerId`, `paymentId`, `date`, `amount: Float`, `isPaid: Boolean`
- `round` — `onDelete: SetNull` (видалення обходу не видаляє виплату)
- `pensioner` — `onDelete: Cascade`; `payment` — `onDelete: Restrict`
- Індекси: `date`, `(pensionerId, date)`

---

## 3. Маршрути та глобальний layout

Глобальний layout: [src/app/layout.tsx](src/app/layout.tsx)
- Шапка `sticky top-0 z-20`: логотип «П» (бренд-плитка) + назва, навігація (Обходи / Дільниця / Виплати / Пенсіонери / Типи / Листоноші), `ThemeToggle`
- `ToastProvider` обгортає весь застосунок ([src/components/Toast.tsx](src/components/Toast.tsx))
- `lang="uk"`, viewport `viewportFit: "cover"` (для iOS notch)

### Дерево маршрутів
- `/` — головна
- `/rounds` — список обходів (вкладки: пенсія / по-адресні)
- `/rounds/new` — новий пенсійний обхід
- `/rounds/[id]` — деталь пенсійного обходу
- `/rounds/[id]/print` — друкована форма обходу
- `/rounds/address/new` — новий по-адресний обхід
- `/rounds/address/[id]` — деталь по-адресного обходу
- `/pensioners` — список пенсіонерів
- `/pensioners/new` — новий пенсіонер
- `/pensioners/[id]` — деталь пенсіонера + його виплати
- `/current-payments` — реєстр виплат із фільтрами
- `/payments` — довідник типів виплат
- `/postmen` — список листонош
- `/district` — будинки дільниці згруповані по вулицях
- `/district/[id]` — деталь будинку (парадні, пенсіонери)
- `/api/pensioners/template` — XLSX-шаблон імпорту пенсіонерів
- `/api/current-payments/template` — XLSX-шаблон імпорту виплат

---

## 4. Головна (/)

Файл: [src/app/page.tsx](src/app/page.tsx)

Дашборд із п'ятьма картками: Обходи, Поточні виплати, Пенсіонери, Типи виплат, Листоноші. Лічильники тягнуться через `Promise.all([prisma.*.count()])`. Кожна картка — `Link` із hover-ефектом (рамка змінюється на `border-brand`).

Сітка: `grid-cols-2 lg:grid-cols-5`.

---

## 5. Пенсіонери

### 5.1. Список `/pensioners`
- Заголовок із кількістю
- Кнопки: «Імпортувати з XLSX» (модал), «+ Додати пенсіонера»
- Сортування: за ФІО (укр. локаль)
- Таблиця/картки: ФІО → посилання на `/pensioners/[id]`, адреса (`вул. X, № N, кв. K`), телефон, день пенсії, листоноша, кількість виплат
- Empty state: дашд-бордер у нейтральному фоні

### 5.2. Створення `/pensioners/new`
Компонент: [src/app/pensioners/PensionerForm.tsx](src/app/pensioners/PensionerForm.tsx)

Поля форми:
- ФІО *
- Будинок * — `BuildingCombobox` (пошук по «вулиця, № N»)
- Квартира, телефон, паспорт
- День пенсії * — number 1–31
- Листоноша (select)
- Примітки

### 5.3. Деталь `/pensioners/[id]`
Файл: [src/app/pensioners/[id]/page.tsx](src/app/pensioners/[id]/page.tsx)

Включає:
- Форму редагування пенсіонера (ті ж поля, що при створенні)
- Кнопку видалення
- Таблицю його `CurrentPayment`-ів: дата, тип, сума, статус, посилання на обхід (якщо `roundId`)

### 5.4. Server actions ([src/app/pensioners/actions.ts](src/app/pensioners/actions.ts))
- `createPensioner(formData)` → валідує ФІО, building, день; redirect на детальну
- `updatePensioner(id, formData)` → часткове оновлення
- `deletePensioner(id)` → cascade видалить `CurrentPayment[]`

### 5.5. Імпорт XLSX
Компонент: [src/app/pensioners/ImportPensioners.tsx](src/app/pensioners/ImportPensioners.tsx)
Парсер: [src/lib/pensionerImport.ts](src/lib/pensionerImport.ts)

**Алгоритм:**
1. Файл (≤ 10 МБ) читається через ExcelJS у `ArrayBuffer`
2. Перша непуста строка з ≥ 3 розпізнаних колонок (за `HEADER_ALIASES`) вважається заголовком
3. Обов'язкові колонки: **ФІО, Вулиця, Будинок, День пенсії**
4. Аліаси: «піб»→ФІО, «буд»→Будинок, «адреса»→Вулиця тощо
5. Нормалізація: street без префіксів `вул./просп./пров./пл.`, `fullName` trim+lower для дедуп-ключа
6. Дедуп-ключ: `normalize(fullName) + buildingId + normalize(apartment)` → якщо знайдено — `update`, інакше — `create`
7. Auto-create будинку, якщо такої пари (street, number) ще немає
8. Помилки рядка не зупиняють імпорт — формують `errors: { rowNumber, message }[]`

**Результат:** `{ created, updated, errors }` показується в модалі.

### 5.6. Шаблон XLSX `/api/pensioners/template`
Файл: [src/app/api/pensioners/template/route.ts](src/app/api/pensioners/template/route.ts)

`buildPensionersTemplate()` повертає Excel із колонками **ФІО, Вулиця, Будинок, Квартира, Телефон, Паспорт, День пенсії, Примітки**, двома прикладами та налаштованою шириною (ФІО: 28, Примітки: 32, Вулиця: 22, інші: 14). Filename: `pensioners-template.xlsx`.

---

## 6. Типи виплат `/payments`

Файли: [page.tsx](src/app/payments/page.tsx), [PaymentsClient.tsx](src/app/payments/PaymentsClient.tsx), [actions.ts](src/app/payments/actions.ts)

- Таблиця `name`, `code`
- Inline-редагування + видалення
- Server actions:
  - `createPayment` — обов'язкові `name`, `code`, унікальність `code` через DB
  - `updatePayment` — часткове
  - `deletePayment` — блокується, якщо є пов'язані `CurrentPayment` (через `onDelete: Restrict`)

---

## 7. Листоноші `/postmen`

Файли: [page.tsx](src/app/postmen/page.tsx), [PostmenClient.tsx](src/app/postmen/PostmenClient.tsx), [actions.ts](src/app/postmen/actions.ts)

- Список з ім'ям та сумарною кількістю обходів (`_count.rounds + _count.addressRounds`)
- CRUD inline
- Видалення дозволене тільки якщо у листоноші немає Round і AddressRound. Зв'язок із Pensioner — `SetNull`, тому він не блокує

---

## 8. Дільниця (будинки)

### 8.1. Список `/district`
Файл: [src/app/district/page.tsx](src/app/district/page.tsx)

- Заголовок: «Будинків: N · Вулиць: M»
- Форма «Додати будинок» ([AddBuilding.tsx](src/app/district/AddBuilding.tsx)): street + number + notes
- Будинки згруповано по вулицях (укр. сортування назв)
- Усередині вулиці — натуральне сортування номерів (1, 2, 2а, 10, 12)
- Кожен будинок — кнопка з кількістю парадних, веде на `/district/[id]`

### 8.2. Деталь `/district/[id]`
Файл: [BuildingDetailClient.tsx](src/app/district/[id]/BuildingDetailClient.tsx)

- Редагування `street`, `number`, `notes`
- Список парадних із діапазоном квартир та примітками
- Форма додавання парадного: номер (>0), діапазон квартир, примітки
- Список пенсіонерів цього будинку (посилання)

### 8.3. Парсер діапазону квартир `parseAptRange`
- Приймає: `«1-8»`, `«1—8»` (en-dash), `«1 - 8»`, одне число `«5»` (від = до)
- Повертає `{ from, to }` або помилку, якщо `to < from`
- Може бути `null/null` — якщо не задано

### 8.4. Server actions ([actions.ts](src/app/district/actions.ts))
- `createBuilding`, `updateBuilding`
- `deleteBuilding` — блокується, якщо є пенсіонери (Restrict)
- `addEntrance` — перевіряє `unique(buildingId, number)`, повертає помилку «Парадне з таким номером вже існує»
- `updateEntrance`, `deleteEntrance`

---

## 9. Поточні виплати `/current-payments`

Файли: [page.tsx](src/app/current-payments/page.tsx), [CurrentPaymentsFilter.tsx](src/app/current-payments/CurrentPaymentsFilter.tsx), [CurrentPaymentsTable.tsx](src/app/current-payments/CurrentPaymentsTable.tsx), [AddCurrentPayment.tsx](src/app/current-payments/AddCurrentPayment.tsx), [ImportCurrentPayments.tsx](src/app/current-payments/ImportCurrentPayments.tsx), [actions.ts](src/app/current-payments/actions.ts)

### 9.1. Сторінка
- **Фільтри** через searchParams: `from`, `to` (дефолт — поточний місяць від `currentMonthRange()`), `pensionerId`, `paymentId`
- **Stat-блок** (4 картки): кількість виплат, заплановано, виплачено (`success`), залишок (`warning`)
- **Форма додавання нової виплати** прямо зі сторінки: пенсіонер, тип виплати, дата (дефолт = `from`), сума, чекбокс «виплачено»
- **Таблиця**: дата, ФІО, тип, сума, статус, обхід (link якщо є)
- Inline-edit: змінювати `amount`/`isPaid` без переходу
- Кнопка видалення з підтвердженням (toast feedback)

### 9.2. Range parsing ([src/lib/dateRange.ts](src/lib/dateRange.ts))
- `currentMonthRange(now?)` → `{ from, to }` як YYYY-MM-DD на перше і останнє число місяця
- `parseRange(rawFrom?, rawTo?)` → дефолт = поточний місяць; `to` ставиться на `23:59:59.999` для inclusive-фільтру

### 9.3. Server actions
- `createCurrentPayment({ pensionerId, paymentId, date, amount, isPaid? })` — мінімальна валідація: всі обов'язкові, `amount ≥ 0`, дата парситься через `fromDateInputValue`
- `updateCurrentPaymentFields(id, patch)` — часткове `{ amount?, isPaid?, date? }`; якщо запис прив'язаний до обходу — викликає `revalidatePath` для деталі обходу
- `deleteCurrentPayment(id)` — аналогічно ревалідує сторінку обходу
- `importCurrentPayments(formData)` — див. нижче

### 9.4. Імпорт XLSX
Парсер: [src/lib/currentPaymentImport.ts](src/lib/currentPaymentImport.ts)

**Параметри форми:** `file`, `paymentId` (один тип на весь імпорт), `year`, `month` (1–12, дефолт — поточний).

**Алгоритм:**
1. Колонки: **ФІО, Вулиця, Будинок, День, Сума, Виплачено** (остання опційна)
2. `parseBool`: `«1» / «true» / «так» / «yes» / «y» / «+» / «✓» / «✔» / «виплачено» / «оплачено»` → `true`
3. День валідується проти кількості днів у обраному місяці
4. Сума: `≥ 0`
5. Пошук пенсіонера: ФІО + (нормалізована вулиця, номер). Якщо за адресою два пенсіонери з однаковим ФІО — помилка з вимогою уточнити
6. Дедуп: один pensioner + (paymentId, year, month, day) — повторні рядки в файлі попадають у `warnings`, не дублюються в БД
7. Створення дати: `new Date(year, month-1, day)` (локальний полудень)

**Результат:** `{ created, errors, warnings }`

### 9.5. Шаблон XLSX `/api/current-payments/template`
- Колонки **ФІО, Вулиця, Будинок, День, Сума, Виплачено**
- Два приклади заповнення
- Filename: `current-payments-template.xlsx`

---

## 10. Обходи `/rounds`

Список має дві вкладки: **Пенсія** (default) та **По-адресні** ([src/app/rounds/page.tsx](src/app/rounds/page.tsx)).

Спільна логіка сортування для обох вкладок:
```
orderBy: [{ closedAt: { sort: "asc", nulls: "first" } }, { date: "desc" }]
```
Тобто **спершу відкриті, потім закриті**, всередині кожної групи — за датою спадання. Закриті обходи мають `opacity-70` і бейджик «Закритий».

### 10.1. Пенсійний обхід — список (вкладка «Пенсія»)
- Кнопка «+ Новий обхід» → `/rounds/new`
- Mobile cards / desktop table з колонками: Дата, Листоноша, Виплат, Заплановано (`Σ amount`), Виплачено (`Σ amount where isPaid`), Залишок
- Дата — клікабельний лінк на `/rounds/[id]`

### 10.2. Створення `/rounds/new`
Файли: [page.tsx](src/app/rounds/new/page.tsx), [NewRoundClient.tsx](src/app/rounds/new/NewRoundClient.tsx)

**Серверна підготовка:** для кожного пенсіонера підтягується **поточний місяць його виплат** → `pensionerMonthPayments: Record<number, ExistingCP[]>`. Це дає змогу при додаванні пенсіонера в обхід **переттянути уже наявні виплати** замість дублювання.

**Логіка форми:**
1. Поля: дата (default — сьогодні), листоноша, примітки
2. **Пропозиції** — пенсіонери, чий `pensionPaymentDay === день обраної дати` і яких ще не додано → відображаються кнопками-плитками
3. **Список пенсіонерів у чернетці** з блоками виплат:
   - Якщо у пенсіонера за обраний місяць уже є виплати — items автоматично заповнюються з `existingId`. Поля **paymentId та amount disabled, якщо isPaid=true**, з підказкою «оплачено»
   - Якщо ще немає — створюється порожній item для введення вручну
   - Кнопки: додати item (тип/сума), видалити item, видалити пенсіонера зі списку
4. Ручне додавання пенсіонера: select з тими, кого ще немає в чернетці
5. Підрахунок «Разом заплановано» внизу

**Submit:**
- Клієнт серіалізує `initialPayments: { pensionerId, paymentId, amount, existingId?, isPaid? }[]`
- Валідує що в кожного item є `paymentId` і `amount`
- Викликає `createRound`

### 10.3. Server actions для пенсійних обходів
Файл: [src/app/rounds/actions.ts](src/app/rounds/actions.ts)

- `createRound(formData)`:
  1. Транзакція — створює `Round`
  2. Розділяє items на **fresh** (без `existingId`) та **existing**
  3. Fresh — `createMany`
  4. Existing — `update`, привʼязуючи `roundId` до новоствореного. Якщо `isPaid=true` — `paymentId/amount` НЕ перезаписуються (зберігається стан реальної виплати)
  5. `redirect('/rounds/[id]')`
- `setRoundClosed(id, closed)` — `closedAt = new Date() | null`
- `deleteRound(id)` — видаляє Round; через `onDelete: SetNull` `CurrentPayment.roundId` стає null (виплати залишаються в реєстрі)
- `updateRoundMeta(id, { date?, postmanId?, notes? })` — часткове оновлення
- `addCurrentPayment(roundId, { pensionerId, paymentId, amount, date? })` — якщо дата не передана — береться з `round.date`
- `updateCurrentPayment(id, roundId, { amount?, isPaid? })`
- `deleteCurrentPayment(id, roundId)`

Усі actions для obhodu викликають `revalidatePath` для відповідних сторінок.

### 10.4. Деталь пенсійного обходу `/rounds/[id]`
Файли: [page.tsx](src/app/rounds/[id]/page.tsx), [RoundDetailClient.tsx](src/app/rounds/[id]/RoundDetailClient.tsx)

**Шапка-картка:**
- BackLink («← Назад» якщо є same-origin referrer, інакше — fallback link на `/rounds`)
- Дата + бейджик «Закритий» (якщо `closedAt`)
- Кнопки: Редагувати (розгортає inline-форму дата/листоноша/примітки), Закрити/Відкрити, Друк (`/rounds/[id]/print`), Видалити (з підтвердженням)
- Stat-блок: Заплановано, Виплачено, Залишок (success/warning токени)

**Список виплат (групи по пенсіонеру):**
- Сортування **спочатку незакриті/неповністю оплачені, потім повністю оплачені** (під «дільником-роздільником»)
- Усередині пенсіонера: items з чекбоксом `isPaid` (`accent-brand`), полем суми (inline-edit), видаленням
- Group card: paid → `border-success-border bg-success-bg/40`, unpaid → нейтральний `border-border bg-surface`
- Item paid → виділяється зеленуватим тлом, рядок ослаблений по opacity
- Адреса пенсіонера — `link` на його сторінку
- ФІО — посилання на `/pensioners/[id]`

**Форма додавання нової виплати** (під списком): пенсіонер (PensionerCombobox), тип, сума, кнопка «Додати».

### 10.5. Друк обходу `/rounds/[id]/print`
Файли: [page.tsx](src/app/rounds/[id]/print/page.tsx), [PrintActions.tsx](src/app/rounds/[id]/print/PrintActions.tsx)

- Окрема print-friendly сторінка зі списком пенсіонерів та їхніми виплатами
- `.print-area` + `@media print` — тримає **світле оформлення навіть у dark mode**
- `PrintActions` — клієнтський блок із кнопкою друку та можливістю позначати виплати як `isPaid` прямо у списку (для роботи в полі)

### 10.6. По-адресний обхід — список (вкладка «По-адресні»)
- Кнопка «+ Новий обхід» → `/rounds/address/new`
- Картки з датою, листоношею, кількістю будинків (`_count.items`), прогресом «пройдено X/Y» (`done/total`), приміткою (line-clamp-2), бейджиком «Закритий»

### 10.7. Створення `/rounds/address/new`
Файли: [page.tsx](src/app/rounds/address/new/page.tsx), [NewAddressRoundClient.tsx](src/app/rounds/address/new/NewAddressRoundClient.tsx)

- Поля: дата, листоноша, примітки
- **Додавання будинків через `BuildingCombobox`** — обираєш зі списку, тиснеш «Додати», будинок переноситься в обрані
- Список обраних із номером порядку, кнопками **↑ / ↓ для зміни послідовності** (записуються в `position`), та `✕` для видалення
- Submit → `createAddressRound(formData)`: `buildingIds` JSON, для кожного створюється `AddressRoundBuilding` з `position = індекс`

### 10.8. Server actions для по-адресних обходів
Файл: [src/app/rounds/address/actions.ts](src/app/rounds/address/actions.ts)

- `createAddressRound(formData)` — створює `AddressRound` + items за списком (`position` за порядком)
- `updateAddressRoundMeta(id, { date?, postmanId?, notes? })`
- `setAddressRoundClosed(id, closed)`
- `deleteAddressRound(id)` — `onDelete: Cascade` для items
- `addBuildingToAddressRound(roundId, buildingId)` — `position = max(position) + 1`; перевіряє унікальність → «Цей будинок вже у списку»
- `removeBuildingFromAddressRound(roundId, itemId)` — видаляє лише запис, сам будинок — ні
- `toggleAddressRoundItemDone(roundId, itemId, done)` — `done: Boolean`
- `updateAddressRoundItemNotes(roundId, itemId, notes)` — інлайн-нотатка для конкретного будинку в межах конкретного обходу

### 10.9. Деталь по-адресного обходу `/rounds/address/[id]`
Файли: [page.tsx](src/app/rounds/address/[id]/page.tsx), [AddressRoundDetailClient.tsx](src/app/rounds/address/[id]/AddressRoundDetailClient.tsx)

- Header: BackLink, метадані з кнопкою редагування (дата/листоноша/примітки)
- Кнопки: Закрити/Відкрити, Видалити (з підтвердженням)
- Список будинків (відсортований за `position`):
  - Пройдені (`done=true`) — переміщуються вниз під роздільник, картка `border-success-border bg-success-bg/30`
  - Кожен item: чекбокс «зроблено» (`accent-brand`), назва будинку (link на `/district/[buildingId]`), пенсіонери цього будинку (для контексту), inline-нотатка обходу
  - Нотатка має inline edit з кнопками «Зберегти / Скасувати» (`btn-primary !px-3 !py-1.5` / `btn-secondary !px-3 !py-1.5`)
  - Кнопка `✕` — `removeBuildingFromAddressRound`
- Форма додавання будинку через `BuildingCombobox` — додає в кінець списку

---

## 11. Спільні компоненти

### `ToastProvider` / `useToast` ([src/components/Toast.tsx](src/components/Toast.tsx))
- React Context, `showToast(message, kind)` де kind: `"error" | "success" | "info"`
- Авто-закриття: error 6 с, інші 3.5 с
- Стилізовано через `*-bg/*-border` токени; fallback у `console.warn`, якщо контекст не знайдено

### `BackLink` ([src/components/BackLink.tsx](src/components/BackLink.tsx))
- Перевіряє `document.referrer` → якщо same-origin: `router.back()`
- Інакше — звичайний `<Link href={fallbackHref}>`

### `BuildingCombobox` ([src/components/BuildingCombobox.tsx](src/components/BuildingCombobox.tsx))
- Контрольований компонент: `value: number | ""`, `onChange`
- Пошук у `street + number`, до **80 результатів**
- Клавіатура: ↑/↓, Enter, Escape, кнопка `✕` для очищення

### `PensionerCombobox` ([src/components/PensionerCombobox.tsx](src/components/PensionerCombobox.tsx))
- Аналог для пенсіонерів — пошук по ФІО, до **50 результатів**
- Синхронізація: при зміні `value` ззовні — оновлюється текст у полі

### `ThemeToggle` ([src/components/ThemeToggle.tsx](src/components/ThemeToggle.tsx))
- Тоглить `.dark` на `<html>`, пише в `localStorage.theme`
- До маунту рендерить нейтральну Moon-іконку (anti-FOUC + anti-hydration mismatch)

---

## 12. Утиліти

### [src/lib/prisma.ts](src/lib/prisma.ts)
- Сінглтон Prisma-клієнта в `globalThis` (щоб уникнути множинних інстансів при HMR)
- Логування: dev → `error, warn`, prod → лише `error`

### [src/lib/format.ts](src/lib/format.ts)
- `formatUAH(value)` — `Intl.NumberFormat` UAH (наприклад `1 234,56 ₴`)
- `formatDate(value)` — DD.MM.YYYY
- `toDateInputValue(date)` — Date → YYYY-MM-DD (для `<input type="date">`)
- `fromDateInputValue(str)` — YYYY-MM-DD → Date як **локальний полудень** (уникає UTC-shift, який ламає день у східних часових поясах)

### [src/lib/dateRange.ts](src/lib/dateRange.ts)
- `currentMonthRange(now?)` — перше та останнє число місяця у YYYY-MM-DD
- `parseRange(rawFrom, rawTo)` — повертає `{ from, to, fromStr, toStr }`; `to` має `23:59:59.999` для inclusive-фільтрації

### [src/lib/pensionerImport.ts](src/lib/pensionerImport.ts)
- `COLUMN_HEADERS`, `HEADER_ALIASES`
- `parsePensionersXlsx(buffer)` — повертає `{ rows, errors }`
- `buildPensionersTemplate()` — генерує `Buffer` із прикладами

### [src/lib/currentPaymentImport.ts](src/lib/currentPaymentImport.ts)
- Те саме для виплат + `parseBool` для колонки «Виплачено»
- `buildCurrentPaymentsTemplate()` — Buffer для шаблона

---

## 13. Бізнес-нюанси та реальні ребра

1. **`closedAt` не блокує редагування.** Закритий обхід — це лише прапорець для сортування і UI-перегляду. Змінити дані в ньому все одно можна (це свідома поведінка для виправлень).
2. **`Round.delete` не видаляє виплати.** Через `CurrentPayment.round` `onDelete: SetNull` виплати залишаються в реєстрі `/current-payments` без обходу. Свідомо — щоб не втратити фінансову історію.
3. **`AddressRound.delete` навпаки видаляє items** — будинки ніяк не страждають, бо relation `Cascade` стоїть лише на стороні `AddressRoundBuilding` → видаляється тільки звʼязка.
4. **Building видалення блокується пенсіонерами** (`Restrict`). Якщо будинок треба видалити — спершу перенести/видалити пенсіонерів. Помилку повертає server action.
5. **Payment видалення блокується** наявними `CurrentPayment` (`Restrict`).
6. **Postman видалення** дозволене лише якщо нема Round/AddressRound. На Pensioner стоїть `SetNull` — пенсіонери просто залишаються без листоноші.
7. **Pensioner видалення видаляє його CurrentPayment** (Cascade) — повна історія виплат піде разом із записом. На фронтенді є попередження.
8. **Форма «Новий обхід» враховує існуючі виплати поточного місяця.** Якщо вже є оплачена (`isPaid=true`) — вона приходить заблокованою з підписом «оплачено». Редагувати її в чернетці не можна — лише в реєстрі виплат або в обході, до якого вона прив'язана.
9. **Пропозиції на сторінці «Новий обхід»** базуються на `pensionPaymentDay === дата.getDate()` і виключають уже доданих у чернетку.
10. **Дедуп при імпорті виплат** — на парі `(pensionerId, день у обраному місяці+рік)` для **одного** `paymentId`. Тобто за один прогон можна імпортувати лише один тип виплати; повторні рядки потрапляють у `warnings`.
11. **Дедуп при імпорті пенсіонерів** — `normalize(fullName) + buildingId + normalize(apartment)`. Без квартири двох пенсіонерів з однаковим ФІО не розрізнити — другий вважатиметься тим самим і оновить першого.
12. **`fromDateInputValue` парсить дати локально** (`new Date(year, month-1, day)`), а не через `new Date(str)`. Це важливо: інакше у часовому поясі України `2025-05-05` ставав би `04.05.2025 21:00 UTC` і за певних агрегатів день зсувався б.
13. **Фільтр виплат за датою**: `to` перетворюється на `23:59:59.999`, тому верхня межа **інклюзивна**.
14. **`AddressRoundBuilding.position`** дає стабільний порядок при `findMany({ orderBy: { position: 'asc' } })`. UI стрілки `↑ / ↓` працюють тільки на сторінці створення; всередині існуючого обходу нові додаються в кінець (`max(position)+1`), переупорядкувати готовий список наразі не можна.
15. **`AddressRoundBuilding.notes`** — це **примітка для конкретного обходу**, а не для будинку. Це окреме поле від `Building.notes`.
16. **Print-сторінка завжди світла** — навмисно (для друку на папері).
17. **Шапка має горизонтальний скрол** на малих екранах (`overflow-x-auto`) — навігація не обрізається.
18. **Header sticky** + `z-20` — поверх усього, окрім модалок (модалки використовують `bg-black/50` бекдроп).
19. **Toast-контекст обовʼязковий**: будь-який клієнтський компонент може викликати `useToast()` без перевірки наявності — провайдер навісано на `<body>` у root layout.

---

## 14. Деплой / середовище

- **Vercel**: production URL https://poshta-map.vercel.app
- БД: PostgreSQL (DATABASE_URL у env). Build виконує `prisma db push --skip-generate`, тому міграцій як таких немає — схема синхронізується «push»-ом
- Темна тема: `localStorage.theme` (`light` | `dark`) + fallback на `prefers-color-scheme`
- Мова інтерфейсу: **українська** (UI-копія, повідомлення про помилки, валідаційні рядки)
- Авторизації немає — застосунок розрахований на одного листоношу/невелику команду з довірою. Вибір листоноші — це **атрибут** обходу, а не сесія.

---

## 15. Що навмисно НЕ зроблено (простір для розвитку)

- **Без auth/RBAC** — будь-хто з URL бачить усі дані
- **Без міграцій Prisma** — `db push` достатньо для прототипу
- **Без пагінації** на великих списках (`/pensioners`, `/current-payments`) — на тисячах записів треба буде додавати курсорну пагінацію та індекси
- **Без географічної карти** — попри назву проекту, мапи зараз немає; «карта дільниці» зараз = список будинків згрупований по вулицях
- **Без переупорядкування** будинків у вже створеному `AddressRound`
- **Без сповіщень/нагадувань** про дні виплат — тільки suggestion-плитки на сторінці нового обходу

---

> Документ актуальний на 2026-05-05. Останній production-комміт із UI redesign: `3ccaccb` («Redesign UI with dark mode and Ukrposhta brand palette»). Останній комміт у функціонал: `547471a` («Move completed items to bottom under divider in rounds»).
