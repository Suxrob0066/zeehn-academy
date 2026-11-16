// Zeehn Platforma — admin va ustozlar uchun API (/api/p/*)
// Ma'lumotlar Cloudflare D1 bazasida (binding: DB) saqlanadi.

const SESSION_DAYS = 30;
const PBKDF2_ITER = 100000;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
const err = (msg, status = 400) => json({ ok: false, error: msg }, status);

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password, salt, iter) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const h = await pbkdf2(password, salt, PBKDF2_ITER);
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(h)}`;
}
async function verifyPassword(password, stored) {
  const [alg, iter, salt, hash] = String(stored).split("$");
  if (alg !== "pbkdf2") return false;
  const h = b64(await pbkdf2(password, unb64(salt), Number(iter)));
  if (h.length !== hash.length) return false;
  let d = 0;
  for (let i = 0; i < h.length; i++) d |= h.charCodeAt(i) ^ hash.charCodeAt(i);
  return d === 0;
}
const randToken = () => b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c]));

function getCookie(req, name) {
  const c = req.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : null;
}

// Toshkent vaqti (UTC+5)
const nowTz = () => new Date(Date.now() + 5 * 3600 * 1000);
const today = () => nowTz().toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);

const S = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const I = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isMonth = (s) => /^\d{4}-\d{2}$/.test(s);

async function currentUser(req, env) {
  const tok = getCookie(req, "zs");
  if (!tok) return null;
  const ses = await env.DB.prepare("SELECT user_id,kind,expires FROM sessions WHERE token=?").bind(tok).first();
  if (!ses || ses.expires < Date.now()) return null;
  if (ses.kind === "student") {
    const st = await env.DB.prepare(
      "SELECT s.id,s.name,s.login,s.phone,s.status,s.group_id FROM students s WHERE s.id=? AND s.login IS NOT NULL"
    ).bind(ses.user_id).first();
    if (!st || st.status === "left") return null;
    return { ...st, role: "student", active: 1 };
  }
  const row = await env.DB.prepare(
    "SELECT u.id,u.role,u.name,u.login,u.phone,u.subject,u.active,u.is_owner FROM users u WHERE u.id=?"
  ).bind(ses.user_id).first();
  if (!row || !row.active) return null;
  return row;
}

const cookie = (tok, maxAge) =>
  `zs=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

async function body(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// ---------- Handlers ----------

async function login(req, env) {
  const ip = req.headers.get("CF-Connecting-IP") || "local";
  const since = Date.now() - 15 * 60 * 1000;
  const fails = await env.DB.prepare("SELECT COUNT(*) n FROM login_fails WHERE ip=? AND ts>?").bind(ip, since).first();
  if (fails && fails.n >= 10) return err("Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring.", 429);

  const b = await body(req);
  const loginName = S(b.login, 60);
  const password = String(b.password || "");
  let u = await env.DB.prepare("SELECT * FROM users WHERE login=?").bind(loginName).first();
  let kind = "user";
  if (!u) {
    const st = await env.DB.prepare("SELECT id,name,login,pass,status FROM students WHERE login=? COLLATE NOCASE AND pass IS NOT NULL").bind(loginName).first();
    if (st) { u = { ...st, role: "student", active: st.status !== "left" ? 1 : 0 }; kind = "student"; }
  }
  if (!u || !(await verifyPassword(password, u.pass))) {
    await env.DB.prepare("INSERT INTO login_fails(ip,ts) VALUES(?,?)").bind(ip, Date.now()).run();
    return err("Login yoki parol noto'g'ri", 401);
  }
  if (!u.active) return err("Hisobingiz o'chirilgan. Administratorga murojaat qiling.", 403);

  const tok = randToken();
  const exp = Date.now() + SESSION_DAYS * 86400 * 1000;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO sessions(token,user_id,expires,kind) VALUES(?,?,?,?)").bind(tok, u.id, exp, kind),
    env.DB.prepare("DELETE FROM sessions WHERE expires<?").bind(Date.now()),
    env.DB.prepare("DELETE FROM login_fails WHERE ts<?").bind(since),
  ]);
  return json(
    { ok: true, user: { id: u.id, role: u.role, name: u.name, login: u.login } },
    200,
    { "Set-Cookie": cookie(tok, SESSION_DAYS * 86400) }
  );
}

async function logout(req, env) {
  const tok = getCookie(req, "zs");
  if (tok) await env.DB.prepare("DELETE FROM sessions WHERE token=?").bind(tok).run();
  return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
}

async function changeMyPassword(req, env, me) {
  const b = await body(req);
  const u = await env.DB.prepare("SELECT pass FROM users WHERE id=?").bind(me.id).first();
  if (!(await verifyPassword(String(b.old || ""), u.pass))) return err("Hozirgi parol noto'g'ri");
  const np = String(b.new || "");
  if (np.length < 6) return err("Yangi parol kamida 6 belgi bo'lsin");
  const tok = getCookie(req, "zs");
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET pass=? WHERE id=?").bind(await hashPassword(np), me.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id=? AND kind='user' AND token<>?").bind(me.id, tok),
  ]);
  return json({ ok: true });
}

// ---- Profil ----
async function photoOf(env, id) {
  const r = await env.DB.prepare("SELECT photo FROM users WHERE id=?").bind(id).first();
  return (r && r.photo) || "";
}
async function myProfile(env, me) {
  const db = env.DB;
  const u = await db.prepare("SELECT id,role,name,login,phone,subject,photo,created_at FROM users WHERE id=?").bind(me.id).first();
  let groups = [], students = 0, marks = 0;
  if (me.role === "teacher") {
    const r = await db
      .prepare(
        `SELECT g.id,g.name,g.days,g.time,g.room,c.name course,c.color,
          (SELECT COUNT(*) FROM students s WHERE s.group_id=g.id AND s.status='active') students
         FROM groups g JOIN courses c ON c.id=g.course_id WHERE g.teacher_id=? AND g.active=1 ORDER BY g.name`
      )
      .bind(me.id)
      .all();
    groups = r.results;
    students = groups.reduce((a, g) => a + g.students, 0);
    const m = await db.prepare("SELECT COUNT(DISTINCT group_id||'|'||date) n FROM attendance WHERE marked_by=?").bind(me.id).first();
    marks = m.n;
  }
  return json({ ok: true, user: u, groups, students, lessons: marks });
}
// Rahbar va administrator o'z ism, telefon va loginini o'zgartira oladi (ustozlarni admin boshqaradi)
async function setMyInfo(req, env, me) {
  if (me.role !== "admin") return err("Ma'lumotlaringizni administrator o'zgartiradi", 403);
  const b = await body(req);
  const name = S(b.name, 80);
  const login = S(b.login, 40).toLowerCase();
  if (name.length < 2) return err("Ismni kiriting");
  if (!/^[a-z0-9._-]{3,40}$/.test(login)) return err("Login kamida 3 belgi: lotin harflari, raqam, . _ -");
  const dup = await env.DB.prepare("SELECT id FROM users WHERE login=? AND id<>?").bind(login, me.id).first();
  if (dup) return err("Bu login band. Boshqasini tanlang.");
  await env.DB.prepare("UPDATE users SET name=?,phone=?,login=? WHERE id=?").bind(name, S(b.phone, 30), login, me.id).run();
  return json({ ok: true });
}
async function setMyPhoto(req, env, me) {
  const b = await body(req);
  const photo = String(b.photo || "");
  if (photo && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)) return err("Rasm formati noto'g'ri");
  if (photo.length > 300000) return err("Rasm juda katta");
  await env.DB.prepare("UPDATE users SET photo=? WHERE id=?").bind(photo, me.id).run();
  return json({ ok: true });
}

