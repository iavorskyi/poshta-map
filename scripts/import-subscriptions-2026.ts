// Одноразовий імпорт даних передплати за 2026 рік з паперових форм.
//
// Запуск:  npx tsx scripts/import-subscriptions-2026.ts
//
// Скрипт ідемпотентний: повторний запуск перезаписує лише `activeMonths` для
// (subscriberId, publicationId, year=2026). Видань і передплатників не дублює.
//
// Уточнення з обговорення:
// - кількість >0 у клітинці місяця → true (schema має Boolean[]; кількість не зберігається)
// - орг. без адреси / "Начальнику відділення" → isOrganization=true, PICKUP, без адреси
// - Сопова Вікторія Володимирівна "Відділення ДО" → особа із самовивозом (PICKUP)
// - рядки з усіма нулями → пропускаються (без створення Subscription)
// - "б." (а не "6.") у номері будинку: "б.12/3" → буд. 12, кв. 3 (правило / у буд. колонці)
// - дільниця доставки не зберігається
// - довгий список передплатників на повернутому фото без заголовка → тимчасово
//   приписано до 30613 ВЕЧІРНЯ ОДЕСА із шаблоном [Apr,May,Jun]=true (TODO: верифікувати)

import { PrismaClient } from "../src/generated/prisma";
import { findBuildingByAddress } from "../src/lib/streetMatch";

const prisma = new PrismaClient();
const YEAR = 2026;

// ──────────────────────────────────────────────────────────────────────────
// Видання (code → name)
// ──────────────────────────────────────────────────────────────────────────
const PUBLICATIONS: Array<{ code: string; name: string }> = [
  { code: "76027", name: "БУВАЛЬЩИНИ І СМІХ, І ГРІХ!" },
  { code: "76596", name: "ОХОРОНА ПРАЦІ (On-line)" },
  { code: "76930", name: "РОЗМАЛЬОВКИ ТА КАЗКИ" },
  { code: "89397", name: '«ЗАРОБІТНА ПЛАТА» + «ЗАРОБІТНА ПЛАТА. СПЕЦВИПУСК». КОМПЛЕКТ' },
  { code: "89490", name: "КУЗЯ" },
  { code: "97799", name: "ІЖАЧОК" },
  { code: "33594", name: "ВСЕ ПРО БУХГАЛТЕРСЬКИЙ ОБЛІК" },
  { code: "37734", name: "ПОСІВНИЙ КАЛЕНДАР" },
  { code: "40224", name: "ГОЛОС УКРАЇНИ" },
  { code: "61035", name: "УРЯДОВИЙ КУР'ЄР" },
  { code: "30613", name: "ВЕЧІРНЯ ОДЕСА" },
  { code: "7914", name: "Листівка Товари2" },
  { code: "23796", name: "ЗДОРОВИЙ СПОСІБ ЖИТТЯ В УКРАЇНІ" },
  { code: "68311", name: "КОПІЙКА ПЛЮС. ГАРНА ГАЗЕТА" },
  { code: "86621", name: "НА ПЕНСІЇ" },
  { code: "89611", name: "МІГРАЦІЯ" },
  { code: "1591", name: "ВІСТІ ВСЕУКРАЇНСЬКОЇ ЦЕНТРАЛЬНОЇ СПІЛКИ СПОЖИВЧИХ ТОВАРИСТВ" },
  { code: "7909", name: 'Каталог "Поштовий маркет"' },
  { code: "7912", name: "Листівка Товари1" },
  { code: "74320", name: "BURDA STYLE" },
  { code: "76385", name: "НА ПЕНСІЇ. ОДЕСА" },
  { code: "76624", name: "ШВИДКА ДОПОМОГА НА ВСІ ВИПАДКИ ЖИТТЯ" },
  { code: "96217", name: "ОДЕСЬКЕ ЖИТТЯ" },
  { code: "99625", name: "ЗЕЛЕНА ПЛАНЕТА ЗЕМНОЇ" },
  { code: "37620", name: "КАЗНА УКРАЇНИ" },
  { code: "49480", name: "РЕЦЕПТИ ГОСПОДИНІ. СЕКРЕТИ СМАЧНОЇ КУХНІ" },
  { code: "60174", name: "ПЕНСІЙНА ТЕЛЕПРОГРАМА" },
  { code: "60249", name: "СІМЕЙНІ ПОРАДИ" },
  { code: "60771", name: "КАЛЕНДАР ВІД СІМЕЙНОЇ ГАЗЕТИ" },
  { code: "61119", name: "ЧОРНОМОРСЬКІ НОВИНИ" },
  { code: "89839", name: "ПРАКТИКУЮЧИЙ ЛІКАР" },
  { code: "90229", name: "БІБЛІОТЕЧКА ПРАКТИКУЮЧОГО ЛІКАРЯ" },
  { code: "91656", name: "БУЛЬВАР ГОРДОНА" },
  { code: "98036", name: "НАРОДНА МЕДИЦИНА + ПОРАДИ ЛІКАРІВ" },
  { code: "6812", name: "ПУБЛИКА" },
  { code: "61019", name: '"СІЛЬСЬКІ ВІСТІ" газета захисту інтересів селян України' },
  { code: "76823", name: "ЗДОРОВИЙ СПОСІБ ЖИТТЯ В УКРАЇНІ (76823)" },
  { code: "76941", name: "ПЕНСІЙНА ТЕЛЕПРОГРАМА. ОДЕСА" },
  { code: "89437", name: "ІСТИННЕ ЗДОРОВ'Я" },
  { code: "30053", name: "НАРОДНЕ ЗДОРОВ'Я" },
  { code: "37943", name: "ДОБРИЙ ЛІКАР" },
  { code: "49801", name: "ПОРАДИ ЮРИСТА" },
  { code: "60974", name: "ЛІТЕРАТУРНА УКРАЇНА" },
  { code: "21584", name: "ВЕТЕРАН УКРАЇНИ" },
  { code: "21922", name: "PAIN, ANAESTHESIA AND INTENSIVE CARE" },
  { code: "22083", name: "ХАЗЯЇН. ДІМ. САД. ГОРОД" },
  { code: "22152", name: "ПРОФСПІЛКОВІ ВІСТІ" },
  { code: "23205", name: "ТИЖНЕВИК 7Я" },
];

