# IELTS Zone — Playwright autotests

Site: https://demo-main.ieltszoneapp.uz/admin

## Scenario: `tests/community-lead-to-group.spec.ts`
Community'dan yangi kelgan lidni olib, guruhga qo'shish:

1. **Call center → Community → "Kiruvchi lidlar"** — birinchi lid ochiladi → **"Lidni olish"**.
2. Lid kartasi: **Lid voronka = Call markaz**, **Lid ustun = Uchrashuvga yozildi**, kelish sanasi (ertaga),
   majburiy maydonlar (ism `Autotest<raqam>`, familiya, telefon `(00) 0xx-xx-xx`, Kim?, til, jins, yosh,
   kunlar, vaqt, filial, kurs, sub kurs) → **"Saqlash"**.
3. **Administratsiya → Uchrashuvga yozilganlar** — lid → **"Lidni olish"** (→ "Filialga keldi").
4. **"Mos guruhga qo'shing"** → birinchi mos guruhda **[+]** → birinchi dars sanasi, tug'ilgan sana → **"Qo'shish"**.
5. Guruh sahifasida talaba borligi tekshiriladi.

> Test har safar demo saytda bitta haqiqiy "Kiruvchi lid"ni ishlatadi (o'zgartiradi).
> Telefon raqami `000…` bilan boshlanadi — sayt lidga SMS yuboradi, haqiqiy odamga ketmasligi uchun.

## Run
```bash
npm install
npx playwright install chromium
npm test              # headless
npm run test:headed   # brauzerni ko'rib turish
npm run test:ui       # Playwright UI mode
npm run report        # HTML hisobot
```

Login ma'lumotlari: `.env.example` dan `.env` nusxa oling va `IZ_EMAIL`, `IZ_PASSWORD` ni to'ldiring (`.env` GitHub'ga yuklanmaydi).

Debug (allaqachon olingan lid bilan qadamdan davom ettirish):
```bash
LEAD_ID=68899 LEAD_NAME=Autotest763520 START_STEP=3 npx playwright test
```

## Scenario: `tests/student-flow.spec.ts` — **Student Flow**
Community'dagi yangi liddan to aktiv guruhdagi talabagacha bo'lgan to'liq yo'l:

1. **Community** (sidebar) → tepadagi **Select column = Kiruvchi lidlar** → birinchi chat → avatar → **"Lidni olish"**.
2. Lid ma'lumotlari kiritiladi. Ism: `Autotest 0001`, `Autotest 0002`, ... (tartib raqami `student-flow-counter.json` faylida saqlanadi).
   Lid voronka = **Call markaz**, ustun = **Yangi lidlar** → "Saqlash".
3. Call center: **Yangi lidlar → Qayta aloqa → Uchrashuvga yozildi** (kelish sanasi = ertaga).
   Kartadagi "Kelish sanasi" to'g'ri ekani tekshiriladi.
4. Administratsiya: **Uchrashuvga yozildi → Filialga keldi** ("Lidni olish").
5. **"Sinov test yaratish"** (`Demo test uchun`) → https://demo.ieltszoneapp.uz/placement-test saytida lid ID bilan test ishlanadi.
   Level tasodifiy tanlanadi: o'tilishi kerak bo'lgan bo'limlarda 5 tadan **4 tasi** to'g'ri (minimal 80%), qolganlarida hammasi xato.
   To'g'ri javoblar: `tests/placement-answers.ts`.
6. Lid chatida **"Quiz Result: <level>"** tekshiriladi.
7. **"Mos guruhga qo'shing"**: mos guruh bo'lmasa, level dropdown'i almashtirib ko'riladi.
8. Guruhda **(...) → "Sinov darsga kelganlar"** → status "Sinov darsida qatnashdi".
9. **Moliya → Kassalar** → birinchi kassa → **Daromad** → "Student to'ladi", telefon, guruh, Naqd, **990 000** → talaba **Faol**.
10. **(...) → "Kutish ro'yxatiga o'tkazish"** → **Administratsiya → Kutish ro'yxati**da tekshiriladi.
11. Kutish ro'yxati → **"Tanlovga qo'shish"** → To'plam guruh → **"Aktiv guruhga kochirish"** → talaba aktiv guruhda.

```bash
npx playwright test student-flow --headed
PASSED_SECTIONS=2 npx playwright test student-flow   # levelni qo'lda berish (0..5): 2 → Pre-Intermediate
```

Debug (yarim qolgan talabani qadamdan davom ettirish):
```bash
START_STEP=12 LEAD_NAME="Autotest 0002" LEAD_PHONE=000646826 GROUP_ID=1028 STUDENT_ID=22959 npx playwright test student-flow
```

## Scenario: `tests/new-placement-test.spec.ts` — **New Placement Test**
**Akademik bo'lim → Placement Tests → New Placement Test**:

1. Sarlavha `General English Placement <sana vaqt>`, Kurslar = **General English + IELTS**
   (IELTS levellari faqat IELTS kursi tanlanganda chiqadi), Time limit = **5:00** → "Save and add sections".
2. 6 ta section (Beginner → Elementary → Pre-Intermediate → Intermediate → IELTS Boshlang'ich → IELTS Standart),
   har birida **Multiple Choice** blok, 5 tadan savol, 4 tadan variant; to'g'ri variant yonidagi yashil belgi (radio) qo'yiladi
   va uning matni **`>> `** bilan boshlanadi (test yechayotganda to'g'ri javob ko'rinib turadi).
   Savollar va to'g'ri javoblar: `tests/new-placement-questions.ts`.
3. Ro'yxatda test tekshiriladi: 6 section, 30 savol, 05:00. Test ID va nomi `new-placement-test.json`ga yoziladi.

```bash
npx playwright test new-placement-test --headed
TEST_ID=240 npx playwright test new-placement-test   # debug: yaratilgan testga sectionlarni qayta yozish
```

## Scenario: `tests/placement-level.spec.ts` — **Placement test leveli**
`new-placement-test.spec.ts` yaratgan test (`new-placement-test.json`) bilan:

1. **Administratsiya → Filialga keldi** ustunidan lid tanlanadi (telefoni `(00)` bo'lgan test lid bo'lsa o'sha, bo'lmasa birinchisi).
2. **"Sinov test yaratish"** → yaratilgan test tanlanadi.
3. https://demo.ieltszoneapp.uz/placement-test saytida lid ID bilan test yechiladi. Har safar tasodifiy darajagacha:
   o'tilgan bo'limlarda 5 tadan **4 tasi** `>>` belgili (to'g'ri) javob, qolgan bo'limlarda hammasi xato.
4. Natija sahifasidagi **"Your level"** va lid chatidagi oxirgi **"Quiz Result: <level>"** tekshiriladi.

| PASSED_SECTIONS | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| Level | Beginner | Elementary | Pre-Intermediate | Intermediate | IELTS Novice | IELTS Standard |

```bash
npx playwright test new-placement-test            # avval testni yaratish (bir marta)
npx playwright test placement-level --headed      # tasodifiy level
PASSED_SECTIONS=3 npx playwright test placement-level   # levelni qo'lda berish → Intermediate
LEAD_ID=69439 npx playwright test placement-level       # aniq lid bilan
```
