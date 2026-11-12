# Zeehn Academy sayti

Zeehn Innovatsiya Akademiyasi (Qamashi, Chim) uchun veb-sayt.

## Tuzilishi

- `public/` — saytning o'zi: `index.html`, rasmlar (`img/`), videolar (`video/`) va xarita (`map.jpg`).
- `src/worker.js` — saytdagi formadan kelgan arizalarni Telegram botga yuboradi.
- `wrangler.jsonc` — Cloudflare Workers sozlamalari.

## Cloudflare'ga joylash

1. Cloudflare'da **Workers & Pages → Create → Import a repository** ni bosing.
2. GitHub'dan `zeehn-academy` repozitoriysini tanlang va **Deploy** qiling.
3. **Settings → Variables and Secrets** bo'limiga ikkita qiymat qo'shing (turi: **Secret**):
   - `BOT_TOKEN` — @BotFather bergan bot tokeni
   - `CHAT_ID` — arizalar keladigan chat yoki guruh ID raqami
4. Domen olganingizda uni **Settings → Domains & Routes** bo'limida ulang.

GitHub'ga har safar o'zgarish yuklanganda sayt o'zi yangilanadi.

## Telefon raqam

+998 99 299 55 88 · Telegram: @ZeehnAcademy · Instagram: @zeehn.academy
