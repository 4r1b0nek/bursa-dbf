/**
 * Uji login, role, expiry, dan CRUD pengguna (tanpa browser).
 * Data hanya diubah di memori/localStorage tiruan.
 * Jalankan: node tools/test_auth.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);

const mem = new Map();
const session = new Map();
globalThis.window = {};
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
globalThis.sessionStorage = {
  getItem: (k) => (session.has(k) ? session.get(k) : null),
  setItem: (k, v) => session.set(k, String(v)),
  removeItem: (k) => session.delete(k),
};
globalThis.fetch = async (url) => {
  const file = path.join(root, String(url));
  if (!fs.existsSync(file)) return { ok: false, status: 404 };
  const buf = fs.readFileSync(file);
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(buf.toString("utf8")),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
};

const DB = await import("../assets/js/store.js");
const Auth = await import("../assets/js/auth.js");

let failed = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`OK   ${label}${extra ? `  ${extra}` : ""}`);
  else { failed++; console.error(`FAIL ${label}  ${extra}`); }
};
const throws = async (fn, label, needle = "") => {
  try {
    await fn();
    check(label, false, "tidak melempar error");
  } catch (err) {
    check(label, !needle || String(err.message).includes(needle), err.message);
  }
};

await DB.init();
const bootstrap = "Bursa#2026!123";
const usersBefore = Auth.users().length;
check("tabel PENGGUNA dimuat", usersBefore >= 1 && Auth.findUser("admin")?.ROLE === "ADMIN");

let result = await Auth.login("admin", "salah-password");
check("login password salah ditolak", result.ok === false);

result = await Auth.login("tidak-ada", "apa saja");
check("username tidak ada ditolak", result.ok === false);

result = await Auth.login("admin", bootstrap);
check("login admin bootstrap", result.ok && result.user.ROLE === "ADMIN" && result.mustChange === false);
check("role admin terdeteksi", Auth.isAdmin() === true);
check("verifikasi ulang admin", (await Auth.verifyAdminPassword(bootstrap)) === true);

await Auth.changeOwnPassword(bootstrap, "AdminBaru#2026");
check("password admin berubah", Auth.findUser("admin").MUSTCHG === "N");
Auth.logout();
check("setelah logout tidak ada sesi", Auth.currentUser() === null);

result = await Auth.login("admin", bootstrap);
check("password lama tidak berlaku", result.ok === false);
result = await Auth.login("admin", "AdminBaru#2026");
check("login dengan password baru", result.ok === true);

const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
const user1 = await Auth.createUser({
  username: "user1", name: "User Satu", role: "USER",
  password: "User#2026", expired: future, note: "uji",
});
check("admin membuat user", Boolean(Auth.findUser("user1")) && user1.MUSTCHG === "Y");
await throws(() => Auth.createUser({
  username: "user1", name: "Duplikat", role: "USER", password: "User#2026",
}), "username duplikat ditolak", "sudah dipakai");

const expired = await Auth.createUser({
  username: "expired1", name: "User Expired", role: "USER",
  password: "Expired#2026", expired: "2020-01-01",
});
check("user kedaluwarsa dibuat", Auth.statusOf(expired) === "KEDALUWARSA");

const disabled = await Auth.createUser({
  username: "disabled1", name: "User Nonaktif", role: "USER", password: "Disable#2026",
});
await Auth.setUserStatus(disabled.ID, "NONAKTIF");
check("status nonaktif", Auth.findUser("disabled1").STATUS === "NONAKTIF");

Auth.logout();
result = await Auth.login("user1", "User#2026");
check("login user aktif", result.ok === true && result.mustChange === true);
check("user bukan admin", Auth.isAdmin() === false);
await throws(() => Auth.createUser({
  username: "hack", name: "Hack", role: "ADMIN", password: "Hack#2026",
}), "user tidak bisa membuat akun", "Hanya administrator");

Auth.logout();
result = await Auth.login("expired1", "Expired#2026");
check("user kedaluwarsa tidak bisa login", result.ok === false && /kedaluwarsa/i.test(result.message), result.message);
result = await Auth.login("disabled1", "Disable#2026");
check("user nonaktif tidak bisa login", result.ok === false && /dinonaktifkan/i.test(result.message), result.message);

result = await Auth.login("admin", "AdminBaru#2026");
check("admin login untuk uji lanjutan", result.ok === true);
await throws(() => Auth.updateUser(1, {
  name: "Administrator", role: "USER", expired: "", note: "x",
}), "admin tidak bisa menurunkan diri sendiri", "sendiri");
await throws(() => Auth.setUserStatus(1, "NONAKTIF"), "admin tidak bisa menonaktifkan diri", "sendiri");

await Auth.updateUser(user1.ID, {
  name: "User Satu Diperbarui", role: "USER", expired: future, note: "diperbarui",
});
check("update nama user", Auth.findUser("user1")?.NAMA === "User Satu Diperbarui");

await Auth.updateUser(user1.ID, {
  name: "User Satu Diperbarui", role: "USER", expired: future, password: "UserBaru#2026",
});
check("reset password user wajib ganti", Auth.findUser("user1").MUSTCHG === "Y");
Auth.logout();
result = await Auth.login("user1", "UserBaru#2026");
check("login user dengan password baru", result.ok === true);
Auth.logout();

check("jumlah akun bertambah", Auth.users().length === usersBefore + 3, `${Auth.users().length} akun`);

if (failed) {
  console.error(`\n${failed} pemeriksaan gagal.`);
  process.exit(1);
}
console.log("\nSemua pemeriksaan autentikasi & role lulus.");
