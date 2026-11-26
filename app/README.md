# Zeehn Lingo — mobil ilova tuzilmasi

## 1. Qanday ishlaydi

```
┌──────────────────────────┐        ┌───────────────────────────────┐
│  Android / iOS ilova     │        │  zeehnacademy.uz (Cloudflare) │
│  (Capacitor qobig'i)     │ HTTPS  │                               │
│  • ikonka, splash        │ ─────► │  /lingo/        → interfeys    │
│  • orqaga tugmasi        │        │  /api/l/*       → API (Worker) │
│  • status bar rangi      │        │  D1 baza        → ma'lumotlar  │
│  • internet yo'q sahifa  │        │                               │
└──────────────────────────┘        └───────────────────────────────┘
```

- Ilova ichida **saytning o'zi** ochiladi. Sayt yangilansa, ilova ham darhol yangilanadi, Play Market'ga qayta yuklash shart emas.
- Sayt, ilova va telefonga o'rnatilgan PWA **bitta baza va bitta hisob** bilan ishlaydi: progress, coin va lug'at hamma joyda bir xil.
- Ilovani Play Market'ga qayta yuklash faqat ikonka, nom, ruxsatlar yoki native imkoniyat (push, barmoq izi) o'zgarganda kerak bo'ladi.

## 2. Papkalar

```
zeehn-academy/
├─ public/lingo/
│  ├─ index.html              ← butun interfeys (sayt + ilova)
│  ├─ manifest.webmanifest    ← PWA: telefonga o'rnatish
│  ├─ sw.js                   ← PWA: kesh, internet sekin bo'lsa ham ochiladi
│  └─ icons/                  ← 192, 512, maskable ikonkalar
├─ src/lingo.js               ← API (darslar, lug'at, Oktagon, sovg'alar...)
├─ migrations/00xx_lingo_*.sql← baza jadvallari
├─ app/                       ← ⭐ mobil ilova (Capacitor)
│  ├─ capacitor.config.json   ← appId, nom, sayt manzili, splash, status bar
│  ├─ package.json            ← Capacitor 7 + App, StatusBar, SplashScreen
│  ├─ assets/                 ← ikonka (1024) va splash (2732) manbalari
│  └─ www/offline.html        ← internet yo'q bo'lsa ko'rinadigan sahifa
└─ .github/workflows/android-apk.yml ← APK'ni avtomatik yig'ish
```

- **appId:** `uz.zeehnacademy.lingo`
- **Nomi:** Zeehn Lingo

## 3. Ekranlar xaritasi

```
Kirish / Ro'yxatdan o'tish
└─ Pastki menyu: Bosh · Xarita · [▶ Dars] · Reyting · Profil
   ├─ Bosh sahifa
   │  ├─ Mening yo'lim (daraja yo'li)
   │  ├─ Davom etish · Takrorlash · Lug'at
   │  ├─ Oktagon · Sovg'alar (ko'k kartochkalar)
   │  ├─ Do'st taklif qilish · AI ustoz
   │  ├─ Kunlik maqsad
   │  ├─ Kurs mavzulari ›
   │  └─ Foydali maslahatlar
   ├─ Mening xaritam → darajalar → bo'limlar → darslar → sandiq
   ├─ ▶ Dars (keyingi darsni ochadi)
   ├─ Reyting (haftalik)
   └─ Profil
      ├─ 🔔 Bildirishnomalar (Yangiliklar / Xabarlar)
      ├─ ⚙️ Sozlamalar (eslatma, tebranish, til, mavzu, parol, akkauntni o'chirish)
      ├─ Daraja · Sovg'alar va bonuslar
      ├─ Hisob: Profil, Do'st taklif, Nishonlar, Lug'atim, Statistika
      ├─ O'rganish: AI ustoz, Oktagon, Mashqlar, Reyting, Qahramon
      └─ Ilova haqida (shartlar, maxfiylik, ijtimoiy tarmoqlar)
```

## 4. APK olish (kompyutersiz)

1. GitHub → **Actions** → "Zeehn Lingo — Android APK" → **Run workflow**.
2. Taxminan 8–10 daqiqadan keyin pastdagi **Artifacts** bo'limidan `zeehn-lingo-apk` ni yuklab oling.
3. ZIP ichidagi `app-debug.apk` ni telefonga o'rnating ("Noma'lum manbalar"ga ruxsat bering).

`app/` papkasida biror narsa o'zgarsa, APK avtomatik yig'iladi.

## 5. Kompyuterda yig'ish (Android Studio)

```bash
cd app
npm install
npx cap add android
npm run assets        # ikonka va splash
npx cap sync android
npx cap open android  # Android Studio ochiladi → Run ▶
```

## 6. Play Market'ga chiqarish

1. Google Play Console hisobi oching (bir martalik to'lov $25).
2. Imzo kaliti yarating (keystore). Uni hech qachon yo'qotmang va GitHub'ga yuklamang.
3. `npm run aab` → `app-release.aab` faylini Play Console'ga yuklang.
4. Quyidagilarni to'ldiring:
   - Maxfiylik siyosati havolasi (ilovada bor: Profil → Ilova haqida)
   - Ilova ichidan akkauntni o'chirish (bor: Sozlamalar → Akkauntni o'chirish)
   - Skrinshotlar, qisqa va to'liq tavsif, yosh toifasi (Ta'lim)
5. Avval **Ichki test** (Internal testing), keyin **Ochiq** (Production) reliz.

## 7. Keyingi bosqichlar (native imkoniyatlar)

| Imkoniyat | Plagin | Nima uchun |
|---|---|---|
| Ovozni tanish | `@capacitor-community/speech-recognition` | Android WebView'da brauzerdagi ovozni tanish ishlamaydi. Ovozli suhbat va ovozli qidiruv uchun kerak |
| Kunlik eslatma | `@capacitor/local-notifications` | "Bugun dars qilmadingiz 🔥" xabari |
| Push xabarlar | `@capacitor/push-notifications` + Firebase | Do'st chaqiruvi, sovg'a tayyor bo'lganda xabar |
| Barmoq izi / PIN | `@capacitor-community/biometric-auth` (yoki `capacitor-native-biometric`) | Tez va xavfsiz kirish |
| Ulashish | `@capacitor/share` | Taklif va chaqiruv havolasini Telegram'ga bir bosishda yuborish |
| Tebranish | `@capacitor/haptics` | To'g'ri/xato javobda tebranish |