// ---- Statistika ----
async function stats(env, me) {
  const m = thisMonth();
  const d = today();
  const dow = ((nowTz().getUTCDay() + 6) % 7) + 1; // 1=Du ... 7=Ya
  const q = (sql, ...p) => env.DB.prepare(sql).bind(...p);
  const [a, b, c, e, f, g, h, i, j] = await env.DB.batch([
    q("SELECT COUNT(*) n FROM students WHERE status='active'"),
    q("SELECT COUNT(*) n FROM courses WHERE active=1"),
    q("SELECT COUNT(*) n FROM groups WHERE active=1"),
    q("SELECT COUNT(*) n FROM users WHERE role='teacher' AND active=1"),
    q(
      "SELECT COUNT(*) n FROM students s WHERE s.status='active' AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.student_id=s.id AND p.month=?)",
      m
    ),
    q("SELECT COALESCE(SUM(amount),0) n FROM payments WHERE month=?", m),
    q("SELECT COUNT(*) n FROM leads WHERE status='yangi'"),
    q(
      `SELECT c.id,c.name,c.color,c.price,
        (SELECT COUNT(*) FROM students s JOIN groups g ON g.id=s.group_id WHERE g.course_id=c.id AND s.status='active') students,
        (SELECT COUNT(*) FROM groups g WHERE g.course_id=c.id AND g.active=1) groups
       FROM courses c WHERE c.active=1 ORDER BY c.name`
    ),
    q(
      `SELECT g.id,g.name,g.time,g.room,g.days,c.name course,c.color,u.name teacher,
        (SELECT COUNT(*) FROM students s WHERE s.group_id=g.id AND s.status='active') students,
        (SELECT COUNT(*) FROM attendance a WHERE a.group_id=g.id AND a.date=?) marked,
        (SELECT COUNT(*) FROM attendance a WHERE a.group_id=g.id AND a.date=? AND a.status IN ('keldi','kechikdi')) present
       FROM groups g JOIN courses c ON c.id=g.course_id LEFT JOIN users u ON u.id=g.teacher_id
       WHERE g.active=1 AND (','||g.days||',') LIKE ? ORDER BY g.time`,
      d,
      d,
      `%,${dow},%`
    ),
  ]);
  const expected = await q(
    `SELECT COALESCE(SUM(c.price),0) n FROM students s JOIN groups g ON g.id=s.group_id JOIN courses c ON c.id=g.course_id WHERE s.status='active'`
  ).first();
  const recent = await q(
    `SELECT s.id,s.name,s.joined_at,g.name grp,c.name course FROM students s LEFT JOIN groups g ON g.id=s.group_id LEFT JOIN courses c ON c.id=g.course_id ORDER BY s.joined_at DESC, s.id DESC LIMIT 6`
  ).all();
  return json({
    ok: true,
    month: m,
    today: d,
    students: a.results[0].n,
    courses: b.results[0].n,
    groups: c.results[0].n,
    teachers: e.results[0].n,
    unpaid: f.results[0].n,
    income: me.is_owner ? g.results[0].n : null,
    expected: me.is_owner ? expected.n : null,
    newLeads: h.results[0].n,
    byCourse: i.results,
    todayGroups: j.results,
    recent: recent.results,
  });
}

// ---- Kurslar ----
async function courses(req, env, id) {
  const db = env.DB;
  if (req.method === "GET") {
    const r = await db
      .prepare(
        `SELECT c.*,
          (SELECT COUNT(*) FROM students s JOIN groups g ON g.id=s.group_id WHERE g.course_id=c.id AND s.status='active') students,
          (SELECT COUNT(*) FROM groups g WHERE g.course_id=c.id AND g.active=1) groups
         FROM courses c ORDER BY c.active DESC, c.name`
      )
      .all();
    return json({ ok: true, items: r.results });
  }
  if (req.method === "DELETE") {
    const used = await db.prepare("SELECT COUNT(*) n FROM groups WHERE course_id=?").bind(id).first();
    if (used.n) return err("Bu kursda guruhlar bor. Avval guruhlarni o'chiring yoki kursni nofaol qiling.");
    await db.prepare("DELETE FROM courses WHERE id=?").bind(id).run();
    return json({ ok: true });
  }
  const b = await body(req);
  const name = S(b.name, 80);
  if (name.length < 2) return err("Kurs nomini kiriting");
  const vals = [name, Math.max(0, I(b.price) || 0), S(b.color, 20) || "#0046E0", S(b.description, 500), b.active === false || b.active === 0 ? 0 : 1];
  if (req.method === "POST") {
    const r = await db.prepare("INSERT INTO courses(name,price,color,description,active) VALUES(?,?,?,?,?)").bind(...vals).run();
    return json({ ok: true, id: r.meta.last_row_id });
  }
  await db.prepare("UPDATE courses SET name=?,price=?,color=?,description=?,active=? WHERE id=?").bind(...vals, id).run();
  return json({ ok: true });
}

