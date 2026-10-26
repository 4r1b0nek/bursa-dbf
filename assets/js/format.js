/** Utilitas format angka & teks (locale Indonesia). */

const nf0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export function num(v, dec = 0) {
  if (!isNum(v)) return "—";
  if (dec === 0) return nf0.format(v);
  if (dec === 1) return nf1.format(v);
  if (dec === 2) return nf2.format(v);
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(v);
}

export function rupiah(v, dec = 0) {
  if (!isNum(v)) return "—";
  return `${v < 0 ? "\u2212" : ""}Rp${num(Math.abs(v), dec)}`;
}

/** Rp1,25 T / Rp21,3 jt / Rp980.000 */
export function compactRp(v) {
  if (!isNum(v)) return "—";
  const sign = v < 0 ? "\u2212" : "";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${sign}Rp${num(abs / 1e12, 2)} T`;
  if (abs >= 1e9) return `${sign}Rp${num(abs / 1e9, 2)} M`;
  if (abs >= 1e6) return `${sign}Rp${num(abs / 1e6, 1)} jt`;
  return `${sign}Rp${num(abs, 0)}`;
}

export function pct(v, dec = 1, signed = false) {
  if (!isNum(v)) return "—";
  const s = `${num(v * 100, dec)}%`;
  return signed && v > 0 ? `+${s}` : s;
}

export function pctRaw(v, dec = 1, signed = false) {
  if (!isNum(v)) return "—";
  const s = `${num(v, dec)}%`;
  return signed && v > 0 ? `+${s}` : s;
}

export function signedNum(v, dec = 0) {
  if (!isNum(v)) return "—";
  return `${v > 0 ? "+" : ""}${num(v, dec)}`;
}

export function signClass(v, { zero = "muted" } = {}) {
  if (!isNum(v) || v === 0) return zero;
  return v > 0 ? "pos" : "neg";
}

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function dateID(iso, { short = false } = {}) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return short ? `${d} ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]} ${y}`;
}

export function bytes(n) {
  if (!isNum(n)) return "—";
  if (n < 1024) return `${n} B`;
  return `${num(n / 1024, 1)} KB`;
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function sum(arr, fn = (x) => x) {
  return arr.reduce((a, b) => a + (fn(b) || 0), 0);
}

export function mean(arr, fn = (x) => x) {
  const vals = arr.map(fn).filter(isNum);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function scoreTone(score) {
  if (!isNum(score)) return "muted";
  if (score >= 62) return "pos";
  if (score >= 55) return "warn";
  return "neg";
}
