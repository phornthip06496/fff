import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const page = document.body.dataset.page;
const $ = (id) => document.getElementById(id);

function showMsg(text, type = "error") {
  const box = $("msg");
  if (!box) return;
  box.textContent = text;
  box.className = `msg msg-${type}`;
  box.hidden = !text;
}

function thaiError(e) {
  const m = (e?.message || "").toLowerCase();
  if (m.includes("invalid login")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (m.includes("already registered")) return "อีเมลนี้ถูกใช้สมัครแล้ว ลองเข้าสู่ระบบแทน";
  if (m.includes("email not confirmed")) return "ยังไม่ได้ยืนยันอีเมล เปิดอีเมลแล้วกดลิงก์ยืนยันก่อน";
  if (m.includes("rate limit")) return "ส่งคำขอบ่อยเกินไป รอสักครู่แล้วลองใหม่";
  if (m.includes("password")) return "รหัสผ่านไม่ผ่านเกณฑ์ ต้องยาวอย่างน้อย 8 ตัวอักษร";
  if (m.includes("failed to fetch")) return "เชื่อมต่อ Supabase ไม่ได้ ตรวจ URL ใน js/config.js";
  return `เกิดข้อผิดพลาด: ${e?.message ?? "ไม่ทราบสาเหตุ"}`;
}

function setBusy(btn, busy, label) {
  btn.disabled = busy;
  btn.textContent = busy ? "กำลังดำเนินการ…" : label;
}

/* ---------- สมัครสมาชิก ---------- */
async function initRegister() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return (location.href = "dashboard.html");

  const form = $("register-form");
  const btn = $("submit");
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    showMsg("");
    const f = new FormData(form);
    const fullName = f.get("full_name").trim();
    const username = f.get("username").trim();
    const email = f.get("email").trim();
    const password = f.get("password");

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
      return showMsg("ชื่อผู้ใช้ต้องเป็น a-z, 0-9 หรือ _ ยาว 3–20 ตัวอักษร");
    if (password.length < 8) return showMsg("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
    if (password !== f.get("confirm")) return showMsg("รหัสผ่านทั้งสองช่องไม่ตรงกัน");

    setBusy(btn, true, "สมัครสมาชิก");
    try {
      const { data: free, error: rpcErr } = await supabase.rpc("is_username_available", { p_username: username });
      if (rpcErr) throw rpcErr;
      if (!free) return showMsg("ชื่อผู้ใช้นี้ถูกใช้แล้ว เลือกชื่ออื่น");

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, username, interest: f.get("interest") },
          emailRedirectTo: new URL("login.html", location.href).href,
        },
      });
      if (error) throw error;
      if (data.user && data.user.identities?.length === 0)
        return showMsg("อีเมลนี้ถูกใช้สมัครแล้ว ลองเข้าสู่ระบบแทน");

      if (data.session) return (location.href = "dashboard.html");
      form.reset();
      showMsg("สมัครสำเร็จ ส่งลิงก์ยืนยันไปที่อีเมลแล้ว กดลิงก์นั้นแล้วกลับมาเข้าสู่ระบบ", "ok");
    } catch (e) {
      showMsg(thaiError(e));
    } finally {
      setBusy(btn, false, "สมัครสมาชิก");
    }
  });
}

/* ---------- เข้าสู่ระบบ ---------- */
async function initLogin() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return (location.href = "dashboard.html");

  const form = $("login-form");
  const btn = $("submit");
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    showMsg("");
    const f = new FormData(form);
    setBusy(btn, true, "เข้าสู่ระบบ");
    const { error } = await supabase.auth.signInWithPassword({
      email: f.get("email").trim(),
      password: f.get("password"),
    });
    if (error) {
      showMsg(thaiError(error));
      return setBusy(btn, false, "เข้าสู่ระบบ");
    }
    location.href = "dashboard.html";
  });

  $("forgot").addEventListener("click", async () => {
    const email = form.elements.email.value.trim();
    if (!email) return showMsg("กรอกอีเมลก่อน แล้วกด “ลืมรหัสผ่าน”");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("login.html", location.href).href,
    });
    showMsg(error ? thaiError(error) : "ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว", error ? "error" : "ok");
  });
}

/* ---------- แดชบอร์ด (ต้องล็อกอิน) ---------- */
const CATEGORY = { hardware: "ฮาร์ดแวร์", programming: "เขียนโปรแกรม", network: "เครือข่าย", security: "ความปลอดภัย", ai: "AI" };
const LEVEL = { beginner: "เริ่มต้น", intermediate: "ปานกลาง", advanced: "ขั้นสูง" };

async function initDashboard() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return (location.href = "login.html");

  $("logout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.href = "login.html";
  });

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.session.user.id).single();
  $("hello").textContent = `สวัสดี ${profile?.full_name || profile?.username || data.session.user.email}`;
  $("who").textContent = profile ? `@${profile.username}` : data.session.user.email;

  const { data: articles, error } = await supabase.from("articles").select("*").order("created_at", { ascending: false });
  if (error) return showMsg(thaiError(error));

  let current = profile?.interest && CATEGORY[profile.interest] ? profile.interest : "all";
  const chips = $("chips");
  const list = $("articles");

  function renderChips() {
    chips.replaceChildren();
    [["all", "ทั้งหมด"], ...Object.entries(CATEGORY)].forEach(([key, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (key === current ? " is-active" : "");
      b.textContent = label;
      b.setAttribute("aria-pressed", key === current);
      b.onclick = () => { current = key; renderChips(); renderList(); };
      chips.append(b);
    });
  }

  function renderList() {
    list.replaceChildren();
    const rows = articles.filter((a) => current === "all" || a.category === current);
    if (!rows.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "ยังไม่มีบทความในหมวดนี้";
      return list.append(p);
    }
    rows.forEach((a) => {
      const el = document.createElement("article");
      el.className = "item";
      const meta = document.createElement("p");
      meta.className = "meta";
      meta.textContent = `${CATEGORY[a.category]} • ${LEVEL[a.level]}`;
      const h = document.createElement("h3");
      h.textContent = a.title;
      const s = document.createElement("p");
      s.textContent = a.summary;
      el.append(meta, h, s);
      list.append(el);
    });
  }

  renderChips();
  renderList();
}

({ register: initRegister, login: initLogin, dashboard: initDashboard })[page]?.();
