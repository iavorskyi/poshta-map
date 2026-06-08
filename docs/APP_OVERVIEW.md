# Поштар (poshta-map) — повний опис застосунку

Сервіс для рутинних задач сільського/міського листоноші: облік пенсіонерів дільниці, типів виплат, щоденних обходів (пенсійних і по-адресних), керування будинками й парадними, аутентифікація з ролями та персональний дашборд за поточним користувачем-листоношею.

Production: https://poshta-map.vercel.app

---

## 1. Технологічний стек

- **Next.js 16.2.4** (App Router, Server Components, Server Actions, Turbopack)
- **React 19.2.4**
- **Prisma 6.19.3** + **PostgreSQL** (DATABASE_URL у env; Vercel/Neon у проді)
- **Tailwind CSS v4** з `@theme inline`, темна тема через клас `.dark`
- **jose** — JWT сесії (HS256), **bcryptjs** — хеш паролів
- **ExcelJS 4.4** — XLSX-шаблони та імпорт
- **Leaflet 1.9 + React-Leaflet 5.0** — карти у по-адресних і пенсійних обходах
- **@dnd-kit/core + sortable + utilities** — drag-and-drop сортування
- **TypeScript 5**, ESLint 9
- Деплой: **Vercel** (production)

### Скрипти ([package.json](package.json))
- `npm run dev` — локальна розробка (Turbopack)
- `npm run build` — `prisma generate && prisma db push --skip-generate && next build`
- `npm run start` — production-сервер
- `npm run db:seed` — наповнення БД через [prisma/seed.ts](prisma/seed.ts)
- `npm run db:geocode` — геокодинг будинків ([scripts/geocode-buildings.ts](scripts/geocode-buildings.ts))
- `npm run grant-admin` — надати адмін-права та логін/пароль листоноші ([scripts/grant-admin.ts](scripts/grant-admin.ts))
- `postinstall` — `prisma generate`

