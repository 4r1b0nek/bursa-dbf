/**
 * app.js — antarmuka Bursa DBF.
 * Routing berbasis hash, render HTML string, tanpa framework.
 */
import * as DB from "./store.js";
import * as C from "./charts.js";
import * as Auth from "./auth.js";
import * as API from "./api.js";
import { parseDbf } from "./dbf.js";
import { parseAnalysisWorkbook } from "./excel.js";
import { renderHelp } from "./help.js";
import {
  esc, num, rupiah, compactRp, pct, pctRaw, signClass, dateID, bytes as fmtBytes,
  isNum, mean, clamp,
} from "./format.js";

/* ------------------------------------------------------------------ ikon */
const PATHS = {
  database: '<ellipse cx="12" cy="5" rx="7.5" ry="3"/><path d="M4.5 5v6.5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5"/><path d="M4.5 11.5V18c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6.5"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M7.5 15.5l3.5-4 3 2.5 4.5-6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  briefcase: '<rect x="3" y="7.5" width="18" height="12" rx="2.5"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7h7"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18.5h.01M12 18.5h.01M15.5 18.5h.01"/>',
  download: '<path d="M12 4v11"/><path d="M8 11.5l4 4 4-4"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 20V9"/><path d="M8 12.5l4-4 4 4"/><path d="M5 4.5h14"/>',
  folder: '<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.2l2 2h7.8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.2"/><path d="M20 5v6h-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.8h5V7"/><path d="M6.5 7l.9 12.2h9.2L17.5 7"/><path d="M10 11v4.5M14 11v4.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  arrow: '<path d="M5 12h13"/><path d="M13 6.5l5.5 5.5L13 17.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 6.5"/>',
  alert: '<path d="M12 4L3.5 19.5h17z"/><path d="M12 10v4.5"/><path d="M12 17.5h.01"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17.5l9 5 9-5"/>',
  file: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4"/><path d="M9 12h6M9 16h6"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  shield: '<path d="M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  coins: '<ellipse cx="9" cy="6.5" rx="5.5" ry="2.5"/><path d="M3.5 6.5v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4"/><path d="M3.5 10.5v4c0 1.4 2.5 2.5 5.5 2.5"/><path d="M14.5 11.5c2.8.2 5 1.2 5 2.5v4c0 1.4-2.5 2.5-5.5 2.5"/>',
  percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  award: '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5"/>',
  gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4.5-5"/><circle cx="12" cy="17" r="1.2"/>',
  wallet: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 9.5h17"/><circle cx="16.5" cy="14.5" r="1.2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/><path d="M18 14v5.5H4.5V6H10"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  power: '<path d="M12 3v9"/><path d="M6.5 6.5a8 8 0 1 0 11 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
};

