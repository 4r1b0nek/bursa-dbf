/**
 * dbf.js — pembaca & penulis DBF (dBase III) murni JavaScript.
 *
 * Tidak ada dependensi. Dipakai untuk membaca data/*.DBF yang disajikan
 * sebagai file statis, dan menulis kembali tabel menjadi berkas .DBF asli
 * (bisa dibuka Excel, LibreOffice, Python, atau FoxPro).
 *
 * Format yang didukung:
 *   baca  : 0x02, 0x03, 0x30 (Visual FoxPro, tanpa memo), 0x83/0x8B dibaca
 *           bagian tabelnya saja (memo diabaikan)
 *   tulis : dBase III 0x03, field C / N / F / D / L
 */

const VERSION_DBASE3 = 0x03;

const CP1252_HIGH = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

/** Transliterasi karakter "cantik" agar aman di DBF. */
export function toAscii(text) {
  return String(text ?? "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00d7/g, "x")
    .replace(/\u2265/g, ">=")
    .replace(/\u2264/g, "<=")
    .replace(/\u00a0/g, " ");
}

function encodeCp1252(text) {
  const s = toAscii(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const cp = s.codePointAt(i);
    if (cp < 0x80) out[i] = cp;
    else if (CP1252_HIGH[cp] !== undefined) out[i] = CP1252_HIGH[cp];
    else if (cp >= 0xa0 && cp <= 0xff) out[i] = cp;
    else out[i] = 0x3f; // '?'
  }
  return out;
}

let decoder = null;
function decodeText(bytes) {
  if (!decoder) {
    try {
      decoder = new TextDecoder("windows-1252");
    } catch {
      decoder = new TextDecoder("latin1");
    }
  }
  return decoder.decode(bytes);
}

const FIELD_TYPES = new Set(["C", "N", "F", "D", "L"]);

function normalizeFields(fields) {
  return fields.map((f) => {
    const type = String(f.type || "C").toUpperCase();
    if (!FIELD_TYPES.has(type)) {
      throw new Error(`Tipe field ${type} tidak didukung writer (${f.name})`);
    }
    const length = Number(f.length);
    const dec = Number(f.dec || 0);
    if (!f.name || String(f.name).length > 10) {
      throw new Error(`Nama field tidak valid: ${f.name}`);
    }
    if (!(length >= 1 && length <= 254)) {
      throw new Error(`Panjang field ${f.name} harus 1..254`);
    }
    if (type === "N" || type === "F") {
      if (dec < 0 || dec > 15 || dec >= length) {
        throw new Error(`Desimal field ${f.name} tidak valid`);
      }
    }
    return { name: String(f.name), type, length, dec };
  });
}

/** Baca header + isi DBF. */
export function parseDbf(input) {
  const buf = input instanceof ArrayBuffer ? input : input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  const bytes = new Uint8Array(buf);
  if (bytes.length < 32) throw new Error("Berkas terlalu kecil untuk DBF");

  const version = bytes[0];
  const year = 1900 + bytes[1];
  const month = bytes[2];
  const day = bytes[3];
  const view = new DataView(buf);
  const records = view.getUint32(4, true);
  const headerLength = view.getUint16(8, true);
  const recordLength = view.getUint16(10, true);

  if (headerLength < 33 || headerLength > bytes.length) {
    throw new Error("Header DBF tidak valid (header length)");
  }
  if (recordLength < 1) throw new Error("Header DBF tidak valid (record length)");

  const fields = [];
  let pos = 32;
  while (pos + 32 <= headerLength && bytes[pos] !== 0x0d) {
    const name = decodeText(bytes.subarray(pos, pos + 11)).replace(/\0.*$/, "").trim();
    const type = String.fromCharCode(bytes[pos + 11]).toUpperCase();
    const length = bytes[pos + 16];
    const dec = bytes[pos + 17];
    if (!name) break;
    fields.push({ name, type, length, dec });
    pos += 32;
  }
  if (!fields.length) throw new Error("DBF tidak memiliki field");

  const sum = fields.reduce((a, f) => a + f.length, 0);
  const expectedRecordLength = sum + 1;
  if (expectedRecordLength !== recordLength) {
    // sebagian writer mengisi record length dengan benar; kalau tidak, pakai hitungan field
    if (expectedRecordLength > recordLength) {
      throw new Error(`Record length tidak cocok (${recordLength} vs ${expectedRecordLength})`);
    }
  }

  const rows = [];
  const offset0 = headerLength;
  for (let r = 0; r < records; r++) {
    const base = offset0 + r * recordLength;
    if (base + recordLength > bytes.length) break;
    const flag = bytes[base];
    if (flag === 0x2a) continue; // rekaman terhapus
    let cur = base + 1;
    const row = {};
    for (const f of fields) {
      const chunk = bytes.subarray(cur, cur + f.length);
      cur += f.length;
      row[f.name] = decodeValue(f, chunk);
    }
    rows.push(row);
  }

  return {
    version,
    updated: month && day ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null,
    records,
    headerLength,
    recordLength,
    fields,
    rows,
    bytes: bytes.length,
  };
}

function decodeValue(field, chunk) {
  if (field.type === "C") {
    return decodeText(chunk).replace(/\0/g, "").replace(/\s+$/, "");
  }
  if (field.type === "N" || field.type === "F") {
    const txt = decodeText(chunk).trim();
    if (!txt || /^\*+$/.test(txt)) return null;
    const normalized = txt.includes(",") && !txt.includes(".") ? txt.replace(",", ".") : txt;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }
  if (field.type === "D") {
    const txt = decodeText(chunk).trim();
    if (!/^\d{8}$/.test(txt)) return null;
    return `${txt.slice(0, 4)}-${txt.slice(4, 6)}-${txt.slice(6, 8)}`;
  }
  if (field.type === "L") {
    const c = String.fromCharCode(chunk[0] || 0x3f).toUpperCase();
    return c === "T" || c === "Y" ? true : c === "F" || c === "N" ? false : null;
  }
  return decodeText(chunk).trim();
}

function padNumber(value, length, dec) {
  if (value === null || value === undefined || value === "") return " ".repeat(length);
  let num = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(num)) return " ".repeat(length);
  if (dec > 0) num = Number(num.toFixed(dec));
  else num = Math.round(num);
  let txt = dec > 0 ? num.toFixed(dec) : String(num);
  if (txt.length > length) {
    // konvensi DBF: nilai terlalu besar ditandai bintang
    return "*".repeat(length);
  }
  return txt.padStart(length, " ");
}

