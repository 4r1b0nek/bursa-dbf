/** charts.js — grafik SVG tanpa dependensi. */
import { esc, num, compactRp, pctRaw, isNum } from "./format.js";

const INK = "#0b1526";
const MUTED = "#64748b";
const GRID = "#e2e8f0";
const BRAND = "#0f766e";
const BRAND_SOFT = "#5eead4";
const POS = "#047857";
const NEG = "#be123c";
const GOLD = "#b45309";
const SLATE = "#94a3b8";

const RATING_COLOR = {
  Menarik: POS,
  Netral: GOLD,
  "Kurang menarik": NEG,
};

function frame(w, h, label, extra = "") {
  return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" ${extra}>`;
}

function text(x, y, content, { size = 10, fill = MUTED, anchor = "start", weight = 500, ops = 1 } = {}) {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}" opacity="${ops}" style="font-variant-numeric:tabular-nums">${esc(content)}</text>`;
}

function niceMax(value) {
  if (!isNum(value) || value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 3 ? 3 : n <= 5 ? 5 : n <= 7.5 ? 7.5 : 10;
  return step * pow;
}

function axisValue(v) {
  if (Math.abs(v) >= 1e9) return compactRp(v);
  return num(v, 0);
}

/* ------------------------------------------------------------------ trend */
export function sparkline(values, { width = 150, height = 44, color = BRAND } = {}) {
  const vals = values.filter(isNum);
  if (vals.length < 2) return `<span class="chart-empty">—</span>`;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pad = 4;
  const x = (i) => pad + (i * (width - pad * 2)) / (vals.length - 1);
  const y = (v) => height - pad - ((v - min) / span) * (height - pad * 2);
  const points = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = `M${points.join(" L")}`;
  const area = `${line} L${x(vals.length - 1).toFixed(1)},${height - pad} L${pad},${height - pad} Z`;
  return `${frame(width, height, "Tren harga mingguan")}
    <path d="${area}" fill="${color}" opacity="0.10"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(vals.length - 1).toFixed(1)}" cy="${y(vals[vals.length - 1]).toFixed(1)}" r="2.6" fill="${color}"/>
  </svg>`;
}

export function priceChart(history, { width = 560, height = 180 } = {}) {
  const vals = history.filter((h) => isNum(h.HARGA));
  if (vals.length < 2) return `<span class="chart-empty">Data harga belum tersedia</span>`;
  const prices = vals.map((h) => h.HARGA);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const padL = 46;
  const padR = 8;
  const padT = 10;
  const padB = 22;
  const x = (i) => padL + (i * (width - padL - padR)) / (vals.length - 1);
  const y = (v) => padT + (height - padT - padB) * (1 - (v - min) / span);
  const pts = vals.map((h, i) => `${x(i).toFixed(1)},${y(h.HARGA).toFixed(1)}`);
  const area = `M${pts.join(" L")} L${x(vals.length - 1).toFixed(1)},${height - padB} L${padL},${height - padB} Z`;
  const grid = [0, 0.5, 1]
    .map((f) => {
      const val = min + span * f;
      return `<line x1="${padL}" x2="${width - padR}" y1="${y(val).toFixed(1)}" y2="${y(val).toFixed(1)}" stroke="${GRID}"/>
        ${text(padL - 6, y(val) + 3, num(val, 0), { anchor: "end", size: 9.5 })}`;
    })
    .join("");
  const labels = vals
    .map((h, i) =>
      i === 0 || i === vals.length - 1 || i === Math.floor(vals.length / 2)
        ? text(x(i), height - 6, h.PERIODE || `W${i + 1}`, { anchor: "middle", size: 9 })
        : ""
    )
    .join("");
  const last = vals[vals.length - 1];
  return `${frame(width, height, "Pergerakan harga 10 minggu terakhir")}
    <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BRAND}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${BRAND}" stop-opacity="0.01"/>
    </linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#pg)"/>
    <path d="M${pts.join(" L")}" fill="none" stroke="${BRAND}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${x(vals.length - 1).toFixed(1)}" cy="${y(last.HARGA).toFixed(1)}" r="3.4" fill="${BRAND}" stroke="#fff" stroke-width="1.5"/>
    ${text(x(vals.length - 1) - 2, y(last.HARGA) - 9, num(last.HARGA, 0), { anchor: "end", size: 10, fill: INK, weight: 700 })}
    ${labels}
  </svg>`;
}

/* -------------------------------------------------------------- valuasi map */
export function valuationMap(stocks) {
  const points = stocks.filter((s) => isNum(s.DY) && isNum(s.MOS) && s.SKOR != null);
  if (!points.length) return `<span class="chart-empty">Belum ada data valuasi</span>`;
  const width = 760;
  const height = 330;
  const m = { l: 52, r: 18, t: 20, b: 38 };
  const plotW = width - m.l - m.r;
  const plotH = height - m.t - m.b;
  const xMin = 3;
  const xMax = 13;
  const yMin = -35;
  const yMax = 55;
  const x = (v) => m.l + ((v - xMin) / (xMax - xMin)) * plotW;
  const y = (v) => m.t + plotH * (1 - (v - yMin) / (yMax - yMin));

  const xTicks = [3, 5, 7, 9, 11, 13];
  const yTicks = [-30, -15, 0, 15, 30, 45];

  const grid = [
    ...xTicks.map(
      (t) =>
        `<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="${m.t}" y2="${m.t + plotH}" stroke="${GRID}"/>
         ${text(x(t), height - 20, `${t}%`, { anchor: "middle", size: 9.5 })}`
    ),
    ...yTicks.map(
      (t) =>
        `<line x1="${m.l}" x2="${m.l + plotW}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="${t === 0 ? "#cbd5e1" : GRID}" ${t === 0 ? 'stroke-dasharray="4 4"' : ""}/>
         ${text(m.l - 8, y(t) + 3.5, `${t > 0 ? "+" : ""}${t}%`, { anchor: "end", size: 9.5 })}`
    ),
  ].join("");

  const placed = [];
  const dots = points
    .map((s) => {
      const cx = x(Math.max(xMin, Math.min(xMax, s.DY * 100)));
      const cy = y(Math.max(yMin, Math.min(yMax, s.MOS * 100)));
      const r = 6 + (s.SKOR || 50) / 22;
      const color = RATING_COLOR[s.RATING] || BRAND;

      // tempatkan label di sekitar titik tanpa saling menimpa
      const w = s.KODE.length * 6.4;
      const candidates = [
        [r + 5, -5, "start"], [r + 5, 12, "start"], [-r - 5, -5, "end"],
        [-r - 5, 12, "end"], [2, -r - 8, "start"], [2, r + 15, "start"],
      ];
      let lx = cx + candidates[0][0];
      let ly = cy + candidates[0][1];
      let anchor = candidates[0][2];
      for (const [dx, dy, anc] of candidates) {
        const tx = cx + dx;
        const ty = cy + dy;
        const box = {
          x1: anc === "start" ? tx : tx - w,
          x2: anc === "start" ? tx + w : tx,
          y1: ty - 10,
          y2: ty + 2,
        };
        const clash = placed.some((b) => box.x1 < b.x2 + 3 && box.x2 + 3 > b.x1 && box.y1 < b.y2 + 2 && box.y2 + 2 > b.y1);
        if (!clash) {
          lx = tx; ly = ty; anchor = anc;
          placed.push(box);
          break;
        }
      }

      return `<g>
        <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" fill-opacity="0.82" stroke="#fff" stroke-width="1.5">
          <title>${esc(s.KODE)} — MoS ${pctRaw(s.MOS * 100, 1, true)}, yield ${pctRaw(s.DY * 100, 1)}, skor ${num(s.SKOR, 1)}</title>
        </circle>
        ${text(lx, ly + 3.5, s.KODE, { size: 10, fill: INK, weight: 700, anchor })}
      </g>`;
    })
    .join("");

  return `${frame(width, height, "Peta valuasi: margin of safety versus dividend yield")}
    ${grid}
    ${text(m.l + 4, m.t + 12, "YIELD TINGGI + DISKON", { size: 9, fill: "#94a3b8", weight: 700 })}
    ${text(m.l + plotW - 4, m.t + 12, "YIELD TINGGI, MAHAL", { size: 9, fill: "#94a3b8", anchor: "end", weight: 700 })}
    ${dots}
    ${text(m.l + plotW / 2, height - 4, "Dividend yield (TTM)", { anchor: "middle", size: 9.5 })}
    <text transform="translate(14 ${(m.t + plotH / 2).toFixed(1)}) rotate(-90)" font-size="9.5" fill="${MUTED}" text-anchor="middle" font-weight="600">Margin of safety</text>
  </svg>`;
}

/* -------------------------------------------------------------- skenario */
export function scenarioChart(scen, price) {
  if (!scen) return `<span class="chart-empty">Skenario belum tersedia</span>`;
  const rows = [
    { key: "bull", label: "Bull", color: POS },
    { key: "base", label: "Base", color: BRAND },
    { key: "bear", label: "Bear", color: NEG },
  ];
  const horizons = [1, 3, 5];
  const values = rows.flatMap((r) => horizons.map((h) => scen[r.key]?.[h]).filter(isNum));
  const all = values.concat(price ? [price] : []);
  const max = niceMax(Math.max(...all) * 1.12);
  const width = 600;
  const height = 270;
  const m = { l: 48, r: 12, t: 28, b: 36 };
  const plotW = width - m.l - m.r;
  const plotH = height - m.t - m.b;
  const y = (v) => m.t + plotH * (1 - v / max);
  const barW = 30;
  const gap = 9;
  const groupW = barW * 3 + gap * 2;
  const step = plotW / horizons.length;

  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const val = max * f;
      return `<line x1="${m.l}" x2="${width - m.r}" y1="${y(val).toFixed(1)}" y2="${y(val).toFixed(1)}" stroke="${f === 0 ? "#cbd5e1" : GRID}"/>
        ${text(m.l - 7, y(val) + 3.5, axisValue(val), { anchor: "end", size: 9 })}`;
    })
    .join("");

  let bars = "";
  let labels = "";
  horizons.forEach((h, gi) => {
    const gx = m.l + step * gi + (step - groupW) / 2;
    rows.forEach((row, ri) => {
      const val = scen[row.key]?.[h];
      if (!isNum(val)) return;
      const bx = gx + ri * (barW + gap);
      const top = y(val);
      bars += `<rect x="${bx.toFixed(1)}" y="${top.toFixed(1)}" width="${barW}" height="${(m.t + plotH - top).toFixed(1)}" rx="4" fill="${row.color}" fill-opacity="0.88">
        <title>${row.label} ${h} tahun: ${num(val, 0)}</title></rect>`;
      const labelY = Math.max(m.t + 8, top - 6 - (ri === 1 ? 11 : 0));
      labels += text(bx + barW / 2, labelY, num(val, 0), { anchor: "middle", size: 8.6, fill: INK, weight: 600 });
    });
    labels += text(m.l + step * gi + step / 2, height - 14, `${h} tahun`, { anchor: "middle", size: 10 });
  });

  const priceLine = isNum(price)
    ? `<line x1="${m.l}" x2="${width - m.r}" y1="${y(price).toFixed(1)}" y2="${y(price).toFixed(1)}" stroke="${INK}" stroke-dasharray="5 5" stroke-width="1.2" opacity="0.55"/>`
    : "";

  const legend = "";

  return `${frame(width, height, "Skenario nilai saham 1, 3, dan 5 tahun")}
    ${grid}${legend}${bars}${labels}${priceLine}
  </svg>`;
}