const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] || ""}</svg>`;

/* ------------------------------------------------------------------ util UI */
const RATING_TONE = { Menarik: "pos", Netral: "warn", "Kurang menarik": "neg" };
const MODEL_LABEL = { bank: "Bank", cyclical: "Siklikal", utility: "Utilitas", insurer: "Asuransi", infra: "Infrastruktur" };

const ui = {
  view: "ringkasan",
  query: "",
  sector: "all",
  rating: "all",
  sortKey: "SKOR",
  sortDir: "desc",
  detail: null,
  dbTable: "SAHAM",
  showAll: false,
  portfolioUser: "all",
  helpSection: "manual",
  sim: null,
  txEditing: null,
  forceModal: false,
};

const mainEl = () => document.getElementById("main");
const authRoot = () => document.getElementById("auth-root");
const drawerRoot = () => document.getElementById("drawer-root");
const modalRoot = () => document.getElementById("modal-root");

const ratingChip = (rating) =>
  `<span class="chip ${RATING_TONE[rating] || "muted"}">${esc(rating || "—")}</span>`;

/** Ringkasan tanggal: harga terbaru dan tanggal analisis fundamental. */
function asOfLabel() {
  const price = DB.priceDate();
  const analysis = DB.dataAge();
  if (price && analysis && price !== analysis) {
    return `Harga per ${dateID(price)} · Fundamental per ${dateID(analysis)}`;
  }
  return `Data per ${dateID(price || analysis)}`;
}

function updateFooterNote() {
  const footNote = document.getElementById("foot-note");
  if (!footNote || !DB.state.manifest) return;
  footNote.textContent = `${asOfLabel()} · Sumber: ${DB.state.manifest.source}`;
}

const modelLine = (s) => {
  const label = MODEL_LABEL[s.MODEL] || s.MODEL;
  return s.SEKTOR && label && s.SEKTOR.toLowerCase() !== String(label).toLowerCase()
    ? `${s.SEKTOR} · ${label}`
    : s.SEKTOR || label || "";
};

const stars = (value) => {
  const full = clamp(Math.round(Number(value) || 0), 0, 5);
  return `<span class="stars" title="${full} dari 5">${"★".repeat(full)}${"☆".repeat(5 - full)}</span>`;
};

const kpi = (label, value, sub, iconName, tint) => `
  <div class="card kpi" style="--tint:${tint || "rgba(15,118,110,.12)"}">
    <div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-icon">${icon(iconName)}</span></div>
    <div class="kpi-value">${value}</div>
    <div class="kpi-sub">${sub}</div>
  </div>`;

const sectionHead = (title, sub, right = "") => `
  <div class="section-head">
    <div><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ""}</div>
    ${right}
  </div>`;

function toast(message, tone = "ok") {
  const root = document.getElementById("toast");
  if (!root) return;
  root.className = `toast show${tone === "err" ? " err" : ""}`;
  root.innerHTML = `${icon(tone === "err" ? "alert" : "check")}<span>${esc(message)}</span>`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => root.classList.remove("show"), 3800);
}

function emptyState(title, text, actionLabel, action) {
  return `<div class="empty">
    <div class="ic">${icon("database")}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
    ${actionLabel ? `<button class="btn btn-primary" data-action="${action}">${icon("plus")} ${esc(actionLabel)}</button>` : ""}
  </div>`;
}

/* ------------------------------------------------------------------ boot */
async function boot() {
  bindGlobal();
  window.addEventListener("hashchange", route);
  document.getElementById("foot-year").textContent = new Date().getFullYear();

  if (!DB.apiMode) {
    try {
      await DB.init();
    } catch (err) {
      console.error(err);
      mainEl().innerHTML = `<div class="card empty">
        <div class="ic">${icon("alert")}</div>
        <h3>Data DBF tidak dapat dimuat</h3>
        <p>${esc(err.message || String(err))}</p>
        <p class="small muted">Aplikasi ini membaca berkas <span class="mono">data/*.DBF</span> lewat HTTP.
        Jalankan server statis (<span class="mono">python -m http.server</span>) atau buka lewat GitHub Pages —
        membuka <span class="mono">index.html</span> langsung dari disk akan diblokir browser.</p>
      </div>`;
      return;
    }
    if (DB.state.autoRefreshed) {
      toast("Data .DBF terbaru dimuat dari server · transaksi tetap dipertahankan");
      DB.state.autoRefreshed = false;
    }
  }

  if (!Auth.currentUser()) {
    showLogin();
  } else {
    await startApp();
  }
  setInterval(() => {
    if (!Auth.currentUser() && !authRoot().childElementCount) {
      showLogin("Sesi berakhir. Silakan login kembali.");
    }
  }, 60000);
}

/* ------------------------------------------------------------------ auth UI */
function showLogin(message = "", tone = "error") {
  document.body.classList.add("auth-locked");
  const box = document.getElementById("user-box");
  if (box) box.hidden = true;
  for (const id of ["nav-database", "nav-admin", "download-dbf"]) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }
  authRoot().innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-brand">
          <span class="brand-mark" aria-hidden="true">${icon("database")}</span>
          <div><b>Bursa <span>DBF</span></b><small>Analisis saham BEI</small></div>
        </div>
        <h1>Masuk ke aplikasi</h1>
        <p class="auth-lede">Gunakan akun yang diberikan administrator. Sesi berlaku
        ${Auth.SESSION_HOURS} jam dan berakhir saat tab ditutup.</p>
        <div class="auth-error${message ? " show" : ""}${tone === "info" ? " notice" : ""}" id="login-error">${esc(message)}</div>
        <form id="login-form" autocomplete="on" novalidate>
          <div class="field">
            <label for="login-user">Username</label>
            <input id="login-user" name="username" autocomplete="username" autocapitalize="none" required>
          </div>
          <div class="field">
            <label for="login-pass">Password</label>
            <input id="login-pass" name="password" type="password" autocomplete="current-password" required>
          </div>
          <button class="btn btn-primary" type="submit" id="login-submit">${icon("arrow")} Masuk</button>
        </form>
        <div class="auth-lock">${icon("shield")} Akses terbatas · hubungi admin jika akun kedaluwarsa</div>
        <button class="btn btn-ghost" type="button" data-install-app hidden style="width:100%;margin-top:14px">
          ${icon("download")} Pasang aplikasi
        </button>
        <p class="auth-note">${DB.apiMode
          ? "Login diverifikasi oleh server Cloudflare D1. Token berlaku 8 jam dan tidak disimpan permanen."
          : "Aplikasi statis: login ini mengatur tampilan, bukan pengganti autentikasi server. Jangan gunakan password penting."}</p>
      </div>
    </div>`;
  const form = document.getElementById("login-form");
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const button = document.getElementById("login-submit");
    const error = document.getElementById("login-error");
    error.classList.remove("show");
    button.disabled = true;
    button.textContent = "Memeriksa…";
    try {
      const result = await Auth.login(form.username.value, form.password.value);
      if (!result.ok) {
        error.textContent = result.message;
        error.classList.add("show");
        return;
      }
      await startApp();
    } catch (err) {
      error.textContent = err.message || "Gagal login.";
      error.classList.add("show");
    } finally {
      button.disabled = false;
      button.innerHTML = `${icon("arrow")} Masuk`;
    }
  });
  setTimeout(() => document.getElementById("login-user")?.focus(), 50);
}

async function startApp() {
  const user = Auth.currentUser();
  if (!user) {
    showLogin("Sesi berakhir. Silakan login kembali.");
    return;
  }
  authRoot().innerHTML = "";
  document.body.classList.remove("auth-locked");
  applyRoleUI(user);

  if (String(user.MUSTCHG).toUpperCase() === "Y") {
    openChangePasswordModal({ forced: true });
    return;
  }

  try {
    if (DB.apiMode) {
      await DB.loadApi();
      await DB.loadLogBulan();
      if (Auth.isAdmin()) {
        await Auth.loadUsers();
        await DB.loadAdminPortfolios();
      } else {
        DB.clearAdminPortfolios();
      }
    }
    ui.sim = DB.simulationDefaults();
    route();
  } catch (err) {
    console.error(err);
    Auth.logout();
    showLogin(err.message || "Gagal memuat data dari server.");
  }
}

function applyRoleUI(user) {
  const admin = Auth.roleOf(user) === "ADMIN";
  const box = document.getElementById("user-box");
  if (box) box.hidden = false;
  const name = document.getElementById("user-name");
  const role = document.getElementById("user-role");
  const avatar = document.getElementById("user-avatar");
  if (name) name.textContent = user.NAMA || user.USERNAME;
  if (role) role.textContent = admin ? "Administrator" : "User";
  if (avatar) avatar.textContent = String(user.NAMA || user.USERNAME || "?").slice(0, 1).toUpperCase();
  const navDb = document.getElementById("nav-database");
  const navAdmin = document.getElementById("nav-admin");
  const download = document.getElementById("download-dbf");
  if (navDb) navDb.hidden = !admin || DB.apiMode;
  if (navAdmin) navAdmin.hidden = !admin;
  if (download) download.hidden = !admin || DB.apiMode;
}

function requireAdmin() {
  if (Auth.isAdmin()) return true;
  toast("Fitur ini hanya untuk administrator.", "err");
  return false;
}

function bindGlobal() {
  document.addEventListener("click", onClick);
  document.addEventListener("click", (e) => {
    const admin = document.getElementById("nav-admin");
    if (!admin?.open) return;
    if (e.target.closest?.(".nav-admin-menu a") || !admin.contains(e.target)) admin.open = false;
  });
  document.addEventListener("change", (e) => {
    const select = e.target.closest?.('[data-action="portfolio-filter"]');
    if (!select) return;
    ui.portfolioUser = select.value;
    render();
  });
  document.getElementById("skip-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    mainEl().focus({ preventScroll: true });
    mainEl().scrollIntoView({ block: "start" });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches?.('tr[data-action="open-stock"]')) {
        e.preventDefault();
        e.target.click();
      }
      return;
    }
    if (modalRoot().childElementCount) return closeModal();
    if (ui.detail) closeDrawer();
  });
  DB.subscribe(() => syncChrome());
}

/* ------------------------------------------------------------------ route */
function route() {
  if (!Auth.currentUser()) {
    showLogin("Sesi berakhir. Silakan login kembali.");
    return;
  }
  const raw = (location.hash || "#/ringkasan").replace(/^#\/?/, "");
  const [viewRaw, paramRaw] = raw.split("/");
  const view = ["ringkasan", "saham", "portofolio", "simulasi", "log-bulan", "bantuan", "database", "pengguna"].includes(viewRaw)
    ? viewRaw : "ringkasan";
  if (view === "simulasi") {
    location.hash = "#/bantuan/simulasi";
    return;
  }
  ui.helpSection = view === "bantuan" ? (paramRaw || "manual") : "manual";
  if (view === "database" && DB.apiMode) {
    location.hash = "#/ringkasan";
    return;
  }
  if ((view === "database" || view === "pengguna" || view === "log-bulan") && !Auth.isAdmin()) {
    toast("Halaman ini hanya untuk administrator.", "err");
    location.hash = "#/ringkasan";
    return;
  }
  ui.view = view;
  const detail = view === "saham" && paramRaw ? paramRaw.toUpperCase() : null;

  if (!detail) closeDrawer(false);
  render();
  if (detail) {
    ui.detail = detail;
    renderDrawer();
  }
  document.title = `${viewTitle(view)} · Bursa DBF`;
  window.scrollTo(0, 0);
}

function viewTitle(view) {
  return {
    ringkasan: "Ringkasan analisis",
    saham: "Analisis saham",
    portofolio: "Portofolio",
    simulasi: "Simulasi investasi",
    "log-bulan": "Riwayat upload data Excel",
    bantuan: "Bantuan",
    database: "Database DBF",
    pengguna: "Manajemen pengguna",
  }[view] || "Bursa DBF";
}

function render() {
  const views = {
    ringkasan: viewDashboard,
    saham: viewStocks,
    portofolio: viewPortfolio,
    simulasi: viewSimulation,
    "log-bulan": viewLogBulan,
    bantuan: viewHelp,
    database: viewDatabase,
    pengguna: viewUsers,
  };
  mainEl().innerHTML = (views[ui.view] || viewDashboard)();
  document.querySelectorAll(".nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === ui.view);
    if (a.dataset.nav === ui.view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const adminNav = document.getElementById("nav-admin");
  if (adminNav) {
    const adminView = ui.view === "log-bulan" || ui.view === "pengguna";
    adminNav.classList.toggle("active", adminView);
    adminNav.open = false;
  }
  syncChrome();
  updateFooterNote();
  afterRender();
}

function syncChrome() {
  const pill = document.getElementById("db-status");
  if (!pill) return;
  const n = DB.state.order.length;
  pill.classList.toggle("dirty", DB.state.dirty);
  pill.innerHTML = `<span class="dot"></span><span>${n} ${DB.apiMode ? "tabel D1" : "tabel DBF"}</span><span class="sep"></span>
    <span class="full">${DB.apiMode ? "tersambung" : DB.state.dirty ? "belum diekspor" : DB.state.folderName ? "folder aktif" : "siap"}</span>`;
  pill.title = DB.apiMode
    ? "Data dibaca dari Cloudflare D1 melalui API"
    : DB.state.dirty
      ? "Perubahan tersimpan di browser, belum ditulis ke berkas .DBF"
      : "Data DBF tersinkron dengan tampilan";
}

function refresh() {
  render();
  if (ui.detail) renderDrawer();
}

function afterRender() {
  if (ui.view === "saham") {
    const search = document.getElementById("stock-search");
    if (search) {
      search.value = ui.query;
      search.addEventListener("input", () => {
        ui.query = search.value;
        updateStockTable();
      });
    }
    const sector = document.getElementById("f-sector");
    if (sector) sector.addEventListener("change", () => { ui.sector = sector.value; updateStockTable(); });
    const rating = document.getElementById("f-rating");
    if (rating) rating.addEventListener("change", () => { ui.rating = rating.value; updateStockTable(); });
  }
  if (ui.view === "simulasi" || (ui.view === "bantuan" && ui.helpSection === "simulasi")) {
    const form = document.getElementById("sim-form");
    if (form) {
      form.addEventListener("input", onSimInput);
      form.addEventListener("change", onSimInput);
    }
  }
  if (ui.view === "database") {
    const input = document.getElementById("import-input");
    if (input) input.addEventListener("change", () => importFiles(input));
  }
  if (ui.view === "log-bulan") {
    const input = document.getElementById("log-upload-input");
    if (input) input.onchange = handleLogUpload;
  }
}

/* ------------------------------------------------------------------ dashboard */
function viewHelp() {
  if (ui.helpSection === "simulasi") return renderHelp("simulasi", viewSimulation());
  return renderHelp(ui.helpSection);
}

function viewDashboard() {
  const stocks = DB.stockList();
  if (!stocks.length) {
    return `<div class="card empty">
      <div class="ic">${icon("database")}</div><h3>Data saham kosong</h3>
      <p>${DB.apiMode ? "Muat ulang halaman atau hubungi administrator." : `Impor kembali <span class="mono">SAHAM.DBF</span> dari halaman Database.`}</p>
      ${DB.apiMode ? `<button class="btn btn-primary" data-action="reload-api">${icon("refresh")} Muat ulang</button>` : `<a class="btn btn-primary" href="#/database">${icon("database")} Buka database</a>`}</div>`;
  }
  const byScore = stocks.slice().sort((a, b) => b.SKOR - a.SKOR);
  const byMos = stocks.slice().sort((a, b) => b.MOS - a.MOS);
  const top = byScore[0];
  const bestYield = stocks.slice().sort((a, b) => b.DY - a.DY)[0];
  const avgMos = mean(stocks, (s) => s.MOS);
  const avgDy = mean(stocks, (s) => s.DY);
  const avgScore = mean(stocks, (s) => s.SKOR);
  const avgPayout = mean(stocks, (s) => s.PAYOUT);
  const below = stocks.filter((s) => s.MOS > 0).length;
  const priceDate = DB.priceDate();
  const meta = DB.state.manifest;

  const heroCard = `
    <aside class="hero-card" aria-label="Pilihan utama">
      <div>
        <div class="hc-top"><span class="hc-label">Skor tertinggi</span><span class="hc-code">${esc(top.KODE)}</span></div>
        <h3>${esc(top.NAMA)}</h3>
        <div class="hc-sector">${esc(modelLine(top))}</div>
        <div class="hc-score"><b>${num(top.SKOR, 1)}</b><span>dari 100<br>${esc(top.RATING)}</span></div>
        <div class="hc-spark">${C.sparkline(top.historik.map((h) => h.HARGA), { color: "#5eead4", width: 260, height: 46 })}</div>
      </div>
      <div class="hc-grid">
        <div><small>Harga</small><b>${num(top.HARGA, 0)}</b></div>
        <div><small>Nilai wajar</small><b>${num(top.FV, 0)}</b><em>${pct(top.MOS, 1, true)} MoS</em></div>
        <div><small>Yield</small><b>${pct(top.DY, 1)}</b><em>${num(top.PE, 2)}x PE</em></div>
      </div>
    </aside>`;

  const rankRows = byScore.map((s, i) => `
    <div class="rank-row">
      <span class="no">${String(i + 1).padStart(2, "0")}</span>
      <div class="who"><b>${esc(s.KODE)}</b><small>${esc(s.NAMA)}</small></div>
      ${C.scoreBar(s.SKOR)}
      ${ratingChip(s.RATING)}
    </div>`).join("");

  const mosRows = byMos.map((s) => `
    <div class="mos-item">
      <div class="info"><b>${esc(s.KODE)}</b><small>Rp${num(s.HARGA, 0)} → Rp${num(s.FV, 0)}</small></div>
      ${C.mosBar(s.MOS)}
    </div>`).join("");

  const thesis = byScore.slice(0, 3).map((s) => `
    <article class="card">
      <div class="between"><div class="wrap-gap">${ratingChip(s.RATING)}<span class="chip plain">${esc(MODEL_LABEL[s.MODEL] || s.MODEL)}</span></div>${stars(s.BINTANG)}</div>
      <h3 class="mt-2" style="font-size:15px">${esc(s.KODE)} — ${esc(s.NAMA)}</h3>
      <p class="small muted mt-1" style="line-height:1.65">${esc(s.RINGKASAN)}</p>
      <a class="btn btn-subtle btn-sm mt-3" href="#/saham/${esc(s.KODE)}">${icon("arrow")} Lembar analisis</a>
    </article>`).join("");

  return `
  <section class="hero">
    <div class="hero-copy">
      <div class="eyebrow">Riset ekuitas · harga ${priceDate ? dateID(priceDate) : "—"}</div>
      <h1>${stocks.length} saham. <em>Satu database</em> yang bisa dibawa.</h1>
      <p class="lede">Dashboard analisis fundamental, valuasi, dividen, dan portofolio untuk ${stocks.length} emiten BEI.
        ${DB.apiMode
          ? "Data dibaca dari <b>SQLite D1</b> melalui API terautentikasi — browser tidak menerima file database."
          : "Semua angka dibaca dari tabel <b>DBF</b> — format basis data yang bisa dibuka Excel, LibreOffice, atau Python."}</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#/saham">${icon("chart")} Lihat analisis</a>
        ${Auth.isAdmin() && !DB.apiMode ? `<a class="btn btn-ghost" href="#/database">${icon("database")} Struktur DBF</a>` : ""}
      </div>
      <div class="hero-meta">
        <span>${icon("layers")} ${DB.state.order.length} ${DB.apiMode ? "tabel D1" : "tabel DBF"}</span>
        <span>${icon("briefcase")} ${stocks.length} emiten</span>
        <span>${icon("clock")} Harga per ${priceDate ? dateID(priceDate) : "—"}</span>
      </div>
    </div>
    ${heroCard}
  </section>

  <section class="grid grid-4 section" aria-label="Indikator utama">
    ${kpi("Rata-rata MoS", pct(avgMos, 1, true), `<b>${below} dari ${stocks.length}</b> emiten di bawah nilai wajar`, "gauge", "rgba(15,118,110,.14)")}
    ${kpi("Dividend yield", pct(avgDy, 1), `Tertinggi <b>${esc(bestYield.KODE)}</b> ${pct(bestYield.DY, 1)}`, "coins", "rgba(180,83,9,.13)")}
    ${kpi("Skor rata-rata", num(avgScore, 1), `Top pick <b>${esc(top.KODE)}</b> ${num(top.SKOR, 1)}/100`, "award", "rgba(14,165,233,.13)")}
    ${kpi("Payout rata-rata", pct(avgPayout, 0), "Bagian laba TTM yang dibagikan", "percent", "rgba(139,92,246,.12)")}
  </section>

  <section class="section grid grid-2" style="align-items:start">
    <div class="card">
      <div class="card-head"><div><h3>Peringkat skor</h3><p>Bobot: fundamental 20%, valuasi 20%, dividen 25%, teknikal 10%, risiko 15%, prospek 10%.</p></div>${icon("award")}</div>
      <div class="rank-list">${rankRows}</div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Margin of safety</h3><p>Selisih nilai wajar model terhadap harga terakhir. Hijau = harga di bawah nilai wajar.</p></div>${icon("target")}</div>
      <div class="mos-list">${mosRows}</div>
      <p class="footnote">Rata-rata ${pct(avgMos, 1, true)} · ${below} dari ${stocks.length} emiten diperdagangkan di bawah nilai wajar model.</p>
    </div>
  </section>

  <section class="section card">
    <div class="card-head">
      <div><h3>Peta valuasi</h3><p>Sumbu X: dividend yield. Sumbu Y: margin of safety. Ukuran gelembung: skor total.</p></div>
      <div class="wrap-gap">
        <span class="chip pos">Menarik</span><span class="chip warn">Netral</span><span class="chip neg">Kurang menarik</span>
      </div>
    </div>
    <div class="chart-wrap">${C.valuationMap(stocks)}</div>
  </section>

  <section class="section">
    ${sectionHead("Tesis singkat", "Tiga emiten dengan skor tertinggi — klik untuk membaca analisis lengkap.",
      `<a class="link" href="#/saham">Semua emiten ${icon("arrow")}</a>`)}
    <div class="grid grid-3">${thesis}</div>
  </section>

  <section class="section grid grid-2">
    <div class="callout">${icon("info")}
      <div><b>Cara membaca.</b> Nilai wajar dihitung dari kombinasi DDM, PE wajar, dan PB wajar dengan bobot berbeda
      per model bisnis. MoS positif berarti harga pasar masih di bawah estimasi nilai wajar — bukan jaminan naik.
      <p>Yield memakai DPS tunai 12 bulan terakhir; payout di atas 100% perlu diperiksa terhadap arus kas.</p></div>
    </div>
    <div class="callout warn">${icon("alert")}
      <div><b>Bukan rekomendasi.</b> ${esc(DB.params().CATATAN || "Angka adalah estimasi model.")}
      <p>Sumber: ${esc(meta?.source || "—")}.</p></div>
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ saham */
function filteredStocks() {
  const q = ui.query.trim().toLowerCase();
  let list = DB.stockList();
  if (q) {
    list = list.filter((s) =>
      [s.KODE, s.NAMA, s.SEKTOR].some((v) => String(v || "").toLowerCase().includes(q)));
  }
  if (ui.sector !== "all") list = list.filter((s) => s.SEKTOR === ui.sector);
  if (ui.rating !== "all") list = list.filter((s) => s.RATING === ui.rating);
  const key = ui.sortKey;
  const dir = ui.sortDir === "asc" ? 1 : -1;
  list.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
  });
  return list;
}

function stockRowsHTML(list) {
  if (!list.length) {
    return `<tr><td colspan="11" class="muted center" style="padding:28px">Tidak ada emiten yang cocok dengan filter.</td></tr>`;
  }
  return list.map((s) => `
    <tr class="clickable" tabindex="0" data-action="open-stock" data-code="${esc(s.KODE)}">
      <td><div class="ticker"><b>${esc(s.KODE)}</b><small>${esc(s.NAMA)}</small></div></td>
      <td class="small muted nowrap">${esc(s.SEKTOR)}</td>
      <td class="num strong">${num(s.HARGA, 0)}</td>
      <td class="num">${num(s.FV, 0)}</td>
      <td>${C.mosBar(s.MOS)}</td>
      <td class="num ${signClass(s.DY)}">${pct(s.DY, 1)}</td>
      <td class="num">${num(s.PE, 2)}x</td>
      <td class="num">${num(s.PB, 2)}x</td>
      <td>${C.scoreBar(s.SKOR)}</td>
      <td>${ratingChip(s.RATING)}</td>
      <td class="chev">›</td>
    </tr>`).join("");
}

function updateStockTable() {
  const body = document.getElementById("stock-rows");
  if (!body) return;
  const list = filteredStocks();
  body.innerHTML = stockRowsHTML(list);
  const count = document.getElementById("stock-count");
  if (count) count.textContent = `${list.length} dari ${DB.stockList().length} emiten`;
}

