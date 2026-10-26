/**
 * Buat arsip ZIP dari seluruh tabel dan berkas pendamping.
 * Jalankan: node tools/test_zip.mjs <output.zip>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeZip } from "../assets/js/zip.js";
import { parseDbf } from "../assets/js/dbf.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const dataDir = path.join(root, "data");
const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, "manifest.json"), "utf8"));
const target = process.argv[2] || path.join(root, "data", "test.zip");

const files = manifest.tables.map((meta) => ({
  name: `${meta.name}.DBF`,
  data: fs.readFileSync(path.join(dataDir, meta.file)),
}));
files.push({ name: "BACA-INI.txt", data: "Arsip uji Bursa DBF.\n" });

for (const meta of manifest.tables) {
  const buf = files.find((f) => f.name === `${meta.name}.DBF`).data;
  const parsed = parseDbf(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  if (parsed.rows.length !== meta.records) throw new Error(`${meta.name}: jumlah baris tidak cocok`);
}

const zip = makeZip(files);
fs.writeFileSync(target, zip);
console.log(`${target} (${zip.length} byte, ${files.length} berkas)`);