/* -------------------------------------------------------------- dividen */
export function dividendChart(rows) {
  const byYear = new Map();
  for (const r of rows) {
    if (!isNum(r.DPS)) continue;
    const y = byYear.get(r.TAHUN) || { reg: 0, spc: 0 };
    if (String(r.TIPE).toUpperCase() === "SPESIAL") y.spc += r.DPS;
    else y.reg += r.DPS;
    byYear.set(r.TAHUN, y);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b).slice(-9);
  if (!years.length) return `<span class="chart-empty">Riwayat dividen belum tersedia</span>`;
  const data = years.map((y) => ({ year: y, ...byYear.get(y) }));
  const max = niceMax(Math.max(...data.map((d) => d.reg + d.spc)) * 1.16 || 1);
  const width = 600;
  const height = 220;
  const m = { l: 48, r: 12, t: 18, b: 32 };
  const plotW = width - m.l - m.r;
  const plotH = height - m.t - m.b;
  const y = (v) => m.t + plotH * (1 - v / max);
  const step = plotW / data.length;
  const barW = Math.min(46, step * 0.5);

  const grid = [0, 0.5, 1]
    .map((f) => {
      const val = max * f;
      return `<line x1="${m.l}" x2="${width - m.r}" y1="${y(val).toFixed(1)}" y2="${y(val).toFixed(1)}" stroke="${f === 0 ? "#cbd5e1" : GRID}"/>
        ${text(m.l - 7, y(val) + 3.5, num(val, 0), { anchor: "end", size: 9 })}`;
    })
    .join("");

  let bars = "";
  let labels = "";
  data.forEach((d, i) => {
    const cx = m.l + step * i + step / 2;
    const x = cx - barW / 2;
    const regH = (d.reg / max) * plotH;
    const spcH = (d.spc / max) * plotH;
    const baseY = m.t + plotH;
    if (d.reg) {
      bars += `<rect x="${x.toFixed(1)}" y="${(baseY - regH).toFixed(1)}" width="${barW}" height="${regH.toFixed(1)}" rx="3" fill="${BRAND}" fill-opacity="0.85">
        <title>${d.year}: DPS reguler ${num(d.reg, 2)}</title></rect>`;
    }
    if (d.spc) {
      bars += `<rect x="${x.toFixed(1)}" y="${(baseY - regH - spcH).toFixed(1)}" width="${barW}" height="${spcH.toFixed(1)}" rx="3" fill="${GOLD}" fill-opacity="0.8">
        <title>${d.year}: dividen spesial ${num(d.spc, 2)}</title></rect>`;
    }
    labels += text(cx, height - 12, d.year, { anchor: "middle", size: 9.5 });
    labels += text(cx, baseY - regH - spcH - 5, num(d.reg + d.spc, 0), { anchor: "middle", size: 8.5, fill: INK, weight: 600 });
  });

  return `${frame(width, height, "Riwayat dividen per tahun")}
    ${grid}${bars}${labels}
    <g transform="translate(${width - m.r - 130}, 10)">
      <rect width="7" height="7" rx="2" fill="${BRAND}" opacity="0.85"/>${text(11, 6.5, "reguler", { size: 9 })}
      <rect x="62" width="7" height="7" rx="2" fill="${GOLD}" opacity="0.8"/>${text(73, 6.5, "spesial", { size: 9 })}
    </g>
  </svg>`;
}

