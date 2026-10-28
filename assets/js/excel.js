/**
 * excel.js — membaca workbook Dashboard_Simulator_13_Saham.xlsx di browser.
 * Membutuhkan SheetJS global (assets/vendor/xlsx.full.min.js).
 */

const n = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const text = (v) => String(v ?? "").trim();

function gridOf(wb, name) {
  const sheet = wb.Sheets[name];
  if (!sheet) throw new Error(`Sheet "${name}" tidak ditemukan.`);
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
}

function findHeader(grid, predicate) {
  return grid.findIndex((row) => predicate(row.map(text)));
}

function table(grid, headerIndex) {
  const headers = grid[headerIndex].map(text);
  return grid.slice(headerIndex + 1).map((row) => {
    const out = {};
    headers.forEach((header, i) => { if (header) out[header] = row[i] ?? null; });
    return out;
  });
}

function inferModel(sector) {
  const s = String(sector || "").toLowerCase();
  if (s.includes("bank")) return "bank";
  if (s.includes("batubara") || s.includes("energi") || s.includes("listrik")) return "cyclical";
  if (s.includes("asuransi") || s.includes("konsumsi")) return "defensive";
  return "growth";
}

function logNumber(value, fallback = null) {
  const x = n(value);
  return x === null ? fallback : x;
}