function viewStocks() {
  const stocks = DB.stockList();
  const sectors = [...new Set(stocks.map((s) => s.SEKTOR))].sort((a, b) => a.localeCompare(b));
  const ratings = ["Menarik", "Netral", "Kurang menarik"].filter((r) => stocks.some((s) => s.RATING === r));
  const list = filteredStocks();
  const arrow = (key) => ui.sortKey === key ? `<span class="arrow">${ui.sortDir === "asc" ? "▲" : "▼"}</span>` : "";
  const th = (key, label, numCol = false) =>
    `<th class="${numCol ? "num " : ""}sortable" data-action="sort" data-key="${key}" title="Urutkan">${label}${arrow(key)}</th>`;

  return `
  ${sectionHead("Analisis saham", "Klik baris untuk membuka lembar analisis: valuasi, skenario, teknikal, dan dividen.",
    `<span class="chip brand">${DB.state.order.length} ${DB.apiMode ? "tabel D1" : "tabel DBF"}</span>`)}
  <div class="toolbar">
    <div class="search">${icon("search")}<input id="stock-search" type="search" placeholder="Cari kode, nama, sektor…" aria-label="Cari saham"></div>
    <select class="control" id="f-sector" aria-label="Filter sektor">
      <option value="all">Semua sektor</option>
      ${sectors.map((s) => `<option value="${esc(s)}" ${ui.sector === s ? "selected" : ""}>${esc(s)}</option>`).join("")}
    </select>
    <select class="control" id="f-rating" aria-label="Filter rating">
      <option value="all">Semua rating</option>
      ${ratings.map((r) => `<option value="${esc(r)}" ${ui.rating === r ? "selected" : ""}>${esc(r)}</option>`).join("")}
    </select>
    <span class="count" id="stock-count">${list.length} dari ${stocks.length} emiten</span>
    <div class="grow"></div>
    ${Auth.isAdmin() ? (DB.apiMode
      ? `<button class="btn btn-primary btn-sm" data-action="price-refresh">${icon("refresh")} Update harga (Yahoo)</button>
         <button class="btn btn-ghost btn-sm" data-action="price-editor">${icon("edit")} Input manual</button>`
      : `<button class="btn btn-ghost btn-sm" data-action="price-editor">${icon("edit")} Update harga</button>`) : ""}
    ${Auth.isAdmin() && !DB.apiMode ? `<button class="btn btn-ghost btn-sm" data-action="export-all">${icon("download")} Unduh DBF</button>` : ""}
  </div>

  <div class="card flush">
    <div class="table-wrap">
      <table class="data">
        <thead><tr>
          ${th("KODE", "Emiten")}${th("SEKTOR", "Sektor")}${th("HARGA", "Harga", true)}${th("FV", "Nilai wajar", true)}
          ${th("MOS", "MoS")}${th("DY", "Yield", true)}${th("PE", "PE", true)}${th("PB", "PB", true)}
          ${th("SKOR", "Skor")}${th("RATING", "Rating")}<th></th>
        </tr></thead>
        <tbody id="stock-rows">${stockRowsHTML(list)}</tbody>
      </table>
    </div>
  </div>
  <p class="table-hint">Geser tabel ke samping untuk melihat kolom lain.</p>
  <p class="footnote">Harga per ${dateID(DB.priceDate())}${DB.priceSource() ? ` · ${esc(DB.priceSource())}` : ""}. Nilai wajar = estimasi model, bukan target harga.
  Skor 0–100 dihitung dari enam faktor dengan bobot yang tertera pada kartu peringkat.</p>`;
}

/* ------------------------------------------------------------------ drawer */
function aggregateDividends(rows) {
  const map = new Map();
  for (const r of rows) map.set(r.TAHUN, (map.get(r.TAHUN) || 0) + (Number(r.DPS) || 0));
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([TAHUN, DPS]) => ({ TAHUN, DPS }));
}

function divCagr(series) {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  const span = last.TAHUN - first.TAHUN;
  if (span <= 0 || first.DPS <= 0) return null;
  return Math.pow(last.DPS / first.DPS, 1 / span) - 1;
}

function kvRow(label, value, cls = "") {
  return `<div class="kv-row"><span>${label}</span><b class="${cls}">${value}</b></div>`;
}

function metric(label, value, sub = "") {
  return `<div class="metric"><small>${label}</small><b>${value}</b>${sub ? `<em>${sub}</em>` : ""}</div>`;
}

function renderDrawer() {
  const s = DB.stockByCode(ui.detail);
  if (!s) {
    closeDrawer(false);
    return;
  }
  const v = s.valuasi || {};
  const t = s.teknikal || {};
  const sk = s.skor || {};
  const scoreKeys = ["FUND", "VAL", "DIV", "TECH", "RISK", "PROS"];
  const hasScoreFactors = scoreKeys.some((key) => isNum(sk[key]));
  const divs = aggregateDividends(s.dividen);
  const cagr = divCagr(divs);
  const tone = RATING_TONE[s.RATING] || "pos";

  const body = `
    <div class="price-band">
      <div class="now">
        <small>Harga terakhir</small>
        <b>${rupiah(s.HARGA)}</b>
        <span class="small muted">Yield ${pct(s.DY, 1)} · Payout ${pct(s.PAYOUT, 1)} · ${esc(MODEL_LABEL[s.MODEL] || s.MODEL)}</span>
      </div>
      <div class="fv">
        <small>Nilai wajar model</small>
        <b>${rupiah(s.FV)}</b>
        <em><span class="chip ${s.MOS > 0 ? "pos" : "neg"}">MoS ${pct(s.MOS, 1, true)}</span>
        ${isNum(v.FV_LO) ? ` · rentang ${num(v.FV_LO, 0)}–${num(v.FV_HI, 0)}` : ""}</em>
      </div>
    </div>

    <div class="dsec">
      <div class="dsec-title">Tesis · analisis ${dateID(DB.dataAge())}</div>
      <p class="thesis">${esc(s.RINGKASAN)}</p>
      <div class="wrap-gap mt-2">
        <span class="chip ${tone}">${esc(s.RATING)}</span>
        <span class="chip plain">${esc(s.KEPUTUSAN)}</span>
        ${stars(s.BINTANG)}
      </div>
    </div>

    <div class="metric-grid mt-3">
      ${metric("PE", `${num(s.PE, 2)}x`, `avg ${num(s.PEAVG5, 2)}x`)}
      ${metric("PB", `${num(s.PB, 2)}x`, `avg ${num(s.PBAVG5, 2)}x`)}
      ${metric("ROE", isNum(s.ROE) ? `${num(s.ROE, 1)}%` : "—", `ROA ${isNum(s.ROA) ? `${num(s.ROA, 1)}%` : "—"}`)}
      ${metric("Payout", isNum(s.PAYOUT) ? pct(s.PAYOUT, 0) : "—", "dari EPS TTM")}
      ${metric("EV/EBITDA", isNum(s.EVEBITDA) ? `${num(s.EVEBITDA, 2)}x` : "—", "enterprise value")}
      ${metric("DER", isNum(s.DER) ? num(s.DER, 2) : "—", "utang / ekuitas")}
      ${metric("RSI(14)", num(t.RSI14, 1), t.RSI14 < 30 ? "oversold" : t.RSI14 > 70 ? "overbought" : "netral")}
      ${metric("ATR", `${num(t.ATR, 0)}`, `${num(t.ATRPCT, 2)}% harga`)}
    </div>

    <div class="dsec">
      <div class="dsec-title">Valuasi</div>
      <div class="two-col">
        <div class="kv">
          ${kvRow("Bobot model", esc(v.BOBOT || "—"))}
          ${kvRow("DDM", v.DDM ? rupiah(v.DDM) : "—")}
          ${kvRow("PE wajar", v.PEFAIR ? `${num(v.PEFAIR, 1)}x → ${rupiah(v.PEVALUE)}` : "—")}
          ${kvRow("PB wajar", isNum(v.PBF) ? `${num(v.PBF, 2)}x → ${rupiah(v.PBVALUE)}` : "—")}
          ${kvRow("Nilai wajar", rupiah(s.FV))}
          ${kvRow("Margin of safety", pct(s.MOS, 1, true), s.MOS > 0 ? "pos" : "neg")}
        </div>
        <div>${hasScoreFactors ? C.radar(sk) : `<div class="chart-empty" style="padding:40px 10px;text-align:center">Skor faktor belum tersedia.<br><span class="small muted">Lengkapi sheet Skor di Excel.</span></div>`}</div>
      </div>
    </div>

    <div class="dsec">
      <div class="dsec-title">Skenario 1–5 tahun</div>
      <div class="chart-wrap">${C.scenarioChart(scenarioFromRow(v), s.HARGA)}</div>
      <div class="legend">
        <span><i style="background:#047857"></i>Bull</span>
        <span><i style="background:#0f766e"></i>Base</span>
        <span><i style="background:#be123c"></i>Bear</span>
        <span><i style="background:#0b1526"></i>Harga sekarang</span>
      </div>
    </div>

    <div class="dsec">
      <div class="dsec-title">Teknikal</div>
      <div class="chart-wrap">${C.priceChart(s.historik)}</div>
      <div class="two-col mt-2">
        <div class="kv">
          ${kvRow("MA20", `${num(t.MA20, 0)} <span class="small ${signClass(t.DISTMA20)}">${pctRaw(t.DISTMA20, 1, true)}</span>`)}
          ${kvRow("MA50", `${num(t.MA50, 0)} <span class="small ${signClass(t.DISTMA50)}">${pctRaw(t.DISTMA50, 1, true)}</span>`)}
          ${kvRow("MA200", `${num(t.MA200, 0)} <span class="small ${signClass(t.DISTMA200)}">${pctRaw(t.DISTMA200, 1, true)}</span>`)}
        </div>
        <div class="kv">
          ${kvRow("MACD", `${num(t.MACD, 2)} / ${num(t.MACDSIG, 2)}`)}
          ${kvRow("Histogram", num(t.MACDHIST, 2), t.MACDHIST >= 0 ? "pos" : "neg")}
          ${kvRow("Rentang 52 pekan", `${num(t.LO52, 0)} – ${num(t.HI52, 0)}`)}
        </div>
      </div>
    </div>

    <div class="dsec">
      <div class="dsec-title">Dividen</div>
      <div class="chart-wrap">${C.dividendChart(s.dividen)}</div>
      <div class="two-col mt-2">
        <div class="kv">
          ${kvRow("DPS 12 bulan", rupiah(s.DPS, 2))}
          ${kvRow("Dividend yield", pct(s.DY, 1))}
        </div>
        <div class="kv">
          ${kvRow("Payout", pct(s.PAYOUT, 1))}
          ${kvRow("CAGR dividen", cagr !== null ? pct(cagr, 1, true) : "—")}
        </div>
      </div>
    </div>

    <div class="dsec">
      <div class="dsec-title">Level harga</div>
      <div class="levels">
        <div class="level"><small>Akumulasi</small><b>${esc(s.LEVEL_AKUM || "—")}</b></div>
        <div class="level buy"><small>Beli</small><b>${esc(s.LEVEL_BUY || "—")}</b></div>
        <div class="level"><small>Target</small><b>${esc(s.TARGET || "—")}</b></div>
        <div class="level stop"><small>Cut loss</small><b>${isNum(s.CUTLOSS) ? num(s.CUTLOSS, 0) : "—"}</b></div>
      </div>
      <p class="footnote">Level adalah area yang dibahas pada riset, bukan instruksi transaksi.
      Analisis per ${dateID(DB.dataAge())}; harga per ${dateID(DB.priceDate())}.</p>
    </div>

    <div class="flex mt-4" style="gap:8px">
      <button class="btn btn-primary" data-action="tx-add" data-code="${esc(s.KODE)}">${icon("plus")} Tambah transaksi</button>
      <button class="btn btn-ghost" data-action="close-drawer">Tutup</button>
    </div>`;

  drawerRoot().innerHTML = `
    <div class="drawer-overlay" data-action="close-drawer"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="Analisis ${esc(s.KODE)}">
      <header class="drawer-head">
        <div class="who">
          <div class="kicker">${esc(s.KODE)} · ${esc(s.SEKTOR)}</div>
          <h2>${esc(s.NAMA)}</h2>
          <div class="sub">Skor ${num(s.SKOR, 1)}/100 · ${esc(s.RATING)} · analisis ${dateID(DB.dataAge())} · harga ${dateID(DB.priceDate())}</div>
        </div>
        <button class="drawer-close" data-action="close-drawer" aria-label="Tutup">${icon("x")}</button>
      </header>
      <div class="drawer-body">${body}</div>
    </aside>`;
  document.body.classList.add("no-scroll");
  const close = drawerRoot().querySelector(".drawer-close");
  if (close) setTimeout(() => close.focus({ preventScroll: true }), 60);
}

function scenarioFromRow(v) {
  return {
    bull: { 1: v.BULL1, 3: v.BULL3, 5: v.BULL5 },
    base: { 1: v.BASE1, 3: v.BASE3, 5: v.BASE5 },
    bear: { 1: v.BEAR1, 3: v.BEAR3, 5: v.BEAR5 },
  };
}

function closeDrawer(updateHash = true) {
  drawerRoot().innerHTML = "";
  ui.detail = null;
  if (document.getElementById("modal-root").childElementCount === 0) {
    document.body.classList.remove("no-scroll");
  }
  if (updateHash && location.hash.startsWith("#/saham/")) {
    history.replaceState(null, "", "#/saham");
    render();
  }
}

/* ------------------------------------------------------------------ portofolio */
function portfolioUserFilter(users, value) {
  return `<div class="wrap-gap">
    <label class="field" style="margin:0;min-width:220px">
      <span>Filter user</span>
      <select id="portfolio-user-filter" data-action="portfolio-filter">
        <option value="all" ${value === "all" ? "selected" : ""}>Semua user</option>
        ${users.map((u) => `<option value="${u.id}" ${String(u.id) === String(value) ? "selected" : ""}>${esc(u.name)} (${esc(u.username)})</option>`).join("")}
      </select>
    </label>
    <button class="btn btn-ghost btn-sm" data-action="portfolio-refresh">${icon("refresh")} Muat ulang</button>
  </div>`;
}

