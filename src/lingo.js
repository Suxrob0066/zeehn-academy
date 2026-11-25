// Zeehn Lingo — til o'rganish platformasi API (/api/l/*)
// Ma'lumotlar D1 bazasidagi lingo_* jadvallarida.
// AI yordamchi uchun (ixtiyoriy): Cloudflare → Settings → Variables and Secrets → ANTHROPIC_API_KEY (Secret)

import { hashPassword, verifyPassword } from "./platform.js";
import { COURSE, LEVELS, LESSON_IDS, WORDS } from "./lingo-course.js";

const SESSION_DAYS = 60;
const BOX_DAYS = [0, 1, 3, 7, 14, 30]; // takrorlash oraliqlari (kun)
const LEARNED_BOX = 5;
const AI_DAILY = 30;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
const err = (msg, status = 400) => json({ ok: false, error: msg }, status);

const nowTz = () => new Date(Date.now() + 5 * 3600 * 1000);
const today = () => nowTz().toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(day + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const weekStart = () => {
  const d = nowTz();
  const dow = (d.getUTCDay() + 6) % 7; // dushanba = 0
  return addDays(d.toISOString().slice(0, 10), -dow);
};
const S = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const normPhone = (p) => {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length === 9) return "998" + d;
  return d;
};
const randToken = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c]));
const getCookie = (req, name) => {
  const m = (req.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : null;
};
const cookie = (tok, maxAge) => `zl=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const photoUrl = (u) => (u.photo_v ? `/api/l/photo/${u.id}?v=${u.photo_v}` : null);
// O'quvchi darajasi: birinchi tugatilmagan dars qaysi darajada bo'lsa — o'sha
const levelLessons = (lv) => COURSE.units.filter((u) => lv.units.includes(u.id)).flatMap((u) => u.lessons.map((l) => l.id));
const tierOf = (doneSet) => {
  let index = LEVELS.length - 1;
  for (let i = 0; i < LEVELS.length; i++) {
    if (levelLessons(LEVELS[i]).some((id) => !doneSet.has(id))) { index = i; break; }
  }
  const ids = levelLessons(LEVELS[index]);
  const doneIn = ids.filter((id) => doneSet.has(id)).length;
  const next = LEVELS[index + 1] || null;
  return { index, name: LEVELS[index].name, next: next ? { name: next.name } : null, done: doneIn, total: ids.length, left: ids.length - doneIn };
};


// ---------- Oktagon ----------
const DUEL_Q = 10, DUEL_MS = 15000, DUEL_COIN_DAILY = 10;
const DUEL_COINS = { win: 30, draw: 15, lose: 10 };
const TITLES = ["Chempion", "Usta", "Bilimdon", "Jangchi", "Jangchi"];
const rshuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const qPoints = (a) => (a && a.c ? 100 + Math.max(0, Math.round((10000 - Math.min(10000, a.ms)) / 100)) : 0);
const duelScore = (ans) => ans.reduce((s, a) => s + qPoints(a), 0);
function duelQuestions(doneIds) {
  const all = Object.entries(WORDS).filter(([, w]) => w.uz && w.en.length < 24);
  let pool = all.filter(([, w]) => doneIds.has(w.lesson));
  if (pool.length < DUEL_Q + 4) pool = all.filter(([, w]) => LESSON_IDS.slice(0, Math.max(6, doneIds.size + 3)).includes(w.lesson));
  if (pool.length < DUEL_Q + 4) pool = all;
  return rshuffle(pool).slice(0, DUEL_Q).map(([k, w], i) => {
    const en2uz = i % 2 === 0;
    const wrong = rshuffle(all.filter(([k2]) => k2 !== k)).slice(0, 3).map(([, x]) => (en2uz ? x.uz : x.en));
    const answer = en2uz ? w.uz : w.en;
    return { q: en2uz ? w.en : w.uz, dir: en2uz ? "en-uz" : "uz-en", opts: rshuffle([answer, ...wrong]), answer };
  });
}
function botAnswers(level) {
  const acc = 0.55 + 0.1 * level;
  return Array.from({ length: DUEL_Q }, () => ({ c: Math.random() < acc ? 1 : 0, ms: 2500 + Math.floor(Math.random() * 6000) }));
}

// ---------- Sovg'alar ----------
const GIFTS = [
  { id: "sticker", e: "📒", name: "Zeehn daftar va stiker", cost: 500 },
  { id: "tshirt", e: "👕", name: "Zeehn futbolkasi", cost: 2500 },
  { id: "course", e: "🎓", name: "1 oy bepul kurs", cost: 4000 },
  { id: "headphones", e: "🎧", name: "Simsiz naushnik", cost: 10000 },
];

// ---------- Dictionary & Translator ----------
// Tarjima manbalari (birinchi sozlangani ishlatiladi):
//   DEEPL_API_KEY  |  GOOGLE_TRANSLATE_KEY  |  AZURE_TRANSLATOR_KEY (+ AZURE_TRANSLATOR_REGION)
//   hech biri bo'lmasa — MyMemory bepul xizmati (cheklangan; MYMEMORY_EMAIL qo'shilsa limit oshadi)
// Inglizcha izoh, talaffuz va audio — Free Dictionary API (dictionaryapi.dev, bepul).
const DICT_DAILY = 80;
const POS_UZ = { noun: "ot", verb: "fe'l", adjective: "sifat", adverb: "ravish", pronoun: "olmosh", preposition: "predlog", conjunction: "bog'lovchi", interjection: "undov", numeral: "son", determiner: "aniqlovchi" };
const cleanQ = (q) => String(q || "").toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9'\- ʻʼoʻgʻ]/gi, " ").replace(/\s+/g, " ").trim().slice(0, 40);

async function translate(env, text, from, to) {
  try {
    if (env.DEEPL_API_KEY) {
      const host = env.DEEPL_API_KEY.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";
      const r = await fetch(`https://${host}/v2/translate`, {
        method: "POST",
        headers: { Authorization: "DeepL-Auth-Key " + env.DEEPL_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ text: [text], source_lang: from.toUpperCase(), target_lang: to.toUpperCase() }),
      });
      const j = await r.json();
      if (j.translations?.[0]?.text) return { text: j.translations[0].text, src: "DeepL" };
    }
    if (env.GOOGLE_TRANSLATE_KEY) {
      const r = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${env.GOOGLE_TRANSLATE_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, source: from, target: to, format: "text" }),
      });
      const j = await r.json();
      const t = j.data?.translations?.[0]?.translatedText;
      if (t) return { text: t, src: "Google" };
    }
    if (env.AZURE_TRANSLATOR_KEY) {
      const r = await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${from}&to=${to}`, {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": env.AZURE_TRANSLATOR_KEY, "Ocp-Apim-Subscription-Region": env.AZURE_TRANSLATOR_REGION || "global", "Content-Type": "application/json" },
        body: JSON.stringify([{ Text: text }]),
      });
      const j = await r.json();
      const t = j?.[0]?.translations?.[0]?.text;
      if (t) return { text: t, src: "Microsoft" };
    }
    const u = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}${env.MYMEMORY_EMAIL ? "&de=" + encodeURIComponent(env.MYMEMORY_EMAIL) : ""}`;
    const r = await fetch(u, { headers: { "User-Agent": "ZeehnLingo/1.0" } });
    const j = await r.json();
    let t = j.responseData?.translatedText;
    if (t && !/MYMEMORY WARNING|INVALID|QUERY LENGTH/i.test(t)) {
      if (t === t.toUpperCase() && t.length > 3) t = t.toLowerCase();
      return { text: t, src: "MyMemory" };
    }
  } catch (e) {}
  return null;
}