/* ---------------------------------------------------------------- radar */
export function radar(scores) {
  if (!scores) return `<span class="chart-empty">Skor belum tersedia</span>`;
  const axes = [
    { key: "fund", label: "Fundamental" },
    { key: "val", label: "Valuasi" },
    { key: "div", label: "Dividen" },
    { key: "tech", label: "Teknikal" },
    { key: "risk", label: "Risiko" },
    { key: "pros", label: "Prospek" },
  ];
  const width = 320;
  const height = 268;
  const cx = width / 2;
  const cy = height / 2 + 4;
  const radius = 88;
  const max = 10;
  const angle = (i) => (Math.PI * 2 * i) / axes.length - Math.PI / 2;
  const point = (i, v) => [cx + Math.cos(angle(i)) * radius * (v / max), cy + Math.sin(angle(i)) * radius * (v / max)];

  const rings = [2.5, 5, 7.5, 10]
    .map((v) => {
      const pts = axes.map((_, i) => point(i, v).map((n) => n.toFixed(1)).join(",")).join(" ");
      return `<polygon points="${pts}" fill="none" stroke="${GRID}" stroke-width="1"/>`;
    })
    .join("");

  const spokes = axes
    .map((_, i) => {
      const [x, y] = point(i, max);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${GRID}"/>`;
    })
    .join("");

  const scoreOf = (scores, key) => {
    const v = scores?.[key] ?? scores?.[key.toUpperCase()] ?? 0;
    return Math.max(0, Math.min(max, Number(v) || 0));
  };
  const polygon = axes
    .map((a, i) => {
      const v = scoreOf(scores, a.key);
      return point(i, v).map((n) => n.toFixed(1)).join(",");
    })
    .join(" ");

  const dots = axes
    .map((a, i) => {
      const v = scoreOf(scores, a.key);
      const [x, y] = point(i, v);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" fill="${BRAND}"/>`;
    })
    .join("");

  const labels = axes
    .map((a, i) => {
      const [x, y] = point(i, max + 1.9);
      const anchor = Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end";
      const value = scoreOf(scores, a.key);
      return `${text(x, y, a.label, { size: 8.6, anchor, fill: MUTED, weight: 700 })}
        ${text(x, y + 11, `${value}/10`, { size: 8.4, anchor, fill: INK, weight: 600 })}`;
    })
    .join("");

  return `${frame(width, height, "Skor enam faktor")}
    ${rings}${spokes}
    <polygon points="${polygon}" fill="${BRAND}" fill-opacity="0.16" stroke="${BRAND}" stroke-width="1.8" stroke-linejoin="round"/>
    ${dots}${labels}
  </svg>`;
}