function viewAdminPortfolioSummary() {
  const users = DB.state.adminUsers || [];
  const rows = users.map((u) => {
    const p = DB.computePortfolio(DB.adminTransactionsFor(u.id));
    return { user: u, p };
  });
  const totalValue = rows.reduce((a, r) => a + r.p.totals.value, 0);
  const totalCost = rows.reduce((a, r) => a + r.p.totals.cost, 0);
  const totalPnl = totalValue - totalCost;
  const tableRows = rows.map(({ user, p }) => `<tr>
    <td><div class="who"><b>${esc(user.name)}</b><small>${esc(user.username)} · ${esc(user.role)}</small></div></td>
    <td class="num">${p.positions.length}</td>
    <td class="num">${p.transactions.length}</td>
    <td class="num strong">${compactRp(p.totals.value)}</td>
    <td class="num">${compactRp(p.totals.cost)}</td>
    <td class="num ${signClass(p.totals.pnl)}">${compactRp(p.totals.pnl)}<div class="tiny">${pct(p.totals.pnlPct, 1, true)}</div></td>
    <td class="num">${compactRp(p.totals.dividend)}</td>
  </tr>`).join("");

  return `
  ${sectionHead("Portofolio semua user",
    "Admin dapat melihat seluruh portofolio user. Perubahan transaksi hanya dapat dilakukan oleh user pemiliknya.",
    portfolioUserFilter(users, "all"))}
  <div class="auth-banner">${icon("shield")}
    <div><b>Mode baca-saja.</b> Admin tidak dapat menambah, mengubah, atau menghapus transaksi portofolio siapa pun.</div>
  </div>
  <section class="grid grid-4 section">
    ${kpi("Total nilai pasar", compactRp(totalValue), `${rows.filter((r) => r.p.positions.length).length} user berposisi`, "wallet", "rgba(15,118,110,.14)")}
    ${kpi("Total modal", compactRp(totalCost), `${users.length} akun`, "coins", "rgba(14,165,233,.12)")}
    ${kpi("Laba/rugi", compactRp(totalPnl), pct(totalCost ? totalPnl / totalCost : null, 1, true), "chart", "rgba(4,120,87,.14)")}
    ${kpi("Total transaksi", num(rows.reduce((a, r) => a + r.p.transactions.length, 0), 0), "Seluruh user", "layers", "rgba(180,83,9,.13)")}
  </section>
  <div class="card flush">
    <div class="card-head" style="padding:18px 20px 0">
      <div><h3>Ringkasan per user</h3><p>Pilih user pada filter untuk melihat rincian portofolionya.</p></div>
      <span class="chip brand">READ-ONLY</span>
    </div>
    <div class="table-wrap mt-2">
      <table class="data">
        <thead><tr><th>User</th><th class="num">Posisi</th><th class="num">Transaksi</th><th class="num">Nilai</th><th class="num">Modal</th><th class="num">P/L</th><th class="num">Dividen</th></tr></thead>
        <tbody>${tableRows || `<tr><td colspan="7" class="muted center" style="padding:28px">Belum ada user.</td></tr>`}</tbody>
      </table>
    </div>
  </div>`;
}