async function enInfo(word) {
  try {
    const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!r.ok) return {};
    const j = await r.json();
    const e = Array.isArray(j) ? j[0] : null;
    if (!e) return {};
    const ph = (e.phonetics || []).find((p) => p.audio) || {};
    const mean = (e.meanings || [])[0] || {};
    const d = (mean.definitions || [])[0] || {};
    const syn = [...new Set([...(mean.synonyms || []), ...(d.synonyms || [])])].slice(0, 5);
    let audio = ph.audio || "";
    if (audio.startsWith("//")) audio = "https:" + audio;
    return { phonetic: e.phonetic || ph.text || "", audio, pos: mean.partOfSpeech || "", def: d.definition || "", example: d.example || "", syn: syn.join(",") };
  } catch (e) { return {}; }
}

const dictOut = (row, extra = {}) => ({
  en: row.en ?? row.word, uz: row.uz, phonetic: row.phonetic || "", audio: row.audio || "",
  pos: row.pos || "", posUz: POS_UZ[row.pos] || row.pos || "", def: row.def || "", example: row.example || "",
  syn: row.syn ? String(row.syn).split(",").filter(Boolean) : [], src: row.src || "", ...extra,
});

async function readBody(req) {
  try { return await req.json(); } catch { return {}; }
}

async function currentUser(req, env) {
  const tok = getCookie(req, "zl");
  if (!tok) return null;
  const ses = await env.DB.prepare("SELECT user_id,expires FROM lingo_sessions WHERE token=?").bind(tok).first();
  if (!ses || ses.expires < Date.now()) return null;
  return env.DB.prepare("SELECT id,name,phone,xp,coins,streak,last_day,avatar,photo_v,ref_code,ref_by,ref_paid,best_streak FROM lingo_users WHERE id=?").bind(ses.user_id).first();
}

async function newSession(env, userId) {
  const tok = randToken();
  await env.DB.prepare("INSERT INTO lingo_sessions (token,user_id,expires) VALUES (?,?,?)")
    .bind(tok, userId, Date.now() + SESSION_DAYS * 86400000).run();
  return cookie(tok, SESSION_DAYS * 86400);
}

// XP, coin va ketma-ket kunlarni yangilash
// Yagona valyuta — coin (lingo_users.xp ustunida saqlanadi; daraja va reyting ham shunga qarab)
async function award(env, user, xp, coins) {
  xp = (xp || 0) + (coins || 0); coins = 0;
  const t = today();
  let streak = user.streak || 0;
  if (user.last_day !== t) streak = user.last_day === addDays(t, -1) ? streak + 1 : 1;
  await env.DB.batch([
    env.DB.prepare("UPDATE lingo_users SET xp=xp+?, coins=coins+?, streak=?, last_day=?, best_streak=MAX(best_streak,?) WHERE id=?").bind(xp, coins, streak, t, streak, user.id),
    env.DB.prepare("INSERT INTO lingo_xp (user_id,day,xp) VALUES (?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET xp=xp+excluded.xp").bind(user.id, t, xp),
  ]);
  return streak;
}

// Boshqa foydalanuvchiga coin (ketma-ket kuniga tegmasdan)
async function giveCoins(env, uid, n) {
  const t = today();
  await env.DB.batch([
    env.DB.prepare("UPDATE lingo_users SET xp=xp+? WHERE id=?").bind(n, uid),
    env.DB.prepare("INSERT INTO lingo_xp (user_id,day,xp) VALUES (?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET xp=xp+excluded.xp").bind(uid, t, n),
  ]);
}
const randCode = (n) => { const A = "abcdefghjkmnpqrstuvwxyz23456789"; const b = crypto.getRandomValues(new Uint8Array(n)); return [...b].map((x) => A[x % A.length]).join(""); };
async function refCode(env, user) {
  if (user.ref_code) return user.ref_code;
  for (let i = 0; i < 5; i++) {
    const c = randCode(6);
    try { const r = await env.DB.prepare("UPDATE lingo_users SET ref_code=? WHERE id=? AND ref_code IS NULL").bind(c, user.id).run(); if (r.meta.changes) return c; } catch {}
    const u = await env.DB.prepare("SELECT ref_code FROM lingo_users WHERE id=?").bind(user.id).first();
    if (u?.ref_code) return u.ref_code;
  }
  return null;
}
const REF_BONUS = 100;
const FIN = "result IN ('win','lose','draw')";

// ---------- Nishonlar ----------
const BADGES = [
  { id: "lesson1", e: "🎯", name: "Birinchi qadam", desc: "1 ta dars tugating", m: "lessons", n: 1 },
  { id: "lesson10", e: "📘", name: "Bilimdon", desc: "10 ta dars tugating", m: "lessons", n: 10 },
  { id: "lessonAll", e: "🎓", name: "Kurs bitiruvchisi", desc: "Barcha darslarni tugating", m: "lessons", n: 0 },
  { id: "streak3", e: "🔥", name: "Olov yoqildi", desc: "3 kun ketma-ket o'qing", m: "streak", n: 3 },
  { id: "streak7", e: "⚡", name: "Bir hafta to'xtovsiz", desc: "7 kun ketma-ket o'qing", m: "streak", n: 7 },
  { id: "streak30", e: "🌟", name: "Temir iroda", desc: "30 kun ketma-ket o'qing", m: "streak", n: 30 },
  { id: "words50", e: "🧠", name: "So'z ustasi", desc: "50 ta so'zni yodlang", m: "words", n: 50 },
  { id: "words100", e: "📚", name: "Yurgan lug'at", desc: "100 ta so'zni yodlang", m: "words", n: 100 },
  { id: "win1", e: "⚔️", name: "Birinchi g'alaba", desc: "Oktagonda 1 marta yuting", m: "wins", n: 1 },
  { id: "win10", e: "🥊", name: "Jangchi", desc: "Oktagonda 10 marta yuting", m: "wins", n: 10 },
  { id: "win50", e: "🏆", name: "Oktagon chempioni", desc: "Oktagonda 50 marta yuting", m: "wins", n: 50 },
  { id: "inv1", e: "🤝", name: "Do'stona", desc: "1 ta do'stni taklif qiling", m: "invites", n: 1 },
  { id: "inv5", e: "👥", name: "Jamoa sardori", desc: "5 ta do'stni taklif qiling", m: "invites", n: 5 },
  { id: "coin1000", e: "💰", name: "Boy o'quvchi", desc: "Jami 1000 coin yig'ing", m: "coins", n: 1000 },
];
async function badgeStats(env, user, doneCount, learned) {
  const [w, inv, c] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) n FROM lingo_duels WHERE user_id=? AND result='win'").bind(user.id).first(),
    env.DB.prepare("SELECT COUNT(*) n FROM lingo_users WHERE ref_by=? AND ref_paid=1").bind(user.id).first(),
    env.DB.prepare("SELECT COALESCE(SUM(xp),0) n FROM lingo_xp WHERE user_id=?").bind(user.id).first(),
  ]);
  return { lessons: doneCount, streak: Math.max(user.best_streak || 0, user.streak || 0), words: learned || 0, wins: w?.n || 0, invites: inv?.n || 0, coins: c?.n || 0 };
}
function badgeList(st) {
  return BADGES.map((b) => { const n = b.n || LESSON_IDS.length; const cur = Math.min(n, st[b.m] || 0); return { id: b.id, e: b.e, name: b.name, desc: b.desc, cur, n, done: cur >= n }; });
}