// ---- Guruhlar ----
async function groups(req, env, id, me) {
  const db = env.DB;
  if (req.method === "GET") {
    const where = me.role === "teacher" ? "WHERE g.teacher_id=? AND g.active=1" : "";
    const st = db.prepare(
      `SELECT g.*,c.name course,c.color,c.price,u.name teacher,
        (SELECT COUNT(*) FROM students s WHERE s.group_id=g.id AND s.status='active') students
       FROM groups g JOIN courses c ON c.id=g.course_id LEFT JOIN users u ON u.id=g.teacher_id ${where}
       ORDER BY g.active DESC, c.name, g.name`
    );
    const r = await (me.role === "teacher" ? st.bind(me.id) : st).all();
    return json({ ok: true, items: r.results });
  }
  if (me.role !== "admin") return err("Ruxsat yo'q", 403);
  if (req.method === "DELETE") {
    const used = await db.prepare("SELECT COUNT(*) n FROM students WHERE group_id=?").bind(id).first();
    if (used.n) return err("Guruhda o'quvchilar bor. Avval ularni boshqa guruhga o'tkazing yoki guruhni nofaol qiling.");
    await db.batch([
      db.prepare("DELETE FROM attendance WHERE group_id=?").bind(id),
      db.prepare("DELETE FROM groups WHERE id=?").bind(id),
    ]);
    return json({ ok: true });
  }
  const b = await body(req);
  const name = S(b.name, 80);
  const course = I(b.course_id);
  if (name.length < 1) return err("Guruh nomini kiriting");
  if (!course) return err("Kursni tanlang");
  const days = (Array.isArray(b.days) ? b.days : String(b.days || "").split(","))
    .map((x) => I(x))
    .filter((x) => x >= 1 && x <= 7)
    .join(",");
  const vals = [name, course, I(b.teacher_id) || null, days, S(b.time, 20), S(b.room, 40), S(b.start_date, 10), b.active === false || b.active === 0 ? 0 : 1];
  if (req.method === "POST") {
    const r = await db
      .prepare("INSERT INTO groups(name,course_id,teacher_id,days,time,room,start_date,active) VALUES(?,?,?,?,?,?,?,?)")
      .bind(...vals)
      .run();
    return json({ ok: true, id: r.meta.last_row_id });
  }
  await db
    .prepare("UPDATE groups SET name=?,course_id=?,teacher_id=?,days=?,time=?,room=?,start_date=?,active=? WHERE id=?")
    .bind(...vals, id)
    .run();
  return json({ ok: true });
}

async function teacherOwnsGroup(env, me, groupId) {
  if (me.role === "admin") return true;
  const g = await env.DB.prepare("SELECT teacher_id FROM groups WHERE id=?").bind(groupId).first();
  return g && g.teacher_id === me.id;
}

