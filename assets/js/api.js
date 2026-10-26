/**
 * api.js — klien Cloudflare Workers + D1.
 *
 * Browser hanya memanggil /api/*. Tidak ada nama tabel DBF atau file database
 * yang dikirim ke klien. Token disimpan di sessionStorage dan dikirim sebagai
 * Bearer token.
 */

export const API_BASE = String(window.BURSA_API_BASE || "").replace(/\/+$/, "");
const SESSION_KEY = "bursa-dbf/api-session/v1";

function expired(session) {
  return !session || !session.token || !session.exp || Date.now() > Number(session.exp);
}

export function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (expired(data)) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function saveSession({ token, user, mustChange }) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    token,
    user,
    mustChange: Boolean(mustChange),
    exp: Date.now() + 8 * 3600 * 1000,
  }));
}

export function updateSessionUser(user, mustChange = false) {
  const session = readSession();
  if (!session) return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, user, mustChange }));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function request(path, { method = "GET", body = null, token = null } = {}) {
  if (!API_BASE) throw new Error("API belum dikonfigurasi.");
  const session = readSession();
  const headers = { Accept: "application/json" };
  if (body !== null) headers["Content-Type"] = "application/json";
  if (token || session?.token) headers.Authorization = `Bearer ${token || session.token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === null ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new Error("Tidak dapat menghubungi server. Periksa koneksi internet.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new Error(data?.error || `Permintaan gagal (HTTP ${response.status}).`);
    error.status = response.status;
    error.code = data?.code || null;
    throw error;
  }
  return data;
}

export async function login(username, password) {
  return request("/api/login", { method: "POST", body: { username, password } });
}

export async function me() {
  return request("/api/me");
}

export async function bootstrap() {
  return request("/api/bootstrap");
}

export async function listTransactions() {
  return request("/api/transactions");
}

export async function createTransaction(row) {
  return request("/api/transactions", { method: "POST", body: row });
}

export async function updateTransaction(id, row) {
  return request(`/api/transactions/${id}`, { method: "PATCH", body: row });
}

export async function deleteTransaction(id) {
  return request(`/api/transactions/${id}`, { method: "DELETE" });
}

export async function clearTransactions() {
  return request("/api/transactions", { method: "DELETE" });
}

export async function listUsers() {
  return request("/api/users");
}

export async function createUser(payload) {
  return request("/api/users", { method: "POST", body: payload });
}

export async function updateUser(id, payload) {
  return request(`/api/users/${id}`, { method: "PATCH", body: payload });
}

export async function setUserStatus(id, status) {
  return request(`/api/users/${id}/status`, { method: "POST", body: { status } });
}

export async function changePassword(current, next) {
  return request("/api/me/password", { method: "POST", body: { current, next } });
}

export async function updatePrices(prices) {
  return request("/api/admin/prices", { method: "POST", body: { prices } });
}

export async function refreshPrices() {
  return request("/api/admin/prices/refresh", { method: "POST" });
}