/* ---------------------------------------------------------------- donut */
export function donut(items, { size = 190, total = null, label = "Alokasi" } = {}) {
  const data = items.filter((d) => isNum(d.value) && d.value > 0);
  if (!data.length) return `<span class="chart-empty">Belum ada posisi</span>`;
  const sum = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = size / 2 - 16;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = data
    .map((d) => {
      const len = (d.value / sum) * c;
      const dash = Math.max(0, len - 2.5);
      const seg = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${d.color}" stroke-width="18" stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})" stroke-linecap="button">
        <title>${esc(d.label)}: ${pctRaw((d.value / sum) * 100, 1)}</title>
      </circle>`;
      offset += len;
      return seg;
    })
    .join("");
  const centerValue = total !== null ? compactRp(total) : `${data.length} saham`;
  return `${frame(size, size, label)}
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${GRID}" stroke-width="18"/>
    ${arcs}
    ${text(size / 2, size / 2 - 2, centerValue, { anchor: "middle", size: 13, fill: INK, weight: 700 })}
    ${text(size / 2, size / 2 + 14, "nilai pasar", { anchor: "middle", size: 8.5 })}
  </svg>`;
}

export const DONUT_COLORS = ["#0f766e", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#84cc16", "#f97316", "#64748b"];

/* ------------------------------------------------------------- simulasi */
export function simChart(series) {
  if (!series?.length) return `<span class="chart-empty">Belum ada hasil simulasi</span>`;
  const width = 780;
  const height = 320;
  const m = { l: 62, r: 18, t: 20, b: 34 };
  const plotW = width - m.l - m.r;
  const plotH = height - m.t - m.b;
  const n = series.length - 1 || 1;
  const max = niceMax(Math.max(...series.map((s) => Math.max(s.value, s.invested))) * 1.05);
  const x = (i) => m.l + (i / n) * plotW;
  const y = (v) => m.t + plotH * (1 - v / max);

  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const val = max * f;
      return `<line x1="${m.l}" x2="${width - m.r}" y1="${y(val).toFixed(1)}" y2="${y(val).toFixed(1)}" stroke="${f === 0 ? "#cbd5e1" : GRID}"/>
        ${text(m.l - 8, y(val) + 3.5, axisValue(val), { anchor: "end", size: 9 })}`;
    })
    .join("");

  const investedPts = series.map((s, i) => `${x(i).toFixed(1)},${y(s.invested).toFixed(1)}`).join(" L");
  const valuePts = series.map((s, i) => `${x(i).toFixed(1)},${y(s.value).toFixed(1)}`).join(" L");

  const valueArea = `M${valuePts} L${x(n).toFixed(1)},${(m.t + plotH).toFixed(1)} L${m.l},${(m.t + plotH).toFixed(1)} Z`;
  const investedArea = `M${investedPts} L${x(n).toFixed(1)},${(m.t + plotH).toFixed(1)} L${m.l},${(m.t + plotH).toFixed(1)} Z`;

  const xLabels = series
    .map((s, i) => {
      if (i === 0 || i === n || i % Math.max(1, Math.round(n / 5)) === 0) {
        return text(x(i), height - 12, `${s.year} th`, { anchor: "middle", size: 9 });
      }
      return "";
    })
    .join("");

  const last = series[series.length - 1];
  return `${frame(width, height, "Proyeksi nilai portofolio dari waktu ke waktu")}
    <defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BRAND}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${BRAND}" stop-opacity="0.02"/>
    </linearGradient></defs>
    ${grid}
    <path d="${investedArea}" fill="${SLATE}" opacity="0.25"/>
    <path d="${investedPts}" fill="none" stroke="${SLATE}" stroke-width="1.8" stroke-dasharray="4 4"/>
    <path d="${valueArea}" fill="url(#vg)"/>
    <path d="M${valuePts}" fill="none" stroke="${BRAND}" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="${x(n).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="3.6" fill="${BRAND}" stroke="#fff" stroke-width="1.6"/>
    ${text(x(n) - 4, y(last.value) - 10, compactRp(last.value), { anchor: "end", size: 10, fill: INK, weight: 700 })}
    ${xLabels}
  </svg>`;
}

export function mosBar(mos, { max = 50 } = {}) {
  if (!isNum(mos)) return `<span class="muted">—</span>`;
  const pctVal = mos * 100;
  const width = Math.min(50, (Math.abs(pctVal) / max) * 50);
  const positive = pctVal >= 0;
  return `<div class="mos" title="Margin of safety ${pctRaw(pctVal, 1, true)}">
    <div class="mos-track"><span class="mos-zero"></span>
      <span class="mos-fill ${positive ? "pos" : "neg"}" style="--w:${width.toFixed(1)}%;--side:${positive ? "left" : "right"}"></span>
    </div>
    <span class="mos-value ${positive ? "pos" : "neg"}">${pctRaw(pctVal, 0, true)}</span>
  </div>`;
}

export function scoreBar(score, { max = 100 } = {}) {
  if (!isNum(score)) return `<span class="muted">—</span>`;
  const tone = score >= 62 ? "pos" : score >= 55 ? "warn" : "neg";
  return `<div class="score" title="Skor ${num(score, 1)} dari 100">
    <span class="score-track"><span class="score-fill ${tone}" style="width:${Math.min(100, (score / max) * 100).toFixed(1)}%"></span></span>
    <b>${num(score, 1)}</b>
  </div>`;
}
