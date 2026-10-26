/**
 * store.js — lapisan data aplikasi.
 *
 * Sumber kebenaran: berkas DBF di /data. Berkas itu dibaca saat aplikasi
 * dimuat, lalu salinan kerja disimpan di localStorage agar perubahan tidak
 * hilang saat halaman dimuat ulang. Pengguna dapat menulis kembali DBF:
 *   - unduh satu tabel / semua tabel (zip), atau
 *   - simpan langsung ke folder lokal lewat File System Access API.
 */
import { parseDbf, buildDbf } from "./dbf.js";
import { makeZip } from "./zip.js";
import * as API from "./api.js";

const LS_KEY = "bursa-dbf/store/v1";
const IDB_NAME = "bursa-dbf";
const IDB_STORE = "handles";

/** Mode API D1 aktif bila index.html menetapkan window.BURSA_API_BASE. */
export const apiMode = Boolean(globalThis.window?.BURSA_API_BASE);

const API_LABELS = {
  SAHAM: ["Master saham", "Profil, harga, rasio, dan rekomendasi emiten."],
  VALUASI: ["Model valuasi", "Nilai wajar, margin of safety, dan skenario."],
  TEKNIKAL: ["Indikator teknikal", "MA, RSI, MACD, ATR, dan level harga."],
  SKOR: ["Skor faktor", "Skor fundamental, valuasi, dividen, teknikal, risiko, prospek."],
  DIVIDEN: ["Riwayat dividen", "Dividen per tahun dan tipe."],
  HISTORIK: ["Historik harga", "Harga mingguan 10 minggu."],
  TRANSAKSI: ["Jurnal transaksi", "Transaksi portofolio pengguna."],
  PENGGUNA: ["Pengguna", "Akun, role, status, dan masa berlaku."],
  PARAM: ["Parameter", "Metadata aplikasi dan sumber harga."],
};

export const state = {
  manifest: null,
  tables: {},
  order: [],
  ready: false,
  dirty: false,
  savedAt: null,
  source: "seed",
  folderHandle: null,
  folderName: null,
  folderPermission: "unknown",
  persistError: null,
  autoRefreshed: false,
  adminUsers: [],
  adminTransactions: [],
  listeners: new Set(),
};

/* ------------------------------------------------------------------ util */
export function subscribe(fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

export function emit() {
  for (const fn of state.listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error(err);
    }
  }
}

const nowISO = () => new Date().toISOString();
const clone = (v) => JSON.parse(JSON.stringify(v));

export function getTable(name) {
  return state.tables[String(name).toUpperCase()] || null;
}

export function rows(name) {
  return getTable(name)?.rows ?? [];
}

export function params() {
  const out = {};
  for (const row of rows("PARAM")) out[row.KUNCI] = row.NILAI;
  return out;
}

export function tableMeta(name) {
  const table = getTable(name);
  if (!table) return null;
  return {
    ...table.meta,
    name: table.name,
    label: table.label,
    description: table.description,
    records: table.rows.length,
    fields: table.schema.length,
    bytes: table.bytes,
  };
}

/* ------------------------------------------------------------ API / D1 */
function inferField(name, value) {
  const isNumber = typeof value === "number";
  return {
    name,
    type: isNumber ? "N" : "C",
    length: isNumber ? 14 : Math.min(254, Math.max(1, String(value ?? "").length)),
    dec: isNumber ? 2 : 0,
  };
}

function apiTable(name, rows) {
  const [label, description] = API_LABELS[name] || [name, "Data dari API D1"];
  const fields = rows.length
    ? Object.keys(rows[0]).map((key) => inferField(key, rows[0][key]))
    : [];
  return {
    name,
    label,
    description,
    file: `${name}.DBF`,
    schema: fields,
    rows,
    bytes: 0,
    updated: new Date().toISOString().slice(0, 10),
    meta: { records: rows.length, fields: fields.length, bytes: 0 },
  };
}

/**
 * Isi store dari /api/bootstrap. Penamaan tabel internal tetap sama agar
 * seluruh view, chart, dan kalkulasi portofolio tidak perlu diubah.
 */
