// Zeehn Academy — Cloudflare Worker
// Sayt fayllari "public/" papkasidan beriladi.
// Saytdagi forma /api/send ga xabar yuboradi, Worker uni Telegram botga jo'natadi.
// Kerakli sozlamalar (Cloudflare → Settings → Variables and Secrets):
//   BOT_TOKEN — @BotFather bergan bot tokeni
//   CHAT_ID   — xabarlar boradigan chat yoki guruh ID raqami

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const esc = (s) =>
  String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

async function handleSend(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);
  if (!env.BOT_TOKEN || !env.CHAT_ID) return json({ ok: false, error: "config" }, 500);

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

  const text =
    "📩 <b>Saytdan yangi ariza</b>\n\n" +
    `👤 <b>Ism:</b> ${esc(name)}\n` +
    `📞 <b>Telefon:</b> ${esc(phone)}\n` +
    (message ? `💬 <b>Xabar:</b> ${esc(message)}` : "💬 Xabar yozilmagan");

  const tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.CHAT_ID, text, parse_mode: "HTML" }),
  });

  if (!tg.ok) return json({ ok: false, error: "telegram" }, 502);
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/send") return handleSend(request, env);
    return env.ASSETS.fetch(request);
  },
};