/** Tulis tabel menjadi byte DBF (dBase III). */
export function buildDbf(fields, rows, options = {}) {
  const schema = normalizeFields(fields);
  let date;
  if (typeof options.updated === "string" && /^\d{4}-\d{2}-\d{2}/.test(options.updated)) {
    const [y, m, d] = options.updated.slice(0, 10).split("-").map(Number);
    date = new Date(y, m - 1, d);
  } else {
    date = options.updated ? new Date(options.updated) : new Date();
  }
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const headerLength = 32 + schema.length * 32 + 1;
  const recordLength = 1 + schema.reduce((a, f) => a + f.length, 0);
  const total = headerLength + rows.length * recordLength + 1;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  out[0] = VERSION_DBASE3;
  out[1] = validDate.getFullYear() - 1900;
  out[2] = validDate.getMonth() + 1;
  out[3] = validDate.getDate();
  view.setUint32(4, rows.length, true);
  view.setUint16(8, headerLength, true);
  view.setUint16(10, recordLength, true);
  out[28] = 0x00; // tanpa file MDX
  out[29] = 0x03; // language driver cp1252

  let p = 32;
  for (const f of schema) {
    const nameBytes = encodeCp1252(f.name);
    out.set(nameBytes.subarray(0, 11), p);
    out[p + 11] = f.type.charCodeAt(0);
    out[p + 16] = f.length;
    out[p + 17] = f.dec;
    p += 32;
  }
  out[p] = 0x0d;
  p = headerLength;

  for (const row of rows) {
    out[p] = 0x20;
    p += 1;
    for (const f of schema) {
      const value = row[f.name] ?? row[f.name.toUpperCase()] ?? row[f.name.toLowerCase()] ?? null;
      let encoded;
      if (f.type === "C") {
        let txt = toAscii(value ?? "");
        if (txt.length > f.length) txt = txt.slice(0, f.length);
        encoded = encodeCp1252(txt.padEnd(f.length, " "));
      } else if (f.type === "D") {
        const raw = String(value ?? "").replace(/-/g, "");
        encoded = encodeCp1252(/^\d{8}$/.test(raw) ? raw : " ".repeat(8));
      } else if (f.type === "L") {
        const v = value;
        encoded = encodeCp1252(v === null || v === undefined ? "?" : v ? "T" : "F");
      } else {
        encoded = encodeCp1252(padNumber(value, f.length, f.dec));
      }
      out.set(encoded, p);
      p += f.length;
    }
  }
  out[p] = 0x1a;
  return out.buffer;
}

/** Ringkasan singkat untuk kartu Database. */
export function dbfSummary(parsed) {
  return {
    version: `0x${parsed.version.toString(16).padStart(2, "0").toUpperCase()}`,
    records: parsed.records,
    fields: parsed.fields.length,
    headerLength: parsed.headerLength,
    recordLength: parsed.recordLength,
    bytes: parsed.bytes,
    updated: parsed.updated,
  };
}