export async function loadApi(payload = null) {
  const data = payload || await API.bootstrap();
  const params = data.params && typeof data.params === "object" ? data.params : {};
  const paramRows = Object.entries(params).map(([KUNCI, NILAI]) => ({ KUNCI, NILAI }));

  const previousUsers = state.tables.PENGGUNA;
  const tables = {
    SAHAM: apiTable("SAHAM", data.stocks || []),
    VALUASI: apiTable("VALUASI", data.valuations || []),
    TEKNIKAL: apiTable("TEKNIKAL", data.technicals || []),
    SKOR: apiTable("SKOR", data.scores || []),
    DIVIDEN: apiTable("DIVIDEN", data.dividends || []),
    HISTORIK: apiTable("HISTORIK", data.history || []),
    TRANSAKSI: apiTable("TRANSAKSI", data.transactions || []),
    PENGGUNA: previousUsers || apiTable("PENGGUNA", []),
    PARAM: apiTable("PARAM", paramRows),
  };
  state.tables = tables;
  state.order = ["SAHAM", "VALUASI", "TEKNIKAL", "SKOR", "DIVIDEN", "HISTORIK", "TRANSAKSI", "PENGGUNA", "PARAM"];
  state.manifest = {
    app: "Bursa DBF",
    version: "api-v1",
    generated: data.meta?.dataDate || null,
    dataDate: data.meta?.dataDate || null,
    priceUpdated: data.meta?.priceDate || null,
    source: "Cloudflare D1",
    tables: state.order.map((name) => ({
      name,
      file: `${name}.DBF`,
      label: tables[name].label,
      description: tables[name].description,
      records: tables[name].rows.length,
      fields: tables[name].schema.length,
      bytes: 0,
    })),
  };
  state.ready = true;
  state.dirty = false;
  state.source = "api";
  state.savedAt = nowISO();
  emit();
  return data;
}

export async function reloadApi() {
  return loadApi();
}

/** Data seluruh portofolio user untuk tampilan admin (read-only). */
export async function loadAdminPortfolios() {
  const data = await API.adminPortfolios();
  state.adminUsers = data.users || [];
  state.adminTransactions = data.transactions || [];
  emit();
  return data;
}

export function clearAdminPortfolios() {
  state.adminUsers = [];
  state.adminTransactions = [];
}

export function adminTransactionsFor(userId) {
  const id = Number(userId);
  return state.adminTransactions.filter((tx) => Number(tx.USER_ID) === id);
}

/** Cache pengguna dari /api/users untuk halaman admin. */
export function setApiUsers(list) {
  const rows = (list || []).map((u) => ({
    ID: u.id,
    USERNAME: u.username,
    NAMA: u.name,
    ROLE: u.role,
    STATUS: u.status,
    EXPIRED: u.expired || "",
    MUSTCHG: u.mustChange ? "Y" : "N",
    CREATED: u.created || "",
    UPDATED: u.updated || "",
    CATATAN: u.note || "",
  }));
  const table = apiTable("PENGGUNA", rows);
  state.tables.PENGGUNA = table;
  if (!state.order.includes("PENGGUNA")) {
    state.order.splice(state.order.length - 1, 0, "PENGGUNA");
  }
  emit();
  return rows;
}