function viewPortfolio() {
  const adminView = Auth.isAdmin() && DB.apiMode;
  const filter = adminView ? String(ui.portfolioUser || "all") : "me";
  const users = adminView ? (DB.state.adminUsers || []) : [];
  const selectedUser = adminView && filter !== "all"
    ? users.find((u) => String(u.id) === String(filter))
    : null;
  if (adminView && filter !== "all" && !selectedUser) {
    ui.portfolioUser = "all";
    return viewAdminPortfolioSummary();
  }
  if (adminView && !selectedUser) return viewAdminPortfolioSummary();

  const sourceTx = adminView
    ? DB.adminTransactionsFor(selectedUser.id)
    : DB.rows("TRANSAKSI");
  const p = DB.computePortfolio(sourceTx);
  const readOnly = adminView;
  const hasPositions = p.positions.length > 0;
  const soldOut = !hasPositions && p.transactions.length > 0;
  const colors = C.DONUT_COLORS;
  const donutItems = p.positions.map((pos, i) => ({ label: pos.code, value: pos.value, color: colors[i % colors.length] }));

  const kpis = `
    <section class="grid grid-4 section" aria-label="Ringkasan portofolio">
      ${kpi("Nilai pasar", compactRp(p.totals.value), `${p.positions.length} posisi aktif`, "wallet", "rgba(15,118,110,.14)")}
      ${kpi("Modal disetor", compactRp(p.totals.cost), `${p.txCount} transaksi`, "coins", "rgba(14,165,233,.12)")}
      ${kpi("Laba/rugi unrealized", `${p.totals.pnl > 0 ? "+" : ""}${compactRp(p.totals.pnl)}`,
        `<span class="${signClass(p.totals.pnl)}">${pct(p.totals.pnlPct, 1, true)}</span> · realisasi ${compactRp(p.realized)}`,
        "chart", "rgba(4,120,87,.14)")}
      ${kpi("Dividen per tahun", compactRp(p.totals.dividend), `Yield on cost ${pct(p.totals.yieldOnCost, 1)}`, "percent", "rgba(180,83,9,.13)")}
    </section>`;

  const holdings = !hasPositions
    ? `<div class="card">${emptyState(
        readOnly ? "Belum ada portofolio" : soldOut ? "Semua posisi sudah ditutup" : "Portofolio masih kosong",
        readOnly ? "User ini belum memiliki transaksi portofolio."
                 : soldOut ? "Transaksi jual tercatat, tetapi tidak ada lot tersisa. Tambahkan pembelian baru untuk memulai posisi."
                 : "Catat transaksi beli pertama Anda. Perhitungan memakai metode biaya rata-rata dan lot 100 lembar.",
        readOnly ? "" : "Tambah transaksi", "tx-add")}</div>`
    : `<div class="card flush">
        <div class="card-head" style="padding:18px 20px 0">
          <div><h3>Kepemilikan</h3><p>Harga pasar dari tabel SAHAM · biaya rata-rata termasuk fee beli.</p></div>
          <span class="chip brand">${p.positions.length} posisi</span>
        </div>
        <div class="table-wrap mt-2">
          <table class="data">
            <thead><tr><th>Saham</th><th class="num">Lot</th><th class="num">Avg</th><th class="num">Harga</th>
            <th class="num">Nilai</th><th class="num">P/L</th><th class="num">Bobot</th><th class="num">Dividen/thn</th></tr></thead>
            <tbody>
              ${p.positions.map((pos) => `
                <tr>
                  <td><div class="ticker"><b>${esc(pos.code)}</b><small>${esc(pos.name)}</small></div></td>
                  <td class="num">${num(pos.lots, 0)}</td>
                  <td class="num">${num(pos.avg, 0)}</td>
                  <td class="num">${num(pos.price, 0)}</td>
                  <td class="num strong">${compactRp(pos.value)}</td>
                  <td class="num ${signClass(pos.pnl)}">${compactRp(pos.pnl)}<div class="tiny">${pct(pos.pnlPct, 1, true)}</div></td>
                  <td class="num">${pct(pos.weight, 1)}</td>
                  <td class="num">${compactRp(pos.dividend)}</td>
                </tr>`).join("")}
            </tbody>
            <tfoot>
              <tr class="strong">
                <td>Total</td><td class="num">${num(p.positions.reduce((a, x) => a + x.lots, 0), 0)}</td>
                <td></td><td></td><td class="num">${compactRp(p.totals.value)}</td>
                <td class="num ${signClass(p.totals.pnl)}">${compactRp(p.totals.pnl)}</td>
                <td class="num">100%</td><td class="num">${compactRp(p.totals.dividend)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="table-hint">Geser tabel ke samping untuk melihat kolom lain.</p>
        <p class="footnote" style="padding:0 20px 14px">Harga pasar memakai harga terakhir ${dateID(DB.priceDate())}${DB.priceSource() ? ` · ${esc(DB.priceSource())}` : ""}; biaya rata-rata sudah termasuk fee beli.
        Dividen memakai DPS 12 bulan terakhir dari tabel SAHAM.</p>
      </div>`;

  const allocation = hasPositions
    ? `<div class="card">
        <div class="card-head"><div><h3>Alokasi</h3><p>Berdasarkan nilai pasar saat ini.</p></div></div>
        <div style="display:flex;justify-content:center">${C.donut(donutItems, { total: p.totals.value })}</div>
        <div class="legend" style="margin-top:14px">
          ${donutItems.map((d, i) => `<span><i style="background:${d.color}"></i>${esc(d.label)} · ${pct(p.positions[i].weight, 1)}</span>`).join("")}
        </div>
      </div>`
    : `<div class="card">${emptyState("Belum ada alokasi", "Alokasi muncul setelah ada posisi aktif.", "", "")}</div>`;

  const txRows = p.transactions.length
    ? p.transactions.map((tx) => {
        const gross = (Number(tx.LOT) || 0) * 100 * (Number(tx.HARGA) || 0);
        const total = String(tx.JENIS).toUpperCase() === "JUAL" ? gross - (Number(tx.FEE) || 0) : gross + (Number(tx.FEE) || 0);
        const isBuy = String(tx.JENIS).toUpperCase() !== "JUAL";
        return `<tr>
          <td class="nowrap">${dateID(tx.TANGGAL)}</td>
          <td class="mono strong">${esc(tx.KODE)}</td>
          <td><span class="chip ${isBuy ? "pos" : "neg"}">${esc(tx.JENIS)}</span></td>
          <td class="num">${num(tx.LOT, 0)}</td>
          <td class="num">${num(tx.HARGA, 0)}</td>
          <td class="num">${num(tx.FEE, 0)}</td>
          <td class="num strong">${rupiah(total)}</td>
          <td class="small muted preview-cell" title="${esc(tx.CATATAN || "")}">${esc(tx.CATATAN || "—")}</td>
          <td class="num nowrap">
            ${readOnly ? `<span class="small muted">—</span>` : `
            <button class="btn btn-ghost btn-icon btn-sm" data-action="tx-edit" data-index="${tx._index}" aria-label="Ubah transaksi">${icon("edit")}</button>
            <button class="btn btn-ghost btn-icon btn-sm" data-action="tx-del" data-index="${tx._index}" aria-label="Hapus transaksi">${icon("trash")}</button>`}
          </td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="9" class="muted center" style="padding:28px">${readOnly ? "User ini belum memiliki transaksi." : "Belum ada transaksi. Catat pembelian pertama Anda."}</td></tr>`;

  const title = adminView ? "Portofolio user" : "Portofolio";
  const subtitle = adminView
    ? `Portofolio ${esc(selectedUser.name)} (${esc(selectedUser.username)}) · hanya baca. Filter user untuk berpindah portofolio.`
    : DB.apiMode
      ? "Dihitung dari jurnal transaksi Anda di D1 dengan metode biaya rata-rata (1 lot = 100 lembar)."
      : "Dihitung dari tabel TRANSAKSI.DBF dengan metode biaya rata-rata (1 lot = 100 lembar).";
  const actions = adminView
    ? portfolioUserFilter(users, filter)
    : `<div class="wrap-gap">
      <button class="btn btn-primary" data-action="tx-add">${icon("plus")} Tambah transaksi</button>
      ${Auth.isAdmin() && !DB.apiMode ? `<button class="btn btn-ghost" data-action="export-table" data-name="TRANSAKSI">${icon("download")} TRANSAKSI.DBF</button>` : ""}
    </div>`;

  return `
  ${sectionHead(title, subtitle, actions)}
  ${kpis}
  <section class="grid grid-2-1">
    ${holdings}
    ${allocation}
  </section>

  <section class="card flush section">
    <div class="card-head" style="padding:18px 20px 0">
      <div><h3>Jurnal transaksi</h3><p>${p.transactions.length} baris tersimpan ${DB.apiMode ? "di D1" : "di TRANSAKSI.DBF"}${DB.state.dirty ? " · ada perubahan lokal" : ""}.</p></div>
      ${readOnly ? `<span class="chip brand">READ-ONLY</span>` : `<button class="btn btn-ghost btn-sm" data-action="tx-clear">${icon("trash")} Hapus semua</button>`}
    </div>
    <div class="table-wrap mt-2">
      <table class="data">
        <thead><tr><th>Tanggal</th><th>Saham</th><th>Jenis</th><th class="num">Lot</th><th class="num">Harga</th>
        <th class="num">Fee</th><th class="num">Total</th><th>Catatan</th><th class="num">Aksi</th></tr></thead>
        <tbody>${txRows}</tbody>
      </table>
    </div>
    <p class="table-hint" style="padding:0 20px">Geser tabel ke samping untuk melihat kolom lain.</p>
  </section>

  <div class="callout mt-3">${icon("database")}
    <div><b>Penyimpanan.</b> ${readOnly
      ? "Mode admin: portofolio user hanya dapat dilihat. Hanya user pemilik akun yang dapat menambah, mengubah, atau menghapus transaksi."
      : DB.apiMode
        ? "Transaksi disimpan di Cloudflare D1 atas nama akun Anda dan langsung tersedia di perangkat lain."
        : `Setiap perubahan langsung disimpan di penyimpanan browser agar tidak hilang saat dimuat ulang.
           ${Auth.isAdmin()
             ? `Agar berkas <span class="mono">TRANSAKSI.DBF</span> ikut berubah, gunakan <b>Unduh .DBF</b> atau
                <a href="#/database">Simpan ke folder</a> di halaman Database.`
             : "Hubungi administrator untuk menyimpan perubahan ini ke berkas DBF."}`}</div>
  </div>`;
}

/* ------------------------------------------------------------------ log bulanan */
function viewLogBulan() {
  if (!DB.apiMode) {
    return `<div class="card">${emptyState("Log bulanan tersedia di mode D1",
      "Buka aplikasi tanpa ?mode=dbf untuk memakai log analisis dari Cloudflare D1.", "", "")}</div>`;
  }
  const rows = (DB.state.logBulan || []).slice()
    .sort((a, b) => String(b.BULAN).localeCompare(String(a.BULAN)));
  const latest = rows[0];
  const actions = Auth.isAdmin()
    ? `<div class="wrap-gap">
        <button class="btn btn-primary" data-action="log-upload">${icon("database")} Upload Data</button>
        <input id="log-upload-input" type="file" accept=".xlsx,.xls" hidden>
      </div>`
    : "";
  const kpis = latest
    ? `<section class="grid grid-4 section">
        ${kpi("IHSG", num(latest.IHSG, 2), dateID(latest.TGL), "chart", "rgba(15,118,110,.14)")}
        ${kpi("Dividend yield", `${num(latest.YIELD, 2)}%`, `Rata-rata ${DB.rows("SAHAM").length} emiten`, "percent", "rgba(14,165,233,.12)")}
        ${kpi("Margin of safety", `${num(latest.MOS, 2)}%`, "Rata-rata", "shield", "rgba(4,120,87,.14)")}
        ${kpi("Skor analisis", num(latest.SKOR, 1), `${num(latest.JML_MURAH, 0)} murah · ${num(latest.JML_BUY, 0)} buy`, "layers", "rgba(180,83,9,.13)")}
      </section>`
    : "";
  const tableRows = rows.map((row) => `<tr>
    <td class="mono strong">${esc(row.BULAN)}</td>
    <td class="nowrap">${row.TGL ? dateID(row.TGL) : "—"}</td>
    <td class="num">${num(row.IHSG, 2)}</td>
    <td class="num">${num(row.YIELD, 2)}%</td>
    <td class="num">${num(row.MOS, 2)}%</td>
    <td class="num">${num(row.JML_MURAH, 0)}</td>
    <td class="num">${num(row.JML_BUY, 0)}</td>
    <td class="num">${num(row.SKOR, 1)}</td>
    <td class="small muted">${esc(row.CATATAN || "—")}</td>
    <td class="nowrap muted">${row.CREATED_AT ? dateID(row.CREATED_AT) : "—"}</td>
  </tr>`).join("");

  return `
  ${sectionHead("Riwayat upload data Excel",
    "Setiap unggahan Excel Dashboard memperbarui data saham dan mencatat log bulanannya. Admin dapat mengunggah; semua user dapat melihat.",
    actions)}
  ${kpis}
  <div class="card flush">
    <div class="card-head" style="padding:18px 20px 0">
      <div><h3>Data unggahan</h3><p>${rows.length} unggahan tersimpan di D1.</p></div>
      <span class="chip brand">${Auth.isAdmin() ? "ADMIN UPLOAD" : "READ-ONLY"}</span>
    </div>
    <div class="table-wrap mt-2">
      <table class="data">
        <thead><tr><th>Bulan</th><th>Tanggal</th><th class="num">IHSG</th><th class="num">Yield</th><th class="num">MoS</th>
        <th class="num">Murah</th><th class="num">Buy</th><th class="num">Skor</th><th>Catatan</th><th>Diunggah</th></tr></thead>
        <tbody>${tableRows || `<tr><td colspan="10" class="muted center" style="padding:28px">Belum ada data unggahan.</td></tr>`}</tbody>
      </table>
    </div>
  </div>`;
}

async function handleLogUpload(event) {
  const input = event.target;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    const analysis = parseAnalysisWorkbook(await file.arrayBuffer());
    const result = await API.importAnalysis(analysis);
    await DB.loadApi();
    await DB.loadLogBulan();
    toast(`${result.stocks} saham diperbarui · log ${result.log || analysis.log?.BULAN || "bulan ini"} dibuat`);
    refresh();
  } catch (err) {
    toast(`Gagal upload: ${err.message}`, "err");
  }
}

/* ------------------------------------------------------------------ pengguna */
const USER_STATUS = {
  AKTIF: ["aktif", "Aktif"],
  NONAKTIF: ["nonaktif", "Nonaktif"],
  KEDALUWARSA: ["expired", "Kedaluwarsa"],
  "SEGERA BERAKHIR": ["warning", "Segera berakhir"],
};

function userStatusChip(row) {
  const status = Auth.statusOf(row);
  const [tone, label] = USER_STATUS[status] || ["nonaktif", status];
  return `<span class="status-chip ${tone}">${label}</span>`;
}

function expiryCell(row) {
  if (!row.EXPIRED) return `<span class="expiry-text muted">Tidak ada</span>`;
  const left = Auth.daysLeft(row);
  const cls = left < 0 ? "expired" : left <= 7 ? "warning" : "";
  const note = left === null ? "" : left < 0 ? ` · lewat ${Math.abs(left)} hari` : left === 0 ? " · hari ini" : ` · ${left} hari`;
  return `<span class="expiry-text ${cls}">${dateID(row.EXPIRED)}${note}</span>`;
}

function viewUsers() {
  if (!Auth.isAdmin()) {
    return `<div class="card">${emptyState("Akses ditolak", "Halaman ini hanya untuk administrator.", "", "")}</div>`;
  }
  const me = Auth.currentUser();
  const list = Auth.users().slice().sort((a, b) => {
    const roleDiff = (Auth.roleOf(b) === "ADMIN" ? 1 : 0) - (Auth.roleOf(a) === "ADMIN" ? 1 : 0);
    return roleDiff || String(a.USERNAME).localeCompare(String(b.USERNAME));
  });
  const adminCount = list.filter((u) => Auth.roleOf(u) === "ADMIN" && String(u.STATUS).toUpperCase() === "AKTIF").length;
  const activeCount = list.filter((u) => ["AKTIF", "SEGERA BERAKHIR"].includes(Auth.statusOf(u))).length;
  const attention = list.filter((u) => ["KEDALUWARSA", "NONAKTIF", "SEGERA BERAKHIR"].includes(Auth.statusOf(u))).length;

  const rows = list.map((u) => {
    const isSelf = me && Number(me.ID) === Number(u.ID);
    const active = String(u.STATUS).toUpperCase() === "AKTIF";
    return `<tr>
      <td><div class="who"><b>${esc(u.USERNAME)}</b><small>${esc(u.NAMA)}${isSelf ? " · Anda" : ""}</small></div></td>
      <td><span class="role-chip ${Auth.roleOf(u) === "ADMIN" ? "admin" : "user"}">${Auth.roleOf(u)}</span></td>
      <td>${userStatusChip(u)}</td>
      <td>${expiryCell(u)}</td>
      <td class="small muted">${u.UPDATED ? dateID(u.UPDATED) : "—"}</td>
      <td class="num">
        <div class="user-actions">
          <button class="btn btn-ghost btn-sm" data-action="user-edit" data-id="${u.ID}">${icon("edit")} Ubah</button>
          ${isSelf ? "" : `<button class="btn ${active ? "btn-danger" : "btn-subtle"} btn-sm" data-action="user-toggle" data-id="${u.ID}">${icon("power")} ${active ? "Nonaktifkan" : "Aktifkan"}</button>`}
        </div>
      </td>
    </tr>`;
  }).join("");

  return `
  ${sectionHead("Manajemen pengguna", "Kelola akun, role, status, dan masa berlaku. Hanya administrator yang dapat membuka halaman ini.",
    `<div class="wrap-gap">
      <button class="btn btn-ghost" data-action="export-table" data-name="PENGGUNA" ${DB.apiMode ? "hidden" : ""}>${icon("download")} PENGGUNA.DBF</button>
      <button class="btn btn-primary" data-action="user-add">${icon("plus")} Tambah pengguna</button>
    </div>`)}

  <div class="auth-banner">${icon("shield")}
    <div>${DB.apiMode
      ? `<b>Autentikasi server D1.</b> Role, status, dan masa berlaku diperiksa oleh Worker;
         browser tidak menerima hash password atau file database. Perubahan pengguna langsung tersimpan di D1.`
      : `<b>Kontrol akses mode statis.</b> Aplikasi ini berjalan di GitHub Pages, sehingga role diperiksa di browser
         dan berkas <span class="mono">PENGGUNA.DBF</span> dapat dibaca publik. Password disimpan sebagai hash PBKDF2 + salt,
         tetapi ini bukan pengganti autentikasi server. Perubahan pengguna hanya tersimpan di browser sampai
         <span class="mono">PENGGUNA.DBF</span> diekspor dan di-commit.`}</div>
  </div>

  <section class="grid grid-4 section">
    ${kpi("Total akun", num(list.length, 0), "Admin dan user", "users", "rgba(15,118,110,.14)")}
    ${kpi("Admin aktif", num(adminCount, 0), "Akses penuh", "shield", "rgba(14,165,233,.12)")}
    ${kpi("Akun aktif", num(activeCount, 0), "Boleh login", "check", "rgba(4,120,87,.14)")}
    ${kpi("Perlu perhatian", num(attention, 0), "Nonaktif / kedaluwarsa / ≤7 hari", "alert", "rgba(180,83,9,.13)")}
  </section>

  <div class="card flush">
    <div class="card-head" style="padding:18px 20px 0">
      <div><h3>Daftar pengguna</h3><p>${list.length} akun · sesi login berlaku ${Auth.SESSION_HOURS} jam.</p></div>
      <span class="chip brand">ADMIN-only</span>
    </div>
    <div class="table-wrap mt-2">
      <table class="data user-table">
        <thead><tr><th>Pengguna</th><th>Role</th><th>Status</th><th>Berlaku s/d</th><th>Diperbarui</th><th class="num">Aksi</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="6" class="muted center" style="padding:28px">Belum ada pengguna.</td></tr>`}</tbody>
      </table>
    </div>
    <p class="footnote" style="padding:0 20px 16px">User biasa hanya dapat membuka Ringkasan, Saham, Portofolio, dan Simulasi.
    ${DB.apiMode ? "Update harga dan manajemen pengguna khusus admin." : "Database, update harga, ekspor DBF, dan manajemen pengguna khusus admin."}</p>
  </div>`;
}

/* ------------------------------------------------------------------ simulasi */
const SIM_PRESETS = {
  konservatif: { label: "Konservatif", priceGrowth: 0.04, divYield: 0.07, divGrowth: 0.03 },
  basis: { label: "Basis", priceGrowth: 0.06, divYield: 0.085, divGrowth: 0.05 },
  optimis: { label: "Optimis", priceGrowth: 0.08, divYield: 0.10, divGrowth: 0.06 },
};

function viewSimulation() {
  const sim = ui.sim || DB.simulationDefaults();
  ui.sim = sim;
  const stocks = DB.stockList();
  return `
  ${sectionHead("Simulasi investasi", "Proyeksi nilai portofolio bila setoran bulanan diinvestasikan ulang bersama dividen.",
    `<span class="chip plain">Asumsi dapat diubah</span>`)}
  <div class="grid grid-1-2" style="align-items:start">
    <div class="card">
      <div class="card-head"><div><h3>Asumsi</h3><p>Semua angka dalam rupiah dan persen per tahun.</p></div>${icon("calc")}</div>
      <form id="sim-form" autocomplete="off">
        <div class="vstack">
          <div class="field">
            <label for="sim-monthly">Setoran bulanan</label>
            <div class="prefix"><span>Rp</span><input id="sim-monthly" name="monthly" type="text" inputmode="numeric" autocomplete="off" value="${num(sim.monthly, 0)}"></div>
          </div>
          <div class="field">
            <label for="sim-initial">Modal awal</label>
            <div class="prefix"><span>Rp</span><input id="sim-initial" name="initial" type="text" inputmode="numeric" autocomplete="off" value="${num(sim.initial, 0)}"></div>
          </div>
          <div class="field">
            <label for="sim-years">Jangka waktu (tahun)</label>
            <input id="sim-years" name="years" type="number" min="1" max="40" step="1" value="${sim.years}">
          </div>
          <div class="field">
            <label for="sim-price">Pertumbuhan harga saham (%/tahun)</label>
            <input id="sim-price" name="priceGrowthPct" type="number" min="-10" max="30" step="0.5" value="${(sim.priceGrowth * 100).toFixed(1)}">
          </div>
          <div class="field">
            <label for="sim-yield">Dividend yield (%/tahun)</label>
            <input id="sim-yield" name="divYieldPct" type="number" min="0" max="25" step="0.1" value="${(sim.divYield * 100).toFixed(1)}">
          </div>
          <div class="field">
            <label for="sim-divgrowth">Pertumbuhan dividen (%/tahun)</label>
            <input id="sim-divgrowth" name="divGrowthPct" type="number" min="-10" max="20" step="0.5" value="${(sim.divGrowth * 100).toFixed(1)}">
          </div>
          <div class="field">
            <label for="sim-source">Ambil yield dari ${DB.apiMode ? "data D1" : "DBF"}</label>
            <select id="sim-source" name="divYieldSource">
              <option value="avg">Rata-rata ${stocks.length} emiten</option>
              ${stocks.map((s) => `<option value="${esc(s.KODE)}">${esc(s.KODE)} — ${pct(s.DY, 1)}</option>`).join("")}
            </select>
          </div>
          <label class="small" style="display:flex;gap:8px;align-items:center">
            <input type="checkbox" name="reinvest" ${sim.reinvest ? "checked" : ""}> Reinvestasi dividen
          </label>
          <div class="wrap-gap">
            ${Object.entries(SIM_PRESETS).map(([key, p]) => `<button type="button" class="btn btn-ghost btn-sm" data-action="sim-preset" data-preset="${key}">${p.label}</button>`).join("")}
          </div>
        </div>
      </form>
    </div>
    <div id="sim-result">${simResultHTML()}</div>
  </div>
  <p class="footnote">Model: harga tumbuh bulanan, dividen dibayar bulanan dan (bila dipilih) diinvestasikan ulang.
  Hasil bersifat ilustrasi, bukan jaminan. Yield awal default = rata-rata dividend yield tabel SAHAM.
  Notasi: <b>jt</b> = juta, <b>M</b> = miliar, <b>T</b> = triliun.</p>`;
}

function simResultHTML() {
  const res = DB.simulate(ui.sim);
  const last = res.series[res.series.length - 1];
  const rows = res.series.slice(1).map((s) => `
    <tr>
      <td class="num">${s.year}</td>
      <td class="num">${compactRp(s.invested)}</td>
      <td class="num strong">${compactRp(s.value)}</td>
      <td class="num ${signClass(s.value - s.invested)}">${compactRp(s.value - s.invested)}</td>
      <td class="num">${compactRp(s.income)}</td>
      <td class="num">${pct((s.value / (s.invested || 1)) - 1, 1, true)}</td>
    </tr>`).join("");

  return `
    <section class="grid grid-4" aria-label="Hasil simulasi">
      ${kpi("Nilai akhir", compactRp(res.final), `${ui.sim.years} tahun`, "wallet", "rgba(15,118,110,.14)")}
      ${kpi("Total modal", compactRp(res.invested), `setoran ${compactRp(ui.sim.monthly)}/bln`, "coins", "rgba(14,165,233,.12)")}
      ${kpi("Dividen per tahun", compactRp(last?.income || 0), "tahun terakhir", "percent", "rgba(180,83,9,.13)")}
      ${kpi("Hasil kali", res.multiple ? `${num(res.multiple, 2)}×` : "—", `IRR ${pct(res.irr, 1)} per tahun`, "award", "rgba(139,92,246,.12)")}
    </section>
    <div class="card mt-2">
      <div class="card-head"><div><h3>Proyeksi nilai</h3><p>Garis putus-putus = modal disetor; area hijau = nilai portofolio.</p></div>${icon("chart")}</div>
      <div class="chart-wrap">${C.simChart(res.series)}</div>
    </div>
    <div class="card flush mt-2">
      <div class="card-head" style="padding:18px 20px 0"><div><h3>Rincian per tahun</h3><p>Nilai akhir, modal, dan dividen tahunan.</p></div></div>
      <div class="table-wrap mt-2 scroll-y">
        <table class="data">
          <thead><tr><th class="num">Tahun</th><th class="num">Modal</th><th class="num">Nilai</th><th class="num">Gain</th><th class="num">Dividen/thn</th><th class="num">Return</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function onSimInput(e) {
  const name = e.target.name;
  if (!name) return;
  if (name === "reinvest") {
    ui.sim.reinvest = e.target.checked;
  } else if (name === "divYieldSource") {
    if (e.target.value !== "avg") {
      const stock = DB.stockByCode(e.target.value);
      if (stock) {
        ui.sim.divYield = stock.DY;
        const input = document.getElementById("sim-yield");
        if (input) input.value = (stock.DY * 100).toFixed(1);
      }
    }
  } else {
    const map = { monthly: "monthly", initial: "initial", years: "years", priceGrowthPct: "priceGrowth", divYieldPct: "divYield", divGrowthPct: "divGrowth" };
    const key = map[name];
    if (!key) return;
    let val;
    if (name === "monthly" || name === "initial") {
      const digits = String(e.target.value).replace(/\D/g, "");
      val = digits ? Number(digits) : 0;
      e.target.value = digits ? num(val, 0) : "";
    } else {
      val = Number(e.target.value);
    }
    if (!Number.isFinite(val)) return;
    if (name.endsWith("Pct")) val /= 100;
    ui.sim[key] = val;
  }
  const out = document.getElementById("sim-result");
  if (out) out.innerHTML = simResultHTML();
}

/* ------------------------------------------------------------------ database */
function tableSize(table) {
  const recLen = 1 + table.schema.reduce((a, f) => a + f.length, 0);
  return 32 + 32 * table.schema.length + 1 + table.rows.length * recLen + 1;
}

function viewDatabase() {
  const st = DB.state;
  const manifest = st.manifest || {};
  const tables = st.order.map((n) => st.tables[n]).filter(Boolean);
  const active = st.tables[ui.dbTable] || tables[0];
  const totalBytes = tables.reduce((a, t) => a + tableSize(t), 0);
  const canFolder = DB.supportsFolder();
  const dirty = st.dirty;

  const cards = tables.map((t) => `
    <button class="table-card ${active && active.name === t.name ? "active" : ""}" data-action="select-table" data-name="${esc(t.name)}">
      <div class="tc-top"><span class="tc-name">${esc(t.name)}</span><span class="chip muted">${t.rows.length} baris</span></div>
      <span class="tc-label">${esc(t.label)}</span>
      <div class="tc-meta"><span>${t.schema.length} field</span><span>${fmtBytes(tableSize(t))}</span></div>
    </button>`).join("");

  const previewRows = active ? (ui.showAll ? active.rows : active.rows.slice(0, 12)) : [];
  const previewHead = active ? active.schema.map((f) => `<th>${esc(f.name)}</th>`).join("") : "";
  const previewBody = previewRows.map((row) => `<tr>${active.schema.map((f) => {
    const v = row[f.name];
    const text = v === null || v === undefined || v === "" ? "—" : String(v);
    return `<td class="${f.type === "N" || f.type === "F" ? "num" : ""}"><span class="preview-cell" title="${esc(text)}">${esc(text)}</span></td>`;
  }).join("")}</tr>`).join("");

  const schemaRows = active ? active.schema.map((f, i) => `
    <tr><td class="num muted">${i + 1}</td><td class="strong">${esc(f.name)}</td><td class="type">${esc(f.type)}</td>
    <td class="num">${f.length}</td><td class="num">${f.dec || 0}</td></tr>`).join("") : "";

  const headerLen = active ? 32 + 32 * active.schema.length + 1 : 0;
  const recLen = active ? 1 + active.schema.reduce((a, f) => a + f.length, 0) : 0;

  return `
  ${sectionHead("Database DBF", "Berkas .DBF adalah sumber data aplikasi ini — bukan ekspor sekunder.",
    `<span class="chip ${dirty ? "warn" : "pos"}">${dirty ? "ada perubahan lokal" : "tersinkron"}</span>`)}

  <div class="card">
    <div class="db-hero">
      <div class="big">
        <div class="ic">${icon("database")}</div>
        <div><h2>${tables.length} tabel · dBase III</h2>
        <p>Dibaca dari <span class="mono">/data</span> · ${esc(manifest.encoding || "ASCII")} · dibuat ${manifest.generated ? dateID(String(manifest.generated).slice(0, 10)) : "—"}</p></div>
      </div>
      <div class="db-actions">
        <button class="btn btn-primary" data-action="export-all">${icon("download")} Unduh ZIP</button>
        <button class="btn btn-ghost" data-action="reload-reference" title="Ambil ulang tabel referensi dari data/*.DBF">${icon("refresh")} Ambil data terbaru</button>
        <button class="btn btn-ghost" data-action="save-folder" ${canFolder ? "" : `disabled title="Butuh Chrome/Edge dan HTTPS atau localhost"`}>
          ${icon("folder")} ${st.folderName ? `Simpan ke ${esc(st.folderName)}` : "Simpan ke folder"}</button>
        <button class="btn btn-ghost" data-action="import">${icon("upload")} Impor</button>
        <input id="import-input" type="file" accept=".dbf" multiple hidden>
      </div>
    </div>
    <div class="db-stats">
      <div><small>Sumber angka</small><b>${esc(manifest.source || "—")}</b></div>
      <div><small>Tanggal analisis / harga</small><b>${dateID(DB.dataAge())} / ${dateID(DB.priceDate())}</b></div>
      <div><small>Total ukuran</small><b>${fmtBytes(totalBytes)}</b></div>
      <div><small>Penyimpanan browser</small><b>${dirty ? "Ada perubahan" : "Tersimpan"}</b></div>
    </div>
    <div class="callout mt-3">${icon("info")}
      <div><b>Bagaimana data disimpan?</b> GitHub Pages tidak bisa menulis ke server. Perubahan dari UI otomatis
      tersimpan di penyimpanan browser, lalu ditulis ke berkas .DBF asli lewat <b>Simpan ke folder</b>
      (Chrome/Edge, pilih folder <span class="mono">data/</span>) atau <b>Unduh ZIP</b> untuk diganti manual lalu di-commit.
      <br>Setelah berkas <span class="mono">.DBF</span> di disk/server diperbarui, klik <b>Ambil data terbaru</b>
      agar tabel referensi di aplikasi ikut dimuat ulang — jurnal transaksi tidak terhapus.</div>
    </div>
  </div>

  <section class="section">
    <div class="table-cards">${cards}</div>
  </section>

  ${active ? `
  <section class="card section">
    <div class="db-detail-head">
      <div>
        <h3>${esc(active.name)}.DBF</h3>
        <p class="small muted">${esc(active.description)}</p>
      </div>
      <div class="actions">
        <button class="btn btn-ghost btn-sm" data-action="export-table" data-name="${esc(active.name)}">${icon("download")} Unduh .DBF</button>
        <button class="btn btn-ghost btn-sm" data-action="toggle-show-all">${ui.showAll ? "Ringkas" : "Semua baris"}</button>
      </div>
    </div>
    <div class="header-bits">
      <span class="chip plain">versi 0x03</span>
      <span class="chip plain">${active.rows.length} rekaman</span>
      <span class="chip plain">header ${headerLen} byte</span>
      <span class="chip plain">record ${recLen} byte</span>
      <span class="chip plain">${active.rows.length * recLen + headerLen + 1} byte</span>
      ${active.updated ? `<span class="chip plain">diperbarui ${dateID(active.updated)}</span>` : ""}
    </div>

    <div class="db-grid mt-3">
      <div>
        <div class="dsec-title">Struktur field</div>
        <div class="table-wrap scroll-y">
          <table class="data schema">
            <thead><tr><th class="num">#</th><th>Nama</th><th>Tipe</th><th class="num">Panjang</th><th class="num">Desimal</th></tr></thead>
            <tbody>${schemaRows}</tbody>
          </table>
        </div>
      </div>
      <div>
        <div class="dsec-title">Pratinjau data</div>
        <div class="table-wrap scroll-y">
          <table class="data">
            <thead><tr>${previewHead}</tr></thead>
            <tbody>${previewBody || `<tr><td colspan="${active.schema.length}" class="muted center" style="padding:24px">Tabel kosong.</td></tr>`}</tbody>
          </table>
        </div>
        <p class="footnote">Geser tabel ke samping untuk melihat kolom lainnya.</p>
      </div>
    </div>
    <p class="footnote">Pratinjau menampilkan ${ui.showAll ? "semua" : "maksimal 12"} baris. Nilai kosong ditampilkan sebagai "—".
    ${active.name === "TRANSAKSI" ? "Tabel ini dapat diubah dari halaman Portofolio." : "Tabel referensi hanya-baca; ubah lewat skrip Python lalu impor ulang."}</p>
  </section>` : ""}

  <section class="card section danger-zone">
    <div class="between">
      <div><h3>Reset data lokal</h3>
      <p class="small muted">Hapus salinan browser dan muat ulang tabel DBF dari folder <span class="mono">data/</span>.</p></div>
      <button class="btn btn-danger" data-action="reset-db">${icon("refresh")} Muat ulang data awal</button>
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ aksi */
async function onClick(e) {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const adminOnly = new Set([
    "price-editor", "price-refresh", "export-table", "export-all", "reload-reference", "save-folder",
    "import", "select-table", "toggle-show-all", "reset-db", "portfolio-refresh", "log-upload",
    "user-add", "user-edit", "user-toggle",
  ]);
  if (adminOnly.has(action) && !requireAdmin()) return;
  if (DB.apiMode && ["export-table", "export-all", "reload-reference", "save-folder",
    "import", "select-table", "toggle-show-all", "reset-db"].includes(action)) {
    toast("Fitur DBF tidak tersedia dalam mode D1.", "err");
    return;
  }

  if (action === "logout") {
    openLogoutModal();
    return;
  }
  if (action === "logout-confirm") {
    Auth.logout();
    closeDrawer(false);
    closeModal(true);
    ui.detail = null;
    history.replaceState(null, "", "#/ringkasan");
    showLogin("Anda telah keluar. Sampai jumpa.", "info");
    return;
  }
  if (action === "change-password") {
    openChangePasswordModal({});
    return;
  }
  if (action === "user-add") {
    openUserModal();
    return;
  }
  if (action === "user-edit") {
    openUserModal(Number(el.dataset.id));
    return;
  }
  if (action === "user-toggle") {
    openUserStatusModal(Number(el.dataset.id));
    return;
  }
  if (action === "open-stock") {
    location.hash = `#/saham/${el.dataset.code}`;
    return;
  }
  if (action === "close-drawer") {
    closeDrawer();
    return;
  }
  if (action === "close-modal") {
    closeModal();
    return;
  }
  if (action === "sort") {
    const key = el.dataset.key;
    if (ui.sortKey === key) ui.sortDir = ui.sortDir === "asc" ? "desc" : "asc";
    else {
      ui.sortKey = key;
      ui.sortDir = key === "KODE" || key === "SEKTOR" || key === "NAMA" ? "asc" : "desc";
    }
    render();
    return;
  }
  if (DB.apiMode && Auth.isAdmin() && ["tx-add", "tx-edit", "tx-del", "tx-clear"].includes(action)) {
    toast("Admin hanya dapat melihat portofolio user.", "err");
    return;
  }
  if (action === "tx-add") {
    openTxModal({ code: el.dataset.code || null });
    return;
  }
  if (action === "log-upload") {
    document.getElementById("log-upload-input")?.click();
    return;
  }
  if (action === "portfolio-refresh") {
    try {
      await DB.loadAdminPortfolios();
      if (ui.portfolioUser !== "all" && !DB.state.adminUsers.some((u) => String(u.id) === String(ui.portfolioUser))) {
        ui.portfolioUser = "all";
      }
      toast("Portofolio user dimuat ulang");
      refresh();
    } catch (err) {
      toast(err.message, "err");
    }
    return;
  }
  if (action === "price-refresh") {
    if (!window.confirm(`Ambil harga terbaru ${DB.rows("SAHAM").length} emiten dari Yahoo Finance dan simpan ke D1?`)) return;
    const original = el.innerHTML;
    el.disabled = true;
    el.textContent = "Mengambil Yahoo…";
    try {
      const result = await API.refreshPrices();
      await DB.loadApi();
      const count = Array.isArray(result.changed) ? result.changed.length : 0;
      const failed = Array.isArray(result.failed) ? result.failed.length : 0;
      toast(count
        ? `${count} harga diperbarui dari Yahoo${failed ? ` · ${failed} gagal` : ""}`
        : "Harga D1 sudah terbaru dari Yahoo");
      refresh();
    } catch (err) {
      toast(`${err.message || "Gagal mengambil Yahoo"} · gunakan Input manual`, "err");
    } finally {
      el.disabled = false;
      el.innerHTML = original;
    }
    return;
  }
  if (action === "price-editor") {
    openPriceModal();
    return;
  }
  if (action === "tx-edit") {
    openTxModal({ index: Number(el.dataset.index) });
    return;
  }
  if (action === "tx-del") {
    const index = Number(el.dataset.index);
    const tx = DB.rows("TRANSAKSI")[index];
    if (!tx) return;
    if (!window.confirm(`Hapus transaksi ${tx.JENIS} ${tx.KODE} ${num(tx.LOT, 0)} lot?`)) return;
    if (DB.apiMode) {
      try {
        await API.deleteTransaction(tx.ID);
        await DB.loadApi();
      } catch (err) {
        toast(err.message, "err");
        return;
      }
    } else {
      DB.deleteRow("TRANSAKSI", index);
    }
    toast("Transaksi dihapus");
    refresh();
    return;
  }
  if (action === "tx-clear") {
    if (!window.confirm("Hapus semua transaksi portofolio Anda?")) return;
    if (DB.apiMode) {
      try {
        await API.clearTransactions();
        await DB.loadApi();
      } catch (err) {
        toast(err.message, "err");
        return;
      }
    } else {
      DB.replaceRows("TRANSAKSI", []);
    }
    toast("Semua transaksi dihapus");
    refresh();
    return;
  }
  if (action === "reload-api") {
    try {
      await DB.loadApi();
      if (Auth.isAdmin()) await Auth.loadUsers();
      toast("Data D1 dimuat ulang");
      refresh();
    } catch (err) {
      toast(err.message, "err");
    }
    return;
  }
  if (action === "export-table") {
    try {
      DB.exportTable(el.dataset.name);
      toast(`${el.dataset.name}.DBF diunduh`);
      refresh();
    } catch (err) {
      toast(err.message, "err");
    }
    return;
  }
  if (action === "export-all") {
    try {
      const size = DB.exportZip();
      toast(`Arsip DBF diunduh (${fmtBytes(size)})`);
      refresh();
    } catch (err) {
      toast(err.message, "err");
    }
    return;
  }
  if (action === "reload-reference") {
    if (!window.confirm("Ambil ulang tabel referensi dari data/*.DBF?\n\nJurnal transaksi tetap dipertahankan, tetapi perubahan pada tabel referensi (harga, valuasi, skor) akan diganti dengan isi berkas .DBF terbaru.")) return;
    el.disabled = true;
    const original = el.innerHTML;
    el.innerHTML = "Memuat…";
    try {
      const result = await DB.reloadReference();
      toast(`Data dimuat ulang · harga per ${dateID(DB.priceDate())} · ${result.transactions} transaksi dipertahankan`);
    } catch (err) {
      toast(err.message || "Gagal memuat ulang data", "err");
      el.disabled = false;
      el.innerHTML = original;
    }
    refresh();
    return;
  }
  if (action === "save-folder") {
    el.disabled = true;
    const original = el.innerHTML;
    el.innerHTML = "Menyimpan…";
    try {
      const count = await DB.saveToFolder();
      toast(`${count} tabel ditulis ke folder ${DB.state.folderName}`);
    } catch (err) {
      toast(err.message || "Gagal menyimpan", "err");
    } finally {
      el.disabled = false;
      el.innerHTML = original;
      refresh();
    }
    return;
  }
  if (action === "import") {
    document.getElementById("import-input")?.click();
    return;
  }
  if (action === "select-table") {
    ui.dbTable = el.dataset.name;
    ui.showAll = false;
    render();
    return;
  }
  if (action === "toggle-show-all") {
    ui.showAll = !ui.showAll;
    render();
    return;
  }
  if (action === "sim-preset") {
    const preset = SIM_PRESETS[el.dataset.preset];
    if (!preset) return;
    ui.sim = { ...ui.sim, priceGrowth: preset.priceGrowth, divYield: preset.divYield, divGrowth: preset.divGrowth };
    render();
    return;
  }
  if (action === "reset-db") {
    if (!window.confirm("Hapus perubahan lokal dan muat ulang data DBF awal?")) return;
    DB.resetLocal();
    location.reload();
    return;
  }
}