### UI-теми
- Брендова палітра Укрпошти: `#FFD200` (yellow) для primary CTA, `#0f172a` як `brand-fg`
- Семантичні токени: `bg`, `surface`, `elevated`, `border`, `fg`, `fg-muted`, `fg-subtle`, `brand`, `link`, `success`, `warning`, `danger` (+ `*-bg`, `*-border`)
- Helper-класи у `@layer components`: `.input`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.card`, `.link`
- Темна тема: клас `.dark` на `<html>`. FOUC-prevention — inline-скрипт у `<head>` ([src/app/layout.tsx](src/app/layout.tsx)) читає `localStorage.theme` + `prefers-color-scheme`
- Перемикач теми у шапці ([src/components/ThemeToggle.tsx](src/components/ThemeToggle.tsx))
- Print-сторінка обходу навмисно лишається світлою через `.print-area` + `@media print`

---

## 2. Модель даних (Prisma → PostgreSQL)

Файл: [prisma/schema.prisma](prisma/schema.prisma)

### Postman — листоноша
- `id`, `name`
- `phone?` — показується на друкованому слипі обходу
- `username? @unique`, `passwordHash?` — для логіну
- `isAdmin: Boolean @default(false)`
- Зв'язки: `rounds[]`, `addressRounds[]`, `pensioners[]`

### DeliveryPreference (enum)
- `OFFICE` — пенсіонер сам приходить у відділення
- `HOME` — доставка додому

### Pensioner — пенсіонер
- `fullName`, `buildingId` (Restrict), `apartment?`, `phone?`, `passportNumber?`
- `pensionPaymentDay: Int` (1–31) — день отримання пенсії
- `postmanId?` — постійний листоноша (SetNull)
- `deliveryPreference?: DeliveryPreference`
- `notes?`, `createdAt`, `updatedAt`
- Індекси: `buildingId`, `postmanId`

### Payment — тип виплати (довідник)
- `name`, `code @unique`
- `currentPayments[]`

### Round — пенсійний обхід
- `date`, `postmanId?` (SetNull), `notes?`, `closedAt?`, `createdAt`
- `currentPayments[]`

### Building — будинок
- `street`, `number`, `notes?`
- **Геодані**: `latitude?`, `longitude?`, `geocodedAt?`, `geocodeFailed @default(false)`
- `createdAt`, `updatedAt`
- `@@unique([street, number])`, індекси `street`, `[latitude, longitude]`
- `entrances[]`, `pensioners[]`, `addressRounds[]`

### Entrance — парадне
- `buildingId` (Cascade), `number: Int`, `aptFrom?`, `aptTo?`, `notes?`
- `@@unique([buildingId, number])`

### AddressRound — по-адресний обхід
- `date`, `postmanId?` (SetNull), `notes?`, `closedAt?`, `createdAt`, `updatedAt`
- `items[]` → `AddressRoundBuilding`

### AddressRoundBuilding — позиція в по-адресному обході
- `roundId` (Cascade), `buildingId` (Restrict), `notes?`, `done: Boolean`, `position: Int @default(0)`, `createdAt`
- `@@unique([roundId, buildingId])`, індекси `roundId`, `buildingId`

### CurrentPayment — поточна виплата
- `roundId?` (SetNull) — може існувати без обходу
- `pensionerId` (Cascade), `paymentId` (Restrict)
- `date`, `amount: Float`, `isPaid: Boolean`
- `roundPosition: Int @default(0)` — стабільний порядок у деталі обходу (DnD)
- Індекси: `date`, `[pensionerId, date]`, `[roundId, roundPosition]`

### SubscriptionDeliveryMode (enum)
- `ADDRESS` — доставка на адресу
- `PICKUP` — самовивіз з відділення

### Publication — періодичне видання (довідник)
- `code @unique` (код у каталозі Укрпошти), `name`
- `issuesPerMonth?: Int` — кількість випусків на місяць (MSP), поки інформативно
- `notes?`, `createdAt`, `updatedAt`, `subscriptions[]`
- Індекс: `name`

### Subscriber — передплатник
- `fullName`, `isOrganization: Boolean @default(false)`, `phone?`
- **Адреса (взаємовиключна пара)**:
  - `buildingId?` (Restrict) — будинок з каталогу дільниці
  - `streetText?`, `numberText?` — текстова адреса «поза дільницею» (відображається italic, без лінку)
- `corpus?`, `apartment?`
- `deliveryMode: SubscriptionDeliveryMode @default(ADDRESS)`
- `notes?`, `createdAt`, `updatedAt`, `subscriptions[]`
- Індекси: `buildingId`, `fullName`

### Subscription — підписка передплатника на видання за рік
- `subscriberId` (Cascade), `publicationId` (Restrict), `year: Int`
- `activeMonths: Int[]` — масив на 12 елементів (Січ-Гру), значення = кількість примірників на місяць (0 = немає підписки)
- `notes?`, `createdAt`, `updatedAt`
- `@@unique([subscriberId, publicationId, year])` — одна підписка на пару передплатник+видання на рік
- Індекси: `[publicationId, year]`, `subscriberId`

---

## 3. Аутентифікація та авторизація

### 3.1. Сесія ([src/lib/auth.ts](src/lib/auth.ts))
- Cookie `phs`, httpOnly, secure у production, `sameSite: lax`, `path: /`, термін **30 днів**
- JWT (HS256, бібліотека `jose`), payload `{ pid: postmanId }`
- `AUTH_SECRET` (env, ≥ 8 символів) — інакше throw на старті
- `getCurrentUser()` обгорнуто в React `cache()` — один запит за цикл рендеру
- `requireUser()` → редірект на `/login`, якщо немає сесії
- `requireAdmin()` → редірект на `/`, якщо не адмін
- Хешування паролів `bcryptjs` (10 раундів)

### 3.2. Middleware ([src/middleware.ts](src/middleware.ts))
- Публічні шляхи: `/login`
- Перевіряє JWT з cookie `phs`
- Невалідний / відсутній → `307 redirect` на `/login?next=<pathname>`
- Matcher виключає `_next/static`, `_next/image`, `favicon.ico`, статичні зображення

### 3.3. Логін `/login`
- [src/app/login/page.tsx](src/app/login/page.tsx) — якщо вже залогінений, редірект на `?next` або `/`
- [src/app/login/LoginForm.tsx](src/app/login/LoginForm.tsx) — `username` + `password`
- [src/app/login/actions.ts](src/app/login/actions.ts) — `login(formData)`: знаходить за username, звіряє bcrypt-хеш, ставить cookie

### 3.4. Профіль `/profile`
- [src/app/(authed)/profile/page.tsx](src/app/(authed)/profile/page.tsx) — показує ФІО, username, роль (Адмін/Листоноша)
- [src/app/(authed)/profile/ProfileClient.tsx](src/app/(authed)/profile/ProfileClient.tsx) — форма зміни пароля

### 3.5. RBAC ([src/lib/permissions.ts](src/lib/permissions.ts))
- `canEditPensioner(me, p)` — адмін | свій пенсіонер (`postmanId === me.id`) | без листоноші
- `canEditRound(me, r)` / `canEditAddressRound(me, r)` — адмін | свій обхід
- `canEditCurrentPayment(me, cp)` — за обходом якщо є, інакше за пенсіонером
- `canManageDistrict` / `canManagePayments` / `canManagePostmen` / `canImport` / `canManageSubscriptions` — **тільки адмін**
- `ForbiddenError`, `assert(cond)` — для server actions

### 3.6. Надання адмін-прав
- [scripts/grant-admin.ts](scripts/grant-admin.ts) — інтерактивний CLI: знайти листоношу за id/username, видати `isAdmin=true`, встановити username + пароль (bcrypt-хеш). Запускається `npm run grant-admin`.

---

## 4. Маршрути та layouts

Глобальний layout: [src/app/layout.tsx](src/app/layout.tsx) — `lang="uk"`, viewport з `viewportFit: "cover"` (для iOS notch), inline-скрипт теми, `ToastProvider`, `RouteProgress` (топ-бар прогресу).

Authed layout: [src/app/(authed)/layout.tsx](src/app/(authed)/layout.tsx) — `sticky top-0 z-20` шапка з логотипом «П», навігацією через `NavLink` (Обходи / Дільниця / Виплати / Пенсіонери / Типи / Листоноші — останні три приховані для не-адмінів), `ThemeToggle`, `LogoutButton`. Активна вкладка має нижній `border-b-2 border-brand` ([src/components/NavLink.tsx](src/components/NavLink.tsx)).

### Дерево маршрутів
```
/login                              — публічна сторінка логіну
(authed)/                           — все нижче під middleware-захистом
  /                                 — персональний дашборд листоноші
  /profile                          — профіль + зміна пароля
  /rounds                           — список обходів (вкладки: Пенсія / По-адресні)
  /rounds/new                       — новий пенсійний обхід
  /rounds/[id]                      — деталь пенсійного обходу
  /rounds/[id]/print                — друкована форма (слипи)
  /rounds/address/new               — новий по-адресний обхід
  /rounds/address/[id]              — деталь по-адресного обходу
  /pensioners                       — список пенсіонерів (фільтр + сорт)
  /pensioners/new                   — новий пенсіонер
  /pensioners/[id]                  — деталь пенсіонера
  /current-payments                 — реєстр виплат
  /payments                         — довідник типів виплат (admin)
  /postmen                          — список листонош (admin)
  /district                         — будинки по вулицях
  /district/[id]                    — деталь будинку (парадні + пенсіонери)
  /subscriptions                    — редірект на /subscriptions/publications
  /subscriptions/publications       — каталог періодичних видань (admin CRUD)
  /subscriptions/publications/[id]  — матриця передплатників × 12 місяців
  /subscriptions/subscribers        — реєстр передплатників
  /subscriptions/subscribers/[id]   — деталь передплатника, 12-місячний редактор
  /api/pensioners/template          — XLSX-шаблон імпорту пенсіонерів
  /api/current-payments/template    — XLSX-шаблон імпорту виплат
