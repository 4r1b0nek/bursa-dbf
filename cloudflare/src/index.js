/**
 * Bursa DBF API — Cloudflare Worker + D1.
 *
 * Browser tidak pernah menerima nama tabel DBF atau file database.
 * Semua akses lewat endpoint /api/* dan token HMAC.
 *
 * Secrets:
 *   SESSION_SECRET  (wajib)  — kunci penandatanganan token
 * Vars:
 *   ALLOWED_ORIGINS (opsional) — daftar origin dipisah koma
 */

const SESSION_SECONDS = 8 * 60 * 60;
const PASSWORD_ITERATIONS = 100000; // batas maksimum PBKDF2 Web Crypto di Workers
const encoder = new TextEncoder();

/* ------------------------------------------------------------------ util */
function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(text) {
  const s = String(text).replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function fromB64(text) {
  const bin = atob(String(text || ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toB64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function same(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isExpired(user) {
  return Boolean(user?.EXPIRED) && String(user.EXPIRED) < today();
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.ID,
    username: row.USERNAME,
    name: row.NAMA,
    role: row.ROLE,
    status: row.STATUS,
    expired: row.EXPIRED || null,
    mustChange: String(row.MUSTCHG).toUpperCase() === "Y",
    created: row.CREATED,
    updated: row.UPDATED,
    note: row.CATATAN || "",
  };
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = allowedOrigins(env);
  const local = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && (allowed.includes(origin) || local)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request, env),
    },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- password */
async function hashPassword(password, saltB64, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(String(password)), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromB64(saltB64), iterations, hash: "SHA-256" },
    key, 256
  );
  return toB64(new Uint8Array(bits));
}

function newSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toB64(bytes);
}

function validatePassword(password) {
  const value = String(password || "");
  if (value.length < 8) return "Password minimal 8 karakter.";
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "Password harus mengandung huruf dan angka.";
  return null;
}

function validateUsername(username) {
  return /^[a-zA-Z0-9._-]{3,20}$/.test(String(username || "").trim())
    ? null : "Username 3–20 karakter: huruf, angka, titik, garis bawah, strip.";
}

function validateDate(value) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

/* ---------------------------------------------------------------- token */
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return b64url(new Uint8Array(sig));
}

