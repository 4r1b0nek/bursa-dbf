/**
 * auth.js — login, sesi, dan manajemen pengguna.
 *
 * CATATAN KEAMANAN
 * Aplikasi ini statis (GitHub Pages). Pemeriksaan role berjalan di browser dan
 * dapat dilewati oleh pengguna yang menguasai DevTools. Hash password memakai
 * PBKDF2-SHA256 + salt acak, tetapi berkas PENGGUNA.DBF tetap dapat dibaca
 * publik. Gunakan modul ini untuk kontrol akses tingkat UI/demo, bukan untuk
 * data rahasia. Untuk keamanan nyata, autentikasi harus di server.
 */
import * as DB from "./store.js";

export const SESSION_HOURS = 8;
export const PASSWORD_ITERATIONS = 100000;
export const MIN_PASSWORD = 8;

const SESSION_KEY = "bursa-dbf/session/v1";
const encoder = new TextEncoder();

function toBase64(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(String(text || ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function newSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64(bytes);
}

export async function hashPassword(password, salt, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(String(password)), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromBase64(salt), iterations, hash: "SHA-256" },
    key,
    256
  );
  return toBase64(new Uint8Array(bits));
}

function safeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

const today = () => new Date().toISOString().slice(0, 10);

export function users() {
  return DB.rows("PENGGUNA");
}

export function findUser(username) {
  const needle = String(username || "").trim().toLowerCase();
  return users().find((u) => String(u.USERNAME).toLowerCase() === needle) || null;
}

export function getUser(id) {
  return users().find((u) => Number(u.ID) === Number(id)) || null;
}

export function isExpired(row) {
  if (!row || !row.EXPIRED) return false;
  return String(row.EXPIRED) < today();
}

export function daysLeft(row) {
  if (!row || !row.EXPIRED) return null;
  const end = new Date(`${row.EXPIRED}T00:00:00`);
  const now = new Date(`${today()}T00:00:00`);
  return Math.round((end - now) / 86400000);
}

export function statusOf(row) {
  if (!row) return "TIDAK ADA";
  if (String(row.STATUS).toUpperCase() !== "AKTIF") return "NONAKTIF";
  if (isExpired(row)) return "KEDALUWARSA";
  const left = daysLeft(row);
  if (left !== null && left <= 7) return "SEGERA BERAKHIR";
  return "AKTIF";
}

export function roleOf(row) {
  return String(row?.ROLE || "").toUpperCase() === "ADMIN" ? "ADMIN" : "USER";
}

/* ------------------------------------------------------------------ sesi */
function saveSession(row) {
  const payload = { id: Number(row.ID), exp: Date.now() + SESSION_HOURS * 3600 * 1000 };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.id || !data.exp) return null;
    if (Date.now() > Number(data.exp)) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function currentUser() {
  const session = readSession();
  if (!session) return null;
  const row = getUser(session.id);
  if (!row || String(row.STATUS).toUpperCase() !== "AKTIF" || isExpired(row)) {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
  return row;
}

export function isAdmin() {
  const row = currentUser();
  return Boolean(row && roleOf(row) === "ADMIN");
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

/* ------------------------------------------------------------------ login */
export async function login(username, password) {
  const row = findUser(username);
  if (!row) return { ok: false, message: "Username atau password salah." };

  const digest = await hashPassword(password, row.SALT, Number(row.ITER) || PASSWORD_ITERATIONS);
  if (!safeEqual(digest, row.PASSHASH)) {
    return { ok: false, message: "Username atau password salah." };
  }
  if (String(row.STATUS).toUpperCase() !== "AKTIF") {
    return { ok: false, message: "Akun dinonaktifkan. Hubungi administrator." };
  }
  if (isExpired(row)) {
    return { ok: false, message: `Akun kedaluwarsa sejak ${row.EXPIRED}. Hubungi administrator.` };
  }

  saveSession(row);
  return { ok: true, user: row, mustChange: String(row.MUSTCHG).toUpperCase() === "Y" };
}

export async function verifyAdminPassword(password) {
  const row = currentUser();
  if (!row || roleOf(row) !== "ADMIN") return false;
  const digest = await hashPassword(password, row.SALT, Number(row.ITER) || PASSWORD_ITERATIONS);
  return safeEqual(digest, row.PASSHASH);
}

/* -------------------------------------------------------- validasi akun */
export function validateUsername(username) {
  const value = String(username || "").trim();
  if (!/^[a-zA-Z0-9._-]{3,20}$/.test(value)) {
    return "Username 3–20 karakter: huruf, angka, titik, garis bawah, atau strip.";
  }
  return null;
}

export function validatePassword(password) {
  const value = String(password || "");
  if (value.length < MIN_PASSWORD) return `Password minimal ${MIN_PASSWORD} karakter.`;
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "Password harus mengandung huruf dan angka.";
  return null;
}

function activeAdmins(excludeId = null) {
  return users().filter(
    (u) => roleOf(u) === "ADMIN" && String(u.STATUS).toUpperCase() === "AKTIF"
      && !isExpired(u) && Number(u.ID) !== Number(excludeId)
  );
}

async function makeHash(password) {
  const salt = newSalt();
  const digest = await hashPassword(password, salt, PASSWORD_ITERATIONS);
  return { PASSHASH: digest, SALT: salt, ITER: PASSWORD_ITERATIONS };
}

function validateExpiry(expired) {
  if (!expired) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expired)) return "Tanggal kedaluwarsa tidak valid.";
  return null;
}

