import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const CATEGORY = { hardware: "ฮาร์ดแวร์", programming: "เขียนโปรแกรม", network: "เครือข่าย", security: "ความปลอดภัย", ai: "AI" };
const fmt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const fmtDay = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });

let users = [];

function showMsg(text) {
  $("msg").textContent = text;
  $("msg").className = "msg msg-error";
  $("msg").hidden = !text;
}

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function renderStats(o) {
  const items = [
    ["ผู้สมัครทั้งหมด", o.total],
    ["วันนี้", o.today],
    ["7 วันล่าสุด", o.last7],
    ["30 วันล่าสุด", o.last30],
    ["ยืนยันอีเมลแล้ว", o.confirmed],
  ];
  $("stats").replaceChildren(
    ...items.map(([label, n]) => {
      const box = el("div", undefined, "stat");
      box.append(el("p", Number(n).toLocaleString("th-TH"), "stat-n"), el("p", label, "stat-l"));
      return box;
    })
  );
}

function renderBars(days) {
  const max = Math.max(1, ...days.map((d) => d.count));
  $("bars").replaceChildren(
    ...days.map((d) => {
      const col = el("div", undefined, "bar-col");
      col.title = `${d.day}: ${d.count} คน`;
      const n = el("span", String(d.count), "bar-n");
      const bar = el("span", undefined, "bar");
      bar.style.height = `${(d.count / max) * 100}%`;
      const label = el("span", fmtDay.format(new Date(d.day + "T00:00:00Z")), "bar-l");
      col.append(n, bar, label);
      return col;
    })
  );
}

function renderInterests(map) {
  const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
  const rows = Object.keys(CATEGORY).map((k) => {
    const n = map[k] || 0;
    const row = el("div", undefined, "hrow");
    const track = el("span", undefined, "htrack");
    const fill = el("span", undefined, "hfill");
    fill.style.width = `${(n / total) * 100}%`;
    track.append(fill);
    row.append(el("span", CATEGORY[k], "hlabel"), track, el("span", String(n), "hn"));
    return row;
  });
  $("interests").replaceChildren(...rows);
}

function renderUsers() {
  $("rows").replaceChildren(
    ...users.map((u) => {
      const tr = document.createElement("tr");
      [
        u.full_name || "-",
        "@" + u.username,
        u.email,
        CATEGORY[u.interest] || u.interest,
        fmt.format(new Date(u.created_at)),
        u.last_sign_in_at ? fmt.format(new Date(u.last_sign_in_at)) : "ยังไม่เคย",
        u.confirmed ? "ยืนยันแล้ว" : "รอยืนยัน",
      ].forEach((t) => tr.append(el("td", t)));
      return tr;
    })
  );
  $("count").textContent = users.length ? `แสดง ${users.length} รายการ` : "ไม่พบรายชื่อ";
}

async function loadUsers(q = "") {
  const { data, error } = await supabase.rpc("admin_list_users", { p_search: q, p_limit: 200, p_offset: 0 });
  if (error) return showMsg("โหลดรายชื่อไม่สำเร็จ: " + error.message);
  users = data;
  renderUsers();
}

// ป้องกัน CSV/Excel formula injection
const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

function exportCsv() {
  const head = ["ชื่อ-นามสกุล", "ชื่อผู้ใช้", "อีเมล", "หมวดที่สนใจ", "สมัครเมื่อ", "เข้าล่าสุด", "ยืนยันอีเมล"];
  const lines = [head, ...users.map((u) => [u.full_name, u.username, u.email, u.interest, u.created_at, u.last_sign_in_at, u.confirmed])];
  const blob = new Blob(["\ufeff" + lines.map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `techhub-users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function init() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return (location.href = "login.html");

  $("logout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.href = "login.html";
  });

  // การตรวจสิทธิ์จริงอยู่ที่ฐานข้อมูล (is_admin) ข้อนี้แค่พาคนที่ไม่ใช่แอดมินออกจากหน้า
  const { data: ok } = await supabase.rpc("is_admin");
  if (!ok) return (location.href = "dashboard.html");

  const { data: overview, error } = await supabase.rpc("admin_overview");
  if (error) return showMsg("โหลดสรุปไม่สำเร็จ: " + error.message);
  renderStats(overview);
  renderBars(overview.by_day);
  renderInterests(overview.by_interest);
  await loadUsers();

  let t;
  $("search").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => loadUsers(e.target.value.trim()), 300);
  });
  $("export").addEventListener("click", exportCsv);
}

init();