async function state(env, user) {
  const t = today();
  const [done, chests, words, week, todayRow] = await Promise.all([
    env.DB.prepare("SELECT lesson,best,times FROM lingo_done WHERE user_id=?").bind(user.id).all(),
    env.DB.prepare("SELECT unit FROM lingo_chests WHERE user_id=?").bind(user.id).all(),
    env.DB.prepare(
      "SELECT SUM(CASE WHEN box>=? THEN 1 ELSE 0 END) learned, SUM(CASE WHEN box<? THEN 1 ELSE 0 END) learning, SUM(CASE WHEN box<? AND due<=? THEN 1 ELSE 0 END) due FROM lingo_words WHERE user_id=?"
    ).bind(LEARNED_BOX, LEARNED_BOX, LEARNED_BOX, t, user.id).first(),
    env.DB.prepare("SELECT COALESCE(SUM(xp),0) xp FROM lingo_xp WHERE user_id=? AND day>=?").bind(user.id, weekStart()).first(),
    env.DB.prepare("SELECT xp FROM lingo_xp WHERE user_id=? AND day=?").bind(user.id, t).first(),
  ]);
  // Ketma-ket kun uzilgan bo'lsa 0 ko'rsatamiz
  const streak = user.last_day === t || user.last_day === addDays(t, -1) ? user.streak : 0;
  const bst = await badgeStats(env, user, (done.results || []).length, words?.learned);
  return {
    badges: badgeList(bst).filter((b) => b.done).map((b) => b.id),
    user: { id: user.id, name: user.name, phone: user.phone, avatar: user.avatar === "girl" ? "girl" : "boy", photo: photoUrl(user), xp: user.xp, coins: user.coins, streak, today: user.last_day === t },
    tier: tierOf(new Set((done.results || []).map((r) => r.lesson))),
    tiers: LEVELS.map((l) => ({ name: l.name })),
    done: Object.fromEntries((done.results || []).map((r) => [r.lesson, { best: r.best, times: r.times }])),
    chests: (chests.results || []).map((r) => r.unit),
    words: { learned: words?.learned || 0, learning: words?.learning || 0, due: words?.due || 0, total: Object.keys(WORDS).length },
    weekXp: week?.xp || 0,
    todayXp: todayRow?.xp || 0,
  };
}

