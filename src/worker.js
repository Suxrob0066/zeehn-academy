// Zeehn Academy — Cloudflare Worker
// Sayt fayllari "public/" papkasidan beriladi.
// Saytdagi forma /api/send ga xabar yuboradi, Worker uni Telegram botga jo'natadi.
// Kerakli sozlamalar (Cloudflare → Settings → Variables and Secrets):
//   BOT_TOKEN — @BotFather bergan bot tokeni
//   CHAT_ID   — xabarlar boradigan chat yoki guruh ID raqami
//   CHAT_ID_2 — (ixtiyoriy) qo'shimcha qabul qiluvchilar. Bir nechta bo'lsa vergul bilan: 111,222
//   EXTRA_CHAT_IDS — wrangler.jsonc dagi qo'shimcha qabul qiluvchilar (vergul bilan)
//   Har bir qabul qiluvchi oldin botga /start bosgan bo'lishi kerak.

import { handlePlatform, saveLead } from "./platform.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const esc = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

async function handleSend(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const chatIds = [env.CHAT_ID, env.CHAT_ID_2, env.EXTRA_CHAT_IDS]
    .filter(Boolean)
    .flatMap((v) => String(v).split(","))
    .map((v) => v.trim())
    .filter(Boolean);
  if (!env.BOT_TOKEN || chatIds.length === 0) return json({ ok: false, error: "config" }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  // Spam botlar uchun yashirin maydon
  if (body.website) return json({ ok: true });

  const name = String(body.name || "").trim().slice(0, 60);
  const phone = String(body.phone || "").trim().slice(0, 20);
  const message = String(body.message || "").trim().slice(0, 1000);

  if (name.length < 2) return json({ ok: false, error: "name" }, 400);
  if (phone.replace(/\D/g, "").length < 12) return json({ ok: false, error: "phone" }, 400);

  // Arizani platformadagi "Arizalar" bo'limiga ham saqlaymiz
  await saveLead(env, name, phone, message);

  const text =
    "📩 <b>Saytdan yangi ariza</b>\n\n" +
    `👤 <b>Ism:</b> ${esc(name)}\n` +
    `📞 <b>Telefon:</b> ${esc(phone)}\n` +
    (message ? `💬 <b>Xabar:</b> ${esc(message)}` : "💬 Xabar yozilmagan");

  // Xabarni barcha qabul qiluvchilarga bir vaqtda yuboramiz
  const results = await Promise.all(
    [...new Set(chatIds)].map((chat_id) =>
      fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text, parse_mode: "HTML" }),
      })
        .then((r) => r.ok)
        .catch(() => false)
    )
  );

  // Kamida bittasiga yetib borsa — muvaffaqiyatli
  if (!results.some(Boolean)) return json({ ok: false, error: "telegram" }, 502);
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/send") return handleSend(request, env);
    if (url.pathname.startsWith("/api/p/")) return handlePlatform(request, env, url);
    if (["/ustoz", "/ustoz/", "/admin", "/admin/", "/oquvchi", "/oquvchi/"].includes(url.pathname)) return Response.redirect(url.origin + "/platforma/", 302);
    if (url.pathname === "/platforma") return Response.redirect(url.origin + "/platforma/", 301);
    return env.ASSETS.fetch(request);
  },
};