async function importFiles(input) {
  const files = [...(input.files || [])];
  input.value = "";
  for (const file of files) {
    try {
      const buffer = await file.arrayBuffer();
      const result = DB.importDbf(file.name, buffer);
      toast(`${result.name}: ${result.records} baris, ${result.fields} field diimpor`);
    } catch (err) {
      toast(`Gagal impor ${file.name}: ${err.message}`, "err");
    }
  }
  refresh();
}

/* ------------------------------------------------------------------ modal transaksi */
function closeModal(force = false) {
  if (ui.forceModal && !force) return;
  ui.forceModal = false;
  modalRoot().innerHTML = "";
  ui.txEditing = null;
  if (!ui.detail) document.body.classList.remove("no-scroll");
}

function modalShell({ title, subtitle, body, footer, width = "560px", id = "modal-title" }) {
  return `
    <div class="modal-overlay">
      <div class="modal" style="width:min(${width},100%)" role="dialog" aria-modal="true" aria-labelledby="${id}">
        <div class="modal-head">
          <div><h2 id="${id}">${title}</h2><p>${subtitle}</p></div>
          <button class="drawer-close" data-action="close-modal" aria-label="Tutup">${icon("x")}</button>
        </div>
        ${body}
        <div class="modal-foot">${footer}</div>
      </div>
    </div>`;
}