// ---- O'quvchilar ----
async function students(req, env, id, me, url) {
  const db = env.DB;
  if (req.method === "GET" && id) {
    if (me.role !== "admin") return err("Ruxsat yo'q", 403);
    const s = await db
      .prepare(
        `SELECT s.*,g.name grp,g.course_id,c.name course,c.price,u.name teacher FROM students s
         LEFT JOIN groups g ON g.id=s.group_id LEFT JOIN courses c ON c.id=g.course_id LEFT JOIN users u ON u.id=g.teacher_id WHERE s.id=?`
      )
      .bind(id)
      .first();
    if (!s) return err("Topilmadi", 404);
    delete s.pass;
    s.has_login = !!s.login;
    const [p, a] = await db.batch([
      db.prepare("SELECT * FROM payments WHERE student_id=? ORDER BY month DESC, id DESC").bind(id),
      db.prepare("SELECT status,COUNT(*) n FROM attendance WHERE student_id=? GROUP BY status").bind(id),
    ]);
    const last = await db
      .prepare("SELECT a.date,a.status FROM attendance a WHERE a.student_id=? ORDER BY a.date DESC LIMIT 12")
      .bind(id)
      .all();
    return json({ ok: true, student: s, payments: p.results, attendance: a.results, lastAttendance: last.results });
  }
  if (req.method === "GET") {
    const p = url.searchParams;
    const month = isMonth(p.get("month") || "") ? p.get("month") : thisMonth();
    const cond = [];
    const args = [month];
    if (me.role === "teacher") {
      cond.push("s.teacher_id=?");
      args.push(me.id);
    }
    if (I(p.get("group"))) {
      cond.push("s.group_id=?");
      args.push(I(p.get("group")));
    }
    if (I(p.get("course"))) {
      cond.push("s.course_id=?");
      args.push(I(p.get("course")));
    }
    const status = p.get("status");
    if (["active", "frozen", "left"].includes(status)) {
      cond.push("s.status=?");
      args.push(status);
    }
    const q = S(p.get("q"), 60);
    if (q) {
      cond.push("(s.name LIKE ? OR s.phone LIKE ? OR s.parent_phone LIKE ?)");
      args.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const pay = p.get("pay");
    if (pay === "paid") cond.push("paid IS NOT NULL");
    if (pay === "unpaid") cond.push("paid IS NULL");
    const where = cond.length ? "WHERE " + cond.join(" AND ") : "";
    const r = await db
      .prepare(
        `SELECT * FROM (SELECT s.id,s.name,s.phone,s.parent_name,s.parent_phone,s.group_id,s.joined_at,s.status,s.note,s.birth_date,s.login,
           g.name grp,g.course_id,g.teacher_id,c.name course,c.color,c.price,
           (SELECT SUM(amount) FROM payments p WHERE p.student_id=s.id AND p.month=?) paid
         FROM students s LEFT JOIN groups g ON g.id=s.group_id LEFT JOIN courses c ON c.id=g.course_id) s
         ${where} ORDER BY s.status='left', s.name`
      )
      .bind(...args)
      .all();
    let items = r.results;
    // Ustoz faqat holatni ko'radi (summalarsiz)
    if (me.role === "teacher")
      items = items.map(({ paid, price, ...x }) => ({ ...x, pay: !price ? (paid ? "paid" : "none") : !paid ? "unpaid" : paid < price ? "partial" : "paid" }));
    return json({ ok: true, month, items });
  }
  if (me.role !== "admin") return err("Ruxsat yo'q", 403);
  if (req.method === "DELETE") {
    await db.batch([
      db.prepare("DELETE FROM payments WHERE student_id=?").bind(id),
      db.prepare("DELETE FROM attendance WHERE student_id=?").bind(id),
      db.prepare("DELETE FROM students WHERE id=?").bind(id),
    ]);
    return json({ ok: true });
  }
  const b = await body(req);
  const name = S(b.name, 80);
  if (name.length < 2) return err("O'quvchi ismini kiriting");
  const joined = isDate(S(b.joined_at, 10)) ? S(b.joined_at, 10) : today();
  const status = ["active", "frozen", "left"].includes(b.status) ? b.status : "active";
  const vals = [name, S(b.phone, 30), S(b.parent_name, 80), S(b.parent_phone, 30), S(b.birth_date, 10), I(b.group_id) || null, joined, status, S(b.note, 500)];
  if (req.method === "POST") {
    const r = await db
      .prepare("INSERT INTO students(name,phone,parent_name,parent_phone,birth_date,group_id,joined_at,status,note) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(...vals)
      .run();
    if (I(b.lead_id)) await db.prepare("UPDATE leads SET status='yozildi' WHERE id=?").bind(I(b.lead_id)).run();
    return json({ ok: true, id: r.meta.last_row_id });
  }
  await db
    .prepare("UPDATE students SET name=?,phone=?,parent_name=?,parent_phone=?,birth_date=?,group_id=?,joined_at=?,status=?,note=? WHERE id=?")
    .bind(...vals, id)
    .run();
  return json({ ok: true });
}

// ---- To'lovlar ----
async function payments(req, env, id, me, url) {
  if (me.role !== "admin") return err("Ruxsat yo'q", 403);
  const db = env.DB;
  if (req.method === "GET") {
    const month = isMonth(url.searchParams.get("month") || "") ? url.searchParams.get("month") : thisMonth();
    const r = await db
      .prepare(
        `SELECT p.*,s.name student,c.name course,g.name grp FROM payments p JOIN students s ON s.id=p.student_id
         LEFT JOIN groups g ON g.id=s.group_id LEFT JOIN courses c ON c.id=g.course_id WHERE p.month=? ORDER BY p.paid_at DESC,p.id DESC`
      )
      .bind(month)
      .all();
    return json({ ok: true, month, items: r.results });
  }
  if (req.method === "DELETE") {
    await db.prepare("DELETE FROM payments WHERE id=?").bind(id).run();
    return json({ ok: true });
  }
  const b = await body(req);
  const sid = I(b.student_id);
  const month = S(b.month, 7);
  if (!sid) return err("O'quvchini tanlang");
  if (!isMonth(month)) return err("Oyni tanlang");
  const amount = Math.max(0, I(String(b.amount || "").replace(/\D/g, "")) || 0);
  if (!amount) return err("Summani kiriting");
  const method = ["naqd", "karta", "click", "payme", "boshqa"].includes(b.method) ? b.method : "naqd";
  const paidAt = isDate(S(b.paid_at, 10)) ? S(b.paid_at, 10) : today();
  const r = await db
    .prepare("INSERT INTO payments(student_id,month,amount,method,paid_at,note,created_by) VALUES(?,?,?,?,?,?,?)")
    .bind(sid, month, amount, method, paidAt, S(b.note, 300), me.id)
    .run();
  return json({ ok: true, id: r.meta.last_row_id });
}

// ---- Ustozlar ----
async function teachers(req, env, id, url, sub) {
  const db = env.DB;
  if (req.method === "GET") {
    const r = await db
      .prepare(
        `SELECT u.id,u.name,u.phone,u.subject,u.login,u.active,u.created_at,u.photo,
          (SELECT COUNT(*) FROM groups g WHERE g.teacher_id=u.id AND g.active=1) groups,
          (SELECT COUNT(*) FROM students s JOIN groups g ON g.id=s.group_id WHERE g.teacher_id=u.id AND s.status='active') students,
          (SELECT GROUP_CONCAT(g.name, ', ') FROM groups g WHERE g.teacher_id=u.id AND g.active=1) group_names,
          (SELECT MAX(a.marked_at) FROM attendance a WHERE a.marked_by=u.id) last_mark
         FROM users u WHERE u.role='teacher' ORDER BY u.active DESC, u.name`
      )
      .all();
    return json({ ok: true, items: r.results });
  }
  const b = await body(req);
  if (sub === "password") {
    const np = String(b.password || "");
    if (np.length < 6) return err("Parol kamida 6 belgi bo'lsin");
    await db.batch([
      db.prepare("UPDATE users SET pass=? WHERE id=? AND role='teacher'").bind(await hashPassword(np), id),
      db.prepare("DELETE FROM sessions WHERE user_id=? AND kind='user'").bind(id),
    ]);
    return json({ ok: true });
  }
  if (req.method === "DELETE") {
    const used = await db.prepare("SELECT COUNT(*) n FROM groups WHERE teacher_id=?").bind(id).first();
    if (used.n) return err("Bu ustozga guruhlar biriktirilgan. Avval guruhlarni boshqa ustozga o'tkazing yoki ustozni nofaol qiling.");
    await db.batch([
      db.prepare("DELETE FROM sessions WHERE user_id=? AND kind='user'").bind(id),
      db.prepare("DELETE FROM users WHERE id=? AND role='teacher'").bind(id),
    ]);
    return json({ ok: true });
  }
  const name = S(b.name, 80);
  const login = S(b.login, 40).toLowerCase();
  if (name.length < 2) return err("Ustoz ismini kiriting");
  if (!/^[a-z0-9._-]{3,40}$/.test(login)) return err("Login kamida 3 belgi: lotin harflari, raqam, . _ -");
  const dup = await db.prepare("SELECT id FROM users WHERE login=? AND id<>?").bind(login, id || 0).first();
  if (dup) return err("Bu login band. Boshqasini tanlang.");
  const active = b.active === false || b.active === 0 ? 0 : 1;
  if (req.method === "POST") {
    const pw = String(b.password || "");
    if (pw.length < 6) return err("Parol kamida 6 belgi bo'lsin");
    const r = await db
      .prepare("INSERT INTO users(role,name,phone,subject,login,pass,active) VALUES('teacher',?,?,?,?,?,?)")
      .bind(name, S(b.phone, 30), S(b.subject, 80), login, await hashPassword(pw), active)
      .run();
    return json({ ok: true, id: r.meta.last_row_id });
  }
  const st = [db.prepare("UPDATE users SET name=?,phone=?,subject=?,login=?,active=? WHERE id=? AND role='teacher'").bind(name, S(b.phone, 30), S(b.subject, 80), login, active, id)];
  if (!active) st.push(db.prepare("DELETE FROM sessions WHERE user_id=? AND kind='user'").bind(id));
  await db.batch(st);
  return json({ ok: true });
}

// ---- Davomat ----
// Yo'qlama faqat dars vaqtida: dars kuni, boshlanishidan tugashiga + GRACE daqiqagacha
const GRACE_MIN = 15;
function parseLesson(time) {
  const m = String(time || "").match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
}
const fmtMin = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
function lessonLock(g, date) {
  const t = nowTz();
  const nowMin = t.getUTCHours() * 60 + t.getUTCMinutes();
  const td = today();
  const dow = ((new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7) + 1;
  const isDay = String(g.days || "").split(",").includes(String(dow));
  const w = parseLesson(g.time);
  const base = { open: false, start: w ? fmtMin(w[0]) : "", end: w ? fmtMin(w[1] + GRACE_MIN) : "", grace: GRACE_MIN, now: fmtMin(nowMin) };
  if (date !== td) return { ...base, reason: date < td ? "past" : "future" };
  if (!isDay) return { ...base, reason: "noday" };
  if (!w) return { ...base, open: true, reason: "notime" };
  if (nowMin < w[0]) return { ...base, reason: "before", left: w[0] - nowMin };
  if (nowMin > w[1] + GRACE_MIN) return { ...base, reason: "after" };
  return { ...base, open: true, reason: "now", left: w[1] + GRACE_MIN - nowMin };
}
async function attendance(req, env, me, url) {
  const db = env.DB;
  if (req.method === "GET") {
    const gid = I(url.searchParams.get("group"));
    if (!gid) return err("Guruhni tanlang");
    if (!(await teacherOwnsGroup(env, me, gid))) return err("Ruxsat yo'q", 403);
    const month = url.searchParams.get("month");
    if (isMonth(month || "")) {
      const [st, at] = await db.batch([
        db.prepare("SELECT id,name,status,joined_at FROM students WHERE group_id=? AND status<>'left' ORDER BY name").bind(gid),
        db.prepare("SELECT student_id,date,status FROM attendance WHERE group_id=? AND date LIKE ? ORDER BY date").bind(gid, month + "%"),
      ]);
      return json({ ok: true, students: st.results, records: at.results });
    }
    const date = isDate(url.searchParams.get("date") || "") ? url.searchParams.get("date") : today();
    const r = await db
      .prepare(
        `SELECT s.id,s.name,s.phone,s.parent_phone,s.status st,a.status,a.marked_at FROM students s
         LEFT JOIN attendance a ON a.student_id=s.id AND a.group_id=? AND a.date=?
         WHERE s.group_id=? AND s.status='active' ORDER BY s.name`
      )
      .bind(gid, date, gid)
      .all();
    const g = await db.prepare("SELECT days,time FROM groups WHERE id=?").bind(gid).first();
    return json({ ok: true, date, items: r.results, lock: lessonLock(g || {}, date) });
  }
  const b = await body(req);
  const gid = I(b.group_id);
  const date = S(b.date, 10);
  if (!gid || !isDate(date)) return err("Guruh yoki sana noto'g'ri");
  if (!(await teacherOwnsGroup(env, me, gid))) return err("Ruxsat yo'q", 403);
  const grp = await db.prepare("SELECT days,time FROM groups WHERE id=?").bind(gid).first();
  const lock = lessonLock(grp || {}, date);
  // Administrator istalgan o'tgan yoki bugungi kun uchun yo'qlama qila oladi; ustoz faqat dars vaqtida
  if (me.role === "admin") {
    if (date > today()) return err("Kelajak sana uchun yo'qlama qilib bo'lmaydi");
  } else if (!lock.open) {
    const why = {
      past: "O'tgan kunlar yo'qlamasini o'zgartirib bo'lmaydi",
      future: "Kelajak sana uchun yo'qlama qilib bo'lmaydi",
      noday: "Bugun bu guruhning darsi yo'q",
      before: `Yo'qlama dars boshlanganda ochiladi (${lock.start})`,
      after: `Dars vaqti tugagan (${lock.end} gacha edi)`,
    }[lock.reason];
    return err(why || "Yo'qlama faqat dars vaqtida qilinadi", 403);
  }
  const items = Array.isArray(b.items) ? b.items : [];
  const valid = await db.prepare("SELECT id FROM students WHERE group_id=?").bind(gid).all();
  const ok = new Set(valid.results.map((x) => x.id));
  const st = [];
  for (const it of items) {
    const sid = I(it.student_id);
    if (!ok.has(sid)) continue;
    if (!it.status) {
      st.push(db.prepare("DELETE FROM attendance WHERE group_id=? AND student_id=? AND date=?").bind(gid, sid, date));
      continue;
    }
    if (!["keldi", "kelmadi", "kechikdi", "sababli"].includes(it.status)) continue;
    st.push(
      db
        .prepare(
          `INSERT INTO attendance(group_id,student_id,date,status,marked_by,marked_at) VALUES(?,?,?,?,?,datetime('now'))
           ON CONFLICT(group_id,student_id,date) DO UPDATE SET status=excluded.status,marked_by=excluded.marked_by,marked_at=excluded.marked_at`
        )
        .bind(gid, sid, date, it.status, me.id)
    );
  }
  if (st.length) await db.batch(st);
  return json({ ok: true, saved: st.length });
}

// ---- Administratorlar (faqat rahbar boshqaradi) ----
async function admins(req, env, id, sub, me) {
  const db = env.DB;
  if (req.method === "GET") {
    const r = await db.prepare("SELECT id,name,phone,login,active,is_owner,created_at,photo FROM users WHERE role='admin' ORDER BY is_owner DESC, name").all();
    return json({ ok: true, items: r.results });
  }
  if (id && id === me.id && (req.method === "DELETE" || sub === "password")) return err("O'z hisobingizni Profil bo'limida boshqaring");
  const b = await body(req);
  if (sub === "password") {
    const np = String(b.password || "");
    if (np.length < 6) return err("Parol kamida 6 belgi bo'lsin");
    await db.batch([
      db.prepare("UPDATE users SET pass=? WHERE id=? AND role='admin' AND is_owner=0").bind(await hashPassword(np), id),
      db.prepare("DELETE FROM sessions WHERE user_id=? AND kind='user'").bind(id),
    ]);
    return json({ ok: true });
  }
  if (req.method === "DELETE") {
    await db.batch([
      db.prepare("DELETE FROM sessions WHERE user_id=? AND kind='user'").bind(id),
      db.prepare("DELETE FROM users WHERE id=? AND role='admin' AND is_owner=0").bind(id),
    ]);
    return json({ ok: true });
  }
  const name = S(b.name, 80);
  const login = S(b.login, 40).toLowerCase();
  if (name.length < 2) return err("Ismni kiriting");
  if (!/^[a-z0-9._-]{3,40}$/.test(login)) return err("Login kamida 3 belgi: lotin harflari, raqam, . _ -");
  const dup = await db.prepare("SELECT id FROM users WHERE login=? AND id<>?").bind(login, id || 0).first();
  if (dup) return err("Bu login band. Boshqasini tanlang.");
  const active = b.active === false || b.active === 0 ? 0 : 1;
  if (req.method === "POST") {
    const pw = String(b.password || "");
    if (pw.length < 6) return err("Parol kamida 6 belgi bo'lsin");
    const r = await db
      .prepare("INSERT INTO users(role,name,phone,login,pass,active,is_owner) VALUES('admin',?,?,?,?,?,0)")
      .bind(name, S(b.phone, 30), login, await hashPassword(pw), active)
      .run();
    return json({ ok: true, id: r.meta.last_row_id });
  }
  const st = [db.prepare("UPDATE users SET name=?,phone=?,login=?,active=? WHERE id=? AND role='admin' AND (is_owner=0 OR id=?)").bind(name, S(b.phone, 30), login, id === me.id ? 1 : active, id, me.id)];
  if (!active && id !== me.id) st.push(db.prepare("DELETE FROM sessions WHERE user_id=? AND kind='user'").bind(id));
  await db.batch(st);
  return json({ ok: true });
}

// ---- Arizalar ----
async function leads(req, env, id) {
  const db = env.DB;
  if (req.method === "GET") {
    const r = await db.prepare("SELECT * FROM leads ORDER BY id DESC LIMIT 500").all();
    return json({ ok: true, items: r.results });
  }
  if (req.method === "DELETE") {
    await db.prepare("DELETE FROM leads WHERE id=?").bind(id).run();
    return json({ ok: true });
  }
  const b = await body(req);
  if (req.method === "POST") {
    const name = S(b.name, 80);
    if (name.length < 2) return err("Ismni kiriting");
    const r = await db.prepare("INSERT INTO leads(name,phone,message,status,created_at) VALUES(?,?,?,'yangi',datetime('now','+5 hours'))").bind(name, S(b.phone, 30), S(b.message, 1000)).run();
    return json({ ok: true, id: r.meta.last_row_id });
  }
  const status = ["yangi", "boglanildi", "yozildi", "rad"].includes(b.status) ? b.status : "yangi";
  await db.prepare("UPDATE leads SET status=? WHERE id=?").bind(status, id).run();
  return json({ ok: true });
}

export async function saveLead(env, name, phone, message) {
  if (!env.DB) return;
  try {
    await env.DB.prepare("INSERT INTO leads(name,phone,message,created_at) VALUES(?,?,?,datetime('now','+5 hours'))").bind(name, phone, message).run();
  } catch (e) {}
}


// ================= O'QUVCHI KABINETI va VAZIFALAR =================

const loginTaken = async (env, login, exceptStudent = 0) => {
  const a = await env.DB.prepare("SELECT 1 FROM users WHERE login=?").bind(login).first();
  if (a) return true;
  const b = await env.DB.prepare("SELECT 1 FROM students WHERE login=? COLLATE NOCASE AND id<>?").bind(login, exceptStudent).first();
  return !!b;
};
const translitLogin = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/[ʻʼ'`’‘]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(".") || "oquvchi";
const genPw = () => {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  return [...crypto.getRandomValues(new Uint8Array(8))].map((x) => a[x % a.length]).join("");
};
async function uniqueStudentLogin(env, name, id) {
  const base = translitLogin(name);
  let l = base, k = 1;
  while (await loginTaken(env, l, id)) l = base + ++k;
  return l;
}

// Admin: o'quvchiga login berish / olib qo'yish
async function studentAccess(req, env, id) {
  const db = env.DB;
  if (req.method === "DELETE") {
    await db.batch([
      db.prepare("UPDATE students SET login=NULL, pass=NULL WHERE id=?").bind(id),
      db.prepare("DELETE FROM sessions WHERE user_id=? AND kind='student'").bind(id),
    ]);
    return json({ ok: true });
  }
  const st = await db.prepare("SELECT id,name,login FROM students WHERE id=?").bind(id).first();
  if (!st) return err("Topilmadi", 404);
  const b = await body(req);
  let login = S(b.login, 40).toLowerCase() || st.login || (await uniqueStudentLogin(env, st.name, id));
  if (!/^[a-z0-9._-]{3,40}$/.test(login)) return err("Login kamida 3 belgi: lotin harflari, raqam, . _ -");
  if (await loginTaken(env, login, id)) return err("Bu login band. Boshqasini tanlang.");
  const pw = String(b.password || "") || genPw();
  if (pw.length < 6) return err("Parol kamida 6 belgi bo'lsin");
  await db.batch([
    db.prepare("UPDATE students SET login=?, pass=? WHERE id=?").bind(login, await hashPassword(pw), id),
    db.prepare("DELETE FROM sessions WHERE user_id=? AND kind='student'").bind(id),
  ]);
  return json({ ok: true, login, password: pw, name: st.name });
}
// Admin: login yo'q o'quvchilarga ommaviy login berish
async function studentAccessBulk(req, env) {
  const db = env.DB;
  const b = await body(req);
  const ids = (Array.isArray(b.ids) ? b.ids : []).map((x) => I(x)).filter(Boolean).slice(0, 300);
  if (!ids.length) return err("O'quvchi tanlanmagan");
  const out = [];
  for (const id of ids) {
    const st = await db.prepare("SELECT id,name,login,group_id FROM students WHERE id=? AND status<>'left'").bind(id).first();
    if (!st || st.login) continue;
    const login = await uniqueStudentLogin(env, st.name, id);
    const pw = genPw();
    await db.prepare("UPDATE students SET login=?, pass=? WHERE id=?").bind(login, await hashPassword(pw), id).run();
    out.push({ id, name: st.name, login, password: pw });
  }
  return json({ ok: true, items: out });
}

// ---- Vazifalar (ustoz / admin) ----
async function assignments(req, env, id, me, url) {
  const db = env.DB;
  if (req.method === "GET" && id) {
    const a = await db
      .prepare("SELECT a.*,g.name grp,g.teacher_id,c.name course,c.color FROM assignments a JOIN groups g ON g.id=a.group_id JOIN courses c ON c.id=g.course_id WHERE a.id=?")
      .bind(id)
      .first();
    if (!a) return err("Topilmadi", 404);
    if (!(await teacherOwnsGroup(env, me, a.group_id))) return err("Ruxsat yo'q", 403);
    const r = await db
      .prepare(
        `SELECT s.id student_id,s.name,s.login IS NOT NULL has_login,sb.id,sb.text,sb.photo,sb.submitted_at,sb.score,sb.feedback,sb.checked_at
         FROM students s LEFT JOIN submissions sb ON sb.student_id=s.id AND sb.assignment_id=?
         WHERE s.group_id=? AND s.status='active' ORDER BY sb.submitted_at IS NULL, s.name`
      )
      .bind(id, a.group_id)
      .all();
    return json({ ok: true, assignment: a, items: r.results });
  }
  if (req.method === "GET") {
    const gid = I(url.searchParams.get("group"));
    const cond = [];
    const args = [];
    if (gid) { cond.push("a.group_id=?"); args.push(gid); }
    if (me.role === "teacher") { cond.push("g.teacher_id=?"); args.push(me.id); }
    const r = await db
      .prepare(
        `SELECT a.id,a.group_id,a.title,a.due_date,a.max_score,a.created_at,g.name grp,c.color,
          (SELECT COUNT(*) FROM students s WHERE s.group_id=a.group_id AND s.status='active') total,
          (SELECT COUNT(*) FROM submissions sb WHERE sb.assignment_id=a.id) submitted,
          (SELECT COUNT(*) FROM submissions sb WHERE sb.assignment_id=a.id AND sb.score IS NULL) unchecked
         FROM assignments a JOIN groups g ON g.id=a.group_id JOIN courses c ON c.id=g.course_id
         ${cond.length ? "WHERE " + cond.join(" AND ") : ""} ORDER BY a.id DESC LIMIT 300`
      )
      .bind(...args)
      .all();
    return json({ ok: true, items: r.results });
  }
  if (req.method === "DELETE") {
    const a = await db.prepare("SELECT group_id FROM assignments WHERE id=?").bind(id).first();
    if (!a || !(await teacherOwnsGroup(env, me, a.group_id))) return err("Ruxsat yo'q", 403);
    await db.batch([db.prepare("DELETE FROM submissions WHERE assignment_id=?").bind(id), db.prepare("DELETE FROM assignments WHERE id=?").bind(id)]);
    return json({ ok: true });
  }
  const b = await body(req);
  const gid = I(b.group_id);
  const title = S(b.title, 150);
  if (!gid) return err("Guruhni tanlang");
  if (title.length < 2) return err("Vazifa nomini kiriting");
  if (!(await teacherOwnsGroup(env, me, gid))) return err("Ruxsat yo'q", 403);
  const due = isDate(S(b.due_date, 10)) ? S(b.due_date, 10) : "";
  const maxS = Math.min(100, Math.max(1, I(b.max_score) || 10));
  const link = S(b.link, 500);
  if (link && !/^https?:\/\//i.test(link)) return err("Havola http:// yoki https:// bilan boshlansin");
  if (req.method === "POST") {
    const r = await db
      .prepare("INSERT INTO assignments(group_id,teacher_id,title,body,link,due_date,max_score) VALUES(?,?,?,?,?,?,?)")
      .bind(gid, me.role === "teacher" ? me.id : null, title, S(b.body, 4000), link, due, maxS)
      .run();
    return json({ ok: true, id: r.meta.last_row_id });
  }
  const old = await db.prepare("SELECT group_id FROM assignments WHERE id=?").bind(id).first();
  if (!old || !(await teacherOwnsGroup(env, me, old.group_id))) return err("Ruxsat yo'q", 403);
  await db
    .prepare("UPDATE assignments SET group_id=?,title=?,body=?,link=?,due_date=?,max_score=? WHERE id=?")
    .bind(gid, title, S(b.body, 4000), link, due, maxS, id)
    .run();
  return json({ ok: true });
}
// Ustoz javobni baholaydi
async function gradeSubmission(req, env, id, me) {
  const db = env.DB;
  const sb = await db.prepare("SELECT sb.id,a.group_id,a.max_score FROM submissions sb JOIN assignments a ON a.id=sb.assignment_id WHERE sb.id=?").bind(id).first();
  if (!sb || !(await teacherOwnsGroup(env, me, sb.group_id))) return err("Ruxsat yo'q", 403);
  const b = await body(req);
  const score = b.score === "" || b.score == null ? null : I(b.score);
  if (score != null && (score < 0 || score > sb.max_score)) return err(`Baho 0 dan ${sb.max_score} gacha bo'lsin`);
  await db
    .prepare("UPDATE submissions SET score=?, feedback=?, checked_at=CASE WHEN ? IS NULL THEN NULL ELSE datetime('now','+5 hours') END WHERE id=?")
    .bind(score, S(b.feedback, 1000), score, id)
    .run();
  return json({ ok: true });
}

// ---- O'quvchi uchun API (/api/p/s/*) ----
async function studentApi(req, env, me, parts, url) {
  const db = env.DB;
  const [, res, rawId, sub] = parts;
  const id = I(rawId);
  const st = await db
    .prepare(
      `SELECT s.id,s.name,s.phone,s.parent_name,s.parent_phone,s.joined_at,s.status,s.login,s.photo,s.group_id,
        g.name grp,g.days,g.time,g.room,c.name course,c.color,c.price,u.name teacher,u.phone teacher_phone,u.photo teacher_photo
       FROM students s LEFT JOIN groups g ON g.id=s.group_id LEFT JOIN courses c ON c.id=g.course_id LEFT JOIN users u ON u.id=g.teacher_id WHERE s.id=?`
    )
    .bind(me.id)
    .first();
  if (!st) return err("Topilmadi", 404);

  if (res === "home") {
    const m = thisMonth();
    const [pay, att, pend, last] = await db.batch([
      db.prepare("SELECT COALESCE(SUM(amount),0) n FROM payments WHERE student_id=? AND month=?").bind(me.id, m),
      db.prepare("SELECT status,COUNT(*) n FROM attendance WHERE student_id=? GROUP BY status").bind(me.id),
      db.prepare(
        `SELECT a.id,a.title,a.due_date,a.max_score FROM assignments a WHERE a.group_id=? AND NOT EXISTS (SELECT 1 FROM submissions sb WHERE sb.assignment_id=a.id AND sb.student_id=?) ORDER BY (a.due_date='' ), a.due_date, a.id DESC LIMIT 20`
      ).bind(st.group_id || 0, me.id),
      db.prepare(
        `SELECT a.title,sb.score,a.max_score,sb.feedback,sb.checked_at,a.id FROM submissions sb JOIN assignments a ON a.id=sb.assignment_id WHERE sb.student_id=? AND sb.score IS NOT NULL ORDER BY sb.checked_at DESC LIMIT 3`
      ).bind(me.id),
    ]);
    const paid = pay.results[0].n;
    const { pass, ...pub } = st;
    return json({
      ok: true,
      today: today(),
      student: { ...pub, price: undefined },
      pay: !st.price ? (paid ? "paid" : "none") : !paid ? "unpaid" : paid < st.price ? "partial" : "paid",
      attendance: att.results,
      pending: pend.results,
      graded: last.results,
    });
  }
  if (res === "tasks" && req.method === "GET" && !id) {
    const r = await db
      .prepare(
        `SELECT a.id,a.title,a.body,a.link,a.due_date,a.max_score,a.created_at,sb.id sub_id,sb.submitted_at,sb.score,sb.feedback,sb.checked_at
         FROM assignments a LEFT JOIN submissions sb ON sb.assignment_id=a.id AND sb.student_id=?
         WHERE a.group_id=? ORDER BY a.id DESC LIMIT 200`
      )
      .bind(me.id, st.group_id || 0)
      .all();
    return json({ ok: true, today: today(), items: r.results });
  }
  if (res === "tasks" && id) {
    const a = await db.prepare("SELECT * FROM assignments WHERE id=? AND group_id=?").bind(id, st.group_id || 0).first();
    if (!a) return err("Vazifa topilmadi", 404);
    const mine = await db.prepare("SELECT * FROM submissions WHERE assignment_id=? AND student_id=?").bind(id, me.id).first();
    if (req.method === "GET") return json({ ok: true, task: a, submission: mine || null, today: today() });
    // Javob yuborish
    if (mine && mine.score != null) return err("Javob baholangan, endi o'zgartirib bo'lmaydi");
    const b = await body(req);
    const text = S(b.text, 5000);
    const photo = String(b.photo || "");
    if (photo && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)) return err("Rasm formati noto'g'ri");
    if (photo.length > 900000) return err("Rasm juda katta");
    if (!text && !photo) return err("Javob yozing yoki rasm biriktiring");
    await db
      .prepare(
        `INSERT INTO submissions(assignment_id,student_id,text,photo,submitted_at) VALUES(?,?,?,?,datetime('now','+5 hours'))
         ON CONFLICT(assignment_id,student_id) DO UPDATE SET text=excluded.text,photo=excluded.photo,submitted_at=excluded.submitted_at`
      )
      .bind(id, me.id, text, photo)
      .run();
    return json({ ok: true });
  }
  if (res === "attendance") {
    const month = isMonth(url.searchParams.get("month") || "") ? url.searchParams.get("month") : thisMonth();
    const r = await db.prepare("SELECT date,status FROM attendance WHERE student_id=? AND date LIKE ? ORDER BY date").bind(me.id, month + "%").all();
    const all = await db.prepare("SELECT status,COUNT(*) n FROM attendance WHERE student_id=? GROUP BY status").bind(me.id).all();
    return json({ ok: true, month, items: r.results, totals: all.results, days: st.days });
  }
  if (res === "password" && req.method === "POST") {
    const b = await body(req);
    const cur = await db.prepare("SELECT pass FROM students WHERE id=?").bind(me.id).first();
    if (!(await verifyPassword(String(b.old || ""), cur.pass))) return err("Hozirgi parol noto'g'ri");
    const np = String(b.new || "");
    if (np.length < 6) return err("Yangi parol kamida 6 belgi bo'lsin");
    const tok = getCookie(req, "zs");
    await db.batch([
      db.prepare("UPDATE students SET pass=? WHERE id=?").bind(await hashPassword(np), me.id),
      db.prepare("DELETE FROM sessions WHERE user_id=? AND kind='student' AND token<>?").bind(me.id, tok),
    ]);
    return json({ ok: true });
  }
  if (res === "photo" && req.method === "POST") {
    const b = await body(req);
    const photo = String(b.photo || "");
    if (photo && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)) return err("Rasm formati noto'g'ri");
    if (photo.length > 300000) return err("Rasm juda katta");
    await db.prepare("UPDATE students SET photo=? WHERE id=?").bind(photo, me.id).run();
    return json({ ok: true });
  }
  return err("Topilmadi", 404);
}

// ---------- Router ----------
export async function handlePlatform(req, env, url) {
  if (!env.DB) return err("Baza ulanmagan", 500);
  const parts = url.pathname.replace(/^\/api\/p\/?/, "").split("/").filter(Boolean);
  const [res, rawId, sub] = parts;
  const id = I(rawId);

  // CSRF himoyasi: o'zgartiruvchi so'rovlar faqat shu saytdan
  if (req.method !== "GET") {
    const origin = req.headers.get("Origin");
    if (origin && new URL(origin).host !== url.host) return err("Ruxsat yo'q", 403);
  }

  try {
    if (res === "login" && req.method === "POST") return await login(req, env);
    if (res === "logout") return await logout(req, env);

    const me = await currentUser(req, env);
    if (!me) return err("Kirish talab qilinadi", 401);

    // O'quvchi faqat o'z bo'limidan foydalanadi
    if (me.role === "student") {
      if (res === "me") {
        const ph = await env.DB.prepare("SELECT photo FROM students WHERE id=?").bind(me.id).first();
        return json({ ok: true, user: { id: me.id, role: "student", name: me.name, login: me.login, photo: (ph && ph.photo) || "" }, today: today() });
      }
      if (res === "s") return await studentApi(req, env, me, parts, url);
      return err("Ruxsat yo'q", 403);
    }
    if (res === "assignments") return await assignments(req, env, id, me, url);
    if (res === "submissions" && id && req.method === "PUT") return await gradeSubmission(req, env, id, me);

    if (res === "me") {
      if (rawId === "password" && req.method === "POST") return await changeMyPassword(req, env, me);
      if (rawId === "photo" && req.method === "POST") return await setMyPhoto(req, env, me);
      if (rawId === "profile") return await myProfile(env, me);
      if (rawId === "info" && req.method === "POST") return await setMyInfo(req, env, me);
      return json({ ok: true, user: { id: me.id, role: me.role, owner: !!me.is_owner, name: me.name, login: me.login, photo: await photoOf(env, me.id) }, today: today() });
    }
    if (res === "groups") return await groups(req, env, id, me);
    if (res === "attendance") return await attendance(req, env, me, url);
    if (res === "students") return await students(req, env, id, me, url);

    if (me.role !== "admin") return err("Ruxsat yo'q", 403);
    if (res === "stats") return await stats(env, me);
    if (res === "courses") return await courses(req, env, id);
    if (res === "payments") return await payments(req, env, id, me, url);
    if (res === "teachers") return await teachers(req, env, id, url, sub);
    if (res === "leads") return await leads(req, env, id);
    if (res === "students-access" && req.method === "POST") return await studentAccessBulk(req, env);
    if (res === "access" && id) return await studentAccess(req, env, id);
    if (res === "admins") {
      if (!me.is_owner) return err("Bu bo'lim faqat rahbar uchun", 403);
      return await admins(req, env, id, sub, me);
    }
    return err("Topilmadi", 404);
  } catch (e) {
    return err("Server xatosi: " + (e && e.message ? e.message : e), 500);
  }
}