export function parseAnalysisWorkbook(buffer) {
  if (!globalThis.XLSX) throw new Error("Library Excel belum termuat.");
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });

  const dashGrid = gridOf(wb, "Dashboard");
  const dashHeader = findHeader(dashGrid, (row) => row[0] === "Kode" && row[1] === "Emiten");
  if (dashHeader < 0) throw new Error("Header Dashboard tidak dikenali.");
  const dashRows = table(dashGrid, dashHeader).filter((row) => /^[A-Z0-9]{4}$/.test(text(row.Kode).toUpperCase()));

  let updated = "2026-10-21";
  for (const row of dashGrid.slice(0, 8)) {
    const found = row.map(text).join(" ").match(/(\d{4}-\d{2}-\d{2})/);
    if (found) { updated = found[1]; break; }
  }
  const ihsg = n(dashGrid.find((row) => text(row[0]).toUpperCase() === "IHSG")?.[1]);

  const valGrid = gridOf(wb, "Valuasi & Skenario");
  const valHeader = findHeader(valGrid, (row) => row[0] === "Kode" && row.some((h) => h === "PE wajar"));
  const valuations = valHeader < 0 ? [] : table(valGrid, valHeader)
    .filter((row) => /^[A-Z0-9]{4}$/.test(text(row.Kode).toUpperCase()));

  const techGrid = gridOf(wb, "Teknikal");
  const techHeader = findHeader(techGrid, (row) => row[0] === "Kode" && row.some((h) => h === "RSI 14"));
  const technicals = techHeader < 0 ? [] : table(techGrid, techHeader)
    .filter((row) => /^[A-Z0-9]{4}$/.test(text(row.Kode).toUpperCase()));

  const logGrid = gridOf(wb, "Log Bulanan");
  const logHeader = findHeader(logGrid, (row) => row[0] === "Bulan");
  const logRows = logHeader < 0 ? [] : table(logGrid, logHeader)
    .filter((row) => /^\d{4}-\d{2}$/.test(text(row.Bulan)));

  const stocks = dashRows.map((row) => {
    const code = text(row.Kode).toUpperCase();
    const price = n(row.Harga);
    const eps = n(row["EPS TTM"]);
    const bvps = n(row.BVPS);
    const dps = n(row["DPS TTM"]);
    const fv = n(row["Nilai Wajar"]);
    const score = n(row.Skor);
    const roe = n(row.ROE);
    const pe = price && eps ? price / eps : n(row.PER);
    const pb = price && bvps ? price / bvps : n(row.PBV);
    const dy = price && dps ? dps / price : n(row.Yield);
    const mos = fv && price ? (fv - price) / fv : n(row.MoS);
    return {
      KODE: code,
      NAMA: text(row.Emiten),
      SEKTOR: text(row.Sektor),
      MODEL: inferModel(row.Sektor),
      HARGA: price,
      MCAP_T: n(row["Market Cap (Rp T)"]),
      EPS: eps,
      BVPS: bvps,
      DPS: dps,
      PE: pe,
      PB: pb,
      DY: dy,
      PAYOUT: n(row.Payout) ?? (dps && eps ? dps / eps : null),
      ROE: roe === null ? null : roe * 100,
      ROA: n(row["ROA (%)"]),
      PM: n(row["PM (%)"]),
      OM: n(row["OM (%)"]),
      DER: n(row["DER (x)"]),
      CR: n(row["CR (x)"]),
      ICR: n(row["ICR (x)"]),
      EVEBITDA: n(row["EV/EBITDA (x)"]),
      FCF: n(row.FCF),
      DEBT: n(row.Debt),
      EQUITY: n(row.Equity),
      CASH: n(row.Cash),
      PEAVG5: n(row["PER 5y"]),
      PBAVG5: n(row["PBV 5y"]),
      FV: fv,
      MOS: mos,
      SKOR: score,
      RATING: text(row.Rating),
      KEPUTUSAN: text(row.Keputusan),
      BINTANG: score === null ? null : Math.max(0, Math.min(5, Math.round((score / 20) * 2) / 2)),
      LEVEL_AKUM: text(row["Level Akumulasi"]) || null,
      LEVEL_BUY: text(row["Level Beli"]) || null,
      TARGET: typeof row.Target === "number"
        ? new Intl.NumberFormat("id-ID").format(Math.round(row.Target))
        : (text(row.Target) || null),
      CUTLOSS: n(row["Cut Loss"]),
      RINGKASAN: text(row.Ringkasan) || null,
      UPDAT: updated,
    };
  }).filter((s) => s.KODE && s.NAMA);

  const byCode = new Map(stocks.map((s) => [s.KODE, s]));
  const valuationRows = valuations.map((row) => {
    const code = text(row.Kode).toUpperCase();
    const s = byCode.get(code);
    return {
      KODE: code,
      MODEL: text(row.Metode),
      BOBOT: text(row.Metode),
      DDM: n(row.DDM),
      DDM_LO: n(row["DDM Low"]),
      DDM_HI: n(row["DDM High"]),
      PEFAIR: n(row["PE wajar"]),
      PEVALUE: s?.PE ?? null,
      PBF: n(row["PB Wajar"]),
      PBVALUE: s?.PB ?? null,
      FV: n(row["Nilai Wajar"]) ?? s?.FV ?? null,
      FV_LO: n(row["FV Low"]),
      FV_HI: n(row["FV High"]),
      MOS: s?.MOS ?? null,
      BULL1: n(row["Bull 1y"]), BULL3: n(row["Bull 3y"]), BULL5: n(row["Bull 5y"]),
      BASE1: n(row["Base 1y"]), BASE3: n(row["Base 3y"]), BASE5: n(row["Base 5y"]),
      BEAR1: n(row["Bear 1y"]), BEAR3: n(row["Bear 3y"]), BEAR5: n(row["Bear 5y"]),
    };
  });

  const technicalRows = technicals.map((row) => ({
    KODE: text(row.Kode).toUpperCase(),
    MA20: n(row.MA20),
    MA50: n(row.MA50),
    MA200: n(row.MA200),
    RSI14: n(row["RSI 14"]),
    MACD: n(row.MACD),
    MACDSIG: n(row.Signal),
    MACDHIST: n(row.Histogram),
    ATR: n(row.ATR),
    ATRPCT: n(row["ATR %"]) === null ? null : n(row["ATR %"]) * 100,
    DISTMA20: n(row["vs MA20"]) === null ? null : n(row["vs MA20"]) * 100,
    DISTMA50: n(row["vs MA50"]) === null ? null : n(row["vs MA50"]) * 100,
    DISTMA200: n(row["vs MA200"]) === null ? null : n(row["vs MA200"]) * 100,
  }));

  const scoreGrid = wb.Sheets.Skor
    ? XLSX.utils.sheet_to_json(wb.Sheets.Skor, { header: 1, defval: null, raw: true })
    : [];
  const scoreHeader = findHeader(scoreGrid, (row) => row[0] === "KODE" && row.includes("FUND"));
  const scoreTable = scoreHeader < 0 ? [] : table(scoreGrid, scoreHeader);
  const scoreByCode = new Map(scoreTable.map((row) => [text(row.KODE).toUpperCase(), row]));

  const scores = stocks.map((s) => {
    const row = scoreByCode.get(s.KODE) || {};
    return {
      KODE: s.KODE,
      FUND: n(row.FUND), VAL: n(row.VAL), DIV: n(row.DIV),
      TECH: n(row.TECH), RISK: n(row.RISK), PROS: n(row.PROS),
      TOTAL: s.SKOR,
    };
  });

  const divGrid = wb.Sheets.Dividen
    ? XLSX.utils.sheet_to_json(wb.Sheets.Dividen, { header: 1, defval: null, raw: true })
    : [];
  const divHeader = findHeader(divGrid, (row) => row[0] === "KODE" && row.includes("TAHUN"));
  const dividendRows = divHeader < 0 ? [] : table(divGrid, divHeader)
    .filter((row) => /^[A-Z0-9]{4}$/.test(text(row.KODE).toUpperCase()) && n(row.DPS) !== null && n(row.DPS) > 0)
    .map((row) => ({
      KODE: text(row.KODE).toUpperCase(),
      TAHUN: n(row.TAHUN) || Number(updated.slice(0, 4)),
      DPS: n(row.DPS),
      TIPE: text(row.TIPE) || "FINAL",
    }));
  const dividends = dividendRows.length
    ? dividendRows
    : stocks.filter((s) => s.DPS !== null && s.DPS > 0)
      .map((s) => ({ KODE: s.KODE, TAHUN: Number(updated.slice(0, 4)), DPS: s.DPS, TIPE: "TTM" }));

  let log = null;
  if (logRows.length) {
    const row = logRows[0];
    const yieldValue = n(row["Yield rata-rata"]);
    const mosValue = n(row["MoS rata-rata"]);
    log = {
      BULAN: text(row.Bulan),
      TGL: text(row.Tanggal) || updated,
      IHSG: n(row.IHSG) ?? ihsg,
      YIELD: yieldValue === null ? null : (Math.abs(yieldValue) <= 1 ? yieldValue * 100 : yieldValue),
      MOS: mosValue === null ? null : (Math.abs(mosValue) <= 1 ? mosValue * 100 : mosValue),
      JML_MURAH: n(row["Jumlah MoS > 0"]) ?? 0,
      JML_BUY: n(row["Jumlah Buy"]) ?? 0,
      SKOR: n(row["Skor rata-rata"]),
      CATATAN: text(row.Catatan) || `Upload Dashboard ${stocks.length} Saham`,
    };
  } else if (stocks.length) {
    const avg = (fn) => stocks.reduce((a, s) => a + (Number(fn(s)) || 0), 0) / stocks.length;
    log = {
      BULAN: updated.slice(0, 7),
      TGL: updated,
      IHSG: ihsg,
      YIELD: avg((s) => s.DY) * 100,
      MOS: avg((s) => s.MOS) * 100,
      JML_MURAH: stocks.filter((s) => s.MOS > 0).length,
      JML_BUY: stocks.filter((s) => String(s.KEPUTUSAN).toLowerCase().includes("buy")).length,
      SKOR: avg((s) => s.SKOR),
      CATATAN: `Upload Dashboard ${stocks.length} Saham`,
    };
  }

  return {
    stocks,
    valuations: valuationRows,
    technicals: technicalRows,
    scores,
    dividends,
    log,
    params: {
      TANGGAL_DATA: updated,
      HARGA_PER: updated,
      HARGA_SUMBER: `Upload Dashboard ${stocks.length} Saham`,
    },
    meta: { stocks: stocks.length, updated, fileName: "Dashboard_Simulator_13_Saham.xlsx" },
  };
}
