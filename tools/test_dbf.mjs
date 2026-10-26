/**
 * Uji roundtrip: baca setiap data/*.DBF, tulis ulang, dan bandingkan byte.
 * Jalankan: node tools/test_dbf.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDbf, buildDbf } from "../assets/js/dbf.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const dataDir = path.join(root, "data");
const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, "manifest.json"), "utf8"));

let failures = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const meta of manifest.tables) {
  const file = path.join(dataDir, meta.file);
  const original = new Uint8Array(fs.readFileSync(file));
  const parsed = parseDbf(original);
  const rebuilt = new Uint8Array(buildDbf(parsed.fields, parsed.rows, { updated: parsed.updated }));
  const reparsed = parseDbf(rebuilt);

  const sameBytes = original.length === rebuilt.length && original.every((b, i) => b === rebuilt[i]);
  const sameRows = eq(parsed.rows, reparsed.rows);
  const sameFields = eq(parsed.fields, reparsed.fields);
  const ok = sameBytes && sameRows && sameFields && parsed.records === meta.records;

  if (!ok) {
    failures++;
    console.error(`FAIL ${meta.name}: byte=${sameBytes} rows=${sameRows} fields=${sameFields} records=${parsed.records}/${meta.records}`);
    if (!sameBytes) {
      let i = 0;
      while (i < Math.min(original.length, rebuilt.length) && original[i] === rebuilt[i]) i++;
      console.error(`  beda pertama di byte ${i}: ${original[i]} vs ${rebuilt[i]}`);
      console.error("  asli  :", Buffer.from(original.slice(Math.max(0, i - 20), i + 20)).toString("latin1"));
      console.error("  ulang :", Buffer.from(rebuilt.slice(Math.max(0, i - 20), i + 20)).toString("latin1"));
    }
  } else {
    console.log(`OK   ${meta.name.padEnd(10)} ${String(parsed.records).padStart(3)} baris  ${original.length} byte  identik`);
  }
  console.log(`     contoh: ${JSON.stringify(parsed.rows[0]).slice(0, 140)}`);
}

if (failures) {
  console.error(`\n${failures} tabel gagal.`);
  process.exit(1);
}
console.log("\nSemua tabel DBF valid dan roundtrip byte-identik.");
