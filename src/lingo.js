// Zeehn Lingo — til o'rganish platformasi API (/api/l/*)
// Ma'lumotlar D1 bazasidagi lingo_* jadvallarida.
// AI yordamchi uchun (ixtiyoriy): Cloudflare → Settings → Variables and Secrets → ANTHROPIC_API_KEY (Secret)

import { hashPassword, verifyPassword } from "./platform.js";
import { COURSE, TIERS, LESSON_IDS, WORDS } from "./lingo-course.js";

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
const tierOf = (xp) => {
  let i = 0;
  TIERS.forEach((t, k) => { if (xp >= t.xp) i = k; });
  return { index: i, name: TIERS[i].name, next: TIERS[i + 1] || null };
};

async function readBody(req) {
  try { return await req.json(); } catch { return {}; }
}

async function currentUser(req, env) {
  const tok = getCookie(req, "zl");
  if (!tok) return null;
  const ses = await env.DB.prepare("SELECT user_id,expires FROM lingo_sessions WHERE token=?").bind(tok).first();
  if (!ses || ses.expires < Date.now()) return null;
  return env.DB.prepare("SELECT id,name,phone,xp,coins,streak,last_day,avatar FROM lingo_users WHERE id=?").bind(ses.user_id).first();
}

async function newSession(env, userId) {
  const tok = randToken();
  await env.DB.prepare("INSERT INTO lingo_sessions (token,user_id,expires) VALUES (?,?,?)")
    .bind(tok, userId, Date.now() + SESSION_DAYS * 86400000).run();
  return cookie(tok, SESSION_DAYS * 86400);
}

// XP, coin va ketma-ket kunlarni yangilash
async function award(env, user, xp, coins) {
  const t = today();
  let streak = user.streak || 0;
  if (user.last_day !== t) streak = user.last_day === addDays(t, -1) ? streak + 1 : 1;
  await env.DB.batch([
    env.DB.prepare("UPDATE lingo_users SET xp=xp+?, coins=coins+?, streak=?, last_day=? WHERE id=?").bind(xp, coins, streak, t, user.id),
    env.DB.prepare("INSERT INTO lingo_xp (user_id,day,xp) VALUES (?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET xp=xp+excluded.xp").bind(user.id, t, xp),
  ]);
  return streak;
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
  return {
    user: { id: user.id, name: user.name, avatar: user.avatar === "girl" ? "girl" : "boy", xp: user.xp, coins: user.coins, streak, today: user.last_day === t },
    tier: tierOf(user.xp),
    tiers: TIERS,
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
    return json({ ok: true, course: COURSE, tiers: TIERS }, 200, { "Cache-Control": "public, max-age=300" });
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
    const r = await env.DB.prepare("INSERT INTO lingo_users (name,phone,pass,avatar) VALUES (?,?,?,?)").bind(name, phone, await hashPassword(pass), avatar).run();
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

  const user = await currentUser(req, env);
  if (!user) return err("auth", 401);

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
    const streak = await award(env, user, xp, coins);
    return json({ ok: true, xp, coins, acc, first, streak, newWords: first ? lesson.words.length : 0 });
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
    return json({ ok: true, xp: 10, coins: 20 });
  }

  // Lug'at
  if (path === "words" && m === "GET") {
    const r = await env.DB.prepare("SELECT word,box,due FROM lingo_words WHERE user_id=?").bind(user.id).all();
    const t = today();
    const list = (r.results || [])
      .filter((w) => WORDS[w.word])
      .map((w) => ({ ...WORDS[w.word], box: w.box, due: w.due <= t && w.box < LEARNED_BOX }));
    return json({ ok: true, words: list, learnedBox: LEARNED_BOX });
  }

  if (path === "review" && m === "GET") {
    const r = await env.DB.prepare("SELECT word,box FROM lingo_words WHERE user_id=? AND box<? AND due<=? ORDER BY due, box LIMIT 20")
      .bind(user.id, LEARNED_BOX, today()).all();
    return json({ ok: true, cards: (r.results || []).filter((w) => WORDS[w.word]).map((w) => ({ ...WORDS[w.word], box: w.box })) });
  }

  if (path === "review" && m === "POST") {
    const b = await readBody(req);
    const res = Array.isArray(b.results) ? b.results.slice(0, 40) : [];
    const t = today();
    const stmts = [];
    let good = 0;
    for (const it of res) {
      const w = S(it.word, 40).toLowerCase();
      if (!WORDS[w]) continue;
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
    return json({ ok: true, xp, good, total: res.length, streak });
  }

  // Haftalik reyting
  if (path === "rating" && m === "GET") {
    const ws = weekStart();
    const r = await env.DB.prepare(
      "SELECT u.id,u.name,u.avatar,SUM(x.xp) xp FROM lingo_xp x JOIN lingo_users u ON u.id=x.user_id WHERE x.day>=? GROUP BY u.id ORDER BY xp DESC, u.id LIMIT 50"
    ).bind(ws).all();
    const list = (r.results || []).map((x, i) => ({ place: i + 1, name: x.name, avatar: x.avatar, xp: x.xp, me: x.id === user.id }));
    let me = list.find((x) => x.me) || null;
    if (!me) {
      const mine = await env.DB.prepare("SELECT COALESCE(SUM(xp),0) xp FROM lingo_xp WHERE user_id=? AND day>=?").bind(user.id, ws).first();
      const above = await env.DB.prepare(
        "SELECT COUNT(*) n FROM (SELECT user_id,SUM(xp) s FROM lingo_xp WHERE day>=? GROUP BY user_id HAVING s>?)"
      ).bind(ws, mine?.xp || 0).first();
      me = { place: (above?.n || 0) + 1, name: user.name, avatar: user.avatar, xp: mine?.xp || 0, me: true };
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
        system:
          "Sen Zeehn Lingo platformasidagi ingliz tili o'qituvchisisan. O'quvchilar o'zbek tilida so'zlashadi va A1–A2 darajada. " +
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

  // Mashq (tezkor test va h.k.) natijasi
  if (path === "practice" && m === "POST") {
    const b = await readBody(req);
    const correct = Math.max(0, Math.min(30, parseInt(b.correct, 10) || 0));
    const xp = Math.min(5, Math.ceil(correct / 2));
    const streak = xp ? await award(env, user, xp, 0) : user.streak;
    return json({ ok: true, xp, coins: 0, streak });
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