```

---

## 5. Головна `/` — персональний дашборд

Файл: [src/app/(authed)/page.tsx](src/app/(authed)/page.tsx)

Заголовок: «Привіт, {ім'я}!». Уся статистика обмежена **пенсіонерами, закріпленими за поточним користувачем** (`pensioner.postmanId === me.id`), незалежно від того, хто фактично робив обхід.

### 5.1. Картки статистики (4 шт, grid 2 / lg:4)
- **Виплачено цього місяця** — `paidCount` із `totalCount`, сума, тон success
- **Залишок до виплати** — `unpaidCount`, сума, тон warning
- **Прострочено** — count + сума (тон danger якщо > 0, «немає» якщо 0)
- **На сьогодні** — `paid/total виплачено`, сума виплат на сьогодні

### 5.2. Прогрес-бар місяця
`% виплачено = paidSum / totalSum × 100`. Знизу — рядок «Заплановано / виплачено / залишок».

### 5.3. Таблиця прострочених
- Усі мої виплати з `isPaid=false AND date < today`, відсортовані за датою, **limit 50**
- Колонки (desktop): Дата, Пенсіонер (link), Адреса, Тип, Сума, **Днів** (червоним)
- Mobile: картки з `border-danger-border`
- Якщо `overdueCount > limit` — підказка «Показано N із M» з посиланням на `/current-payments`
- Empty state: «Прострочених виплат немає. Так тримати!»

### 5.4. На сьогодні
Список виплат з датою = today, статус (Виплачено / Очікує). Приховано, якщо пусто.

### 5.5. Швидкі переходи (нав-картки)
- Обходи (показує кількість активних)
- Поточні виплати
- Пенсіонери (закріплено: N)
- Листоноші (тільки для адміна)

---

## 6. Пенсіонери

### 6.1. Список `/pensioners`
Файл: [src/app/(authed)/pensioners/page.tsx](src/app/(authed)/pensioners/page.tsx)

**Фільтр** ([PensionersFilter.tsx](src/app/(authed)/pensioners/PensionersFilter.tsx)) через searchParams:
- `q` — пошук case-insensitive по ФІО, телефону, квартирі, вулиці, номеру будинку
- `postmanId` — `none` (без листоноші) або ID
- `day` — день пенсії 1–31

**Сортування** (`sort=name|address|day|payments`, `dir=asc|desc`):
- `name` — за ФІО (укр. колація)
- `address` — за вулицею → номером → квартирою → ФІО
- `day` — за днем пенсії
- `payments` — в JS за `monthPaymentsTotal` (кількість виплат поточного місяця)

**Список**: для кожного пенсіонера показується **badge `X/Y`** — `paid/total` виплат поточного місяця (агрегація через `prisma.currentPayment.groupBy`).

Кнопки в шапці: «+ Додати пенсіонера», «Імпортувати з XLSX» (admin).

### 6.2. Форма пенсіонера
[src/app/(authed)/pensioners/PensionerForm.tsx](src/app/(authed)/pensioners/PensionerForm.tsx)

Поля: ФІО *, Будинок * (`BuildingCombobox`), Квартира, Телефон, Паспорт, День пенсії * (1–31), Листоноша (select), **Спосіб отримання** (`OFFICE` / `HOME`), Примітки.

### 6.3. Деталь `/pensioners/[id]`
[src/app/(authed)/pensioners/[id]/page.tsx](src/app/(authed)/pensioners/[id]/page.tsx)
- Форма редагування (refresh через `key={updatedAt}`)
- Таблиця виплат у вибраному періоді з фільтром `CurrentPaymentsFilter` у `mode="pensioner"`
- Stat-блок: заплановано / виплачено / залишок
- Кнопка додавання виплати, якщо `canEditPensioner`

### 6.4. Imports / actions
- [actions.ts](src/app/(authed)/pensioners/actions.ts) — `createPensioner`, `updatePensioner`, `deletePensioner` (всі перевіряють `canEditPensioner`)
- [ImportPensioners.tsx](src/app/(authed)/pensioners/ImportPensioners.tsx) + [src/lib/pensionerImport.ts](src/lib/pensionerImport.ts) — XLSX-імпорт з дедупом за `normalize(fullName) + buildingId + normalize(apartment)`, auto-create будинків
- [api/pensioners/template/route.ts](src/app/api/pensioners/template/route.ts) — генерація `pensioners-template.xlsx`

---

## 7. Поточні виплати `/current-payments`

Файли: [page.tsx](src/app/(authed)/current-payments/page.tsx), [CurrentPaymentsFilter.tsx](src/app/(authed)/current-payments/CurrentPaymentsFilter.tsx), [CurrentPaymentsTable.tsx](src/app/(authed)/current-payments/CurrentPaymentsTable.tsx), [AddCurrentPayment.tsx](src/app/(authed)/current-payments/AddCurrentPayment.tsx), [ImportCurrentPayments.tsx](src/app/(authed)/current-payments/ImportCurrentPayments.tsx), [actions.ts](src/app/(authed)/current-payments/actions.ts)

### 7.1. Фільтри
`from`, `to` (дефолт — поточний місяць), `pensionerId`, `paymentId`. Параметри `sort` та `dir` керують серверним `orderBy`.

### 7.2. Сортування (6 колонок)
- `date` (default), `pensioner`, `payment`, `amount`, **`postman`** (за `pensioner.postman.name`), `paid`
- Реалізація — серверний `orderBy` + клікабельні заголовки `SortHeader` у `CurrentPaymentsTable`
- Колонка «Листоноша» з '—' для пенсіонерів без listonoshi (десктоп + мобільна картка)

### 7.3. Stat-блок
Виплат (count), Заплановано, Виплачено (success), Залишок (warning).

### 7.4. Додавання виплати (`AddCurrentPayment.tsx`)
Поля: пенсіонер (PensionerCombobox), тип, дата, сума, чекбокс «виплачено». Видно тільки тим, хто може редагувати хоча б одного пенсіонера.

Адмін також бачить кнопку відкриття **модалу управління типами виплат** ([src/components/PaymentTypeManager.tsx](src/components/PaymentTypeManager.tsx)) — CRUD довідника `Payment` без переходу на `/payments`.

### 7.5. Таблиця (inline-edit)
- Колонки: Дата, Пенсіонер, Тип, Сума (input number, `onBlur` save), Виплачено (checkbox), Листоноша, Обхід, дії
- Permission per item: якщо `!canEdit` — input/checkbox `disabled`
- Видалення з підтвердженням, тост-фідбек

### 7.6. Імпорт XLSX
[src/lib/currentPaymentImport.ts](src/lib/currentPaymentImport.ts), [src/lib/nameMatch.ts](src/lib/nameMatch.ts), [actions.ts](src/app/(authed)/current-payments/actions.ts), [ImportCurrentPayments.tsx](src/app/(authed)/current-payments/ImportCurrentPayments.tsx), [CurrentPaymentsPreview.tsx](src/app/(authed)/current-payments/CurrentPaymentsPreview.tsx)
- Колонки: **ФІО, Вулиця, Будинок, День, Сума, Виплачено**
- `parseBool`: `1 / true / так / yes / y / + / ✓ / ✔ / виплачено / оплачено`
- Параметри форми: `paymentId`, `year`, `month`
- **Двокроковий потік** (preview → apply): `previewCurrentPaymentsImport` повертає для кожного рядка резолв будинку (`exact|loose|ambiguous|none`) та резолв пенсіонера у межах будинку (`exact|fuzzy|ambiguous|none`); користувач у UI підтверджує рішення (прийняти запропонованого / обрати іншого з будинку / створити нового / обрати найближчого за ФІО з усієї бази / пропустити); `applyCurrentPaymentsImport` створює `CurrentPayment` за підтвердженими рішеннями. Ніяких неявних auto-create пенсіонерів — лише за явним «Створити нового»
- Fuzzy-матчинг ФІО — [src/lib/nameMatch.ts](src/lib/nameMatch.ts): нормалізація (lowercase, єдиний апостроф, ё→е, без пунктуації); токенізація з відкиданням ініціалів і сортуванням токенів (порядок «Прізвище Імʼя» не важливий); per-token Levenshtein допуск: 0 для ≤3 літер, 1 для 4–6, 2 для ≥7. `exact` — рівний нормалізований набір токенів; `fuzzy` — рівно один кандидат у бюджеті; `ambiguous` — два+ кандидати в бюджеті (UI вимагає вибору)
- **Broad name-search** (`findClosestPensionersByName`) — топ-3 найближчих ФІО серед усіх пенсіонерів дільниці (повний Levenshtein на відсортованих токенах, без бюджету — лише ранжування). Показується в UI: (а) коли в очікуваному будинку ніхто не схожий на імпортоване ФІО (`pensioner.kind === "none"`) — замість dropdown «сусідів по будинку»; (б) коли сам будинок не вдалось зрезолвити (`ambiguous`/`none`) — щоб дати шанс врятувати рядок, якщо у файлі помилка в адресі, а ФІО близьке до існуючого пенсіонера з іншого будинку
- Помилки розпізнавання **будинку** (`ambiguous`/`none`) — рядок отримує controls «обрати найближчого за ФІО / пропустити» (за замовчуванням skip). Якщо користувач обирає існуючого пенсіонера, `applyCurrentPaymentsImport` ігнорує неправильну адресу й привʼязує виплату до обраного `pensionerId` напряму. `create_new` для таких рядків недоступний (нема куди прикріплювати) — треба виправити адресу у файлі
- День поза межами місяця (`row_invalid`) — рядок невідновлюваний, без жодних рішень
- Auto-create будинків через нормалізацію вулиць ([src/lib/streetMatch.ts](src/lib/streetMatch.ts))
- Дедуп `(pensionerId, paymentId, year, month, day)` перевіряється і на preview (бейдж «Вже є в місяці»), і на apply (race-safe — стан перечитується)

---

## 8. Обходи `/rounds`

Список — [src/app/(authed)/rounds/page.tsx](src/app/(authed)/rounds/page.tsx) — дві вкладки **Пенсія** (default) / **По-адресні**.

Сортування для обох: `[{ closedAt: { sort: "asc", nulls: "first" } }, { date: "desc" }]` — спочатку відкриті, потім закриті, всередині — за датою спадання. Закриті — `opacity-70` + бейджик «Закритий».

### 8.1. Пенсійний обхід — список (вкладка «Пенсія»)
Mobile cards / desktop table з колонками: Дата (link), Листоноша, Виплат (count), Заплановано (`Σ amount`), Виплачено (`Σ amount where isPaid`), Залишок.

### 8.2. Створення `/rounds/new`
Файли: [page.tsx](src/app/(authed)/rounds/new/page.tsx), [NewRoundClient.tsx](src/app/(authed)/rounds/new/NewRoundClient.tsx)

- Дата (default — сьогодні), листоноша, примітки
- **Пропозиції**: пенсіонери з невиплаченими `CurrentPayment` поточного місяця, у яких день платежу збігається з обраною датою; виключаються вже додані до чернетки. В адмін-режимі додатково фільтруються по обраному в формі листоноші (`pensioner.postmanId === postmanId`)
- При додаванні пенсіонера в чернетку підтягуються **лише наявні неоплачені `CurrentPayment` поточного місяця** (із `existingId`); оплачені приходять заблокованими з підписом «оплачено». Шаблонні items із попередніх місяців **більше не матеріалізуються автоматично** — додаткові виплати треба додавати вручну
- Можна додавати додаткові виплати на місці (плюс модал створення типу для адмінів)
- Submit: items серіалізуються як `initialPayments: { pensionerId, paymentId, amount, existingId?, isPaid? }[]` → `createRound`

### 8.3. Деталь пенсійного обходу `/rounds/[id]`
Файли: [page.tsx](src/app/(authed)/rounds/[id]/page.tsx), [RoundDetailClient.tsx](src/app/(authed)/rounds/[id]/RoundDetailClient.tsx)

- **Шапка**: BackLink, дата, бейджик «Закритий», кнопки: Редагувати (inline дата/листоноша/примітки), Закрити/Відкрити, Друк, Видалити
- **Stat**: Заплановано / Виплачено / Залишок
- **Список виплат, групи по пенсіонеру**, відсортовані `roundPosition` (DnD-перетягування — `@dnd-kit` через [SortableList.tsx](src/components/SortableList.tsx))
  - Спочатку незакриті / неповністю оплачені, потім повністю оплачені під роздільником
  - Item: checkbox `isPaid`, inline-edit `amount`, кнопка видалення
  - Бейдж **Спосіб отримання** (OFFICE / HOME) поряд з ФІО (комміт `a106074`)
  - Адреса — link на пенсіонера
- **Optimistic UI** (комміт `a2081f4`): локальний стан `localItems` — toggle, edit, remove застосовуються миттєво, потім узгоджуються з сервером; `useGlobalPending(isPending)` повідомляє топ-прогрес-бар
- **Карта пенсіонерів** (комміт `fefc460`): під списком — `AddressMap` з будинками всіх пенсіонерів обходу, пронумерована у тому ж порядку, що й список
- **Форма додавання виплати** під списком: PensionerCombobox + тип + сума
- **Форма додавання пенсіонера** показує плитки-пропозиції: пенсіонери з невиплаченими `CurrentPayment` у місяці обходу, де `date.getDate() === day(round.date)`; виключаються вже додані, а якщо в обходу є `postmanId` — фільтрується по ньому. Клік по плитці миттєво додає пенсіонера (через `addPensionerToRound`)

### 8.4. Server actions для пенсійних обходів
[src/app/(authed)/rounds/actions.ts](src/app/(authed)/rounds/actions.ts)
- `createRound(formData)` — транзакційно створює `Round`, fresh items через `createMany`, existing (`existingId`) — `update` з прив'язкою `roundId`. Оплачені items не перезаписуються
- `setRoundClosed(id, closed)` — `closedAt = new Date() | null`
- `deleteRound(id)` — Round видаляється, `CurrentPayment.roundId` ставиться `null` (виплати лишаються в реєстрі)
- `addPensionerToRound(roundId, pensionerId)` — прив'язує до обходу всі неоплачені `CurrentPayment` цього пенсіонера за місяць обходу (без матеріалізації шаблонів із попередніх місяців). Якщо нічого прив'язувати — повертає помилку
- `updateRoundMeta`, `addCurrentPayment`, `updateCurrentPayment`, `deleteCurrentPayment`
- `reorderRoundPayments(roundId, ids[])` — оновлює `roundPosition` за DnD-порядком

### 8.5. Друк `/rounds/[id]/print`
[page.tsx](src/app/(authed)/rounds/[id]/print/page.tsx), [PrintActions.tsx](src/app/(authed)/rounds/[id]/print/PrintActions.tsx)

Слипи для роботи в полі:
- Заголовок: дата обходу + **ФІО листоноші з телефоном** (`Postman.phone`, комміт `5a00f25`)
- `.print-area` + `@media print` — світла тема навіть у dark
- `PrintActions` — клієнтський блок із кнопкою друку + чекбоксами `isPaid` для відмітки прямо на смартфоні

### 8.6. Список по-адресних обходів (вкладка «По-адресні»)
Картки: дата, листоноша, кількість будинків, прогрес «пройдено X/Y», примітка (line-clamp-2), бейджик «Закритий».

### 8.7. Створення `/rounds/address/new`
Файли: [page.tsx](src/app/(authed)/rounds/address/new/page.tsx), [NewAddressRoundClient.tsx](src/app/(authed)/rounds/address/new/NewAddressRoundClient.tsx)

- Дата, листоноша, примітки
- `BuildingCombobox` → «Додати» переносить будинок в обрані
- Обрані сортуються через **drag-and-drop** (`@dnd-kit`)
- **Карта** ([AddressMap.tsx](src/components/AddressMap.tsx)):
  - Жовті пронумеровані пін-каплі для обраних
  - Блакитні «+»-маркери для пропозицій сусідніх будинків
  - Клік на пропозицію → додає в кінець списку
- Submit → `createAddressRound(formData)`: items зі стартовим `position = індекс`

### 8.8. Деталь по-адресного обходу `/rounds/address/[id]`
Файли: [page.tsx](src/app/(authed)/rounds/address/[id]/page.tsx), [AddressRoundDetailClient.tsx](src/app/(authed)/rounds/address/[id]/AddressRoundDetailClient.tsx)

- Header: BackLink, мета, кнопки Редагувати / Закрити / Видалити
- Список будинків (за `position`), DnD-сортування:
  - Чекбокс «зроблено» (`accent-brand`)
  - Назва будинку (link на `/district/[buildingId]`)
  - Пенсіонери цього будинку (для контексту)
  - Inline-нотатка для конкретного обходу (Зберегти / Скасувати)
  - Пройдені (`done=true`) переміщуються вниз під роздільник, картка `border-success-border bg-success-bg`
- **Карта**:
  - Жовті пронумеровані піни для обраних, **червоні для done** (комміт `5178107`)
  - Нумерація піни **синхронізована з порядком списку**, не з ID (комміт `cdf022d`)
  - Блакитні маркери — пропозиції сусідніх будинків (`getNearbyBuildings`)
- Форма додавання будинку через `BuildingCombobox`

### 8.9. Підбір сусідніх будинків
[src/app/(authed)/rounds/address/nearby.ts](src/app/(authed)/rounds/address/nearby.ts)

- `getNearbyBuildings(selectedIds, excludeIds)` шукає будинки в радіусі **200 м від будь-якої** обраної адреси (а не лише від останньої — комміт `4b4aa19`)
- Haversine для відстаней, обмеження до 12 результатів
- Конфіг центру міста / меж — [src/lib/geo-config.ts](src/lib/geo-config.ts)

### 8.10. Server actions для по-адресних обходів
[src/app/(authed)/rounds/address/actions.ts](src/app/(authed)/rounds/address/actions.ts)
- `createAddressRound`, `updateAddressRoundMeta`, `setAddressRoundClosed`, `deleteAddressRound`
- `addBuildingToAddressRound(roundId, buildingId)` — `position = max(position) + 1`, перевіряє унікальність
- `removeBuildingFromAddressRound`, `toggleAddressRoundItemDone`, `updateAddressRoundItemNotes`
- `reorderAddressRoundItems(roundId, ids[])` — DnD reposition

---

## 9. Дільниця `/district`

### 9.1. Список
[src/app/(authed)/district/page.tsx](src/app/(authed)/district/page.tsx)
- Заголовок: «Будинків: N · Вулиць: M»
- Форма «Додати будинок» (admin-only)
- Групування по вулицях (укр. сортування), натуральне сортування номерів (1, 2, 2а, 10)
- Кожен будинок — кнопка з кількістю парадних, веде на `/district/[id]`

### 9.2. Деталь `/district/[id]`
[BuildingDetailClient.tsx](src/app/(authed)/district/[id]/BuildingDetailClient.tsx)
- Редагування `street`, `number`, `notes`
- Парадні: номер, діапазон квартир, примітки. Парсер `parseAptRange` приймає `1-8`, `1—8`, `1 - 8`, `5`
- Список пенсіонерів цього будинку

### 9.3. Server actions
[actions.ts](src/app/(authed)/district/actions.ts)
- `createBuilding`, `updateBuilding`, `deleteBuilding` (Restrict на пенсіонерах)
- `addEntrance`, `updateEntrance`, `deleteEntrance`
- Усі — `canManageDistrict` (admin)

---

## 10. Довідники

### 10.1. Типи виплат `/payments` (admin)
Файли: [page.tsx](src/app/(authed)/payments/actions.ts) (тут лише actions; UI керується через модал на `/current-payments`)
Альтернативно — кнопка модалу `PaymentTypeManager` на `/current-payments`.

### 10.2. Листоноші `/postmen` (admin)
- Список з ім'ям, телефоном, обходами (`_count.rounds + _count.addressRounds`), бейджем «Адмін»
- CRUD inline + кнопка «Видати доступ» (username + пароль)
- Видалення дозволено лише якщо немає Round/AddressRound (Pensioner — SetNull, не блокує)

---

## 11. Передплати `/subscriptions`

Модуль обліку передплат на періодичні видання (газети, журнали). Доступний усім аутентифікованим у режимі читання; CRUD — `canManageSubscriptions` (admin).

### 11.1. Вкладки
[SubscriptionsTabs.tsx](src/app/(authed)/subscriptions/SubscriptionsTabs.tsx) — дві вкладки: **Видання** (`/subscriptions/publications`) і **Передплатники** (`/subscriptions/subscribers`). `/subscriptions` редіректить на видання.

### 11.2. Видання `/subscriptions/publications`
[page.tsx](src/app/(authed)/subscriptions/publications/page.tsx), [PublicationsClient.tsx](src/app/(authed)/subscriptions/publications/PublicationsClient.tsx)

Список усіх `Publication`: код Укрпошти, назва, MSP (`issuesPerMonth?`), кількість активних підписок у вибраному році. Admin може створювати/редагувати/видаляти inline. Видалення заблоковане Restrict, якщо є `Subscription`.

### 11.3. Деталь видання `/subscriptions/publications/[id]`
[page.tsx](src/app/(authed)/subscriptions/publications/[id]/page.tsx)

Матриця **передплатники × 12 місяців** для обраного року (`?year=`) — read-only вид з кількістю примірників на місяць і рядком підсумків знизу. Редагування відбувається на сторінці передплатника. YearSwitcher — посилання на попередній/наступний рік.

### 11.4. Передплатники `/subscriptions/subscribers`
[page.tsx](src/app/(authed)/subscriptions/subscribers/page.tsx), [SubscribersClient.tsx](src/app/(authed)/subscriptions/subscribers/SubscribersClient.tsx)

Список усіх `Subscriber` з пошуком (`q` — по ФІО/телефону) і фільтром по року для лічильника активних підписок. Колонки: ПІБ/Організація (бейдж «організація»), Адреса, Телефон, Доставка (`ADDRESS`/`PICKUP`), к-сть підписок у році. Inline-edit на десктопі через `SubscriberForm`. Admin також бачить кнопку «+ Передплатник» зі складанням нового запису.

### 11.5. Форма передплатника
[SubscriberForm.tsx](src/app/(authed)/subscriptions/subscribers/SubscriberForm.tsx) — спільна для create/edit:
- ФІО *, чекбокс «Організація», телефон
- Чекбокс «Адреса поза дільницею» перемикає між `BuildingCombobox` і парою `streetText`/`numberText` (italic-відображення в списках)
- Корпус, квартира, спосіб доставки, нотатка

### 11.6. Деталь передплатника `/subscriptions/subscribers/[id]`
[page.tsx](src/app/(authed)/subscriptions/subscribers/[id]/page.tsx), [SubscriberDetailClient.tsx](src/app/(authed)/subscriptions/subscribers/[id]/SubscriberDetailClient.tsx)

Header з адресою (off-district — italic), бейджем «організація», способом доставки, телефоном і кнопкою **«Редагувати»** ([EditSubscriberButton.tsx](src/app/(authed)/subscriptions/subscribers/[id]/EditSubscriberButton.tsx)) — модал поверх сторінки (`fixed inset-0 z-50 bg-black/50`, Escape закриває, після збереження `router.refresh()`).

Нижче — 12-місячний редактор по виданнях за обраний рік: кожна клітинка — `input type="number"` з кількістю примірників на місяць (0 = немає підписки). Стан зберігається оптимістично (`useOptimistic`), на зміну викликається `upsertSubscription`. Колонка «∑» — сума по рядку. Кнопка «Додати видання» з фільтром уже доданих публікацій. YearSwitcher як на видавництві.

### 11.7. Server actions
[actions.ts](src/app/(authed)/subscriptions/subscribers/actions.ts)
- `createSubscriber`, `updateSubscriber`, `deleteSubscriber` — `canManageSubscriptions`
- `upsertSubscription({ subscriberId, publicationId, year, monthIndex, quantity })` — створює рядок з нульовим масивом якщо немає, інакше оновлює один індекс (кількість примірників)
- `addSubscriptionRow({ subscriberId, publicationId, year })` — додає порожній рядок підписки на нове видання
- `deleteSubscription(id)` — видалити весь рядок року

[publications/actions.ts](src/app/(authed)/subscriptions/publications/actions.ts) — `createPublication`, `updatePublication`, `deletePublication` (Restrict на `Subscription`).

### 11.8. Off-district + auto-resolve
Адреса передплатника — **взаємовиключна пара** `buildingId` або `streetText+numberText`. На збереженні `createSubscriber` / `updateSubscriber` викликають `resolveBuildingFromText`:
- Якщо `buildingId` не вказано, але обидва тексти задано — спроба матчу через `findBuildingByAddress` ([streetMatch.ts](src/lib/streetMatch.ts)) серед усіх будинків дільниці
- На `exact` або `loose` збігу — `buildingId` встановлюється, `streetText/numberText` обнуляються
- Це уникає дублювання, якщо адміністратор вводить «Шевченко, 12», а в каталозі є «вул. Шевченка, 12»

---

## 12. Спільні компоненти

| Файл | Призначення |
|---|---|
| [Toast.tsx](src/components/Toast.tsx) | ToastProvider + `useToast(message, kind)` — error 6с, інші 3.5с |
| [BackLink.tsx](src/components/BackLink.tsx) | `router.back()` для same-origin referrer, інакше fallback `<Link>` |
| [BuildingCombobox.tsx](src/components/BuildingCombobox.tsx) | Пошук по `street + number`, до 80 результатів, клавіатурна навігація |
| [PensionerCombobox.tsx](src/components/PensionerCombobox.tsx) | Пошук по ФІО, до 50 результатів |
| [NavLink.tsx](src/components/NavLink.tsx) | Nav-вкладка з активним `border-b-2 border-brand` (комміт `727faa4`) |
| [ThemeToggle.tsx](src/components/ThemeToggle.tsx) | Перемикач теми + localStorage, anti-FOUC |
| [LogoutButton.tsx](src/components/LogoutButton.tsx) | Server action виходу + redirect на `/login` |
| [RouteProgress.tsx](src/components/RouteProgress.tsx) | Топ-прогрес-бар (h-0.5, fixed, z-50). Слухає кліки `<a>`, сабміти `<form>` та CustomEvent від `useGlobalPending(isPending)` — інкремент/декремент counter (комміт `902e68c`) |
| [Spinner.tsx](src/components/Spinner.tsx) | Inline-спінер для кнопок з pending state |
| [SortableList.tsx](src/components/SortableList.tsx) | DnD-обгортка над `@dnd-kit` (PointerSensor distance=6, TouchSensor delay=200, KeyboardSensor). API: `items, onReorder(ids[])` (комміт `23960e0`) |
| [PaymentTypeManager.tsx](src/components/PaymentTypeManager.tsx) | Модал CRUD типів виплат, доступний з `/current-payments` (комміт `7eefb7a`) |
| [AddressMap.tsx](src/components/AddressMap.tsx) | React-Leaflet карта: жовті пронумеровані піни обраних, червоні done, блакитні маркери пропозицій, FitBounds, OpenStreetMap tiles |

---

## 13. Утиліти

| Файл | Що робить |
|---|---|
| [prisma.ts](src/lib/prisma.ts) | Сінглтон Prisma-клієнта (через globalThis для HMR) |
| [auth.ts](src/lib/auth.ts) | Сесії, getCurrentUser, requireUser/requireAdmin, hashPassword |
| [permissions.ts](src/lib/permissions.ts) | `canEdit*`, `can*Manage*`, `ForbiddenError`, `assert` |
| [format.ts](src/lib/format.ts) | `formatUAH`, `formatDate`, `toDateInputValue`, `fromDateInputValue` (локальний полудень — уникає UTC-shift) |
| [dateRange.ts](src/lib/dateRange.ts) | `currentMonthRange`, `parseRange` (`to` як `23:59:59.999` для inclusive) |
| [pensionerImport.ts](src/lib/pensionerImport.ts) | Парсер XLSX-пенсіонерів + builder шаблону |
| [currentPaymentImport.ts](src/lib/currentPaymentImport.ts) | Парсер XLSX-виплат + auto-create пенсіонерів + builder шаблону |
| [streetMatch.ts](src/lib/streetMatch.ts) | Нормалізація і розпізнавання варіантів написання вулиць (комміт `1895e5a`) — використовується імпортами для матчингу та auto-create |
| [geocode.ts](src/lib/geocode.ts) | Звернення до Nominatim для перетворення `street + number` → `{ lat, lon }` |
| [geo-config.ts](src/lib/geo-config.ts) | Конфіг міста: центр карти, bbox для Nominatim |
| [queries.ts](src/lib/queries.ts) | `getCachedPayments`, `getCachedPostmen` через `unstable_cache` з тегами `ref:payments` / `ref:postmen`; інвалідація через `revalidateTag` у відповідних actions (комміти `5a1f954`, `1923749`) |

---

## 14. Скрипти

| Скрипт | Що робить |
|---|---|
| [prisma/seed.ts](prisma/seed.ts) | Базові дані: листоноша, типи виплат, кілька будинків / пенсіонерів |
| [scripts/grant-admin.ts](scripts/grant-admin.ts) | Інтерактивно: знайти листоношу, видати `isAdmin`, встановити username + bcrypt-пароль |
| [scripts/geocode-buildings.ts](scripts/geocode-buildings.ts) | Через Nominatim ([geocode.ts](src/lib/geocode.ts)) проставляє `latitude`/`longitude`/`geocodedAt` будинкам; невдачі позначає `geocodeFailed=true`; rate-limit згідно ToS |
| [scripts/import-buildings.ts](scripts/import-buildings.ts) | Batch-імпорт будинків з XLSX |
| [scripts/import-subscriptions-2026.ts](scripts/import-subscriptions-2026.ts) | Одноразовий ідемпотентний імпорт передплат на 2026 рік: 48 видань, 86 передплатників, 107 підписок. `activeMonths` — `Int[12]` з кількістю примірників (1 у масках старого набору даних). Використовує `findBuildingByAddress` для авто-прив'язки до будинків дільниці; off-district адреси зберігає як `streetText/numberText` |

---

## 15. Бізнес-нюанси та реальні ребра

1. **Дашборд показує тільки моїх пенсіонерів** (`pensioner.postmanId === me.id`), включно з прострочкою — навіть якщо фактично обхід робив інший листоноша. Прострочка обмежена **поточним місяцем** (`date >= monthStart AND date < today`); неоплачені виплати попередніх місяців не тягнуться, бо «поточні» — це саме виплати цього місяця.
2. **`closedAt` не блокує редагування.** Закритий обхід — лише прапорець для сортування і UI.
3. **`Round.delete` не видаляє виплати** — `CurrentPayment.roundId` → `null`. Виплати залишаються в реєстрі.
4. **`AddressRound.delete` видаляє items, а не будинки** (Cascade лише на `AddressRoundBuilding`).
5. **Building видалення блокується** наявністю пенсіонерів (Restrict).
6. **Payment видалення блокується** наявністю `CurrentPayment` (Restrict).
7. **Postman видалення** дозволене лише без Round/AddressRound. Пенсіонери при цьому розв'язуються (SetNull).
8. **Pensioner видалення Cascade видаляє його CurrentPayment** — фінансова історія йде разом.
9. **Форма «Новий обхід»** тягне неоплачені виплати поточного місяця для пенсіонера (із `existingId`); оплачені приходять заблокованими.
10. **Пропозиції в «Новий обхід»** базуються на невиплачених `CurrentPayment` поточного місяця, де `date.getDate() === day(round.date)`; в адмін-режимі додатково фільтруються по вибраному листоноші.
11. **Дедуп при імпорті виплат** на парі `(pensionerId, день+місяць+рік)` для одного `paymentId`.
12. **Імпорт виплат — двокроковий**: preview з fuzzy-матчем ФІО в межах будинку, потім apply за підтвердженими рішеннями. Нові пенсіонери створюються **лише за явним підтвердженням** — це відсікає дублі від одруківок у Excel.
13. **`fromDateInputValue` парсить дату локально** (`new Date(year, m-1, day)`) — уникає UTC-shift у східних поясах.
14. **Фільтр виплат за датою** — верхня межа інклюзивна (`23:59:59.999`).
15. **DnD-сортування**: `Round.currentPayment.roundPosition` і `AddressRoundBuilding.position` зберігають порядок між сесіями.
16. **Карта пенсіонерів у пенсійному обході** показує тільки будинки з геокодом (`latitude/longitude IS NOT NULL`).
17. **Кеш довідників** (`getCachedPayments`, `getCachedPostmen`) інвалідується через `revalidateTag` при CRUD типів виплат / листонош.
18. **Optimistic UI**: будь-яка дія `useTransition` повідомляє `useGlobalPending`, який підіймає топ-прогрес-бар.
19. **Toast-провайдер** обгортає весь застосунок у root layout — `useToast()` працює всюди.
20. **Print-сторінка завжди світла** (`.print-area`), включає телефон листоноші.
21. **Шапка має горизонтальний скрол** на малих екранах (`overflow-x-auto`).
22. **AUTH_SECRET обов'язковий**; без нього застосунок падає на старті (явний throw у `getSecret()`).
23. **Middleware виключає публічні шляхи через matcher**, тому `/login` доступний без перевірки.
24. **Subscriber-адреса — взаємовиключна**: або `buildingId`, або текстова пара `streetText+numberText`. На збереженні актіонами через `findBuildingByAddress` робиться авто-прив'язка до будинку, якщо текстова адреса фактично відповідає існуючій у каталозі дільниці.
25. **Off-district передплатники** відображаються italic і без лінку (адреси немає в каталозі). Корисно для організацій-передплатників, що сидять на сусідніх дільницях.
26. **Subscription.activeMonths** — `Int[12]`, де індекс 0 = січень, значення = кількість примірників на місяць (0 = немає підписки). У БД — PostgreSQL `INTEGER[]`; UI завжди нормалізує до 12 елементів.
27. **Унікальність підписки** — пара `(subscriberId, publicationId, year)`: одне видання на одного передплатника за рік. Щоб поміняти MSP по місяцях — змінюється `activeMonths`, новий рядок не створюється.
28. **`Publication.issuesPerMonth` (MSP)** наразі інформативне поле; виплати по MSP застосунок не рахує.

---

## 16. Деплой / середовище

- **Vercel**: production URL https://poshta-map.vercel.app
- Деплой **ручний** через `vercel --prod --yes` з головного worktree (`/Users/yavorskyi/Documents/Work/projects/playground/poshta-map`). GitHub auto-deploy НЕ налаштований.
- БД: PostgreSQL (env `DATABASE_URL`). Build виконує `prisma db push --skip-generate` — формальних міграцій немає.
- Env vars: `DATABASE_URL`, `AUTH_SECRET` (мін. 8 символів).
- Темна тема: `localStorage.theme` + `prefers-color-scheme`.
- Мова інтерфейсу — **українська**.

---

## 17. Що навмисно НЕ зроблено

- **Без формальних Prisma-міграцій** — `db push` достатньо для проекту такого масштабу.
- **Без пагінації** на великих списках — на десятках тисяч записів потрібна курсорна пагінація.
- **Без реєстрації користувачів** — username/пароль видає адмін через `grant-admin` CLI.
- **Без email/SMS-нагадувань** — є лише suggestion-плитки в «Новий обхід» і дашборд.
- **Карти лише в межах конфігу міста** — `geo-config.ts` фіксує bbox; для іншого міста потрібно переконфігурувати.

---

> Документ актуальний на 2026-05-31. Останній зафіксований комміт: `cdf022d` («Sync address round map numbering with list order»). Гілка `claude/nice-bardeen` додає модал редагування передплатника й авто-резолв адреси за каталогом дільниці.
