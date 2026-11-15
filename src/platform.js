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
  const row = await env.DB.prepare(
    "SELECT u.id,u.role,u.name,u.login,u.phone,u.subject,u.active,s.expires FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?"
  ).bind(tok).first();
  if (!row || !row.active || row.expires < Date.now()) return null;
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
  const u = await env.DB.prepare("SELECT * FROM users WHERE login=?").bind(loginName).first();
  if (!u || !(await verifyPassword(password, u.pass))) {
    await env.DB.prepare("INSERT INTO login_fails(ip,ts) VALUES(?,?)").bind(ip, Date.now()).run();
    return err("Login yoki parol noto'g'ri", 401);
  }
  if (!u.active) return err("Hisobingiz o'chirilgan. Administratorga murojaat qiling.", 403);

  const tok = randToken();
  const exp = Date.now() + SESSION_DAYS * 86400 * 1000;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)").bind(tok, u.id, exp),
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
    env.DB.prepare("DELETE FROM sessions WHERE user_id=? AND token<>?").bind(me.id, tok),
  ]);
  return json({ ok: true });
}

// ---- Statistika ----
async function stats(env) {
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
    `SELECT s.id,s.name,s.joined_at,g.name grp,c.name course FROM students s LEFT JOIN groups g ON g.id=s.group_id LEFT JOIN courses c ON c.id=g.course_id ORDER BY s.id DESC LIMIT 6`
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
    income: g.results[0].n,
    expected: expected.n,
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
        `SELECT * FROM (SELECT s.id,s.name,s.phone,s.parent_name,s.parent_phone,s.group_id,s.joined_at,s.status,s.note,s.birth_date,
           g.name grp,g.course_id,g.teacher_id,c.name course,c.color,c.price,
           (SELECT SUM(amount) FROM payments p WHERE p.student_id=s.id AND p.month=?) paid
         FROM students s LEFT JOIN groups g ON g.id=s.group_id LEFT JOIN courses c ON c.id=g.course_id) s
         ${where} ORDER BY s.status='left', s.name`
      )
      .bind(...args)
      .all();
    let items = r.results;
    if (me.role === "teacher") items = items.map(({ paid, price, ...x }) => x);
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
        `SELECT u.id,u.name,u.phone,u.subject,u.login,u.active,u.created_at,
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
      db.prepare("DELETE FROM sessions WHERE user_id=?").bind(id),
    ]);
    return json({ ok: true });
  }
  if (req.method === "DELETE") {
    const used = await db.prepare("SELECT COUNT(*) n FROM groups WHERE teacher_id=?").bind(id).first();
    if (used.n) return err("Bu ustozga guruhlar biriktirilgan. Avval guruhlarni boshqa ustozga o'tkazing yoki ustozni nofaol qiling.");
    await db.batch([
      db.prepare("DELETE FROM sessions WHERE user_id=?").bind(id),
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
  if (!active) st.push(db.prepare("DELETE FROM sessions WHERE user_id=?").bind(id));
  await db.batch(st);
  return json({ ok: true });
}

// ---- Davomat ----
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
    return json({ ok: true, date, items: r.results });
  }
  const b = await body(req);
  const gid = I(b.group_id);
  const date = S(b.date, 10);
  if (!gid || !isDate(date)) return err("Guruh yoki sana noto'g'ri");
  if (!(await teacherOwnsGroup(env, me, gid))) return err("Ruxsat yo'q", 403);
  if (me.role === "teacher" && date > today()) return err("Kelajak sana uchun yo'qlama qilib bo'lmaydi");
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
    const r = await db.prepare("INSERT INTO leads(name,phone,message,status) VALUES(?,?,?,'yangi')").bind(name, S(b.phone, 30), S(b.message, 1000)).run();
    return json({ ok: true, id: r.meta.last_row_id });
  }
  const status = ["yangi", "boglanildi", "yozildi", "rad"].includes(b.status) ? b.status : "yangi";
  await db.prepare("UPDATE leads SET status=? WHERE id=?").bind(status, id).run();
  return json({ ok: true });
}

export async function saveLead(env, name, phone, message) {
  if (!env.DB) return;
  try {
    await env.DB.prepare("INSERT INTO leads(name,phone,message) VALUES(?,?,?)").bind(name, phone, message).run();
  } catch (e) {}
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

    if (res === "me") {
      if (rawId === "password" && req.method === "POST") return await changeMyPassword(req, env, me);
      return json({ ok: true, user: { id: me.id, role: me.role, name: me.name, login: me.login }, today: today() });
    }
    if (res === "groups") return await groups(req, env, id, me);
    if (res === "attendance") return await attendance(req, env, me, url);
    if (res === "students") return await students(req, env, id, me, url);

    if (me.role !== "admin") return err("Ruxsat yo'q", 403);
    if (res === "stats") return await stats(env);
    if (res === "courses") return await courses(req, env, id);
    if (res === "payments") return await payments(req, env, id, me, url);
    if (res === "teachers") return await teachers(req, env, id, url, sub);
    if (res === "leads") return await leads(req, env, id);
    return err("Topilmadi", 404);
  } catch (e) {
    return err("Server xatosi: " + (e && e.message ? e.message : e), 500);
  }
}