// ──────────────────────────────────────────────────────────────────────────
// Передплатники (унікальний ключ — `key`)
// ──────────────────────────────────────────────────────────────────────────
type SubAddr =
  | { kind: "addr"; street: string; number: string; corpus?: string | null; apartment?: string | null }
  | { kind: "pickup" };

type SubRec = {
  key: string;
  fullName: string;
  isOrganization: boolean;
  phone: string | null;
  addr: SubAddr;
};

const M = (mask: string): boolean[] => {
  // "111111111111" або "1 1 1 1 1 1 0 0 0 0 0 0" → boolean[12]
  const cleaned = mask.replace(/\s+/g, "");
  if (cleaned.length !== 12) throw new Error(`Bad mask "${mask}"`);
  return cleaned.split("").map((c) => c !== "0");
};

const SUBSCRIBERS: SubRec[] = [
  // Особи
  {
    key: "myronova",
    fullName: "Миронова Ірина Миколаївна",
    isOrganization: false,
    phone: "380995077409",
    addr: { kind: "addr", street: "Данченка", number: "3", apartment: "99" },
  },
  {
    key: "sopova",
    fullName: "Сопова Вікторія Володимирівна",
    isOrganization: false,
    phone: "0931431877",
    addr: { kind: "pickup" }, // "Відділення ДО, буд. 0"
  },
  {
    key: "podgurska",
    fullName: "Подгурська Олена Михайлівна",
    isOrganization: false,
    phone: "0672612668",
    addr: { kind: "addr", street: "Миру", number: "28", apartment: "17" },
  },
  {
    key: "yerema",
    fullName: "Єрема Валентина Павлівна",
    isOrganization: false,
    phone: "0666256117",
    addr: { kind: "addr", street: "Миру", number: "30", apartment: "15" },
  },
  {
    key: "balytska",
    fullName: "Балицька Надія Іванівна",
    isOrganization: false,
    phone: "0963564955",
    addr: { kind: "addr", street: "Миру", number: "43", apartment: "11" },
  },
  {
    key: "dyachenko",
    fullName: "Дяченко Марія Семенівна",
    isOrganization: false,
    phone: "0685652536",
    addr: { kind: "addr", street: "Миру", number: "9", apartment: "59" },
  },
  {
    key: "kryuchkovska",
    fullName: "Крючковська Любов Олександрівна",
    isOrganization: false,
    phone: "0974535578",
    // "пров. Шкільний, 46/10, кор. 3" — Буд "46/10" + Кор "3" (за колонками форми)
    addr: { kind: "addr", street: "Шкільний", number: "46/10", corpus: "3" },
  },
  {
    key: "vitvytska",
    fullName: "Вітвицька Олена Олександрівна",
    isOrganization: false,
    phone: "0505071203",
    addr: { kind: "pickup" }, // "Відділення ДО, буд. 0"
  },
  {
    key: "leshchuk_k",
    fullName: "Лещук Клавдія Андріївна",
    isOrganization: false,
    phone: "0964298095",
    addr: { kind: "addr", street: "В. Шума", number: "13", apartment: "34" },
  },
  {
    key: "konon",
    fullName: "Конон Марія Ігнатівна",
    isOrganization: false,
    phone: "0972500370",
    addr: { kind: "addr", street: "В. Шума", number: "21/19", apartment: "1" },
  },
  {
    key: "afanasi",
    fullName: "Афанасі Віктор Ілліч",
    isOrganization: false,
    phone: "0661611624",
    addr: { kind: "addr", street: "Данченка", number: "13/11", apartment: "5" },
  },
  {
    key: "kuznetsova",
    fullName: "Кузнецова Людмила Степанівна",
    isOrganization: false,
    phone: "0950967759",
    addr: { kind: "addr", street: "Данченка", number: "3", apartment: "2" },
  },
  {
    key: "horodkova",
    fullName: "Городкова Тамара Миколаївна",
    isOrganization: false,
    phone: "0973341553",
    addr: { kind: "addr", street: "Данченка", number: "5", apartment: "30" },
  },
  {
    key: "saltykova",
    fullName: "Салтикова Тетяна Іванівна",
    isOrganization: false,
    phone: "0979865658",
    addr: { kind: "addr", street: "Захисників України", number: "17", apartment: "90" },
  },
  {
    key: "zamaraev",
    fullName: "Замараєв Михайло Васильович",
    isOrganization: false,
    phone: "0997432678",
    addr: { kind: "addr", street: "Захисників України", number: "2", apartment: "54" },
  },
  {
    key: "nikolaienko",
    fullName: "Ніколаєнко Геннадій Григорович",
    isOrganization: false,
    phone: "0506003521",
    addr: { kind: "addr", street: "Захисників України", number: "4а", apartment: "75" },
  },
  {
    key: "sadovyuk",
    fullName: "Садовюк Світлана Михайлівна",
    isOrganization: false,
    phone: "0634146554",
    addr: { kind: "addr", street: "Олександрійська", number: "3", apartment: "28" },
  },
  {
    key: "vinnyk",
    fullName: "Вінник Олена Юріївна",
    isOrganization: false,
    phone: "0667869503",
    addr: { kind: "addr", street: "Олександрійська", number: "13", apartment: "66" },
  },
  {
    key: "kotyolkin",
    fullName: "Котьолкін Дмитро Борисович",
    isOrganization: false,
    phone: "0668445461",
    addr: { kind: "addr", street: "Олександрійська", number: "19", apartment: "86" },
  },
  {
    key: "pochesuy",
    fullName: "Почесуй Ольга Володимирівна",
    isOrganization: false,
    phone: "0962600493",
    addr: { kind: "addr", street: "Олександрійська", number: "1а", apartment: "22" },
  },
  // Передплатники з повернутого фото (без явного заголовка → 30613, TODO: верифікувати)
  {
    key: "prygoda",
    fullName: "Пригода Валентина Андріївна",
    isOrganization: false,
    phone: "0951262136",
    addr: { kind: "addr", street: "Олександрійська", number: "20/60", corpus: "5" },
  },
  {
    key: "mishyna",
    fullName: "Мішина Ірина Петрівна",
    isOrganization: false,
    phone: "0675353964",
    addr: { kind: "addr", street: "Олександрійська", number: "20/70", corpus: "2" },
  },
  {
    key: "rekechynska",
    fullName: "Рекечинська Тамара Петрівна",
    isOrganization: false,
    phone: "0982481996",
    addr: { kind: "addr", street: "Олександрійська", number: "24", apartment: "48" },
  },
  {
    key: "bilous",
    fullName: "Білоус Валентина Василівна",
    isOrganization: false,
    phone: "0671508592",
    addr: { kind: "addr", street: "Олександрійська", number: "7", apartment: "40" },
  },
  {
    key: "kravets",
    fullName: "Кравець Володимир Іванович",
    isOrganization: false,
    phone: "0949607851",
    addr: { kind: "addr", street: "Паркова", number: "18", apartment: "28" },
  },
  {
    key: "ibash",
    fullName: "Ібаш Віра Володимирівна",
    isOrganization: false,
    phone: "0681925816",
    addr: { kind: "addr", street: "Паркова", number: "50", apartment: "23" },
  },
  {
    key: "fedchyk",
    fullName: "Федчик Іван Олексійович",
    isOrganization: false,
    phone: "0731578693",
    addr: { kind: "addr", street: "Парусна", number: "1", corpus: "6", apartment: "85" },
  },
  {
    key: "vovk",
    fullName: "Вовк Ніна Антонівна",
    isOrganization: false,
    phone: "0971739078",
    addr: { kind: "addr", street: "Парусна", number: "9", apartment: "99" },
  },
  {
    key: "shylivskyi",
    fullName: "Шилівський Богдан Данилович",
    isOrganization: false,
    phone: "0934134617",
    addr: { kind: "addr", street: "Праці", number: "3", apartment: "36" },
  },
  {
    key: "shashiashvili",
    fullName: "Шашіашвілі Лідія Григорівна",
    isOrganization: false,
    phone: "0970793748",
    addr: { kind: "addr", street: "Приморська", number: "18" },
  },
  {
    key: "tsekhovska",
    fullName: "Цеховська Тетяна Михайлівна",
    isOrganization: false,
    phone: "0965005420",
    addr: { kind: "addr", street: "Спортивна", number: "12", apartment: "39" },
  },
  {
    key: "logvynenko",
    fullName: "Логвиненко Ніна Михайлівна",
    isOrganization: false,
    phone: "0938514453",
    addr: { kind: "addr", street: "Спортивна", number: "12а/6", corpus: "8" },
  },
  {
    key: "muravei",
    fullName: "Муравей Ганна Олексіївна",
    isOrganization: false,
    phone: "0685612575",
    addr: { kind: "addr", street: "Спортивна", number: "12а/7", corpus: "6" },
  },
  {
    key: "venglovska",
    fullName: "Венгловська Геля Йосипівна",
    isOrganization: false,
    phone: "0964020015",
    addr: { kind: "addr", street: "Спортивна", number: "6а", apartment: "19" },
  },
  {
    key: "muntyan",
    fullName: "Мунтян Галина Уляніна",
    isOrganization: false,
    phone: "0992490193",
    addr: { kind: "addr", street: "Хантадзе", number: "10", apartment: "8" },
  },
  {
    key: "reznichuk",
    fullName: "Резнічук Тетяна Костянтинівна",
    isOrganization: false,
    phone: "0960470148",
    addr: { kind: "addr", street: "Центральна", number: "59" },
  },
  {
    key: "berdnikova",
    fullName: "Бердникова Віра Григорівна",
    isOrganization: false,
    phone: "0961131701",
    addr: { kind: "addr", street: "Шевченка", number: "19" },
  },
  {
    key: "dmytriieva",
    fullName: "Дмитрієва Надія Максимівна",
    isOrganization: false,
    phone: "0984390257",
    addr: { kind: "addr", street: "Захисників України", number: "17", apartment: "38" },
  },
  {
    key: "senchonkova",
    fullName: "Сенчонкова Тетяна Федорівна",
    isOrganization: false,
    phone: "0963681967",
    addr: { kind: "addr", street: "Захисників України", number: "2", apartment: "101" },
  },
  {
    key: "rusescul",
    fullName: "Русескул Марія Іванівна",
    isOrganization: false,
    phone: "0674513949",
    addr: { kind: "addr", street: "Миру", number: "20А", apartment: "39" },
  },
  {
    key: "babakov",
    fullName: "Бабаков Євгеній Миколайович",
    isOrganization: false,
    phone: "0949607325",
    addr: { kind: "addr", street: "Миру", number: "15", corpus: "6", apartment: "7" },
  },
  {
    key: "leskova",
    fullName: "Лескова Валентина Михайлівна",
    isOrganization: false,
    phone: null, // TODO: phone виглядав схожим на дублікат — пропускаю
    addr: { kind: "addr", street: "Миру", number: "15а/6", corpus: "2" },
  },
  {
    key: "ivanova_m",
    fullName: "Іванова Марія Терентіївна",
    isOrganization: false,
    phone: "0631130637",
    addr: { kind: "addr", street: "Миру", number: "17", apartment: "75" },
  },
  {
    key: "synyakova",
    fullName: "Синякова Валентина Григорівна",
    isOrganization: false,
    phone: "0934889029",
    addr: { kind: "addr", street: "Миру", number: "17", apartment: "79" },
  },
  {
    key: "lykova",
    fullName: "Ликова Ніна Петрівна",
    isOrganization: false,
    phone: "0678554284",
    addr: { kind: "addr", street: "Миру", number: "18а/3", corpus: "4" },
  },
  {
    key: "brynzova",
    fullName: "Бринзова Євдокія Миколаївна",
    isOrganization: false,
    phone: "0985990124",
    addr: { kind: "addr", street: "Миру", number: "26", apartment: "45" },
  },
  {
    key: "haykovych",
    fullName: "Гайкович Людмила Миколаївна",
    isOrganization: false,
    phone: "0679066311",
    addr: { kind: "addr", street: "Миру", number: "27", apartment: "43" },
  },
  // Інші передплатники
  {
    key: "mala",
    fullName: "Мала Віра Тихонівна",
    isOrganization: false,
    phone: "0973532407",
    addr: { kind: "addr", street: "Данченка", number: "5А", apartment: "48" },
  },
  {
    key: "lopato",
    fullName: "Лопато Ніанель Іванівна",
    isOrganization: false,
    phone: "0965837652",
    addr: { kind: "addr", street: "Данченка", number: "19", apartment: "64" },
  },
  {
    key: "kyndyuk",
    fullName: "Киндюк Людмила",
    isOrganization: false,
    phone: "380957611095",
    addr: { kind: "addr", street: "Миру", number: "1" },
  },
  {
    key: "khomovska",
    fullName: "Хомовська Раїса Іванівна",
    isOrganization: false,
    phone: "0972183973",
    addr: { kind: "addr", street: "Миру", number: "10А", apartment: "8" },
  },
  {
    key: "dorogan",
    fullName: "Дорогань І В",
    isOrganization: false,
    phone: "0684912950",
    addr: { kind: "addr", street: "Шкільний", number: "4", apartment: "27" },
  },
  {
    key: "baron",
    fullName: "Барон Алла Галіївна",
    isOrganization: false,
    phone: "0972777904",
    addr: { kind: "addr", street: "Миру", number: "9", apartment: "29" },
  },
  {
    key: "kulykova",
    fullName: "Куликова Віра Василіївна",
    isOrganization: false,
    phone: "380634805992",
    addr: { kind: "addr", street: "Миру", number: "13А", apartment: "89" },
  },
  {
    key: "baklanova",
    fullName: "Бакланова Олена Олександрівна",
    isOrganization: false,
    phone: "0950182436",
    addr: { kind: "addr", street: "Миру", number: "13А", apartment: "29" },
  },
  {
    key: "demchak",
    fullName: "Демчак Іван Петрович",
    isOrganization: false,
    phone: "0978091503",
    addr: { kind: "addr", street: "Миру", number: "1" },
  },
  {
    key: "pavlova",
    fullName: "Павлова Лариса Олександрівна",
    isOrganization: false,
    phone: "0679318852",
    addr: { kind: "addr", street: "Миру", number: "5А", apartment: "1" },
  },
  {
    key: "koshlay",
    fullName: "Кошлай Юлія Васильівна",
    isOrganization: false,
    phone: "0978410225",
    addr: { kind: "addr", street: "Миру", number: "16", apartment: "42" },
  },
  {
    key: "hordiychuk",
    fullName: "Гордійчук Катерина Юхимівна",
    isOrganization: false,
    phone: "0671183728",
    addr: { kind: "addr", street: "Миру", number: "4А", apartment: "4" },
  },
  {
    key: "timanovska",
    fullName: "Тімановська Любов Серафимівна",
    isOrganization: false,
    phone: "380963588669",
    addr: { kind: "addr", street: "Данченка", number: "3Б", apartment: "82" },
  },
  {
    key: "matsan",
    fullName: "Мацан Олександр Дмитрович",
    isOrganization: false,
    phone: "380667372487",
    addr: { kind: "addr", street: "Миру", number: "17", apartment: "76" },
  },
  {
    key: "chernenkova",
    fullName: "Черненкова Вікторія Григорівна",
    isOrganization: false,
    phone: "0674822365",
    addr: { kind: "addr", street: "Миру", number: "17", apartment: "81" },
  },
  {
    key: "skvartsova",
    fullName: "Скварцова Ирина Петровна",
    isOrganization: false,
    phone: "0674807700",
    addr: { kind: "addr", street: "Миру", number: "28Т" },
  },
  {
    key: "levchuk",
    fullName: "Левчук Федір Іванович",
    isOrganization: false,
    phone: "0950963437",
    addr: { kind: "addr", street: "Паркова", number: "6", apartment: "75" },
  },
  {
    key: "sahatyuk",
    fullName: "Сагатюк Галина Миколаївна",
    isOrganization: false,
    phone: "0933124395",
    addr: { kind: "addr", street: "1 Травня", number: "4А", apartment: "58" },
  },
  {
    key: "dzynko",
    fullName: "Дзинько Ірина Михайлівна",
    isOrganization: false,
    phone: "0662957492",
    addr: { kind: "addr", street: "Данченка", number: "24", apartment: "1" },
  },
  {
    key: "unguryan",
    fullName: "Унгурян Вікторія Вікторівна",
    isOrganization: false,
    phone: "0934956642",
    addr: { kind: "addr", street: "Данченка", number: "3Б", apartment: "82" },
  },
  {
    key: "boltsii",
    fullName: "Больцій Марія Семенівна",
    isOrganization: false,
    phone: "0635761871",
    addr: { kind: "addr", street: "Спортивна", number: "5К", apartment: "60" },
  },
  {
    key: "tkachenko",
    fullName: "Ткаченко Олексій Миколайович",
    isOrganization: false,
    phone: "0501451941",
    addr: { kind: "addr", street: "Миру", number: "2", apartment: "40" },
  },
  {
    key: "klyueva",
    fullName: "Клюєва Тамара Всеволодовна",
    isOrganization: false,
    phone: "0930190100",
    addr: { kind: "addr", street: "Миру", number: "23", apartment: "4" },
  },
  {
    key: "ostapenko",
    fullName: "Остапенко Андрій Іванович",
    isOrganization: false,
    phone: "0503334908",
    addr: { kind: "addr", street: "Паркова", number: "14А", apartment: "40" },
  },
  {
    key: "stetsyuk",
    fullName: "Стецюк Олена Володимирівна",
    isOrganization: false,
    phone: "0932574467",
    addr: { kind: "addr", street: "Паркова", number: "26", apartment: "69" },
  },
  {
    key: "loshmanova",
    fullName: "Лошманова Валентина Костянтинівна",
    isOrganization: false,
    phone: "380963902801",
    addr: { kind: "addr", street: "Паркова", number: "22", apartment: "89" },
  },
  {
    key: "snovyda",
    fullName: "Сновида Євгенія Харитонівна",
    isOrganization: false,
    phone: "380993761116",
    addr: { kind: "addr", street: "Миру", number: "19", apartment: "109" },
  },
  {
    key: "kostenko",
    fullName: "Костенко Олена Володимирівна",
    isOrganization: false,
    phone: "0932865875",
    addr: { kind: "addr", street: "Миру", number: "19", apartment: "24" },
  },
  {
    key: "vodopyanova",
    fullName: "Водоп'янова Татяна Дмитрівна",
    isOrganization: false,
    phone: "380989532487",
    addr: { kind: "addr", street: "Паркова", number: "14", apartment: "11" },
  },

  // Організації
  {
    key: "kp_chte",
    fullName: "КП ЧТЕ",
    isOrganization: true,
    phone: null,
    addr: { kind: "addr", street: "Торгова", number: "2-А" },
  },
  {
    key: "kp_chte_2",
    fullName: 'ДП "Караван"',
    isOrganization: true,
    phone: "0984376152",
    addr: { kind: "addr", street: "Торгова", number: "2" },
  },
  {
    key: "chmtp",
    fullName: 'ДП "МТП "ЧОРНОМОРСЬК"',
    isOrganization: true,
    phone: null,
    addr: { kind: "addr", street: "Праці", number: "6" },
  },
  {
    key: "vyrobnyk_ukr",
    fullName: 'ТОВ "ВИРОБНИК УКРАЇНИ"',
    isOrganization: true,
    phone: null,
    addr: { kind: "addr", street: "Корабельна", number: "12", apartment: "3" },
  },
  {
    key: "tanit_group",
    fullName: 'ТОВ "Таніт груп"',
    isOrganization: true,
    phone: null,
    addr: { kind: "addr", street: "Корабельна", number: "3", apartment: "32" },
  },
  {
    key: "gamma_transban",
    fullName: 'ТОВ "ГАММА ТРАНСБАН"',
    isOrganization: true,
    phone: null,
    addr: { kind: "addr", street: "Праці", number: "8" },
  },
  {
    key: "mta_servis",
    fullName: 'ТОВ МОРСЬКЕ ТРАНСПОРТНЕ АГЕНТСТВО "МТА СЕРВІС ЛТ"',
    isOrganization: true,
    phone: null,
    addr: { kind: "addr", street: "Хантадзе", number: "2", apartment: "66" },
  },
  {
    key: "gudms",
    fullName: "Чорноморський відділ ГУДМС",
    isOrganization: true,
    phone: "0486862308",
    addr: { kind: "addr", street: "Хантадзе", number: "13", corpus: "С" },
  },
  {
    key: "osvita_chmr",
    fullName: "Управління освіти ЧМР",
    isOrganization: true,
    phone: "0959230511",
    addr: { kind: "addr", street: "Хантадзе", number: "8А" },
  },
  {
    key: "nach_viddil",
    fullName: "Начальник відділення",
    isOrganization: true,
    phone: null,
    addr: { kind: "pickup" },
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Підписки (subscriberKey → publicationCode → 12-міс маска)
// ──────────────────────────────────────────────────────────────────────────
const SUBSCRIPTIONS: Array<{ sub: string; pub: string; months: boolean[] }> = [
  // 76027 БУВАЛЬЩИНИ
  { sub: "myronova", pub: "76027", months: M("111111111111") },
  // 76596 ОХОРОНА ПРАЦІ
  { sub: "kp_chte", pub: "76596", months: M("111111111111") },
  // 76930 РОЗМАЛЬОВКИ ТА КАЗКИ
  { sub: "sopova", pub: "76930", months: M("111111111111") },
  // 89397 ЗАРОБІТНА ПЛАТА
  { sub: "chmtp", pub: "89397", months: M("111111000000") },
  // 89490 КУЗЯ
  { sub: "sopova", pub: "89490", months: M("111111111111") },
  // 97799 ІЖАЧОК
  { sub: "sopova", pub: "97799", months: M("111111111111") },

  // 33594 ВСЕ ПРО БУХГАЛТЕРСЬКИЙ ОБЛІК (TODO: маски організацій на повернутому фото читаються неточно)
  { sub: "vyrobnyk_ukr", pub: "33594", months: M("111111100000") },
  { sub: "tanit_group", pub: "33594", months: M("111111000000") },
  { sub: "chmtp", pub: "33594", months: M("111111011100") },
  { sub: "gamma_transban", pub: "33594", months: M("111110101100") },
  { sub: "mta_servis", pub: "33594", months: M("111100100000") },
  { sub: "podgurska", pub: "33594", months: M("000111100000") },
  { sub: "yerema", pub: "33594", months: M("000111000000") },
  { sub: "balytska", pub: "33594", months: M("000111000000") },
  { sub: "dyachenko", pub: "33594", months: M("000011100000") },
  { sub: "kryuchkovska", pub: "33594", months: M("111111111111") },

  // 37734 ПОСІВНИЙ КАЛЕНДАР
  { sub: "myronova", pub: "37734", months: M("111111111111") },
  // 40224 ГОЛОС УКРАЇНИ
  { sub: "kp_chte", pub: "40224", months: M("111111111111") },
  // 61035 УРЯДОВИЙ КУР'ЄР
  { sub: "kp_chte", pub: "61035", months: M("111111111111") },

  // 30613 ВЕЧІРНЯ ОДЕСА — підтверджені передплатники
  { sub: "kp_chte", pub: "30613", months: M("111111111111") },
  { sub: "leshchuk_k", pub: "30613", months: M("000111000000") },
  { sub: "konon", pub: "30613", months: M("000111000000") },
  { sub: "afanasi", pub: "30613", months: M("000111000000") },
  { sub: "kuznetsova", pub: "30613", months: M("000111000000") },
  { sub: "horodkova", pub: "30613", months: M("000111000000") },
  { sub: "saltykova", pub: "30613", months: M("000111000000") },
  { sub: "zamaraev", pub: "30613", months: M("000111000000") },
  { sub: "nikolaienko", pub: "30613", months: M("000111000000") },
  { sub: "sadovyuk", pub: "30613", months: M("000111000000") },
  { sub: "vinnyk", pub: "30613", months: M("000111000000") },
  { sub: "kotyolkin", pub: "30613", months: M("000111000000") },
  { sub: "pochesuy", pub: "30613", months: M("000111000000") },
  // 30613 — довгий список з повернутого фото (TODO: верифікувати маски, припущення [Apr,May,Jun])
  { sub: "prygoda", pub: "30613", months: M("000111000000") },
  { sub: "mishyna", pub: "30613", months: M("000111000000") },
  { sub: "rekechynska", pub: "30613", months: M("000111000000") },
  { sub: "bilous", pub: "30613", months: M("000111000000") },
  { sub: "kravets", pub: "30613", months: M("000111000000") },
  { sub: "ibash", pub: "30613", months: M("000111000000") },
  { sub: "fedchyk", pub: "30613", months: M("000111000000") },
  { sub: "vovk", pub: "30613", months: M("000111000000") },
  { sub: "shylivskyi", pub: "30613", months: M("000111000000") },
  { sub: "shashiashvili", pub: "30613", months: M("000111000000") },
  { sub: "tsekhovska", pub: "30613", months: M("000111000000") },
  { sub: "logvynenko", pub: "30613", months: M("000111000000") },
  { sub: "muravei", pub: "30613", months: M("000111000000") },
  { sub: "venglovska", pub: "30613", months: M("000111000000") },
  { sub: "muntyan", pub: "30613", months: M("000111000000") },
  { sub: "reznichuk", pub: "30613", months: M("000111000000") },
  { sub: "berdnikova", pub: "30613", months: M("000111000000") },
  { sub: "dmytriieva", pub: "30613", months: M("000111000000") },
  { sub: "senchonkova", pub: "30613", months: M("000111000000") },
  { sub: "rusescul", pub: "30613", months: M("000111000000") },
  { sub: "babakov", pub: "30613", months: M("000111000000") },
  { sub: "leskova", pub: "30613", months: M("000111000000") },
  { sub: "ivanova_m", pub: "30613", months: M("000111000000") },
  { sub: "synyakova", pub: "30613", months: M("000111000000") },
  { sub: "lykova", pub: "30613", months: M("000111000000") },
  { sub: "brynzova", pub: "30613", months: M("000111000000") },
  { sub: "haykovych", pub: "30613", months: M("000111000000") },
  { sub: "osvita_chmr", pub: "30613", months: M("111111000000") },

  // 7914 — пропускаю (всі нулі для "Начальнику відділення")
  // 7912 — пропускаю (всі нулі)

  // 23796 ЗДОРОВИЙ СПОСІБ ЖИТТЯ В УКРАЇНІ — об'єднано з кількох фото
  { sub: "vitvytska", pub: "23796", months: M("111111111111") },
  { sub: "mala", pub: "23796", months: M("111111000000") },
  { sub: "baklanova", pub: "23796", months: M("111111111111") },
  { sub: "snovyda", pub: "23796", months: M("111111111111") },
  { sub: "kostenko", pub: "23796", months: M("111111000000") },
  { sub: "vodopyanova", pub: "23796", months: M("111111000000") },

  // 68311 КОПІЙКА ПЛЮС
  { sub: "mala", pub: "68311", months: M("111111000000") },
  // 86621 НА ПЕНСІЇ
  { sub: "lopato", pub: "86621", months: M("111111000000") },
  // 89611 МІГРАЦІЯ (8 примірників/міс — зберігаємо лише як активні)
  { sub: "gudms", pub: "89611", months: M("111111111111") },
  // 1591 ВІСТІ
  { sub: "kp_chte_2", pub: "1591", months: M("111111111111") },
  // 7909 Каталог Поштовий маркет (квітень=3 + січень=5 у "Начальнику відділення")
  { sub: "nach_viddil", pub: "7909", months: M("100100000000") },

  // 74320 BURDA STYLE (Лют–Грудень)
  { sub: "kyndyuk", pub: "74320", months: M("011111111111") },
  // 76385 НА ПЕНСІЇ. ОДЕСА
  { sub: "khomovska", pub: "76385", months: M("111100000000") },
  { sub: "dzynko", pub: "76385", months: M("111111111100") },
  { sub: "unguryan", pub: "76385", months: M("111111111111") },
  { sub: "boltsii", pub: "76385", months: M("111111111111") },
  // 76624 ШВИДКА ДОПОМОГА
  { sub: "dorogan", pub: "76624", months: M("111000000000") },
  // 96217 ОДЕСЬКЕ ЖИТТЯ
  { sub: "baron", pub: "96217", months: M("111111000000") },
  // 99625 ЗЕЛЕНА ПЛАНЕТА
  { sub: "kulykova", pub: "99625", months: M("111111000000") },
  { sub: "skvartsova", pub: "99625", months: M("111111111111") },

  // 49480 РЕЦЕПТИ ГОСПОДИНІ
  { sub: "demchak", pub: "49480", months: M("111111000000") },
  // 60174 ПЕНСІЙНА ТЕЛЕПРОГРАМА
  { sub: "pavlova", pub: "60174", months: M("111111111111") },
  // 60249 СІМЕЙНІ ПОРАДИ
  { sub: "koshlay", pub: "60249", months: M("111111111111") },
  // 60771 КАЛЕНДАР ВІД СІМЕЙНОЇ ГАЗЕТИ
  { sub: "dorogan", pub: "60771", months: M("111111111111") },
  // 61119 ЧОРНОМОРСЬКІ НОВИНИ
  { sub: "hordiychuk", pub: "61119", months: M("111110000000") },
  { sub: "sahatyuk", pub: "61119", months: M("000000111111") },

  // 89839 ПРАКТИКУЮЧИЙ ЛІКАР
  { sub: "timanovska", pub: "89839", months: M("000110000000") },
  // 90229 БІБЛІОТЕЧКА ПРАКТИКУЮЧОГО ЛІКАРЯ
  { sub: "timanovska", pub: "90229", months: M("011010000000") },
  // 91656 БУЛЬВАР ГОРДОНА
  { sub: "matsan", pub: "91656", months: M("111111111111") },
  { sub: "chernenkova", pub: "91656", months: M("111111111111") },
  // 98036 НАРОДНА МЕДИЦИНА
  { sub: "timanovska", pub: "98036", months: M("011111111111") },

  // 6812 ПУБЛИКА
  { sub: "matsan", pub: "6812", months: M("111111000000") },
  { sub: "chernenkova", pub: "6812", months: M("111111111111") },

  // 61019 СІЛЬСЬКІ ВІСТІ
  { sub: "levchuk", pub: "61019", months: M("111111000000") },
  // 76823 ЗДОРОВИЙ СПОСІБ ЖИТТЯ (інший код)
  { sub: "tkachenko", pub: "76823", months: M("111111111111") },
  // 76941 ПЕНСІЙНА ТЕЛЕПРОГРАМА. ОДЕСА
  { sub: "klyueva", pub: "76941", months: M("111111111111") },
  { sub: "ostapenko", pub: "76941", months: M("111111111111") },
  // 89437 ІСТИННЕ ЗДОРОВ'Я
  { sub: "timanovska", pub: "89437", months: M("011111111110") },
  { sub: "stetsyuk", pub: "89437", months: M("111111000000") },

  // 30053 НАРОДНЕ ЗДОРОВ'Я
  { sub: "timanovska", pub: "30053", months: M("011100000000") },
  // 37943 ДОБРИЙ ЛІКАР
  { sub: "tkachenko", pub: "37943", months: M("111111000000") },
  // 49801 ПОРАДИ ЮРИСТА
  { sub: "timanovska", pub: "49801", months: M("011100000000") },
  // 60974 ЛІТЕРАТУРНА УКРАЇНА
  { sub: "tkachenko", pub: "60974", months: M("111111000000") },

  // 21584 ВЕТЕРАН УКРАЇНИ
  { sub: "timanovska", pub: "21584", months: M("011100000000") },
  // 21922 PAIN, ANAESTHESIA AND INTENSIVE CARE
  { sub: "timanovska", pub: "21922", months: M("000111111111") },
  // 22083 ХАЗЯЇН. ДІМ. САД. ГОРОД
  { sub: "loshmanova", pub: "22083", months: M("111111000000") },
  // 22152 ПРОФСПІЛКОВІ ВІСТІ
  { sub: "timanovska", pub: "22152", months: M("011000000000") },
];

// ──────────────────────────────────────────────────────────────────────────
// Імпорт
// ──────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Імпорт передплат за ${YEAR} рік...\n`);

  // 1) Видання
  const pubByCode = new Map<string, number>();
  for (const p of PUBLICATIONS) {
    const row = await prisma.publication.upsert({
      where: { code: p.code },
      create: { code: p.code, name: p.name },
      update: { name: p.name },
      select: { id: true },
    });
    pubByCode.set(p.code, row.id);
  }
  console.log(`Видань: ${pubByCode.size}`);

  // 2) Передплатники
  const buildings = await prisma.building.findMany({
    select: { id: true, street: true, number: true },
  });

  const subByKey = new Map<string, number>();
  const addrLog: string[] = [];
  for (const s of SUBSCRIBERS) {
    let buildingId: number | null = null;
    let streetText: string | null = null;
    let numberText: string | null = null;
    let corpus: string | null = null;
    let apartment: string | null = null;
    let deliveryMode: "ADDRESS" | "PICKUP" = "ADDRESS";

    if (s.addr.kind === "pickup") {
      deliveryMode = "PICKUP";
    } else {
      corpus = s.addr.corpus ?? null;
      apartment = s.addr.apartment ?? null;
      const match = findBuildingByAddress(buildings, s.addr.street, s.addr.number);
      if (match.kind === "exact" || match.kind === "loose") {
        buildingId = match.id;
        if (match.kind === "loose") {
          addrLog.push(
            `  ~loose: "${s.addr.street} ${s.addr.number}" → buildingId=${match.id} (${match.matchedStreet})`,
          );
        }
      } else {
        streetText = s.addr.street;
        numberText = s.addr.number;
        addrLog.push(
          `  off-district: ${s.fullName} → ${s.addr.street}, ${s.addr.number}` +
            (match.kind === "ambiguous" ? " (ambiguous)" : ""),
        );
      }
    }

    // Пошук існуючого передплатника за іменем + адресою
    const existing = await prisma.subscriber.findFirst({
      where: {
        fullName: s.fullName,
        buildingId: buildingId ?? undefined,
        streetText: streetText ?? undefined,
        numberText: numberText ?? undefined,
        corpus: corpus ?? undefined,
        apartment: apartment ?? undefined,
      },
      select: { id: true },
    });

    let id: number;
    if (existing) {
      id = existing.id;
    } else {
      const created = await prisma.subscriber.create({
        data: {
          fullName: s.fullName,
          isOrganization: s.isOrganization,
          phone: s.phone,
          buildingId,
          streetText,
          numberText,
          corpus,
          apartment,
          deliveryMode,
        },
        select: { id: true },
      });
      id = created.id;
    }
    subByKey.set(s.key, id);
  }
  console.log(`Передплатників: ${subByKey.size}`);
  if (addrLog.length > 0) {
    console.log("\nАдресні нотатки:");
    for (const line of addrLog) console.log(line);
  }

  // 3) Підписки
  let created = 0;
  let updated = 0;
  for (const ss of SUBSCRIPTIONS) {
    const subId = subByKey.get(ss.sub);
    const pubId = pubByCode.get(ss.pub);
    if (!subId || !pubId) {
      console.warn(`⚠ skip: sub=${ss.sub} pub=${ss.pub} (не знайдено)`);
      continue;
    }
    const existing = await prisma.subscription.findUnique({
      where: {
        subscriberId_publicationId_year: {
          subscriberId: subId,
          publicationId: pubId,
          year: YEAR,
        },
      },
      select: { id: true },
    });
    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: { activeMonths: ss.months },
      });
      updated++;
    } else {
      await prisma.subscription.create({
        data: {
          subscriberId: subId,
          publicationId: pubId,
          year: YEAR,
          activeMonths: ss.months,
        },
      });
      created++;
    }
  }
  console.log(`\nПідписок: створено ${created}, оновлено ${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