export async function handleLingo(req, env, url) {
  const path = url.pathname.slice("/api/l/".length);
  const m = req.method;

  if (path === "course" && m === "GET") {
    return json({ ok: true, course: COURSE, tiers: LEVELS }, 200, { "Cache-Control": "public, max-age=300" });
  }

  if (path.startsWith("photo/") && m === "GET") {
    const id = parseInt(path.slice(6), 10);
    const r = id ? await env.DB.prepare("SELECT photo FROM lingo_users WHERE id=?").bind(id).first() : null;
    const mm = r?.photo && /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(r.photo);
    if (!mm) return new Response("not found", { status: 404 });
    const bin = Uint8Array.from(atob(mm[2]), (c) => c.charCodeAt(0));
    return new Response(bin, { headers: { "Content-Type": "image/" + mm[1], "Cache-Control": "public, max-age=31536000, immutable" } });
  }

  if (path === "register" && m === "POST") {
    const b = await readBody(req);
    const name = S(b.name, 40);
    const phone = normPhone(b.phone);
    const pass = String(b.password || "");
    if (name.length < 2) return err("Ismingizni kiriting");
    if (phone.length !== 12 || !phone.startsWith("998")) return err("Telefon raqam noto'g'ri");
    if (pass.length < 6) return err("Parol kamida 6 ta belgi bo'lsin");
    const exists = await env.DB.prepare("SELECT id FROM lingo_users WHERE phone=?").bind(phone).first();
    if (exists) return err("Bu raqam ro'yxatdan o'tgan. Kirish tugmasini bosing");
    const avatar = b.avatar === "girl" ? "girl" : "boy";
    const refCodeIn = String(b.ref || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
    const inviter = refCodeIn ? await env.DB.prepare("SELECT id FROM lingo_users WHERE ref_code=?").bind(refCodeIn).first() : null;
    const r = await env.DB.prepare("INSERT INTO lingo_users (name,phone,pass,avatar,ref_by) VALUES (?,?,?,?,?)").bind(name, phone, await hashPassword(pass), avatar, inviter ? inviter.id : null).run();
    const c = await newSession(env, r.meta.last_row_id);
    return json({ ok: true }, 200, { "Set-Cookie": c });
  }

  if (path === "login" && m === "POST") {
    const b = await readBody(req);
    const phone = normPhone(b.phone);
    const u = await env.DB.prepare("SELECT id,pass FROM lingo_users WHERE phone=?").bind(phone).first();
    if (!u || !(await verifyPassword(String(b.password || ""), u.pass))) return err("Telefon yoki parol noto'g'ri", 401);
    const c = await newSession(env, u.id);
    return json({ ok: true }, 200, { "Set-Cookie": c });
  }

  if (path === "logout" && m === "POST") {
    const tok = getCookie(req, "zl");
    if (tok) await env.DB.prepare("DELETE FROM lingo_sessions WHERE token=?").bind(tok).run();
    return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
  }

  // Do'st chaqiruvi haqida (kirmasdan ham ko'rinadi)
  if (path === "oktagon/challenge" && m === "GET") {
    const tk = String(url.searchParams.get("t") || "").replace(/[^a-z0-9]/g, "").slice(0, 16);
    const d = tk ? await env.DB.prepare("SELECT d.id,d.user_id,d.score,d.result,d.answers,u.name,u.avatar,u.photo_v FROM lingo_duels d JOIN lingo_users u ON u.id=d.user_id WHERE d.token=?").bind(tk).first() : null;
    if (!d || !d.answers) return err("Chaqiruv topilmadi yoki hali tugatilmagan", 404);
    const me = await currentUser(req, env);
    return json({ ok: true, from: { name: d.name, avatar: d.avatar, photo: photoUrl({ id: d.user_id, photo_v: d.photo_v }) }, score: d.score,
      status: me && me.id === d.user_id ? "own" : d.result === "wait" ? "open" : "done" });
  }

  const user = await currentUser(req, env);
  if (!user) return err("auth", 401);

  // Taklif havolasi va statistikasi
  if (path === "invite" && m === "GET") {
    const code = await refCode(env, user);
    const st = await env.DB.prepare("SELECT COUNT(*) total, COALESCE(SUM(ref_paid),0) paid FROM lingo_users WHERE ref_by=?").bind(user.id).first();
    const list = await env.DB.prepare("SELECT name,avatar,photo_v,id,ref_paid FROM lingo_users WHERE ref_by=? ORDER BY id DESC LIMIT 20").bind(user.id).all();
    return json({ ok: true, code, url: `${url.origin}/lingo/?ref=${code}`, total: st?.total || 0, paid: st?.paid || 0, bonus: REF_BONUS,
      friends: (list.results || []).map((x) => ({ name: x.name, avatar: x.avatar, photo: photoUrl(x), paid: !!x.ref_paid })) });
  }

  // Nishonlar
  if (path === "badges" && m === "GET") {
    const [dn, w] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) n FROM lingo_done WHERE user_id=?").bind(user.id).first(),
      env.DB.prepare("SELECT COUNT(*) n FROM lingo_words WHERE user_id=? AND box>=?").bind(user.id, LEARNED_BOX).first(),
    ]);
    const list = badgeList(await badgeStats(env, user, dn?.n || 0, w?.n || 0));
    return json({ ok: true, list, done: list.filter((b) => b.done).length });
  }

  if (path === "me" && m === "GET") return json({ ok: true, ...(await state(env, user)) });

  // Dars tugatildi
  if (path === "lesson" && m === "POST") {
    const b = await readBody(req);
    const id = S(b.lesson, 10);
    const idx = LESSON_IDS.indexOf(id);
    if (idx < 0) return err("Dars topilmadi");
    const correct = Math.max(0, Math.min(100, parseInt(b.correct, 10) || 0));
    const total = Math.max(1, Math.min(100, parseInt(b.total, 10) || 1));
    const acc = Math.round((correct / total) * 100);
    if (idx > 0) {
      const prev = await env.DB.prepare("SELECT 1 FROM lingo_done WHERE user_id=? AND lesson=?").bind(user.id, LESSON_IDS[idx - 1]).first();
      if (!prev) return err("Avval oldingi darsni tugating");
    }
    const before = await env.DB.prepare("SELECT best FROM lingo_done WHERE user_id=? AND lesson=?").bind(user.id, id).first();
    const first = !before;
    const xp = first ? 10 + (acc === 100 ? 5 : 0) : 3;
    const coins = first ? 5 : 1;
    const t = today();
    const lesson = COURSE.units.flatMap((u) => u.lessons).find((l) => l.id === id);
    const stmts = [
      env.DB.prepare(
        "INSERT INTO lingo_done (user_id,lesson,best) VALUES (?,?,?) ON CONFLICT(user_id,lesson) DO UPDATE SET best=MAX(best,excluded.best), times=times+1"
      ).bind(user.id, id, acc),
    ];
    if (first) {
      for (const [en] of lesson.words) {
        stmts.push(
          env.DB.prepare("INSERT OR IGNORE INTO lingo_words (user_id,word,box,due) VALUES (?,?,1,?)").bind(user.id, en.toLowerCase(), addDays(t, BOX_DAYS[1]))
        );
      }
    }
    await env.DB.batch(stmts);
    let refBonus = 0;
    if (first && user.ref_by && !user.ref_paid) {
      const u = await env.DB.prepare("UPDATE lingo_users SET ref_paid=1 WHERE id=? AND ref_paid=0").bind(user.id).run();
      if (u.meta.changes) { refBonus = REF_BONUS; await giveCoins(env, user.ref_by, REF_BONUS); }
    }
    const streak = await award(env, user, xp + refBonus, coins);
    return json({ ok: true, coins: xp + coins + refBonus, refBonus, acc, first, streak, newWords: first ? lesson.words.length : 0 });
  }

  // Bo'lim sandig'i
  if (path === "chest" && m === "POST") {
    const b = await readBody(req);
    const unit = COURSE.units.find((u) => u.id === S(b.unit, 10));
    if (!unit) return err("Bo'lim topilmadi");
    const ids = unit.lessons.map((l) => l.id);
    const n = await env.DB.prepare(`SELECT COUNT(*) n FROM lingo_done WHERE user_id=? AND lesson IN (${ids.map(() => "?").join(",")})`)
      .bind(user.id, ...ids).first();
    if ((n?.n || 0) < ids.length) return err("Avval bo'limdagi barcha darslarni tugating");
    const r = await env.DB.prepare("INSERT OR IGNORE INTO lingo_chests (user_id,unit) VALUES (?,?)").bind(user.id, unit.id).run();
    if (!r.meta.changes) return err("Sandiq allaqachon ochilgan");
    await award(env, user, 10, 20);
    return json({ ok: true, coins: 30 });
  }


  // ---------- Dictionary ----------
  if (path === "dict/suggest" && m === "GET") {
    const q = cleanQ(url.searchParams.get("q"));
    const dir = url.searchParams.get("dir") === "uz-en" ? "uz-en" : "en-uz";
    if (!q) return json({ ok: true, list: [] });
    const out = [];
    const seen = new Set();
    for (const w of Object.values(WORDS)) {
      const hay = (dir === "en-uz" ? w.en : w.uz).toLowerCase();
      if (hay.startsWith(q) || (q.length > 2 && hay.includes(q))) { out.push({ en: w.en, uz: w.uz, course: true }); seen.add(w.en.toLowerCase()); }
      if (out.length >= 6) break;
    }
    if (out.length < 8) {
      const r = dir === "en-uz"
        ? await env.DB.prepare("SELECT word,uz FROM lingo_dict WHERE word LIKE ? ORDER BY length(word) LIMIT 8").bind(q + "%").all()
        : await env.DB.prepare("SELECT word,uz FROM lingo_dict WHERE uz LIKE ? ORDER BY length(uz) LIMIT 8").bind("%" + q + "%").all();
      for (const x of r.results || []) if (!seen.has(x.word) && out.length < 8) { out.push({ en: x.word, uz: x.uz }); seen.add(x.word); }
    }
    return json({ ok: true, list: out });
  }

  if (path === "dict" && m === "GET") {
    const q = cleanQ(url.searchParams.get("q"));
    const dir = url.searchParams.get("dir") === "uz-en" ? "uz-en" : "en-uz";
    if (!q) return err("So'z yozing");
    const savedSet = async (en) => !!(await env.DB.prepare("SELECT 1 FROM lingo_words WHERE user_id=? AND word=?").bind(user.id, en.toLowerCase()).first());
    let en = q;
    if (dir === "uz-en") {
      const c = Object.values(WORDS).find((w) => w.uz.toLowerCase().split(/[\/,()]/).map((x) => x.trim()).includes(q));
      if (c) en = c.en.toLowerCase();
      else {
        const d = await env.DB.prepare("SELECT word FROM lingo_dict WHERE uz=? OR uz LIKE ? LIMIT 1").bind(q, q + ",%").first();
        if (d) en = d.word;
        else {
          const used = await env.DB.prepare("SELECT n FROM lingo_dq WHERE user_id=? AND day=?").bind(user.id, today()).first();
          if ((used?.n || 0) >= DICT_DAILY) return err(`Bugungi qidiruv limiti tugadi (${DICT_DAILY}). Ertaga davom eting!`, 429);
          const t = await translate(env, q, "uz", "en");
          if (!t) return err("Tarjima xizmati hozir javob bermadi. Keyinroq urinib ko'ring", 502);
          await env.DB.prepare("INSERT INTO lingo_dq (user_id,day,n) VALUES (?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET n=n+1").bind(user.id, today()).run();
          en = cleanQ(t.text);
        }
      }
    }
    // 1) kurs lug'ati
    if (WORDS[en]) {
      const w = WORDS[en];
      const cache = await env.DB.prepare("SELECT * FROM lingo_dict WHERE word=?").bind(en).first();
      let info = cache;
      if (!info) {
        const e = await enInfo(w.en);
        info = { ...e };
        await env.DB.prepare("INSERT OR REPLACE INTO lingo_dict (word,uz,phonetic,audio,pos,def,example,syn,src) VALUES (?,?,?,?,?,?,?,?,?)")
          .bind(en, w.uz, e.phonetic || "", e.audio || "", e.pos || "", e.def || "", e.example || "", e.syn || "", "Zeehn lug'ati").run();
      }
      return json({ ok: true, result: dictOut({ ...info, word: w.en, uz: w.uz, src: "Zeehn lug'ati" }, { course: true, saved: await savedSet(en) }) });
    }
    // 2) kesh
    const cached = await env.DB.prepare("SELECT * FROM lingo_dict WHERE word=?").bind(en).first();
    if (cached) return json({ ok: true, result: dictOut(cached, { saved: await savedSet(en) }) });
    // 3) tarjima xizmati
    const used = await env.DB.prepare("SELECT n FROM lingo_dq WHERE user_id=? AND day=?").bind(user.id, today()).first();
    if ((used?.n || 0) >= DICT_DAILY) return err(`Bugungi qidiruv limiti tugadi (${DICT_DAILY}). Ertaga davom eting!`, 429);
    const [t, e] = await Promise.all([translate(env, en, "en", "uz"), enInfo(en)]);
    if (!t) return err("Tarjima xizmati hozir javob bermadi. Keyinroq urinib ko'ring", 502);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO lingo_dq (user_id,day,n) VALUES (?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET n=n+1").bind(user.id, today()),
      env.DB.prepare("INSERT OR REPLACE INTO lingo_dict (word,uz,phonetic,audio,pos,def,example,syn,src) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(en, S(t.text, 120), e.phonetic || "", e.audio || "", e.pos || "", S(e.def, 400), S(e.example, 300), e.syn || "", t.src),
    ]);
    const row = await env.DB.prepare("SELECT * FROM lingo_dict WHERE word=?").bind(en).first();
    return json({ ok: true, result: dictOut(row, { saved: false }) });
  }

  if (path === "dict/save" && m === "POST") {
    const b = await readBody(req);
    const w = cleanQ(b.word);
    if (!WORDS[w]) {
      const d = await env.DB.prepare("SELECT 1 FROM lingo_dict WHERE word=?").bind(w).first();
      if (!d) return err("Avval so'zni qidiring");
    }
    if (b.remove) {
      await env.DB.prepare("DELETE FROM lingo_words WHERE user_id=? AND word=?").bind(user.id, w).run();
      return json({ ok: true, saved: false });
    }
    await env.DB.prepare("INSERT OR IGNORE INTO lingo_words (user_id,word,box,due) VALUES (?,?,1,?)").bind(user.id, w, addDays(today(), 1)).run();
    return json({ ok: true, saved: true });
  }

  // Lug'at
  if (path === "words" && m === "GET") {
    const r = await env.DB.prepare("SELECT w.word,w.box,w.due,d.uz duz FROM lingo_words w LEFT JOIN lingo_dict d ON d.word=w.word WHERE w.user_id=?").bind(user.id).all();
    const t = today();
    const list = (r.results || [])
      .filter((w) => WORDS[w.word] || w.duz)
      .map((w) => ({ ...(WORDS[w.word] || { en: w.word, uz: w.duz, custom: true }), box: w.box, due: w.due <= t && w.box < LEARNED_BOX }));
    return json({ ok: true, words: list, learnedBox: LEARNED_BOX });
  }

  if (path === "review" && m === "GET") {
    const r = await env.DB.prepare("SELECT w.word,w.box,d.uz duz FROM lingo_words w LEFT JOIN lingo_dict d ON d.word=w.word WHERE w.user_id=? AND w.box<? AND w.due<=? ORDER BY w.due, w.box LIMIT 20")
      .bind(user.id, LEARNED_BOX, today()).all();
    return json({ ok: true, cards: (r.results || []).filter((w) => WORDS[w.word] || w.duz).map((w) => ({ ...(WORDS[w.word] || { en: w.word, uz: w.duz }), box: w.box })) });
  }

  if (path === "review" && m === "POST") {
    const b = await readBody(req);
    const res = Array.isArray(b.results) ? b.results.slice(0, 40) : [];
    const t = today();
    const stmts = [];
    let good = 0;
    for (const it of res) {
      const w = S(it.word, 40).toLowerCase();
      if (!w) continue;
      if (it.ok) {
        good++;
        stmts.push(
          env.DB.prepare("UPDATE lingo_words SET box=MIN(box+1,?), due=? WHERE user_id=? AND word=? AND due<=?")
            .bind(LEARNED_BOX, "", user.id, w, t)
        );
      } else {
        stmts.push(env.DB.prepare("UPDATE lingo_words SET box=1, due=? WHERE user_id=? AND word=?").bind(addDays(t, 1), user.id, w));
      }
    }
    // to'g'ri javoblar uchun keyingi sanani box bo'yicha qo'yamiz
    if (stmts.length) {
      await env.DB.batch(stmts);
      await env.DB.batch(
        BOX_DAYS.map((d, box) =>
          env.DB.prepare("UPDATE lingo_words SET due=? WHERE user_id=? AND box=? AND due=''").bind(addDays(t, d || 1), user.id, box)
        )
      );
    }
    const xp = Math.min(good, 20);
    const streak = xp ? await award(env, user, xp, 0) : user.streak;
    return json({ ok: true, coins: xp, good, total: res.length, streak });
  }

  // Haftalik reyting
  if (path === "rating" && m === "GET") {
    const ws = weekStart();
    const r = await env.DB.prepare(
      "SELECT u.id,u.name,u.avatar,u.photo_v,SUM(x.xp) xp FROM lingo_xp x JOIN lingo_users u ON u.id=x.user_id WHERE x.day>=? GROUP BY u.id ORDER BY xp DESC, u.id LIMIT 50"
    ).bind(ws).all();
    const list = (r.results || []).map((x, i) => ({ place: i + 1, name: x.name, avatar: x.avatar, photo: photoUrl(x), xp: x.xp, me: x.id === user.id }));
    let me = list.find((x) => x.me) || null;
    if (!me) {
      const mine = await env.DB.prepare("SELECT COALESCE(SUM(xp),0) xp FROM lingo_xp WHERE user_id=? AND day>=?").bind(user.id, ws).first();
      const above = await env.DB.prepare(
        "SELECT COUNT(*) n FROM (SELECT user_id,SUM(xp) s FROM lingo_xp WHERE day>=? GROUP BY user_id HAVING s>?)"
      ).bind(ws, mine?.xp || 0).first();
      me = { place: (above?.n || 0) + 1, name: user.name, avatar: user.avatar, photo: photoUrl(user), xp: mine?.xp || 0, me: true };
    }
    const daysLeft = 7 - ((nowTz().getUTCDay() + 6) % 7);
    return json({ ok: true, list, me, daysLeft });
  }

  // AI yordamchi
  if (path === "ai" && m === "POST") {
    if (!env.ANTHROPIC_API_KEY) return json({ ok: false, error: "AI yordamchi hali ulanmagan. Tez orada ishga tushadi!" }, 503);
    const t = today();
    const used = await env.DB.prepare("SELECT n FROM lingo_ai WHERE user_id=? AND day=?").bind(user.id, t).first();
    if ((used?.n || 0) >= AI_DAILY) return err(`Bugungi limit tugadi (${AI_DAILY} ta savol). Ertaga yana so'rang!`, 429);
    const b = await readBody(req);
    const msgs = (Array.isArray(b.messages) ? b.messages : [])
      .slice(-10)
      .map((x) => ({ role: x.role === "assistant" ? "assistant" : "user", content: S(x.content, 1000) }))
      .filter((x) => x.content);
    if (!msgs.length || msgs[msgs.length - 1].role !== "user") return err("Savol yozing");
    while (msgs.length && msgs[0].role !== "user") msgs.shift();
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: env.AI_MODEL || "claude-haiku-5-5",
        max_tokens: 500,
        system: b.mode === "voice"
          ? "You are a friendly English conversation partner on the Zeehn Lingo app for A1–A2 learners from Uzbekistan. " +
            "Reply in simple, natural English: 1–2 short sentences, then ask a short question to keep the conversation going. " +
            (b.topic ? "Conversation topic: " + S(b.topic, 60) + ". " : "") +
            "If the learner's last sentence had a grammar or word mistake, add one final line starting with 'Tip:' that explains the correction briefly in Uzbek (Latin script). No markdown, no emojis."
          : "Sen Zeehn Lingo platformasidagi ingliz tili o'qituvchisisan. O'quvchilar o'zbek tilida so'zlashadi va A1–A2 darajada. " +
          "Har doim o'zbek tilida (lotin yozuvida), qisqa va sodda javob ber: qoida, 1–2 misol (inglizcha + o'zbekcha tarjima). " +
          "So'ralsa, kichik mashq ber va javobni tekshir. Ingliz tili va o'qishdan boshqa mavzularda muloyimlik bilan darsga qaytar.",
        messages: msgs,
      }),
    }).catch(() => null);
    if (!r || !r.ok) return err("AI hozir javob bera olmadi. Birozdan keyin urinib ko'ring", 502);
    const data = await r.json();
    const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
    await env.DB.prepare("INSERT INTO lingo_ai (user_id,day,n) VALUES (?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET n=n+1").bind(user.id, t).run();
    return json({ ok: true, text, left: AI_DAILY - (used?.n || 0) - 1 });
  }

  // Statistika
  if (path === "stats" && m === "GET") {
    const t = today(), from = addDays(t, -13);
    const [days, agg, words, total] = await Promise.all([
      env.DB.prepare("SELECT day,xp FROM lingo_xp WHERE user_id=? AND day>=? ORDER BY day").bind(user.id, from).all(),
      env.DB.prepare("SELECT COUNT(*) n, COALESCE(AVG(best),0) acc, COALESCE(SUM(times),0) runs FROM lingo_done WHERE user_id=?").bind(user.id).first(),
      env.DB.prepare("SELECT SUM(CASE WHEN box>=? THEN 1 ELSE 0 END) learned, COUNT(*) seen FROM lingo_words WHERE user_id=?").bind(LEARNED_BOX, user.id).first(),
      env.DB.prepare("SELECT COUNT(*) d FROM lingo_xp WHERE user_id=? AND xp>0").bind(user.id).first(),
    ]);
    const map = Object.fromEntries((days.results || []).map((r) => [r.day, r.xp]));
    const series = Array.from({ length: 14 }, (_, i) => { const d = addDays(from, i); return { day: d, xp: map[d] || 0 }; });
    return json({ ok: true, series, lessons: agg?.n || 0, runs: agg?.runs || 0, acc: Math.round(agg?.acc || 0), learned: words?.learned || 0, seen: words?.seen || 0, activeDays: total?.d || 0, todayXp: map[t] || 0 });
  }

  // ---------- Oktagon ----------
  if (path === "oktagon" && m === "GET") {
    const ws = weekStart(), t = today();
    const [mine, top, recent, todayN] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) games, COALESCE(SUM(result='win'),0) wins, COALESCE(SUM(coins),0) coins, COALESCE(SUM(score),0) pts FROM lingo_duels WHERE user_id=? AND week=? AND result IN ('win','lose','draw')").bind(user.id, ws).first(),
      env.DB.prepare("SELECT u.id,u.name,u.avatar,u.photo_v,COUNT(*) games,SUM(d.result='win') wins,SUM(d.score) pts FROM lingo_duels d JOIN lingo_users u ON u.id=d.user_id WHERE d.week=? AND d.result IN ('win','lose','draw') GROUP BY u.id ORDER BY wins DESC, pts DESC, u.id LIMIT 20").bind(ws).all(),
      env.DB.prepare("SELECT d.score,d.opp_score,d.result,d.coins,d.created_at,u.name opp_name FROM lingo_duels d LEFT JOIN lingo_users u ON u.id=d.opp_user WHERE d.user_id=? AND d.result IN ('win','lose','draw') ORDER BY d.id DESC LIMIT 5").bind(user.id).all(),
      env.DB.prepare("SELECT COUNT(*) n FROM lingo_duels WHERE user_id=? AND day=? AND result IN ('win','lose','draw')").bind(user.id, t).first(),
    ]);
    const list = (top.results || []).map((x, i) => ({ place: i + 1, name: x.name, avatar: x.avatar, photo: photoUrl(x), games: x.games, wins: x.wins, title: x.wins ? TITLES[i] || null : null, me: x.id === user.id }));
    let place = list.find((x) => x.me)?.place || null;
    if (!place && mine.games) {
      const above = await env.DB.prepare("SELECT COUNT(*) n FROM (SELECT user_id,SUM(result='win') w,SUM(score) p FROM lingo_duels WHERE week=? AND result IN ('win','lose','draw') GROUP BY user_id HAVING w>? OR (w=? AND p>?))").bind(ws, mine.wins, mine.wins, mine.pts).first();
      place = (above?.n || 0) + 1;
    }
    const daysLeft = 7 - ((nowTz().getUTCDay() + 6) % 7);
    const ch = await env.DB.prepare("SELECT d.token,d.score,d.opp_score,d.result,u.name opp_name FROM lingo_duels d LEFT JOIN lingo_users u ON u.id=d.opp_user WHERE d.user_id=? AND d.token IS NOT NULL AND d.answers IS NOT NULL ORDER BY d.id DESC LIMIT 5").bind(user.id).all();
    return json({ ok: true, week: { games: mine.games, wins: mine.wins, coins: mine.coins, place }, list, daysLeft,
      challenges: (ch.results || []).map((c) => ({ ...c, url: `${url.origin}/lingo/?duel=${c.token}` })),
      recent: (recent.results || []).map((r) => ({ ...r, opp_name: r.opp_name || "Zeehn bot" })),
      today: { played: todayN?.n || 0, coinGames: DUEL_COIN_DAILY }, prize: DUEL_COINS, questions: DUEL_Q, seconds: DUEL_MS / 1000 });
  }

  if (path === "oktagon/start" && m === "POST") {
    const sb = await readBody(req);
    const done = await env.DB.prepare("SELECT lesson FROM lingo_done WHERE user_id=?").bind(user.id).all();
    const doneIds = new Set((done.results || []).map((r) => r.lesson));
    const level = tierOf(doneIds).index;
    // Do'stni chaqirish: avval o'zi o'ynaydi, keyin havolani yuboradi
    if (sb.challenge) {
      const qs = duelQuestions(doneIds), token = randCode(8);
      const r = await env.DB.prepare("INSERT INTO lingo_duels (user_id,day,week,qs,opp_ans,token) VALUES (?,?,?,?,?,?)")
        .bind(user.id, today(), weekStart(), JSON.stringify(qs), "[]", token).run();
      return json({ ok: true, id: r.meta.last_row_id, challenge: true, rival: { name: "Do'stingiz", pending: true },
        questions: qs.map((q) => ({ q: q.q, dir: q.dir, opts: q.opts, answer: q.answer })), opp: [], seconds: DUEL_MS / 1000 });
    }
    // Do'st chaqiruvini qabul qilish
    if (sb.token) {
      const tk = String(sb.token).replace(/[^a-z0-9]/g, "").slice(0, 16);
      const c = await env.DB.prepare("SELECT d.*,u.name,u.avatar,u.photo_v FROM lingo_duels d JOIN lingo_users u ON u.id=d.user_id WHERE d.token=?").bind(tk).first();
      if (!c || !c.answers) return err("Chaqiruv topilmadi", 404);
      if (c.user_id === user.id) return err("Bu o'zingizning chaqiruvingiz — havolani do'stingizga yuboring");
      if (c.result !== "wait") return err("Bu chaqiruv allaqachon qabul qilingan");
      const r = await env.DB.prepare("INSERT INTO lingo_duels (user_id,day,week,opp_user,opp_duel,qs,opp_ans) VALUES (?,?,?,?,?,?,?)")
        .bind(user.id, today(), weekStart(), c.user_id, c.id, c.qs, c.answers).run();
      const qs = JSON.parse(c.qs);
      return json({ ok: true, id: r.meta.last_row_id, friend: true, rival: { name: c.name, avatar: c.avatar, photo: photoUrl({ id: c.user_id, photo_v: c.photo_v }), bot: false },
        questions: qs.map((q) => ({ q: q.q, dir: q.dir, opts: q.opts, answer: q.answer })), opp: JSON.parse(c.answers), seconds: DUEL_MS / 1000 });
    }
    // Raqib: boshqa o'quvchining yaqindagi haqiqiy o'yini (bir xil savollar, uning javoblari va vaqti)
    const opp = await env.DB.prepare(
      "SELECT d.id,d.user_id,d.qs,d.answers,u.name,u.avatar,u.photo_v FROM lingo_duels d JOIN lingo_users u ON u.id=d.user_id WHERE d.user_id<>? AND d.result IN ('win','lose','draw') AND d.answers IS NOT NULL AND d.created_at>=datetime('now','+5 hours','-21 days') ORDER BY RANDOM() LIMIT 1"
    ).bind(user.id).first();
    let qs, oppAns, oppUser = null, oppDuel = null, rival;
    if (opp) {
      qs = JSON.parse(opp.qs); oppAns = JSON.parse(opp.answers); oppUser = opp.user_id; oppDuel = opp.id;
      rival = { name: opp.name, avatar: opp.avatar, photo: photoUrl({ id: opp.user_id, photo_v: opp.photo_v }), bot: false };
    } else {
      qs = duelQuestions(doneIds); oppAns = botAnswers(level);
      rival = { name: "Zeehn bot", bot: true };
    }
    const r = await env.DB.prepare("INSERT INTO lingo_duels (user_id,day,week,opp_user,opp_duel,qs,opp_ans) VALUES (?,?,?,?,?,?,?)")
      .bind(user.id, today(), weekStart(), oppUser, oppDuel, JSON.stringify(qs), JSON.stringify(oppAns)).run();
    return json({ ok: true, id: r.meta.last_row_id, rival, questions: qs.map((q) => ({ q: q.q, dir: q.dir, opts: q.opts, answer: q.answer })), opp: oppAns, seconds: DUEL_MS / 1000 });
  }

  if (path === "oktagon/finish" && m === "POST") {
    const b = await readBody(req);
    const d = await env.DB.prepare("SELECT * FROM lingo_duels WHERE id=? AND user_id=?").bind(parseInt(b.id, 10) || 0, user.id).first();
    if (!d) return err("O'yin topilmadi", 404);
    if (d.result) return err("O'yin allaqachon tugagan");
    const qs = JSON.parse(d.qs), oppAns = JSON.parse(d.opp_ans);
    const given = Array.isArray(b.answers) ? b.answers : [];
    const ans = qs.map((q, i) => {
      const g = given[i] || {};
      const ms = Math.max(300, Math.min(DUEL_MS, parseInt(g.ms, 10) || DUEL_MS));
      return { c: g.a != null && String(g.a) === q.answer ? 1 : 0, ms };
    });
    // Chaqiruv yaratuvchisi: natija do'sti o'ynaguncha kutadi
    if (d.token && !d.opp_user) {
      const score = duelScore(ans);
      await env.DB.prepare("UPDATE lingo_duels SET answers=?,score=?,result='wait' WHERE id=?").bind(JSON.stringify(ans), score, d.id).run();
      return json({ ok: true, challenge: true, token: d.token, url: `${url.origin}/lingo/?duel=${d.token}`, score, correct: ans.filter((a) => a.c).length, coins: 0 });
    }
    const score = duelScore(ans), oppScore = duelScore(oppAns);
    const result = score > oppScore ? "win" : score < oppScore ? "lose" : "draw";
    if (d.opp_duel) {
      const inv = { win: "lose", lose: "win", draw: "draw" }[result];
      const cu = await env.DB.prepare("UPDATE lingo_duels SET opp_user=?,opp_score=?,result=?,coins=? WHERE id=? AND result='wait' AND token IS NOT NULL")
        .bind(user.id, score, inv, DUEL_COINS[inv], d.opp_duel).run();
      if (cu.meta.changes) await giveCoins(env, d.opp_user, DUEL_COINS[inv]);
    }
    const played = await env.DB.prepare("SELECT COUNT(*) n FROM lingo_duels WHERE user_id=? AND day=? AND result IN ('win','lose','draw')").bind(user.id, today()).first();
    const coins = (played?.n || 0) < DUEL_COIN_DAILY ? DUEL_COINS[result] : 0;
    await env.DB.prepare("UPDATE lingo_duels SET answers=?,score=?,opp_score=?,result=?,coins=? WHERE id=?")
      .bind(JSON.stringify(ans), score, oppScore, result, coins, d.id).run();
    const streak = coins ? await award(env, user, coins, 0) : user.streak;
    return json({ ok: true, result, score, oppScore, correct: ans.filter((a) => a.c).length, oppCorrect: oppAns.filter((a) => a.c).length, coins, streak });
  }

  // ---------- Sovg'alar ----------
  if (path === "gifts" && m === "GET") {
    const c = await env.DB.prepare("SELECT id,gift,cost,status,created_at FROM lingo_claims WHERE user_id=? ORDER BY id DESC LIMIT 20").bind(user.id).all();
    const byId = Object.fromEntries(GIFTS.map((g) => [g.id, g]));
    return json({ ok: true, coins: user.xp, gifts: GIFTS, claims: (c.results || []).map((x) => ({ ...x, name: byId[x.gift]?.name || x.gift, e: byId[x.gift]?.e || "🎁" })) });
  }

  if (path === "gifts/claim" && m === "POST") {
    const b = await readBody(req);
    const g = GIFTS.find((x) => x.id === b.id);
    if (!g) return err("Sovg'a topilmadi", 404);
    const pend = await env.DB.prepare("SELECT COUNT(*) n FROM lingo_claims WHERE user_id=? AND gift=? AND status='new'").bind(user.id, g.id).first();
    if (pend?.n) return err("Bu sovg'a uchun so'rovingiz allaqachon bor — akademiyadan olib keting");
    const u = await env.DB.prepare("UPDATE lingo_users SET xp=xp-? WHERE id=? AND xp>=?").bind(g.cost, user.id, g.cost).run();
    if (!u.meta.changes) return err(`Coin yetmaydi: kerak ${g.cost}, sizda ${user.xp}`);
    await env.DB.prepare("INSERT INTO lingo_claims (user_id,gift,cost) VALUES (?,?,?)").bind(user.id, g.id, g.cost).run();
    return json({ ok: true, coins: user.xp - g.cost });
  }

  // Mashq (tezkor test va h.k.) natijasi
  if (path === "practice" && m === "POST") {
    const b = await readBody(req);
    const correct = Math.max(0, Math.min(30, parseInt(b.correct, 10) || 0));
    const xp = Math.min(5, Math.ceil(correct / 2));
    const streak = xp ? await award(env, user, xp, 0) : user.streak;
    return json({ ok: true, coins: xp, streak });
  }

  if (path === "password" && m === "POST") {
    const b = await readBody(req);
    const np = String(b.new || "");
    if (np.length < 6) return err("Yangi parol kamida 6 ta belgi bo'lsin");
    const row = await env.DB.prepare("SELECT pass FROM lingo_users WHERE id=?").bind(user.id).first();
    if (!row || !(await verifyPassword(String(b.old || ""), row.pass))) return err("Joriy parol noto'g'ri");
    const tok = getCookie(req, "zl");
    await env.DB.batch([
      env.DB.prepare("UPDATE lingo_users SET pass=? WHERE id=?").bind(await hashPassword(np), user.id),
      env.DB.prepare("DELETE FROM lingo_sessions WHERE user_id=? AND token<>?").bind(user.id, tok || ""),
    ]);
    return json({ ok: true });
  }

  if (path === "photo" && m === "POST") {
    const b = await readBody(req);
    if (b.remove) {
      await env.DB.prepare("UPDATE lingo_users SET photo=NULL, photo_v=0 WHERE id=?").bind(user.id).run();
      return json({ ok: true, photo: null });
    }
    const data = String(b.data || "");
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data)) return err("Rasm formati noto'g'ri");
    if (data.length > 400000) return err("Rasm juda katta");
    await env.DB.prepare("UPDATE lingo_users SET photo=?, photo_v=photo_v+1 WHERE id=?").bind(data, user.id).run();
    const u = await env.DB.prepare("SELECT id,photo_v FROM lingo_users WHERE id=?").bind(user.id).first();
    return json({ ok: true, photo: photoUrl(u) });
  }

  if (path === "profile" && m === "POST") {
    const b = await readBody(req);
    if (b.avatar !== undefined) {
      await env.DB.prepare("UPDATE lingo_users SET avatar=? WHERE id=?").bind(b.avatar === "girl" ? "girl" : "boy", user.id).run();
    }
    if (b.name !== undefined) {
      const name = S(b.name, 40);
      if (name.length < 2) return err("Ismingizni kiriting");
      await env.DB.prepare("UPDATE lingo_users SET name=? WHERE id=?").bind(name, user.id).run();
    }
    return json({ ok: true });
  }

  return err("not_found", 404);
}