/* --------------------------------------------------------------- CRUD */
export async function createUser({ username, name, role, password, expired, note }) {
  if (!isAdmin()) throw new Error("Hanya administrator yang dapat membuat pengguna.");
  const usernameError = validateUsername(username);
  if (usernameError) throw new Error(usernameError);
  if (findUser(username)) throw new Error("Username sudah dipakai.");
  if (!String(name || "").trim()) throw new Error("Nama wajib diisi.");
  if (!["ADMIN", "USER"].includes(role)) throw new Error("Role tidak valid.");
  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);
  const expiryError = validateExpiry(expired);
  if (expiryError) throw new Error(expiryError);

  const hash = await makeHash(password);
  const row = {
    ID: DB.nextId("PENGGUNA", "ID"),
    USERNAME: String(username).trim(),
    NAMA: String(name).trim(),
    ROLE: role,
    ...hash,
    STATUS: "AKTIF",
    EXPIRED: expired || "",
    CREATED: today(),
    UPDATED: today(),
    MUSTCHG: "Y",
    CATATAN: String(note || "").slice(0, 60),
  };
  DB.insertRow("PENGGUNA", row);
  return row;
}

export async function updateUser(id, { name, role, password, expired, note }) {
  if (!isAdmin()) throw new Error("Hanya administrator yang dapat mengubah pengguna.");
  const index = users().findIndex((u) => Number(u.ID) === Number(id));
  if (index < 0) throw new Error("Pengguna tidak ditemukan.");
  const row = users()[index];
  const current = currentUser();
  const isSelf = current && Number(current.ID) === Number(row.ID);

  if (!["ADMIN", "USER"].includes(role)) throw new Error("Role tidak valid.");
  if (!String(name || "").trim()) throw new Error("Nama wajib diisi.");
  const expiryError = validateExpiry(expired);
  if (expiryError) throw new Error(expiryError);
  if (isSelf && expired && String(expired) < today()) {
    throw new Error("Tidak bisa membuat akun sendiri kedaluwarsa.");
  }

  if (role !== "ADMIN" || String(row.STATUS).toUpperCase() !== "AKTIF") {
    if (isSelf) throw new Error("Tidak bisa menurunkan atau menonaktifkan akun sendiri.");
    if (roleOf(row) === "ADMIN" && activeAdmins(row.ID).length === 0) {
      throw new Error("Harus ada minimal satu admin aktif.");
    }
  }

  const patch = {
    NAMA: String(name).trim(),
    ROLE: role,
    EXPIRED: expired || "",
    CATATAN: String(note || "").slice(0, 60),
    UPDATED: today(),
  };
  if (password) {
    const passwordError = validatePassword(password);
    if (passwordError) throw new Error(passwordError);
    Object.assign(patch, await makeHash(password), { MUSTCHG: "Y" });
  }
  DB.updateRow("PENGGUNA", index, patch);
  return DB.getTable("PENGGUNA").rows[index];
}

export async function setUserStatus(id, status) {
  if (!isAdmin()) throw new Error("Hanya administrator yang dapat mengubah status pengguna.");
  const index = users().findIndex((u) => Number(u.ID) === Number(id));
  if (index < 0) throw new Error("Pengguna tidak ditemukan.");
  const row = users()[index];
  const current = currentUser();
  if (current && Number(current.ID) === Number(row.ID) && status !== "AKTIF") {
    throw new Error("Tidak bisa menonaktifkan akun sendiri.");
  }
  if (roleOf(row) === "ADMIN" && activeAdmins(row.ID).length === 0 && status !== "AKTIF") {
    throw new Error("Harus ada minimal satu admin aktif.");
  }
  DB.updateRow("PENGGUNA", index, {
    STATUS: status,
    UPDATED: today(),
  });
}

export async function changeOwnPassword(currentPassword, newPassword) {
  const row = currentUser();
  if (!row) throw new Error("Sesi berakhir. Silakan login lagi.");
  const digest = await hashPassword(currentPassword, row.SALT, Number(row.ITER) || PASSWORD_ITERATIONS);
  if (!safeEqual(digest, row.PASSHASH)) throw new Error("Password saat ini salah.");
  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new Error(passwordError);
  if (safeEqual(currentPassword, newPassword)) throw new Error("Password baru harus berbeda.");
  const index = users().findIndex((u) => Number(u.ID) === Number(row.ID));
  DB.updateRow("PENGGUNA", index, {
    ...(await makeHash(newPassword)),
    MUSTCHG: "N",
    UPDATED: today(),
  });
}
