/**
 * Uji integrasi lapisan data + grafik tanpa browser.
 * Meniru fetch() dengan membaca berkas dari folder /data.
 * Jalankan: node tools/test_app.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);

globalThis.window = {};
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
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
const C = await import("../assets/js/charts.js");
const F = await import("../assets/js/format.js");

let failed = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`OK   ${label}${extra ? `  ${extra}` : ""}`);
  else { failed++; console.error(`FAIL ${label}  ${extra}`); }
};

await DB.init();
check("manifest & tabel dimuat", DB.state.order.length === 9, DB.state.order.join(","));

const stocks = DB.stockList();
check("join 9 emiten", stocks.length === 9);
const withVal = stocks.filter((s) => s.valuasi && s.skor && s.teknikal && s.dividen.length);
check("join valuasi/skor/teknikal/dividen", withVal.length === 9);

const tugu = DB.stockByCode("TUGU");
check("detail TUGU", tugu && tugu.NAMA === "Asuransi Tugu Pratama" && tugu.valuasi.FV > 0);
check("MA200 terbaca", Number.isFinite(tugu.teknikal.MA200), String(tugu.teknikal.MA200));

const initialTx = DB.rows("TRANSAKSI").length;
const testId = DB.nextId("TRANSAKSI", "ID") + 1000;
const port = DB.computePortfolio();
check("portofolio: transaksi terbaca", port.transactions.length === initialTx, `${port.transactions.length}/${initialTx}`);
check("portofolio: posisi wajar", port.positions.length <= Math.max(initialTx, 1), port.positions.map((p) => p.code).join(","));
check("portofolio: nilai & modal >= 0", port.totals.value >= 0 && port.totals.cost >= 0,
  `${Math.round(port.totals.value)} / ${Math.round(port.totals.cost)}`);
check("portofolio: realisasi terhitung", Number.isFinite(port.realized), String(port.realized));
check("portofolio: bobot total 1",
  port.positions.length === 0 || Math.abs(port.positions.reduce((a, p) => a + p.weight, 0) - 1) < 1e-9);

const sim = DB.simulate({ initial: 0, monthly: 5000000, years: 20, priceGrowth: 0.06, divYield: 0.085, divGrowth: 0.05, reinvest: true });
check("simulasi 20 tahun", sim.series.length === 21 && sim.final > 0, `final ${Math.round(sim.final)}`);
check("simulasi: multiple > 1", sim.multiple > 1, `${sim.multiple.toFixed(2)}x`);
check("simulasi: IRR wajar", sim.irr > 0.04 && sim.irr < 0.25, `${(sim.irr * 100).toFixed(1)}%`);

const svgs = {
  sparkline: C.sparkline([1, 2, 3, 2, 4]),
  price: C.priceChart(tugu.historik),
  map: C.valuationMap(stocks),
  scenario: C.scenarioChart({
    bull: { 1: tugu.valuasi.BULL1, 3: tugu.valuasi.BULL3, 5: tugu.valuasi.BULL5 },
    base: { 1: tugu.valuasi.BASE1, 3: tugu.valuasi.BASE3, 5: tugu.valuasi.BASE5 },
    bear: { 1: tugu.valuasi.BEAR1, 3: tugu.valuasi.BEAR3, 5: tugu.valuasi.BEAR5 },
  }, tugu.HARGA),
  dividend: C.dividendChart(tugu.dividen),
  radar: C.radar(tugu.skor),
  donut: C.donut(port.positions.map((p, i) => ({ label: p.code, value: p.value, color: C.DONUT_COLORS[i] })), { total: port.totals.value }),
  sim: C.simChart(sim.series),
  mos: C.mosBar(tugu.MOS),
  score: C.scoreBar(tugu.SKOR),
};
for (const [name, svg] of Object.entries(svgs)) {
  const tag = name === "mos" || name === "score" ? "<div" : "<svg";
  if (name === "donut" && port.positions.length === 0) {
    check("grafik donut (tanpa posisi)", typeof svg === "string" && svg.includes("chart-empty"));
    continue;
  }
  check(`grafik ${name}`, typeof svg === "string" && svg.includes(tag) && !svg.includes("undefined") && !svg.includes("NaN"));
}
const radarScores = [...svgs.radar.matchAll(/(\d+)\/10/g)].map((m) => Number(m[1]));
check("radar memakai skor asli", radarScores.some((v) => v > 0), radarScores.join(" "));

check("format rupiah", F.rupiah(2080) === "Rp2.080", F.rupiah(2080));
check("format persen", F.pct(0.107, 1) === "10,7%", F.pct(0.107, 1));
check("label MoS memakai persen", C.mosBar(0.4816).includes("48%"));

const KEY = "bursa-dbf/store/v1";
DB.insertRow("TRANSAKSI", { ID: testId, TANGGAL: "2026-10-24", KODE: "TLKM", JENIS: "BELI", LOT: 1, HARGA: 2000, FEE: 0, CATATAN: "uji" });
check("perubahan menulis cache", mem.has(KEY) && DB.state.dirty === true);
DB.resetLocal();
check("reset menghapus cache", !mem.has(KEY) && DB.state.dirty === false);

const skorBuf = fs.readFileSync(path.join(root, "data", "SKOR.DBF"));
const imported = DB.importDbf("SKOR.DBF", skorBuf.buffer.slice(skorBuf.byteOffset, skorBuf.byteOffset + skorBuf.byteLength));
check("impor DBF mengganti tabel", imported.name === "SKOR" && imported.records === 9, `${imported.name} ${imported.records}`);

const reloaded = await DB.reloadReference();
check("reload referensi mempertahankan transaksi", reloaded.tables === 9 && reloaded.transactions === initialTx + 1, `${reloaded.tables} tabel / ${reloaded.transactions} transaksi`);
check("reload referensi memperbarui saham", DB.rows("SAHAM").length === 9 && DB.rows("SAHAM").some((r) => r.KODE === "BJBR"));

const testPrice = 4321;
const changed = DB.updatePrices({ TLKM: testPrice }, "2026-10-24");
const tlkm = DB.stockByCode("TLKM");
check("update harga dari UI", changed === 1 && tlkm.HARGA === testPrice, `changed=${changed}`);
check("rasio harga dihitung ulang",
  Math.abs(tlkm.PE - testPrice / tlkm.EPS) < 1e-9 && Math.abs(tlkm.DY - tlkm.DPS / testPrice) < 1e-9,
  `PE ${tlkm.PE.toFixed(2)} DY ${tlkm.DY.toFixed(4)}`);
check("MoS & VALUASI ikut diperbarui",
  Math.abs(tlkm.MOS - (tlkm.FV - testPrice) / tlkm.FV) < 1e-9 && Math.abs(tlkm.valuasi.MOS - tlkm.MOS) < 1e-9);
check("tanggal harga tersimpan", DB.priceDate() === "2026-10-24", DB.priceDate());
check("harga sama tidak dihitung ulang", DB.updatePrices({ TLKM: testPrice }) === 0);

// Simulasi data server berubah (mis. workflow Yahoo): referensi harus diambil
// dari DBF baru, tetapi jurnal transaksi di browser tetap dipertahankan.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  if (String(url).endsWith("data/manifest.json")) {
    const res = await originalFetch(url);
    const data = await res.json();
    data.priceUpdated = "2099-01-01T00:00:00+07:00";
    return { ok: true, status: 200, json: async () => data, arrayBuffer: () => res.arrayBuffer() };
  }
  return originalFetch(url);
};
await DB.init();
check("auto-refresh referensi saat server berubah", DB.state.autoRefreshed === true);
check("transaksi bertahan saat auto-refresh", DB.rows("TRANSAKSI").some((r) => r.ID === testId));
check("harga lokal yang basi diganti harga DBF", DB.stockByCode("TLKM").HARGA !== testPrice, String(DB.stockByCode("TLKM").HARGA));

if (failed) {
  console.error(`\n${failed} pemeriksaan gagal.`);
  process.exit(1);
}
console.log("\nSemua pemeriksaan logika aplikasi lulus.");