async function issueToken(user, env) {
  if (!env.SESSION_SECRET) throw new Error("SESSION_SECRET belum diset");
  const payload = { uid: Number(user.ID), exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS };
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(env.SESSION_SECRET, body)}`;
}

async function tokenUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
  } catch {
    return null;
  }
  if (!payload || !payload.uid || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  const expected = await hmac(env.SESSION_SECRET, body);
  if (!same(sig, expected)) return null;

  const user = await env.DB.prepare("SELECT * FROM PENGGUNA WHERE ID = ?").bind(payload.uid).first();
  if (!user || String(user.STATUS).toUpperCase() !== "AKTIF" || isExpired(user)) return null;
  return user;
}

/* ------------------------------------------------------------- database */
async function nextId(env, table) {
  const row = await env.DB.prepare(`SELECT COALESCE(MAX(ID), 0) + 1 AS NEXT FROM ${table}`).first();
  return Number(row?.NEXT || 1);
}

async function activeAdmins(env, excludeId = null) {
  const rows = await env.DB.prepare(
    "SELECT * FROM PENGGUNA WHERE ROLE = 'ADMIN' AND STATUS = 'AKTIF'"
  ).all();
  return (rows.results || []).filter((u) => !isExpired(u) && Number(u.ID) !== Number(excludeId));
}

/* ---------------------------------------------------------------- routes */
async function login(request, env) {
  const body = await readJson(request);
  if (!body?.username || !body?.password) return json({ error: "Username dan password wajib." }, 400, request, env);

  const user = await env.DB.prepare(
    "SELECT * FROM PENGGUNA WHERE USERNAME = ? COLLATE NOCASE"
  ).bind(String(body.username).trim()).first();
  if (!user) return json({ error: "Username atau password salah." }, 401, request, env);

  const digest = await hashPassword(body.password, user.SALT, Number(user.ITER) || PASSWORD_ITERATIONS);
  if (!same(digest, user.PASSHASH)) {
    return json({ error: "Username atau password salah." }, 401, request, env);
  }
  if (String(user.STATUS).toUpperCase() !== "AKTIF") {
    return json({ error: "Akun dinonaktifkan. Hubungi administrator." }, 403, request, env);
  }
  if (isExpired(user)) {
    return json({ error: `Akun kedaluwarsa sejak ${user.EXPIRED}. Hubungi administrator.` }, 403, request, env);
  }

  return json({
    token: await issueToken(user, env),
    user: publicUser(user),
    mustChange: String(user.MUSTCHG).toUpperCase() === "Y",
  }, 200, request, env);
}

async function me(request, env, user) {
  return json({ user: publicUser(user) }, 200, request, env);
}

async function changePassword(request, env, user) {
  const body = await readJson(request);
  if (!body?.current || !body?.next) return json({ error: "Password saat ini dan baru wajib." }, 400, request, env);
  const digest = await hashPassword(body.current, user.SALT, Number(user.ITER) || PASSWORD_ITERATIONS);
  if (!same(digest, user.PASSHASH)) return json({ error: "Password saat ini salah." }, 403, request, env);
  const invalid = validatePassword(body.next);
  if (invalid) return json({ error: invalid }, 400, request, env);

  const salt = newSalt();
  const hash = await hashPassword(body.next, salt, PASSWORD_ITERATIONS);
  await env.DB.prepare(
    "UPDATE PENGGUNA SET PASSHASH = ?, SALT = ?, ITER = ?, MUSTCHG = 'N', UPDATED = ? WHERE ID = ?"
  ).bind(hash, salt, PASSWORD_ITERATIONS, today(), user.ID).run();
  return json({ ok: true }, 200, request, env);
}

async function bootstrap(request, env, user) {
  const [stocks, valuations, technicals, scores, dividends, history, params, tx] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM SAHAM ORDER BY SKOR DESC"),
    env.DB.prepare("SELECT * FROM VALUASI ORDER BY KODE"),
    env.DB.prepare("SELECT * FROM TEKNIKAL ORDER BY KODE"),
    env.DB.prepare("SELECT * FROM SKOR ORDER BY KODE"),
    env.DB.prepare("SELECT * FROM DIVIDEN ORDER BY KODE, TAHUN"),
    env.DB.prepare("SELECT * FROM HISTORIK ORDER BY KODE, MINGGU"),
    env.DB.prepare("SELECT * FROM PARAM ORDER BY KUNCI"),
    env.DB.prepare("SELECT * FROM TRANSAKSI WHERE USER_ID = ? ORDER BY TANGGAL, ID").bind(user.ID),
  ]);
  const paramMap = {};
  for (const row of params.results || []) paramMap[row.KUNCI] = row.NILAI;
  return json({
    user: publicUser(user),
    stocks: stocks.results || [],
    valuations: valuations.results || [],
    technicals: technicals.results || [],
    scores: scores.results || [],
    dividends: dividends.results || [],
    history: history.results || [],
    params: paramMap,
    transactions: (tx.results || []).map((r) => ({ ...r, USER_ID: undefined })),
    meta: {
      priceDate: paramMap.HARGA_PER || paramMap.TANGGAL_DATA || null,
      dataDate: paramMap.TANGGAL_DATA || null,
      source: "Cloudflare D1",
    },
  }, 200, request, env);
}

async function listTransactions(request, env, user) {
  const rows = await env.DB.prepare(
    "SELECT * FROM TRANSAKSI WHERE USER_ID = ? ORDER BY TANGGAL, ID"
  ).bind(user.ID).all();
  return json({ transactions: rows.results || [] }, 200, request, env);
}

function validateTransaction(body) {
  if (!validateDate(body?.tanggal)) return "Tanggal tidak valid.";
  if (!body?.kode) return "Kode saham wajib.";
  const side = String(body?.jenis || "").toUpperCase();
  if (!["BELI", "JUAL"].includes(side)) return "Jenis harus BELI atau JUAL.";
  const lots = Number(body?.lot);
  const price = Number(body?.harga);
  const fee = Number(body?.fee || 0);
  if (!Number.isInteger(lots) || lots <= 0) return "Lot harus bilangan bulat positif.";
  if (!Number.isFinite(price) || price <= 0) return "Harga harus lebih dari 0.";
  if (!Number.isFinite(fee) || fee < 0) return "Fee tidak valid.";
  return null;
}

async function createTransaction(request, env, user) {
  const body = await readJson(request);
  const invalid = validateTransaction(body);
  if (invalid) return json({ error: invalid }, 400, request, env);
  const code = String(body.kode).toUpperCase();
  const stock = await env.DB.prepare("SELECT KODE FROM SAHAM WHERE KODE = ?").bind(code).first();
  if (!stock) return json({ error: `Saham ${code} tidak ditemukan.` }, 404, request, env);

  if (String(body.jenis).toUpperCase() === "JUAL") {
    const held = await env.DB.prepare(
      "SELECT COALESCE(SUM(CASE WHEN JENIS = 'BELI' THEN LOT ELSE -LOT END), 0) AS HELD FROM TRANSAKSI WHERE USER_ID = ? AND KODE = ?"
    ).bind(user.ID, code).first();
    if (Number(held?.HELD || 0) < Number(body.lot)) {
      return json({ error: `Lot jual melebihi posisi (${held?.HELD || 0} lot).` }, 400, request, env);
    }
  }

  const id = await nextId(env, "TRANSAKSI");
  await env.DB.prepare(
    "INSERT INTO TRANSAKSI (ID, USER_ID, TANGGAL, KODE, JENIS, LOT, HARGA, FEE, CATATAN) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, user.ID, body.tanggal, code, String(body.jenis).toUpperCase(),
    Number(body.lot), Number(body.harga), Number(body.fee || 0), String(body.catatan || "").slice(0, 60)).run();
  const row = await env.DB.prepare("SELECT * FROM TRANSAKSI WHERE ID = ?").bind(id).first();
  return json({ transaction: row }, 201, request, env);
}

async function updateTransaction(request, env, user, id) {
  const body = await readJson(request);
  const invalid = validateTransaction(body);
  if (invalid) return json({ error: invalid }, 400, request, env);
  const existing = await env.DB.prepare("SELECT * FROM TRANSAKSI WHERE ID = ? AND USER_ID = ?").bind(id, user.ID).first();
  if (!existing) return json({ error: "Transaksi tidak ditemukan." }, 404, request, env);
  await env.DB.prepare(
    "UPDATE TRANSAKSI SET TANGGAL = ?, KODE = ?, JENIS = ?, LOT = ?, HARGA = ?, FEE = ?, CATATAN = ? WHERE ID = ? AND USER_ID = ?"
  ).bind(body.tanggal, String(body.kode).toUpperCase(), String(body.jenis).toUpperCase(),
    Number(body.lot), Number(body.harga), Number(body.fee || 0), String(body.catatan || "").slice(0, 60), id, user.ID).run();
  const row = await env.DB.prepare("SELECT * FROM TRANSAKSI WHERE ID = ?").bind(id).first();
  return json({ transaction: row }, 200, request, env);
}

async function deleteTransaction(request, env, user, id) {
  const existing = await env.DB.prepare("SELECT ID FROM TRANSAKSI WHERE ID = ? AND USER_ID = ?").bind(id, user.ID).first();
  if (!existing) return json({ error: "Transaksi tidak ditemukan." }, 404, request, env);
  await env.DB.prepare("DELETE FROM TRANSAKSI WHERE ID = ? AND USER_ID = ?").bind(id, user.ID).run();
  return json({ ok: true }, 200, request, env);
}

async function clearTransactions(request, env, user) {
  const result = await env.DB.prepare("DELETE FROM TRANSAKSI WHERE USER_ID = ?").bind(user.ID).run();
  return json({ ok: true, deleted: result.meta?.changes ?? 0 }, 200, request, env);
}

/* ---------------------------------------------------------------- users */
async function listUsers(request, env) {
  const rows = await env.DB.prepare("SELECT * FROM PENGGUNA ORDER BY ROLE DESC, USERNAME").all();
  return json({ users: (rows.results || []).map(publicUser) }, 200, request, env);
}

async function adminPortfolios(request, env) {
  const users = await env.DB.prepare("SELECT * FROM PENGGUNA ORDER BY USERNAME").all();
  const tx = await env.DB.prepare(
    "SELECT T.*, P.USERNAME, P.NAMA FROM TRANSAKSI T JOIN PENGGUNA P ON P.ID = T.USER_ID ORDER BY T.USER_ID, T.TANGGAL, T.ID"
  ).all();
  return json({
    users: (users.results || []).map(publicUser),
    transactions: tx.results || [],
  }, 200, request, env);
}

async function createUser(request, env) {
  const body = await readJson(request);
  const usernameError = validateUsername(body?.username);
  if (usernameError) return json({ error: usernameError }, 400, request, env);
  if (!String(body?.name || "").trim()) return json({ error: "Nama wajib diisi." }, 400, request, env);
  const role = String(body?.role || "USER").toUpperCase();
  if (!["ADMIN", "USER"].includes(role)) return json({ error: "Role tidak valid." }, 400, request, env);
  const invalid = validatePassword(body?.password);
  if (invalid) return json({ error: invalid }, 400, request, env);
  if (!validateDate(body?.expired)) return json({ error: "Tanggal kedaluwarsa tidak valid." }, 400, request, env);

  const exists = await env.DB.prepare("SELECT ID FROM PENGGUNA WHERE USERNAME = ? COLLATE NOCASE").bind(body.username.trim()).first();
  if (exists) return json({ error: "Username sudah dipakai." }, 409, request, env);

  const id = await nextId(env, "PENGGUNA");
  const salt = newSalt();
  const hash = await hashPassword(body.password, salt, PASSWORD_ITERATIONS);
  await env.DB.prepare(
    "INSERT INTO PENGGUNA (ID, USERNAME, NAMA, ROLE, PASSHASH, SALT, ITER, STATUS, EXPIRED, CREATED, UPDATED, MUSTCHG, CATATAN) VALUES (?, ?, ?, ?, ?, ?, ?, 'AKTIF', ?, ?, ?, 'Y', ?)"
  ).bind(id, body.username.trim(), body.name.trim(), role, hash, salt, PASSWORD_ITERATIONS,
    body.expired || null, today(), today(), String(body.note || "").slice(0, 60)).run();
  const row = await env.DB.prepare("SELECT * FROM PENGGUNA WHERE ID = ?").bind(id).first();
  return json({ user: publicUser(row) }, 201, request, env);
}

async function updateUser(request, env, user, id) {
  const body = await readJson(request);
  const target = await env.DB.prepare("SELECT * FROM PENGGUNA WHERE ID = ?").bind(id).first();
  if (!target) return json({ error: "Pengguna tidak ditemukan." }, 404, request, env);
  const role = String(body?.role || target.ROLE).toUpperCase();
  if (!["ADMIN", "USER"].includes(role)) return json({ error: "Role tidak valid." }, 400, request, env);
  if (!String(body?.name || "").trim()) return json({ error: "Nama wajib diisi." }, 400, request, env);
  if (!validateDate(body?.expired)) return json({ error: "Tanggal kedaluwarsa tidak valid." }, 400, request, env);

  const self = Number(user.ID) === Number(id);
  if (self && (role !== "ADMIN" || (body?.expired && String(body.expired) < today()))) {
    return json({ error: "Tidak bisa menurunkan atau membuat akun sendiri kedaluwarsa." }, 400, request, env);
  }
  if (String(target.ROLE).toUpperCase() === "ADMIN" && role !== "ADMIN") {
    const admins = await activeAdmins(env, id);
    if (!admins.length) return json({ error: "Harus ada minimal satu admin aktif." }, 409, request, env);
  }

  let passwordSql = "";
  const values = [body.name.trim(), role, body.expired || null, String(body.note || "").slice(0, 60), today()];
  if (body?.password) {
    const invalid = validatePassword(body.password);
    if (invalid) return json({ error: invalid }, 400, request, env);
    const salt = newSalt();
    const hash = await hashPassword(body.password, salt, PASSWORD_ITERATIONS);
    passwordSql = ", PASSHASH = ?, SALT = ?, ITER = ?, MUSTCHG = 'Y'";
    values.push(hash, salt, PASSWORD_ITERATIONS);
  }
  values.push(id);
  await env.DB.prepare(
    `UPDATE PENGGUNA SET NAMA = ?, ROLE = ?, EXPIRED = ?, CATATAN = ?, UPDATED = ?${passwordSql} WHERE ID = ?`
  ).bind(...values).run();
  const row = await env.DB.prepare("SELECT * FROM PENGGUNA WHERE ID = ?").bind(id).first();
  return json({ user: publicUser(row) }, 200, request, env);
}

async function setUserStatus(request, env, user, id) {
  const body = await readJson(request);
  const status = String(body?.status || "").toUpperCase();
  if (!["AKTIF", "NONAKTIF"].includes(status)) return json({ error: "Status tidak valid." }, 400, request, env);
  const target = await env.DB.prepare("SELECT * FROM PENGGUNA WHERE ID = ?").bind(id).first();
  if (!target) return json({ error: "Pengguna tidak ditemukan." }, 404, request, env);
  if (Number(user.ID) === Number(id) && status !== "AKTIF") {
    return json({ error: "Tidak bisa menonaktifkan akun sendiri." }, 400, request, env);
  }
  if (String(target.ROLE).toUpperCase() === "ADMIN" && status !== "AKTIF") {
    const admins = await activeAdmins(env, id);
    if (!admins.length) return json({ error: "Harus ada minimal satu admin aktif." }, 409, request, env);
  }
  await env.DB.prepare("UPDATE PENGGUNA SET STATUS = ?, UPDATED = ? WHERE ID = ?")
    .bind(status, today(), id).run();
  return json({ ok: true }, 200, request, env);
}

/* --------------------------------------------------------------- prices */
async function applyPriceMap(env, prices, { source = "Input manual (D1)", priceDate = today() } = {}) {
  const rows = await env.DB.prepare("SELECT KODE, HARGA, EPS, BVPS, DPS, FV, MCAP_T FROM SAHAM").all();
  const byCode = new Map((rows.results || []).map((r) => [r.KODE, r]));
  const statements = [];
  const changed = [];

  for (const [code, raw] of Object.entries(prices)) {
    const price = Number(raw);
    if (!Number.isFinite(price) || price <= 0) continue;
    const s = byCode.get(String(code).toUpperCase());
    if (!s) continue;
    if (Number(s.HARGA) === price) continue;
    const pe = s.EPS ? price / s.EPS : null;
    const pb = s.BVPS ? price / s.BVPS : null;
    const dy = s.DPS ? s.DPS / price : null;
    const mos = s.FV ? (s.FV - price) / s.FV : null;
    const mcap = s.HARGA && s.MCAP_T ? price * (s.MCAP_T * 1e12 / s.HARGA) / 1e12 : s.MCAP_T;
    statements.push(env.DB.prepare(
      "UPDATE SAHAM SET HARGA = ?, MCAP_T = ?, PE = ?, PB = ?, DY = ?, MOS = ?, UPDAT = ? WHERE KODE = ?"
    ).bind(price, mcap, pe, pb, dy, mos, priceDate, s.KODE));
    statements.push(env.DB.prepare("UPDATE VALUASI SET MOS = ? WHERE KODE = ?").bind(mos, s.KODE));
    changed.push({ code: s.KODE, old: s.HARGA, price });
  }
  if (!changed.length) return { changed: [], priceDate, source };
  statements.push(env.DB.prepare("INSERT INTO PARAM (KUNCI, NILAI) VALUES ('HARGA_PER', ?) ON CONFLICT(KUNCI) DO UPDATE SET NILAI = excluded.NILAI").bind(priceDate));
  statements.push(env.DB.prepare("INSERT INTO PARAM (KUNCI, NILAI) VALUES ('HARGA_SUMBER', ?) ON CONFLICT(KUNCI) DO UPDATE SET NILAI = excluded.NILAI").bind(source));
  await env.DB.batch(statements);
  return { changed, priceDate, source };
}

async function updatePrices(request, env) {
  const body = await readJson(request);
  if (!body?.prices || typeof body.prices !== "object") {
    return json({ error: "Body prices wajib." }, 400, request, env);
  }
  const result = await applyPriceMap(env, body.prices, { source: "Input manual (D1)" });
  if (!result.changed.length) return json({ error: "Tidak ada harga yang berubah." }, 400, request, env);
  return json(result, 200, request, env);
}

const YAHOO_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

function jakartaDate(epochSeconds) {
  const d = epochSeconds ? new Date(Number(epochSeconds) * 1000) : new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

async function fetchYahooQuote(code) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code)}.JK?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: { "User-Agent": YAHOO_UA, Accept: "application/json" },
    cf: { cacheTtl: 0 },
  });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const data = await res.json();
  if (data?.chart?.error) throw new Error(data.chart.error.description || "Yahoo error");
  const result = data?.chart?.result?.[0];
  const meta = result?.meta || {};
  let price = Number(meta.regularMarketPrice);
  if (!price) {
    const closes = result?.indicators?.quote?.[0]?.close || [];
    price = Number([...closes].reverse().find((c) => c));
  }
  if (!Number.isFinite(price) || price <= 0) throw new Error("harga tidak tersedia");
  return { price, time: Number(meta.regularMarketTime) || Math.floor(Date.now() / 1000) };
}

/**
 * Ambil 9 harga dari Yahoo Finance lalu tulis ke D1.
 * Dipakai oleh endpoint admin dan Cron Trigger 17:15 WIB.
 */
async function syncYahooPrices(env) {
  const rows = await env.DB.prepare("SELECT KODE FROM SAHAM ORDER BY KODE").all();
  const codes = (rows.results || []).map((r) => r.KODE);
  if (!codes.length) throw new Error("Data saham kosong.");

  const quotes = {};
  const failed = [];
  const results = await Promise.allSettled(codes.map((code) => fetchYahooQuote(code)));
  results.forEach((result, index) => {
    if (result.status === "fulfilled") quotes[codes[index]] = result.value;
    else failed.push(`${codes[index]}: ${result.reason?.message || "gagal"}`);
  });
  if (Object.keys(quotes).length < Math.ceil(codes.length / 2)) {
    throw new Error(`Yahoo hanya mengembalikan ${Object.keys(quotes).length}/${codes.length} harga.`);
  }

  const prices = Object.fromEntries(Object.entries(quotes).map(([code, q]) => [code, q.price]));
  const stamp = Math.max(...Object.values(quotes).map((q) => q.time || 0));
  const priceDate = jakartaDate(stamp);
  const applied = await applyPriceMap(env, prices, {
    source: "Yahoo Finance (delayed)",
    priceDate,
  });
  return { ...applied, failed, requested: codes.length };
}

async function refreshPrices(request, env) {
  try {
    const result = await syncYahooPrices(env);
    return json(result, 200, request, env);
  } catch (err) {
    console.error("Yahoo sync:", err);
    return json({ error: err.message || "Gagal mengambil harga Yahoo." }, 502, request, env);
  }
}

/* --------------------------------------------------------------- router */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    try {
      if (url.pathname === "/api/health") {
        await env.DB.prepare("SELECT 1 AS OK").first();
        return json({ ok: true }, 200, request, env);
      }
      if (url.pathname === "/api/login" && request.method === "POST") {
        return await login(request, env);
      }

      const user = await tokenUser(request, env);
      if (!user) return json({ error: "Tidak terautentikasi." }, 401, request, env);

      if (String(user.MUSTCHG).toUpperCase() === "Y"
        && !["/api/me", "/api/me/password"].includes(url.pathname)) {
        return json({
          error: "Ganti password wajib sebelum memakai API.",
          code: "MUST_CHANGE",
        }, 403, request, env);
      }

      if (url.pathname === "/api/me" && request.method === "GET") return await me(request, env, user);
      if (url.pathname === "/api/me/password" && request.method === "POST") return await changePassword(request, env, user);
      if (url.pathname === "/api/bootstrap" && request.method === "GET") return await bootstrap(request, env, user);
      if (url.pathname.startsWith("/api/transactions")
        && String(user.ROLE).toUpperCase() === "ADMIN"
        && request.method !== "GET") {
        return json({ error: "Admin hanya dapat melihat portofolio user, bukan mengubahnya." }, 403, request, env);
      }
      if (url.pathname === "/api/admin/portfolios" && request.method === "GET") {
        if (String(user.ROLE).toUpperCase() !== "ADMIN") return json({ error: "Hanya administrator." }, 403, request, env);
        return await adminPortfolios(request, env);
      }
      if (url.pathname === "/api/transactions" && request.method === "GET") return await listTransactions(request, env, user);
      if (url.pathname === "/api/transactions" && request.method === "POST") return await createTransaction(request, env, user);
      if (url.pathname === "/api/transactions" && request.method === "DELETE") return await clearTransactions(request, env, user);

      const txMatch = url.pathname.match(/^\/api\/transactions\/(\d+)$/);
      if (txMatch && request.method === "PATCH") return await updateTransaction(request, env, user, Number(txMatch[1]));
      if (txMatch && request.method === "DELETE") return await deleteTransaction(request, env, user, Number(txMatch[1]));

      if (url.pathname.startsWith("/api/users")) {
        if (String(user.ROLE).toUpperCase() !== "ADMIN") {
          return json({ error: "Hanya administrator." }, 403, request, env);
        }
        if (url.pathname === "/api/users" && request.method === "GET") return await listUsers(request, env);
        if (url.pathname === "/api/users" && request.method === "POST") return await createUser(request, env);
        const statusMatch = url.pathname.match(/^\/api\/users\/(\d+)\/status$/);
        if (statusMatch && request.method === "POST") return await setUserStatus(request, env, user, Number(statusMatch[1]));
        const userMatch = url.pathname.match(/^\/api\/users\/(\d+)$/);
        if (userMatch && request.method === "PATCH") return await updateUser(request, env, user, Number(userMatch[1]));
      }

      if (url.pathname === "/api/admin/prices/refresh" && request.method === "POST") {
        if (String(user.ROLE).toUpperCase() !== "ADMIN") return json({ error: "Hanya administrator." }, 403, request, env);
        return await refreshPrices(request, env);
      }

      if (url.pathname === "/api/admin/prices" && request.method === "POST") {
        if (String(user.ROLE).toUpperCase() !== "ADMIN") return json({ error: "Hanya administrator." }, 403, request, env);
        return await updatePrices(request, env);
      }

      return json({ error: "Endpoint tidak ditemukan." }, 404, request, env);
    } catch (err) {
      console.error("API error:", err);
      return json({ error: "Terjadi kesalahan server." }, 500, request, env);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      syncYahooPrices(env)
        .then((result) => console.log("Cron Yahoo:", JSON.stringify(result)))
        .catch((err) => console.error("Cron Yahoo gagal:", err))
    );
  },
};