/* --------------------------------------------------------------- init */
export async function init() {
  const res = await fetch("data/manifest.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`manifest.json tidak ditemukan (HTTP ${res.status})`);
  const manifest = await res.json();
  state.manifest = manifest;

  const loaded = await Promise.all(
    manifest.tables.map(async (meta) => {
      const r = await fetch(`data/${meta.file}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`${meta.file} tidak ditemukan (HTTP ${r.status})`);
      const parsed = parseDbf(await r.arrayBuffer());
      return [meta, parsed];
    })
  );

  state.tables = {};
  state.order = [];
  for (const [meta, parsed] of loaded) {
    state.tables[meta.name] = {
      name: meta.name,
      label: meta.label,
      description: meta.description,
      file: meta.file,
      schema: parsed.fields,
      rows: parsed.rows,
      bytes: parsed.bytes,
      updated: parsed.updated,
      meta: {
        records: meta.records,
        fields: meta.fields,
        bytes: meta.bytes,
        sha1: meta.sha1,
      },
    };
    state.order.push(meta.name);
  }

  const cached = readCache();
  if (cached) {
    const stale = cacheIsStale(cached);
    const freshNames = new Set(Object.keys(state.tables));
    const freshTx = JSON.stringify(state.tables.TRANSAKSI?.rows ?? []);
    applyCache(cached, { keepReference: stale });
    if (stale) {
      // data .DBF di server lebih baru: pakai referensi baru, pertahankan transaksi
      const extras = state.order.filter((n) => !freshNames.has(n));
      state.dirty = JSON.stringify(state.tables.TRANSAKSI?.rows ?? []) !== freshTx || extras.length > 0;
      state.savedAt = nowISO();
      state.source = "seed";
      state.autoRefreshed = true;
      persistLocal();
    } else {
      state.source = "local";
    }
  }

  // Jangan blokir render bila IndexedDB lambat/tidak tersedia.
  restoreFolderHandle().catch((err) => console.warn("folder handle:", err));
  state.ready = true;
  emit();
}

function readCache() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== state.manifest?.version || !data.tables) return null;
    return data;
  } catch {
    return null;
  }
}

function cacheIsStale(cache) {
  const generated = cache.generated;
  const priceUpdated = cache.priceUpdated;
  const manifestGenerated = state.manifest?.generated || "";
  const manifestPrice = state.manifest?.priceUpdated || "";
  if (!generated && !priceUpdated) {
    // cache lama tanpa penanda: perlakukan basi bila server sudah punya data harga baru
    return Boolean(manifestPrice);
  }
  return (generated || "") !== manifestGenerated || (priceUpdated || "") !== manifestPrice;
}

function applyCache(cache, { keepReference = false } = {}) {
  let applied = 0;
  for (const [name, table] of Object.entries(cache.tables)) {
    if (!table?.fields || !Array.isArray(table.rows)) continue;
    // saat data server berubah, tabel referensi diambil dari .DBF baru
    if (keepReference && name !== "TRANSAKSI" && state.tables[name]) continue;
    const existing = state.tables[name];
    state.tables[name] = {
      name,
      label: table.label || existing?.label || name,
      description: table.description || existing?.description || "Tabel tersimpan di browser",
      file: table.file || `${name}.DBF`,
      schema: table.fields,
      rows: table.rows,
      bytes: existing?.bytes || 0,
      updated: cache.savedAt ? cache.savedAt.slice(0, 10) : existing?.updated || null,
      meta: existing?.meta || { records: table.rows.length, fields: table.fields.length, bytes: 0 },
    };
    if (!state.order.includes(name)) state.order.push(name);
    applied++;
  }
  state.dirty = Boolean(cache.dirty);
  state.savedAt = cache.savedAt || null;
  if (applied) state.source = "local";
}

export function persistLocal() {
  try {
    const payload = {
      version: state.manifest?.version ?? "0",
      generated: state.manifest?.generated ?? null,
      priceUpdated: state.manifest?.priceUpdated ?? null,
      savedAt: state.savedAt || nowISO(),
      dirty: state.dirty,
      tables: {},
    };
    for (const [name, t] of Object.entries(state.tables)) {
      payload.tables[name] = {
        label: t.label,
        description: t.description,
        file: t.file,
        fields: t.schema,
        rows: t.rows,
      };
    }
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    state.persistError = null;
  } catch (err) {
    state.persistError = err?.message || "Penyimpanan browser penuh";
    console.warn("localStorage gagal:", err);
  }
}

function touch({ saved = false, source = null } = {}) {
  state.savedAt = nowISO();
  if (saved) state.dirty = false;
  else state.dirty = true;
  if (source) state.source = source;
  persistLocal();
  emit();
}

export function resetLocal() {
  // jangan menulis ulang cache: hapus saja agar init() memuat ulang data/*.DBF
  localStorage.removeItem(LS_KEY);
  state.dirty = false;
  state.savedAt = null;
}

/**
 * Ambil ulang seluruh tabel referensi dari data/*.DBF tanpa kehilangan
 * jurnal transaksi. Dipakai setelah berkas DBF diperbarui di server/disk.
 */
export async function reloadReference() {
  const res = await fetch("data/manifest.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`manifest.json tidak ditemukan (HTTP ${res.status})`);
  const manifest = await res.json();

  const loaded = await Promise.all(
    manifest.tables.map(async (meta) => {
      const r = await fetch(`data/${meta.file}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`${meta.file} tidak ditemukan (HTTP ${r.status})`);
      return [meta, parseDbf(await r.arrayBuffer())];
    })
  );

  const localTx = state.tables.TRANSAKSI;
  const previous = state.tables;
  const fresh = {};
  for (const [meta, parsed] of loaded) {
    fresh[meta.name] = {
      name: meta.name,
      label: meta.label,
      description: meta.description,
      file: meta.file,
      schema: parsed.fields,
      rows: parsed.rows,
      bytes: parsed.bytes,
      updated: parsed.updated,
      meta: { records: meta.records, fields: meta.fields, bytes: meta.bytes, sha1: meta.sha1 },
    };
  }

  const seedTx = fresh.TRANSAKSI ? JSON.stringify(fresh.TRANSAKSI.rows) : null;
  // pertahankan jurnal lokal apa adanya (termasuk skema hasil impor)
  if (localTx) fresh.TRANSAKSI = localTx;

  // pertahankan tabel tambahan hasil impor yang tidak ada di manifest
  const extraNames = state.order.filter((n) => !fresh[n] && previous[n]);
  for (const name of extraNames) fresh[name] = previous[name];

  state.tables = fresh;
  state.order = manifest.tables.map((t) => t.name).concat(extraNames);
  state.manifest = manifest;
  state.savedAt = nowISO();
  state.dirty = localTx ? JSON.stringify(localTx.rows) !== seedTx : false;
  persistLocal();
  emit();
  return {
    tables: manifest.tables.length,
    transactions: localTx ? localTx.rows.length : 0,
    dirty: state.dirty,
  };
}

/* -------------------------------------------------------- mutasi tabel */
export function getRow(tableName, index) {
  return getTable(tableName)?.rows[index] ?? null;
}

export function insertRow(tableName, row) {
  const table = getTable(tableName);
  if (!table) throw new Error(`Tabel ${tableName} tidak ada`);
  table.rows.push(row);
  touch({ source: "local" });
  return row;
}

export function updateRow(tableName, index, patch) {
  const table = getTable(tableName);
  if (!table || !table.rows[index]) throw new Error("Baris tidak ditemukan");
  table.rows[index] = { ...table.rows[index], ...patch };
  touch({ source: "local" });
}

export function deleteRow(tableName, index) {
  const table = getTable(tableName);
  if (!table) return;
  table.rows.splice(index, 1);
  touch({ source: "local" });
}

export function replaceRows(tableName, newRows) {
  const table = getTable(tableName);
  if (!table) return;
  table.rows = newRows;
  touch({ source: "local" });
}

export function nextId(tableName = "TRANSAKSI", field = "ID") {
  const list = rows(tableName).map((r) => Number(r[field]) || 0);
  return (list.length ? Math.max(...list) : 0) + 1;
}

/* ----------------------------------------------------------- saham join */
export function stockList() {
  const saham = rows("SAHAM");
  if (!saham.length) return [];
  const index = (name) => new Map(rows(name).map((r) => [r.KODE, r]));
  const valuasi = index("VALUASI");
  const teknikal = index("TEKNIKAL");
  const skor = index("SKOR");
  const dividen = new Map();
  for (const d of rows("DIVIDEN")) {
    if (!dividen.has(d.KODE)) dividen.set(d.KODE, []);
    dividen.get(d.KODE).push(d);
  }
  const historik = new Map();
  for (const h of rows("HISTORIK")) {
    if (!historik.has(h.KODE)) historik.set(h.KODE, []);
    historik.get(h.KODE).push(h);
  }
  return saham.map((s) => ({
    ...s,
    valuasi: valuasi.get(s.KODE) || null,
    teknikal: teknikal.get(s.KODE) || null,
    skor: skor.get(s.KODE) || null,
    dividen: (dividen.get(s.KODE) || []).sort((a, b) => a.TAHUN - b.TAHUN),
    historik: (historik.get(s.KODE) || []).sort((a, b) => a.MINGGU - b.MINGGU),
  }));
}

export function stockByCode(code) {
  return stockList().find((s) => s.KODE === code) || null;
}

/* -------------------------------------------------------------- portofolio */
const LOT_SIZE = 100;

export function computePortfolio(transactions = rows("TRANSAKSI")) {
  const stocks = stockList();
  const priceOf = new Map(stocks.map((s) => [s.KODE, s]));
  const txs = transactions
    .map((row, index) => ({ ...row, _index: index }))
    .sort((a, b) => String(a.TANGGAL).localeCompare(String(b.TANGGAL)) || a.ID - b.ID);

  const groups = new Map();
  let realized = 0;
  let validTx = 0;

  for (const tx of txs) {
    const lots = Number(tx.LOT) || 0;
    const price = Number(tx.HARGA) || 0;
    if (!lots || !price) continue;
    const gross = lots * LOT_SIZE * price;
    const fee = Number(tx.FEE) || 0;
    const g = groups.get(tx.KODE) || { code: tx.KODE, lots: 0, cost: 0 };
    if (String(tx.JENIS).toUpperCase() === "JUAL") {
      if (g.lots <= 0) continue;
      const sold = Math.min(lots, g.lots);
      const avg = g.cost / g.lots;
      const costOut = avg * sold;
      const proceeds = gross * (sold / lots) - fee * (sold / lots);
      g.cost -= costOut;
      g.lots -= sold;
      realized += proceeds - costOut;
    } else {
      g.lots += lots;
      g.cost += gross + fee;
    }
    validTx++;
    groups.set(tx.KODE, g);
  }

  const positions = [];
  for (const g of groups.values()) {
    if (g.lots <= 0.0001) continue;
    const stock = priceOf.get(g.code);
    const last = stock?.HARGA ?? g.cost / (g.lots * LOT_SIZE);
    const value = g.lots * LOT_SIZE * last;
    const pnl = value - g.cost;
    positions.push({
      code: g.code,
      name: stock?.NAMA || g.code,
      lots: g.lots,
      avg: g.cost / (g.lots * LOT_SIZE),
      cost: g.cost,
      price: last,
      value,
      pnl,
      pnlPct: g.cost > 0 ? pnl / g.cost : null,
      dps: stock?.DPS ?? 0,
      dividend: (stock?.DPS ?? 0) * g.lots * LOT_SIZE,
      score: stock?.SKOR ?? null,
      rating: stock?.RATING ?? null,
    });
  }

  const totalValue = positions.reduce((a, p) => a + p.value, 0);
  const totalCost = positions.reduce((a, p) => a + p.cost, 0);
  for (const p of positions) p.weight = totalValue > 0 ? p.value / totalValue : 0;
  positions.sort((a, b) => b.value - a.value);

  return {
    positions,
    totals: {
      value: totalValue,
      cost: totalCost,
      pnl: totalValue - totalCost,
      pnlPct: totalCost > 0 ? (totalValue - totalCost) / totalCost : null,
      dividend: positions.reduce((a, p) => a + p.dividend, 0),
      yieldOnCost: totalCost > 0 ? positions.reduce((a, p) => a + p.dividend, 0) / totalCost : null,
    },
    realized,
    txCount: validTx,
    transactions: txs.slice().reverse(),
  };
}

export function simulationDefaults() {
  const stocks = stockList();
  const avgDy = stocks.length
    ? stocks.reduce((a, s) => a + (Number(s.DY) || 0), 0) / stocks.length
    : 0.085;
  return {
    initial: 0,
    monthly: 5000000,
    years: 20,
    priceGrowth: 0.06,
    divYield: Math.round(avgDy * 1000) / 1000,
    divGrowth: 0.05,
    reinvest: true,
  };
}

function monthlyIrr(flows) {
  if (!flows.length || !flows.some((f) => f.amount > 0) || !flows.some((f) => f.amount < 0)) return null;
  const npv = (r) => flows.reduce((a, f) => a + f.amount / Math.pow(1 + r, f.t), 0);
  let lo = -0.9;
  let hi = 1;
  let flo = npv(lo);
  let fhi = npv(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const v = npv(mid);
    if (Math.abs(v) < 1e-6) return mid;
    if (v * flo < 0) hi = mid;
    else { lo = mid; flo = v; }
  }
  return (lo + hi) / 2;
}

export function simulate({
  initial = 0,
  monthly = 0,
  years = 20,
  priceGrowth = 0.06,
  divYield = 0.08,
  divGrowth = 0.05,
  reinvest = true,
} = {}) {
  const months = Math.max(1, Math.min(50, Math.round(years))) * 12;
  const pm = Math.pow(1 + priceGrowth, 1 / 12) - 1;
  let price = 1;
  let dps = divYield;
  let shares = initial > 0 ? initial / price : 0;
  let invested = initial;
  let cash = 0;
  const series = [{ year: 0, invested, value: initial, income: 0, shares, price: 1 }];
  const flows = [];
  if (initial > 0) flows.push({ t: 0, amount: -initial });

  for (let m = 1; m <= months; m++) {
    if (m > 1 && (m - 1) % 12 === 0) dps *= 1 + divGrowth;
    price *= 1 + pm;
    const dividendCash = shares * (dps / 12);
    if (reinvest) shares += (monthly + dividendCash) / price;
    else {
      shares += monthly / price;
      cash += dividendCash;
    }
    invested += monthly;
    if (monthly > 0) flows.push({ t: m, amount: -monthly });
    if (m % 12 === 0) {
      series.push({
        year: m / 12,
        invested,
        value: shares * price + cash,
        income: shares * dps,
        shares,
        price,
      });
    }
  }

  const last = series[series.length - 1];
  flows.push({ t: months, amount: last.value });
  const monthlyRate = monthlyIrr(flows);
  return {
    series,
    final: last.value,
    invested: last.invested,
    income: last.income,
    multiple: last.invested > 0 ? last.value / last.invested : null,
    dividends: last.income,
    irr: monthlyRate === null ? null : Math.pow(1 + monthlyRate, 12) - 1,
    cagr: last.invested > 0 ? Math.pow(last.value / last.invested, 1 / Math.max(1, years)) - 1 : null,
  };
}

/* --------------------------------------------------------------- ekspor */
function dbfBytes(table) {
  // cap tanggal header = waktu ekspor, bukan tanggal data
  return buildDbf(table.schema, table.rows, { updated: new Date() });
}

function download(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function exportTable(name) {
  const table = getTable(name);
  if (!table) throw new Error(`Tabel ${name} tidak ada`);
  const bytes = dbfBytes(table);
  download(bytes, `${table.name}.DBF`);
  markExported(`unduh ${table.name}.DBF`);
  return bytes.byteLength;
}

export function exportZip() {
  const files = [];
  for (const name of state.order) {
    const table = state.tables[name];
    if (!table) continue;
    files.push({ name: `${name}.DBF`, data: dbfBytes(table) });
  }
  files.push({ name: "BACA-INI.txt", data: BACA_INI });
  const zip = makeZip(files);
  const stamp = new Date().toISOString().slice(0, 10);
  download(zip, `bursa-dbf-${stamp}.zip`);
  markExported("unduh arsip ZIP");
  return zip.byteLength;
}

const BACA_INI = `Arsip DBF - Bursa DBF
=========================

Berkas .DBF di arsip ini adalah tabel dBase III yang bisa dibuka di
Excel, LibreOffice Calc, Python (dbfread), atau FoxPro.

Cara memakai:
1. Ekstrak arsip.
2. Ganti berkas di folder data/ repositori dengan berkas dari arsip ini.
3. Commit dan push -> GitHub Pages menyajikan data terbaru.

Catatan: aplikasi web statis tidak dapat menulis ke server GitHub.
Perubahan dari UI disimpan di localStorage browser dan ditulis ke .DBF
lewat tombol "Simpan ke folder" atau "Unduh .DBF".
`;

export function markExported(label) {
  state.dirty = false;
  state.savedAt = nowISO();
  persistLocal();
  emit();
  return label;
}

/* --------------------------------------------------------- impor DBF */
export function importDbf(fileName, buffer) {
  const parsed = parseDbf(buffer);
  const base = String(fileName || "IMPOR")
    .replace(/\.dbf$/i, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toUpperCase()
    .slice(0, 10);
  const name = base || "IMPOR";
  const existing = state.tables[name];
  state.tables[name] = {
    name,
    label: existing?.label || `Impor ${name}`,
    description: existing?.description || `Tabel hasil impor ${fileName}`,
    file: `${name}.DBF`,
    schema: parsed.fields,
    rows: parsed.rows,
    bytes: parsed.bytes,
    updated: parsed.updated,
    meta: { records: parsed.rows.length, fields: parsed.fields.length, bytes: parsed.bytes },
  };
  if (!state.order.includes(name)) state.order.push(name);
  touch({ source: "import" });
  return { name, records: parsed.rows.length, fields: parsed.fields.length };
}

/* --------------------------------------------------- File System Access */
export function supportsFolder() {
  return typeof window.showDirectoryPicker === "function" && window.isSecureContext;
}

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await idbOpen();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet(key) {
  const db = await idbOpen();
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}

async function restoreFolderHandle() {
  if (!supportsFolder()) return;
  try {
    const handle = await idbGet("dataDir");
    if (!handle) return;
    const perm = await handle.queryPermission({ mode: "readwrite" });
    state.folderHandle = handle;
    state.folderName = handle.name;
    state.folderPermission = perm;
  } catch (err) {
    console.warn("folder handle tidak dapat dipulihkan:", err);
  }
}

export async function chooseFolder() {
  if (!supportsFolder()) throw new Error("Browser ini tidak mendukung akses folder");
  const handle = await window.showDirectoryPicker({ id: "bursa-dbf-data", mode: "readwrite" });
  state.folderHandle = handle;
  state.folderName = handle.name;
  const perm = await handle.requestPermission({ mode: "readwrite" });
  state.folderPermission = perm;
  await idbSet("dataDir", handle);
  emit();
  return handle;
}

export async function saveToFolder() {
  let handle = state.folderHandle;
  if (!handle) handle = await chooseFolder();
  let perm = await handle.queryPermission({ mode: "readwrite" });
  if (perm !== "granted") perm = await handle.requestPermission({ mode: "readwrite" });
  state.folderPermission = perm;
  if (perm !== "granted") throw new Error("Izin menulis folder ditolak");

  let count = 0;
  for (const name of state.order) {
    const table = state.tables[name];
    if (!table) continue;
    const fileHandle = await handle.getFileHandle(`${name}.DBF`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([dbfBytes(table)], { type: "application/octet-stream" }));
    await writable.close();
    count++;
  }
  markExported(`folder ${handle.name}`);
  return count;
}

/* --------------------------------------------------------------- misc */
export function tableBytes() {
  return state.order.reduce((a, name) => a + (state.tables[name]?.bytes || 0), 0);
}

export function dataAge() {
  return state.manifest?.dataDate || params().TANGGAL_DATA || null;
}

/** Tanggal harga terakhir (bisa diperbarui lewat modal Update harga). */
export function priceDate() {
  return params().HARGA_PER || dataAge();
}

/** Sumber harga terakhir, mis. "Yahoo Finance (delayed)". */
export function priceSource() {
  return params().HARGA_SUMBER || null;
}

/**
 * Perbarui harga saham dan rasio yang bergantung pada harga.
 * Nilai wajar, skor, dan indikator teknikal tidak dihitung ulang.
 */
export function updatePrices(prices, date = new Date().toISOString().slice(0, 10)) {
  if (apiMode) {
    return API.updatePrices(prices).then(async (result) => {
      await loadApi();
      return Array.isArray(result.changed) ? result.changed.length : 0;
    });
  }
  const saham = rows("SAHAM");
  const valuasi = rows("VALUASI");
  let changed = 0;

  for (const [code, raw] of Object.entries(prices)) {
    const price = Number(raw);
    if (!Number.isFinite(price) || price <= 0) continue;
    const row = saham.find((r) => r.KODE === code);
    if (!row || Number(row.HARGA) === price) continue;

    row.HARGA = price;
    row.PE = row.EPS ? price / row.EPS : null;
    row.PB = row.BVPS ? price / row.BVPS : null;
    row.DY = row.DPS ? row.DPS / price : null;
    row.MOS = row.FV ? (row.FV - price) / row.FV : null;
    row.UPDAT = date;

    const v = valuasi.find((r) => r.KODE === code);
    if (v && row.FV) v.MOS = row.MOS;
    changed++;
  }

  if (changed) {
    const param = rows("PARAM").find((r) => r.KUNCI === "HARGA_PER");
    if (param) param.NILAI = date;
    else rows("PARAM").push({ KUNCI: "HARGA_PER", NILAI: date });
    const source = rows("PARAM").find((r) => r.KUNCI === "HARGA_SUMBER");
    if (source) source.NILAI = "Input manual";
    else rows("PARAM").push({ KUNCI: "HARGA_SUMBER", NILAI: "Input manual" });
    touch({ source: "local" });
  }
  return changed;
}

export { LOT_SIZE };