function openLogoutModal() {
  const user = Auth.currentUser();
  if (!user) return showLogin("Sesi berakhir. Silakan login kembali.");
  modalRoot().innerHTML = modalShell({
    title: "Keluar dari aplikasi?",
    subtitle: `Sesi ${esc(user.NAMA || user.USERNAME)} akan diakhiri.`,
    width: "460px",
    id: "logout-title",
    body: `<div class="modal-body">
      <div class="callout">${icon("shield")}
        <div><b>Data sudah tersimpan.</b> Transaksi dan pengaturan disimpan di D1.
        Anda perlu login kembali untuk membuka aplikasi.</div>
      </div>
    </div>`,
    footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">Batal</button>
      <div class="right"><button class="btn btn-danger" type="button" data-action="logout-confirm">${icon("power")} Ya, keluar</button></div>`,
  });
  document.body.classList.add("no-scroll");
  const overlay = modalRoot().querySelector(".modal-overlay");
  overlay.addEventListener("mousedown", (ev) => { if (ev.target === overlay) closeModal(); });
  setTimeout(() => modalRoot().querySelector('[data-action="logout-confirm"]')?.focus(), 60);
}

function openChangePasswordModal({ forced = false } = {}) {
  const user = Auth.currentUser();
  if (!user) return showLogin("Sesi berakhir. Silakan login kembali.");
  ui.forceModal = forced;
  modalRoot().innerHTML = `
    <div class="modal-overlay">
      <div class="modal" style="width:min(480px,100%)" role="dialog" aria-modal="true" aria-labelledby="pw-title">
        <div class="modal-head">
          <div><h2 id="pw-title">${forced ? "Ganti password wajib" : "Ganti password"}</h2>
          <p>${forced ? "Akun ini memakai password awal. Ganti sebelum melanjutkan." : `Akun ${esc(user.USERNAME)}.`}</p></div>
          ${forced ? "" : `<button class="drawer-close" data-action="close-modal" aria-label="Tutup">${icon("x")}</button>`}
        </div>
        <form id="pw-form" class="modal-body" novalidate>
          <div class="field"><label for="pw-current">Password saat ini</label><input id="pw-current" name="current" type="password" autocomplete="current-password" required></div>
          <div class="field"><label for="pw-new">Password baru</label><input id="pw-new" name="new" type="password" autocomplete="new-password" required>
            <span class="help">Minimal ${Auth.MIN_PASSWORD} karakter, mengandung huruf dan angka.</span></div>
          <div class="field"><label for="pw-confirm">Ulangi password baru</label><input id="pw-confirm" name="confirm" type="password" autocomplete="new-password" required></div>          <div class="form-error" id="pw-error"></div>
          <div class="callout mt-2">${icon("info")}<div>${forced ? "Modal ini tidak dapat ditutup sampai password berhasil diganti." : "Setelah diganti, gunakan password baru pada login berikutnya."}</div></div>
        </form>
        <div class="modal-foot">
          ${forced ? "" : `<button class="btn btn-ghost" type="button" data-action="close-modal">Batal</button>`}
          <div class="right"><button class="btn btn-primary" type="submit" form="pw-form">${icon("check")} Simpan password</button></div>
        </div>
      </div>
    </div>`;
  document.body.classList.add("no-scroll");
  const overlay = modalRoot().querySelector(".modal-overlay");
  overlay.addEventListener("mousedown", (ev) => { if (ev.target === overlay && !forced) closeModal(); });

  const form = document.getElementById("pw-form");
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const error = document.getElementById("pw-error");
    error.classList.remove("show");
    if (form.new.value !== form.confirm.value) {
      error.textContent = "Konfirmasi password tidak sama.";
      error.classList.add("show");
      return;
    }
    try {
      await Auth.changeOwnPassword(form.current.value, form.new.value);
      ui.forceModal = false;
      closeModal(true);
      toast("Password berhasil diperbarui");
      const refreshed = Auth.currentUser();
      if (refreshed) applyRoleUI(refreshed);
      if (forced) await startApp();
      else route();
    } catch (err) {
      error.textContent = err.message;
      error.classList.add("show");
    }
  });
  setTimeout(() => document.getElementById(forced ? "pw-new" : "pw-current")?.focus(), 60);
}

function openAdminVerify({ title, message, confirmLabel, successMessage, onConfirm }) {
  modalRoot().innerHTML = `
    <div class="modal-overlay">
      <div class="modal" style="width:min(480px,100%)" role="dialog" aria-modal="true" aria-labelledby="verify-title">
        <div class="modal-head">
          <div><h2 id="verify-title">${title}</h2><p>${message}</p></div>
          <button class="drawer-close" data-action="close-modal" aria-label="Tutup">${icon("x")}</button>
        </div>
        <form id="verify-form" class="modal-body" novalidate>
          <div class="field"><label for="verify-pass">Password administrator</label>
            <input id="verify-pass" name="password" type="password" autocomplete="current-password" required autofocus></div>
          <div class="form-error" id="verify-error"></div>
          <div class="callout mt-2">${icon("shield")}<div>Verifikasi ulang diperlukan untuk tindakan administratif.</div></div>
        </form>
        <div class="modal-foot">
          <button class="btn btn-ghost" type="button" data-action="close-modal">Batal</button>
          <div class="right"><button class="btn btn-primary" type="submit" form="verify-form">${confirmLabel}</button></div>
        </div>
      </div>
    </div>`;
  document.body.classList.add("no-scroll");
  const overlay = modalRoot().querySelector(".modal-overlay");
  overlay.addEventListener("mousedown", (ev) => { if (ev.target === overlay) closeModal(); });
  const form = document.getElementById("verify-form");
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const error = document.getElementById("verify-error");
    error.classList.remove("show");
    const ok = await Auth.verifyAdminPassword(form.password.value);
    if (!ok) {
      error.textContent = "Password administrator salah.";
      error.classList.add("show");
      return;
    }
    try {
      await onConfirm();
      closeModal(true);
      toast(successMessage);
      refresh();
    } catch (err) {
      error.textContent = err.message;
      error.classList.add("show");
    }
  });
  setTimeout(() => document.getElementById("verify-pass")?.focus(), 60);
}

function openUserStatusModal(id) {
  const target = Auth.getUser(id);
  const me = Auth.currentUser();
  if (!target) return;
  if (me && Number(me.ID) === Number(target.ID)) {
    toast("Tidak bisa menonaktifkan akun sendiri.", "err");
    return;
  }
  const activate = String(target.STATUS).toUpperCase() !== "AKTIF";
  openAdminVerify({
    title: activate ? "Aktifkan pengguna" : "Nonaktifkan pengguna",
    message: `${activate ? "Aktifkan kembali" : "Nonaktifkan"} akun ${target.USERNAME} (${target.NAMA})?`,
    confirmLabel: activate ? "Aktifkan" : "Nonaktifkan",
    successMessage: `Akun ${target.USERNAME} ${activate ? "diaktifkan" : "dinonaktifkan"}`,
    onConfirm: () => Auth.setUserStatus(target.ID, activate ? "AKTIF" : "NONAKTIF"),
  });
}

function openUserModal(id = null) {
  const existing = id ? Auth.getUser(id) : null;
  const me = Auth.currentUser();
  const isSelf = existing && me && Number(existing.ID) === Number(me.ID);
  const title = existing ? "Ubah pengguna" : "Tambah pengguna";
  modalRoot().innerHTML = modalShell({
    title,
    subtitle: existing ? `Akun ${esc(existing.USERNAME)} · ${DB.apiMode ? "perubahan disimpan ke D1." : "perubahan dicatat di PENGGUNA.DBF."}` : "Akun baru wajib mengganti password saat login pertama.",
    width: "620px",
    id: "user-title",
    body: `
      <form id="user-form" class="modal-body" novalidate>
        <div class="form-grid">
          <div class="field"><label for="user-username">Username</label>
            <input id="user-username" name="username" value="${existing ? esc(existing.USERNAME) : ""}" ${existing ? "disabled" : "autocomplete=off"} maxlength="20" required>
            <span class="help">3–20 karakter: huruf, angka, titik, garis bawah, strip.</span></div>
          <div class="field"><label for="user-name">Nama lengkap</label>
            <input id="user-name" name="name" value="${existing ? esc(existing.NAMA) : ""}" maxlength="40" required></div>
          <div class="field"><label for="user-role">Role</label>
            <select id="user-role" name="role" ${isSelf ? "disabled" : ""}>
              <option value="USER" ${existing && existing.ROLE === "USER" ? "selected" : ""}>USER — fitur terbatas</option>
              <option value="ADMIN" ${existing && existing.ROLE === "ADMIN" ? "selected" : ""}>ADMIN — semua fitur</option>
            </select>
            ${isSelf ? `<span class="help">Role akun sendiri tidak dapat diubah.</span>` : ""}</div>
          <div class="field"><label for="user-expired">Berlaku sampai</label>
            <input id="user-expired" name="expired" type="date" value="${existing?.EXPIRED || ""}">
            <span class="help">Kosongkan untuk tanpa kedaluwarsa.</span></div>
          <div class="field"><label for="user-pass">${existing ? "Password baru (opsional)" : "Password awal"}</label>
            <input id="user-pass" name="password" type="password" autocomplete="new-password" ${existing ? "" : "required"}>
            <span class="help">Minimal ${Auth.MIN_PASSWORD} karakter, huruf + angka.${existing ? " Kosongkan jika tidak diubah." : ""}</span></div>
          <div class="field"><label for="user-confirm">Ulangi password</label>
            <input id="user-confirm" name="confirm" type="password" autocomplete="new-password"></div>
          <div class="field span-2"><label for="user-note">Catatan</label>
            <input id="user-note" name="note" maxlength="60" value="${existing ? esc(existing.CATATAN || "") : ""}" placeholder="mis. divisi riset"></div>
          <div class="field span-2"><label for="user-admin-pass">Password administrator Anda</label>
            <input id="user-admin-pass" name="adminpass" type="password" autocomplete="current-password" required>
            <span class="help">Verifikasi ulang sebelum menyimpan perubahan pengguna.</span></div>
        </div>
        <div class="form-error" id="user-error"></div>
      </form>`,
    footer: `
      <button class="btn btn-ghost" type="button" data-action="close-modal">Batal</button>
      <div class="right"><button class="btn btn-primary" type="submit" form="user-form">${icon("check")} ${existing ? "Simpan perubahan" : "Buat pengguna"}</button></div>`,
  });
  document.body.classList.add("no-scroll");
  const overlay = modalRoot().querySelector(".modal-overlay");
  overlay.addEventListener("mousedown", (ev) => { if (ev.target === overlay) closeModal(); });
  const form = document.getElementById("user-form");
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const error = document.getElementById("user-error");
    error.classList.remove("show");
    const show = (message) => { error.textContent = message; error.classList.add("show"); };
    if (form.password.value !== form.confirm.value) return show("Konfirmasi password tidak sama.");
    const ok = await Auth.verifyAdminPassword(form.adminpass.value);
    if (!ok) return show("Password administrator salah.");
    try {
      const payload = {
        name: form.name.value,
        role: form.role.value,
        expired: form.expired.value,
        note: form.note.value,
        password: form.password.value || null,
      };
      if (existing) {
        await Auth.updateUser(existing.ID, payload);
        toast(`Pengguna ${existing.USERNAME} diperbarui`);
      } else {
        const created = await Auth.createUser({ username: form.username.value, ...payload });
        toast(`Pengguna ${created.USERNAME} dibuat · password wajib diganti saat login`);
      }
      const current = Auth.currentUser();
      if (current) applyRoleUI(current);
      closeModal(true);
      refresh();
    } catch (err) {
      show(err.message);
    }
  });
  setTimeout(() => document.getElementById(existing ? "user-name" : "user-username")?.focus(), 60);
}

function openPriceModal() {
  const stocks = DB.stockList();
  modalRoot().innerHTML = `
    <div class="modal-overlay">
      <div class="modal" style="width:min(680px,100%)" role="dialog" aria-modal="true" aria-labelledby="price-title">
        <div class="modal-head">
          <div><h2 id="price-title">Update harga</h2>
          <p>Harga terbaru per saham (per ${dateID(DB.priceDate())}). PE, PB, DY, dan MoS dihitung ulang otomatis.</p></div>
          <button class="drawer-close" data-action="close-modal" aria-label="Tutup">${icon("x")}</button>
        </div>
        <form id="price-form" class="modal-body" novalidate>
          <div class="table-wrap">
            <table class="data price-table">
              <thead><tr><th>Saham</th><th class="num">Harga lama</th><th class="num">Harga baru</th><th class="num">Nilai wajar</th></tr></thead>
              <tbody>
                ${stocks.map((s) => `<tr>
                  <td><div class="ticker"><b>${esc(s.KODE)}</b><small>${esc(s.NAMA)}</small></div></td>
                  <td class="num">${num(s.HARGA, 0)}</td>
                  <td class="num"><input class="price-input" type="text" inputmode="numeric" data-code="${esc(s.KODE)}" value="${num(s.HARGA, 0)}" aria-label="Harga baru ${esc(s.KODE)}"></td>
                  <td class="num muted">${num(s.FV, 0)}</td>
                </tr>`).join("")}
              </tbody>
            </table>
          </div>
          <div class="form-error" id="price-error"></div>
          <div class="callout mt-2">${icon("info")}
            <div>${DB.apiMode
              ? "Perubahan harga disimpan ke D1. PE, PB, DY, dan MoS dihitung ulang oleh server."
              : "Nilai wajar, skor, dan indikator teknikal tidak diubah. Setelah disimpan, unduh <b>SAHAM.DBF</b> dan <b>VALUASI.DBF</b> (atau ZIP) agar perubahan ikut tersimpan ke berkas DBF."}</div>
          </div>
        </form>
        <div class="modal-foot">
          <button class="btn btn-ghost" type="button" data-action="close-modal">Batal</button>
          <div class="right"><button class="btn btn-primary" type="submit" form="price-form">${icon("check")} Simpan harga</button></div>
        </div>
      </div>
    </div>`;

  document.body.classList.add("no-scroll");
  const overlay = modalRoot().querySelector(".modal-overlay");
  overlay.addEventListener("mousedown", (ev) => { if (ev.target === overlay) closeModal(); });

  const form = document.getElementById("price-form");
  form.addEventListener("focusin", (e) => {
    if (!e.target.matches(".price-input")) return;
    const digits = e.target.value.replace(/\D/g, "");
    e.target.value = digits;
    e.target.select();
  });
  form.addEventListener("focusout", (e) => {
    if (!e.target.matches(".price-input")) return;
    const digits = e.target.value.replace(/\D/g, "");
    e.target.value = digits ? num(Number(digits), 0) : "";
  });
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const prices = {};
    form.querySelectorAll(".price-input").forEach((input) => {
      const value = Number(String(input.value).replace(/\D/g, ""));
      if (value > 0) prices[input.dataset.code] = value;
    });
    const error = document.getElementById("price-error");
    const submit = form.closest(".modal").querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    let changed;
    try {
      changed = await DB.updatePrices(prices);
    } catch (err) {
      error.textContent = err.message || "Gagal menyimpan harga.";
      error.classList.add("show");
      if (submit) submit.disabled = false;
      return;
    }
    if (!changed) {
      error.textContent = "Tidak ada harga yang berubah. Isi minimal satu harga baru.";
      error.classList.add("show");
      if (submit) submit.disabled = false;
      return;
    }
    closeModal();
    toast(`${changed} harga diperbarui · PE, PB, DY, dan MoS dihitung ulang`);
    refresh();
  });
  setTimeout(() => form.querySelector(".price-input")?.focus(), 60);
}

function openTxModal({ index = null, code = null } = {}) {  const existing = index !== null ? DB.rows("TRANSAKSI")[index] : null;
  ui.txEditing = index;
  const stocks = DB.stockList();
  const selected = existing?.KODE || code || stocks[0]?.KODE || "";
  const today = new Date().toISOString().slice(0, 10);
  const held = DB.computePortfolio().positions.find((p) => p.code === selected);

  modalRoot().innerHTML = `
    <div class="modal-overlay">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="tx-title">
        <div class="modal-head">
          <div><h2 id="tx-title">${existing ? "Ubah transaksi" : "Tambah transaksi"}</h2>
          <p>1 lot = 100 lembar. Fee default 0,15% dari nilai transaksi.</p></div>
          <button class="drawer-close" data-action="close-modal" aria-label="Tutup">${icon("x")}</button>
        </div>
        <form id="tx-form" class="modal-body" novalidate>
          <div class="form-grid">
            <div class="field"><label for="tx-date">Tanggal</label><input id="tx-date" name="tanggal" type="date" required value="${existing?.TANGGAL || today}"></div>
            <div class="field"><label for="tx-code">Saham</label>
              <select id="tx-code" name="kode" required>
                ${stocks.map((s) => `<option value="${esc(s.KODE)}" ${s.KODE === selected ? "selected" : ""}>${esc(s.KODE)} — ${esc(s.NAMA)}</option>`).join("")}
              </select>
            </div>
            <div class="field"><label for="tx-type">Jenis</label>
              <select id="tx-type" name="jenis" required>
                <option value="BELI" ${existing?.JENIS !== "JUAL" ? "selected" : ""}>BELI</option>
                <option value="JUAL" ${existing?.JENIS === "JUAL" ? "selected" : ""}>JUAL</option>
              </select>
            </div>
            <div class="field"><label for="tx-lot">Jumlah lot</label><input id="tx-lot" name="lot" type="number" min="1" step="1" required value="${existing?.LOT ?? ""}" placeholder="10"></div>
            <div class="field"><label for="tx-price">Harga per lembar</label><div class="prefix"><span>Rp</span><input id="tx-price" name="harga" type="number" min="1" step="1" required value="${existing?.HARGA ?? ""}" placeholder="2080"></div></div>
            <div class="field"><label for="tx-fee">Fee</label><div class="prefix"><span>Rp</span><input id="tx-fee" name="fee" type="number" min="0" step="1" value="${existing?.FEE ?? 0}"></div></div>
            <div class="field span-2"><label for="tx-note">Catatan</label><input id="tx-note" name="catatan" maxlength="60" value="${esc(existing?.CATATAN || "")}" placeholder="mis. cicilan bulanan"></div>
          </div>
          <div class="form-error" id="tx-error"></div>
          <div class="small muted mt-2" id="tx-held">Posisi saat ini: ${held ? `${num(held.lots, 0)} lot ${held.code}` : "belum ada"}.
          Transaksi jual dibatasi jumlah lot yang dimiliki.</div>
        </form>
        <div class="modal-foot">
          <button class="btn btn-ghost" type="button" data-action="close-modal">Batal</button>
          <div class="right">
            <button class="btn btn-ghost" type="button" id="tx-reset-fee">Hitung fee</button>
            <button class="btn btn-primary" type="submit" form="tx-form">${icon("check")} Simpan</button>
          </div>
        </div>
      </div>
    </div>`;

  document.body.classList.add("no-scroll");
  const overlay = modalRoot().querySelector(".modal-overlay");
  overlay.addEventListener("mousedown", (ev) => { if (ev.target === overlay) closeModal(); });

  const form = document.getElementById("tx-form");
  const feeInput = form.fee;
  let feeTouched = Boolean(existing);
  feeInput.addEventListener("input", () => { feeTouched = true; });
  const autoFee = () => {
    if (feeTouched) return;
    const gross = (Number(form.lot.value) || 0) * 100 * (Number(form.harga.value) || 0);
    feeInput.value = Math.round(gross * 0.0015);
  };
  form.lot.addEventListener("input", autoFee);
  form.harga.addEventListener("input", autoFee);
  document.getElementById("tx-reset-fee").addEventListener("click", () => {
    const gross = (Number(form.lot.value) || 0) * 100 * (Number(form.harga.value) || 0);
    feeInput.value = Math.round(gross * 0.0015);
    feeTouched = true;
  });
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    saveTransaction(form, existing);
  });
  const updateHeld = () => {
    const code = form.kode.value;
    const pos = DB.computePortfolio().positions.find((p) => p.code === code);
    let available = pos ? pos.lots : 0;
    if (existing && existing.KODE === code && String(existing.JENIS).toUpperCase() === "JUAL") {
      available += Number(existing.LOT) || 0;
    }
    const label = document.getElementById("tx-held");
    if (label) {
      label.innerHTML = `Posisi saat ini: <b>${available ? `${num(available, 0)} lot ${esc(code)}` : `belum ada ${esc(code)}`}</b>.
        Transaksi jual dibatasi jumlah lot yang dimiliki.`;
    }
  };
  form.kode.addEventListener("change", updateHeld);
  updateHeld();
  setTimeout(() => document.getElementById("tx-lot")?.focus(), 60);
}

function saveTransaction(form, existing) {
  const err = document.getElementById("tx-error");
  const show = (msg) => {
    err.textContent = msg;
    err.classList.add("show");
    return false;
  };
  err.classList.remove("show");

  const tanggal = form.tanggal.value;
  const kode = form.kode.value;
  const jenis = form.jenis.value;
  const lot = Number(form.lot.value);
  const harga = Number(form.harga.value);
  const fee = Number(form.fee.value) || 0;
  const catatan = form.catatan.value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return show("Tanggal tidak valid.");
  if (!kode) return show("Pilih saham.");
  if (!(lot > 0) || !Number.isInteger(lot)) return show("Jumlah lot harus bilangan bulat positif.");
  if (!(harga > 0)) return show("Harga harus lebih besar dari nol.");
  if (fee < 0) return show("Fee tidak boleh negatif.");

  if (jenis === "JUAL") {
    const current = DB.computePortfolio().positions.find((p) => p.code === kode);
    let available = current ? current.lots : 0;
    const editingThisSell = existing && existing.KODE === kode && String(existing.JENIS).toUpperCase() === "JUAL";
    if (editingThisSell) available += Number(existing.LOT) || 0;
    if (available <= 0) return show(`Belum ada posisi ${kode} untuk dijual.`);
    if (lot > available) return show(`Lot jual (${lot}) melebihi posisi tersedia (${available} lot).`);
  }

  if (DB.apiMode) {
    const payload = { tanggal, kode, jenis, lot, harga, fee, catatan };
    const request = existing
      ? API.updateTransaction(existing.ID, payload)
      : API.createTransaction(payload);
    request.then(async () => {
      await DB.loadApi();
      closeModal();
      toast(existing ? "Transaksi diperbarui" : "Transaksi ditambahkan");
      refresh();
    }).catch((error) => show(error.message || "Gagal menyimpan transaksi."));
    return true;
  }

  const row = {
    ID: existing?.ID ?? DB.nextId("TRANSAKSI", "ID"),
    TANGGAL: tanggal,
    KODE: kode,
    JENIS: jenis,
    LOT: lot,
    HARGA: harga,
    FEE: fee,
    CATATAN: catatan,
  };

  if (existing) {
    DB.updateRow("TRANSAKSI", ui.txEditing, row);
  } else {
    DB.insertRow("TRANSAKSI", row);
  }
  closeModal();
  toast(existing ? "Transaksi diperbarui" : "Transaksi ditambahkan");
  refresh();
  return true;
}

/* ------------------------------------------------------------------ start */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
