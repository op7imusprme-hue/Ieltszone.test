# IELTS Zone — Playwright autotests

[demo-main.ieltszoneapp.uz](https://demo-main.ieltszoneapp.uz/admin) CRM paneli va
[demo.ieltszoneapp.uz/placement-test](https://demo.ieltszoneapp.uz/placement-test) public sahifasi uchun avtotestlar.
Stack: **Playwright + TypeScript**, Page Object Model, custom fixtures.

## Tuzilma

```
├── config/
│   └── env.ts                  # URL'lar, login (.env dan), yo'llar
├── src/
│   ├── api/                    # HTTP orqali tez setup / cleanup (PlacementTestsApi)
│   ├── components/             # Qayta ishlatiladigan UI elementlar: multiselect, datepicker, form, table
│   ├── data/                   # Test ma'lumotlari: lid factory, route'lar, placement savol/javoblari
│   ├── fixtures/               # test.extend — page object'lar va cleanup fixture'lar
│   ├── pages/
│   │   ├── admin/              # KanbanBoard, LeadCard, SuitableGroupPage, PlacementTestsPage
│   │   └── public/             # PlacementTestPage (lid test yechadigan sahifa)
│   └── utils/                  # dates, network (submit, CSRF), random, state
├── tests/
│   ├── setup/                  # auth.setup.ts — bir marta login, sessiya .auth/ga saqlanadi
│   ├── functional/             # Izolyatsiyalangan test-case'lar (har biri o'zidan keyin tozalaydi)
│   │   └── placement-test/     # positive · negative · edge-cases · ui-ux · validation · security
│   └── e2e/                    # Uzun biznes oqimlari (demo ma'lumotlarini o'zgartiradi)
│       ├── lead/               # community-lead-to-group, student-flow
│       └── placement/          # new-placement-test → placement-level
├── playwright.config.ts        # setup · functional · e2e project'lari
└── .github/workflows/          # CI (qo'lda ishga tushiriladi)
```

**Qoidalar**
- Spec fayllarda faqat test qadamlari va tekshiruvlar bo'ladi; selector va UI amallari `src/pages` va `src/components` ichida.
- Import'lar alias orqali: `@fixtures`, `@pages/*`, `@components/*`, `@data/*`, `@utils/*`, `@api/*`, `@config/*`.
- Funksional testlar yaratgan har bir placement test `placementTestsApi` fixture'i orqali test tugagach o'chiriladi.
- Bir run'dan keyingisiga o'tadigan ma'lumot (yaratilgan test ID, ism hisoblagichi) `.state/` papkasida saqlanadi va git'ga kirmaydi.

## O'rnatish

```bash
npm install
npx playwright install chromium
cp .env.example .env      # IZ_EMAIL va IZ_PASSWORD ni to'ldiring (.env git'ga kirmaydi)
```

| O'zgaruvchi | Default | Ma'nosi |
|---|---|---|
| `IZ_EMAIL`, `IZ_PASSWORD` | — | CEO login (majburiy) |
| `BASE_URL` | `https://demo-main.ieltszoneapp.uz` | Admin panel |
| `PLACEMENT_URL` | `https://demo.ieltszoneapp.uz/placement-test` | Public placement sahifasi |

## Ishga tushirish

```bash
npm test                        # hammasi
npm run test:functional         # placement test-case'lari (50 ta)
npm run test:e2e                # barcha biznes oqimlari
npm run test:student-flow
npm run test:community
npm run test:placement:create   # yangi placement test yaratish
npm run test:placement:level    # yaratilgan test bilan lid levelini tekshirish
npm run test:headed             # brauzerni ko'rib turish
npm run test:ui                 # Playwright UI mode
npm run report                  # HTML hisobot
npm run typecheck               # TypeScript tekshiruvi
```

## Funksional: Placement Tests (`tests/functional/placement-test`)

**Akademik bo'lim → Placement Tests** bo'limi: Positive (P1–P4), Negative (N1–N9), Edge cases (E1–E9),
UI/UX (U1–U10), Validation (V1–V8), Security (S1–S10).
Sarlavhasi `AT-QA` bilan boshlanadigan testlar yaratiladi va test tugagach o'chiriladi.
Saytdagi ma'lum xatolar `test.fail()` bilan belgilangan (E9, V7): xato tuzatilsa, test qizil bo'lib xabar beradi.

## E2E oqimlar

### `lead/community-lead-to-group.spec.ts`
1. **Call center → Community → "Kiruvchi lidlar"**: birinchi lid → **"Lidni olish"**.
2. Lid kartasi: **Call markaz → Uchrashuvga yozildi**, kelish sanasi (ertaga), majburiy maydonlar → **"Saqlash"**.
3. **Administratsiya**: lid → **"Lidni olish"** (→ "Filialga keldi").
4. **"Mos guruhga qo'shing"** → birinchi guruhda **[+]** → **"Qo'shish"**.
5. Guruh sahifasida talaba borligi tekshiriladi.

> Test har safar demo saytda bitta haqiqiy "Kiruvchi lid"ni ishlatadi.
> Telefon raqami `000…` bilan boshlanadi: sayt lidga SMS yuboradi, u haqiqiy odamga ketmasligi kerak.

```bash
LEAD_ID=68899 LEAD_NAME=Autotest763520 START_STEP=3 npm run test:community   # qadamdan davom ettirish
```

### `lead/student-flow.spec.ts` — Student Flow
Community'dagi yangi liddan to aktiv guruhdagi talabagacha:
Community → Call center (Yangi lidlar → Qayta aloqa → Uchrashuvga yozildi) → Administratsiya (Filialga keldi) →
**Sinov test** (`Demo test uchun`, javoblar `src/data/placement/demo-test.ts`) → lid chatida "Quiz Result" →
mos guruh → "Sinov darsga kelganlar" → **Kassa: 990 000 UZS** → talaba Faol → Kutish ro'yxati → To'plam guruh → Aktiv guruh.

Ism: `Autotest 0001`, `Autotest 0002`, … (hisoblagich `.state/student-flow-counter.json`).

```bash
PASSED_SECTIONS=2 npm run test:student-flow    # levelni qo'lda berish (0..5): 2 → Pre-Intermediate
START_STEP=12 LEAD_NAME="Autotest 0002" LEAD_PHONE=000646826 GROUP_ID=1028 STUDENT_ID=22959 npm run test:student-flow
```

### `placement/new-placement-test.spec.ts` → `placement/placement-level.spec.ts`
1. **New Placement Test**: General English + IELTS, 5:00, 6 ta section (Beginner → IELTS Standart) × 5 ta Multiple Choice savol
   (`src/data/placement/generated-test.ts`). To'g'ri variant yashil belgi bilan belgilanadi va matni **`>> `** bilan boshlanadi.
   Test ID va nomi `.state/generated-placement-test.json`ga yoziladi.
2. **Placement level**: "Filialga keldi"dagi lid (`(00)` telefonli test lid afzal) shu testni yechadi.
   O'tilgan bo'limlarda 5 tadan **4 tasi** to'g'ri (minimal 80%), qolganlarida hammasi xato.
   Natija sahifasidagi **"Your level"** va lid chatidagi **"Quiz Result"** tekshiriladi.

| PASSED_SECTIONS | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| Level | Beginner | Elementary | Pre-Intermediate | Intermediate | IELTS Novice | IELTS Standard |

```bash
TEST_ID=240 npm run test:placement:create      # mavjud testga sectionlarni qayta yozish
PASSED_SECTIONS=3 LEAD_ID=69439 npm run test:placement:level
```

## CI

`.github/workflows/playwright.yml` — GitHub Actions'da **qo'lda** ishga tushiriladi (Actions → Playwright → Run workflow),
chunki e2e testlar demo ma'lumotlarini o'zgartiradi. Repo **Settings → Secrets → Actions**ga `IZ_EMAIL` va `IZ_PASSWORD` qo'shing.
Hisobot artefakt sifatida yuklanadi.
