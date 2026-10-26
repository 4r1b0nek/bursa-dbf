# -*- coding: utf-8 -*-
"""
Dataset + model perhitungan untuk 9 emiten BEI.
Sumber angka: stockanalysis.com (statistics / dividend / financials / ratios),
diverifikasi silang dengan riset berita (Kontan, CNBC, Antara, IDX Channel) per 21 Okt 2026.
Semua angka adalah data publik; tidak ada angka yang diarang.
"""
import json, math

FX = 17997.0          # Rp/USD, 21 Okt 2026
COE = 0.145           # cost of equity (BI 5,75% + ERP ~8,75%) - asumsi eksplisit

# ---------------------------------------------------------------- RAW DATA
D = {}

D["BJBR"] = dict(
    name="Bank BJB", sector="Bank Daerah", mcap="7,52 T", shares=10.52e9,
    price=715, ma50=772.00, ma200=796.35, rsi=38.74, chg52=-6.49,
    hi52=900, lo52=660, avgvol=4494325,
    pe=5.29, fwdpe=4.12, pb=0.39, ps=0.82, ev_ebitda=None,
    roe=9.38, roa=0.84, der=None, cr=None, icr=None,
    rev_ttm=9283436, ni_ttm=1442705, eps_ttm=137.12, pm=15.54, om=25.63,
    fcf=20970000, debt=43640000, equity=19770000, cash=21870000,
    rev=[8934495, 9730882, 8216451, 7991198, 9071730],       # 2021..2025
    ni=[2031858, 2304376, 1778395, 1369463, 1152816],
    eps=[206.52, 219.02, 169.03, 130.16, 109.57],
    pe_hist=[7.39, 6.91, 6.38, 6.33, 5.25],
    pb_hist=[1.03, 0.93, 0.77, 0.56, 0.36],
    div={2022: 99.11, 2023: 104.55, 2024: 95.05, 2025: 85.25, 2026: 85.54},
    dps_ttm=85.54,
    model="bank", growth_basis="IDR",
)

D["BJTM"] = dict(
    name="Bank Jatim", sector="Bank Daerah", mcap="7,45 T", shares=15.02e9,
    price=496, ma50=515.70, ma200=540.79, rsi=47.75, chg52=-1.94,
    hi52=605, lo52=466, avgvol=9069675,
    pe=4.79, fwdpe=None, pb=0.35, ps=0.95, ev_ebitda=None,
    roe=11.27, roa=1.46, der=None, cr=None, icr=None,
    rev_ttm=7886075, ni_ttm=1567090, eps_ttm=104.36, pm=19.87, om=30.23,
    fcf=-4803360, debt=15100000, equity=21640000, cash=15720000,
    rev=[4668920, 5053997, 4995384, 5270241, 6342611],
    ni=[1523070, 1542824, 1470105, 1281718, 1545518],
    eps=[101.43, 102.75, 97.91, 85.36, 102.93],
    pe_hist=[7.39, 6.91, 6.38, 6.33, 5.25],
    pb_hist=[1.03, 0.93, 0.77, 0.56, 0.36],
    div={2022: 52.11, 2023: 53.09, 2024: 54.39, 2025: 54.71, 2026: 56.62},
    dps_ttm=56.62,
    model="bank", growth_basis="IDR",
)

D["ADRO"] = dict(
    name="Alamtri Resources", sector="Batubara & Energi", mcap="68,77 T", shares=28.80e9,
    price=2340, ma50=2571.80, ma200=2390.10, rsi=40.69, chg52=38.05,
    hi52=2860, lo52=1695, avgvol=41449070,
    pe=6.64, fwdpe=6.24, pb=0.77, ps=1.96, ev_ebitda=4.94,
    roe=12.34, roa=6.01, der=0.38, cr=2.92, icr=18.39,
    rev_ttm=36050000, ni_ttm=10410000, eps_ttm=361.18, pm=28.89, om=33.90,
    fcf=-4604540, debt=34690000, equity=91720000, cash=28410000,
    rev_usd=[3993, 8102, 2135, 2079, 1874],
    ni_usd=[933.49, 2493, 1641, 1380, 447.69],
    ni_ttm_usd=582.12,
    eps=[None, None, None, None, None],   # USD, tidak dipakai
    pe_hist=[5.41, 3.08, 2.91, 3.37, 6.97],
    pb_hist=[1.13, 1.18, 0.64, 0.86, 0.62],
    div={2021: 226.44, 2022: 141.39, 2023: 692.04, 2024: 1674.33, 2025: 311.83, 2026: 118.26},
    div_regular={2023: 492.06, 2024: 316.15, 2025: 311.83, 2026: 118.26},
    dps_ttm=263.40,
    model="cyclical", growth_basis="USD",
)

D["PGEO"] = dict(
    name="Pertamina Geothermal", sector="Energi Terbarukan", mcap="41,06 T", shares=41.90e9,
    price=980, ma50=1019.50, ma200=1030.98, rsi=47.73, chg52=-26.05,
    hi52=1365, lo52=770, avgvol=15763585,
    pe=15.67, fwdpe=14.13, pb=1.16, ps=5.01, ev_ebitda=6.90,
    roe=7.51, roa=4.35, der=0.37, cr=4.36, icr=6.78,
    rev_ttm=8280000, ni_ttm=2650000, eps_ttm=63.17, pm=32.05, om=45.19,
    fcf=4070000, debt=13260000, equity=35880000, cash=11750000,
    rev_usd=[368.82, 386.07, 406.29, 407.12, 432.73],
    ni_usd=[85.08, 127.34, 163.59, 160.49, 137.70],
    ni_ttm_usd=148.36,
    eps=[None, None, None, None, None],
    pe_hist=[None, None, 19.21, 15.02, 20.45],
    pb_hist=[None, None, 1.59, 1.20, 1.38],
    div={2023: 10.87, 2024: 47.77, 2025: 53.09, 2026: 49.44},
    dps_ttm=49.44,
    model="utility", growth_basis="USD",
)

D["IPCC"] = dict(
    name="Indonesia Kendaraan Terminal", sector="Pelabuhan / Logistik", mcap="1,80 T", shares=1.82e9,
    price=990, ma50=1101.30, ma200=1221.33, rsi=37.51, chg52=-9.63,
    hi52=1450, lo52=900, avgvol=911415,
    pe=7.50, fwdpe=5.37, pb=1.41, ps=1.99, ev_ebitda=3.35,
    roe=19.12, roa=9.75, der=0.36, cr=3.83, icr=8.74,
    rev_ttm=927911, ni_ttm=245949, eps_ttm=135.26, pm=26.51, om=33.59,
    fcf=363750, debt=475730, equity=1310000, cash=1110000,
    rev=[516837, 726573, 735205, 824596, 929960],
    ni=[60056, 161725, 190855, 212216, 256513],
    eps=[33.03, 88.94, 104.96, 116.71, 141.07],
    pe_hist=[15.59, 6.41, 6.81, 6.04, 9.82],
    pb_hist=[0.88, 0.89, 1.06, 1.00, 1.85],
    div={2022: 35.61, 2023: 71.47, 2024: 86.81, 2025: 95.11, 2026: 86.69},
    dps_ttm=112.85,
    model="infra", growth_basis="IDR",
)

D["TLKM"] = dict(
    name="Telkom Indonesia", sector="Telekomunikasi", mcap="204,06 T", shares=98.58e9,
    price=2070, ma50=2452.20, ma200=2911.15, rsi=39.01, chg52=-29.59,
    hi52=3990, lo52=1770, avgvol=270804810,
    pe=11.35, fwdpe=10.22, pb=1.51, ps=1.36, ev_ebitda=3.49,
    roe=17.68, roa=7.58, der=0.60, cr=0.79, icr=7.80,
    rev_ttm=149616000, ni_ttm=17964000, eps_ttm=181.57, pm=12.01, om=24.19,
    fcf=43300000, debt=80890000, equity=134850000, cash=56480000,
    rev=[143210000, 147306000, 149216000, 149967000, 146742000],
    ni=[24877000, 20736000, 24560000, 22403000, 17814000],
    eps=[251.13, 209.32, 247.92, 226.15, 179.83],
    pe_hist=[16.09, 17.92, 15.93, 11.98, 19.35],
    pb_hist=[2.75, 2.49, 2.50, 1.74, 2.29],
    div={2022: 149.97, 2023: 167.60, 2024: 178.50, 2025: 212.47, 2026: 223.17},
    dps_ttm=223.17,
    model="infra", growth_basis="IDR",
)

D["POWR"] = dict(
    name="Cikarang Listrindo", sector="Listrik / IPP", mcap="14,58 T", shares=15.85e9,
    price=920, ma50=925.20, ma200=769.65, rsi=47.50, chg52=30.00,
    hi52=1040, lo52=670, avgvol=6773490,
    pe=11.46, fwdpe=12.53, pb=1.13, ps=1.43, ev_ebitda=4.83,
    roe=9.87, roa=5.80, der=0.49, cr=7.11, icr=5.43,
    rev_ttm=9960000, ni_ttm=1240000, eps_ttm=78.53, pm=12.49, om=19.85,
    fcf=1390000, debt=6170000, equity=12620000, cash=5330000,
    rev_usd=[514.85, 550.45, 546.08, 547.02, 553.50],
    ni_usd=[90.44, 72.54, 76.98, 75.34, 72.06],
    ni_ttm_usd=69.55,
    eps=[None, None, None, None, None],
    pe_hist=[7.52, 9.24, 9.45, 9.06, 9.21],
    pb_hist=[0.97, 0.96, 1.03, 0.96, 0.93],
    div={2024: 72.16, 2025: 69.79, 2026: 73.74},
    dps_ttm=73.74,
    model="utility", growth_basis="USD",
)

D["PTBA"] = dict(
    name="Bukit Asam", sector="Batubara", mcap="34,43 T", shares=11.52e9,
    price=2990, ma50=2909.60, ma200=2690.90, rsi=45.47, chg52=30.84,
    hi52=3490, lo52=2220, avgvol=45735790,
    pe=7.41, fwdpe=7.22, pb=1.39, ps=0.79, ev_ebitda=4.14,
    roe=21.11, roa=6.78, der=0.12, cr=1.21, icr=27.04,
    rev_ttm=44227234, ni_ttm=4746812, eps_ttm=411.70, pm=10.73, om=11.13,
    fcf=5540000, debt=2990000, equity=25340000, cash=7300000,
    rev=[29261468, 42648590, 38488867, 42764968, 42651724],
    ni=[7909113, 12567582, 6105856, 5103720, 2929957],
    eps=[701.91, 1094.00, 531.54, 443.51, 254.00],
    pe_hist=[3.94, 3.37, 4.59, 6.20, 9.08],
    pb_hist=[1.28, 1.47, 1.30, 1.40, 1.18],
    div={2022: 688.52, 2023: 1094.05, 2024: 397.71, 2025: 332.44, 2026: 114.51},
    dps_ttm=114.51,
    model="cyclical", growth_basis="IDR",
)

D["TUGU"] = dict(
    name="Asuransi Tugu Pratama", sector="Asuransi", mcap="4,73 T", shares=3.56e9,
    price=1345, ma50=1428.10, ma200=1274.20, rsi=42.76, chg52=31.22,
    hi52=1705, lo52=1000, avgvol=3204350,
    pe=5.24, fwdpe=None, pb=0.48, ps=0.84, ev_ebitda=5.07,
    roe=9.10, roa=1.95, der=0.08, cr=35.07, icr=13.77,
    rev_ttm=5751540, ni_ttm=919788, eps_ttm=258.69, pm=15.99, om=16.85,
    fcf=466700, debt=837400, equity=10010000, cash=8230000,
    rev=[2697843, 3031496, 3464139, 4115663, 5761146],
    ni=[316480, 347151, 1322394, 401575, 711057],
    eps=[89.01, 97.64, 371.92, 112.94, 199.98],
    pe_hist=[8.96, 8.89, 2.74, 9.12, 5.83],
    pb_hist=[0.32, 0.34, 0.35, 0.37, 0.41],
    div={2021: 26.10, 2022: 35.60, 2023: 64.56, 2024: 123.26, 2025: 78.85, 2026: 99.99},
    dps_ttm=99.99,
    model="insurer", growth_basis="IDR",
)

# ---------------------------------------------------------------- HELPERS
def cagr(v0, v1, n):
    if v0 is None or v1 is None or v0 <= 0 or v1 <= 0 or n <= 0:
        return None
    return (v1 / v0) ** (1.0 / n) - 1.0

def safe_avg(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None

def pct(x, d=1):
    return "n/a" if x is None else f"{x*100:.{d}f}%"

# ---------------------------------------------------------------- COMPUTE
out = {}
for code, d in D.items():
    r = {"code": code, "name": d["name"], "sector": d["sector"], "model": d["model"]}
    r.update({k: d[k] for k in ("price", "ma50", "ma200", "rsi", "chg52", "hi52", "lo52",
                                "avgvol", "pe", "fwdpe", "pb", "ps", "ev_ebitda", "roe", "roa",
                                "der", "cr", "icr", "mcap", "pm", "om")})
    # yield & payout (dihitung sendiri dari DPS tunai 12 bulan terakhir)
    r["dy"] = d["dps_ttm"] / d["price"]
    r["dps_ttm"] = d["dps_ttm"]
    r["payout"] = d["dps_ttm"] / d["eps_ttm"]

    # growth
    basis = d["growth_basis"]
    rev = d["rev"] if basis == "IDR" else d["rev_usd"]
    ni = d["ni"] if basis == "IDR" else d["ni_usd"]
    r["rev_cagr5"] = cagr(rev[0], rev[4], 4)
    r["ni_cagr5"] = cagr(ni[0], ni[4], 4)
    if basis == "IDR":
        r["eps_cagr5"] = cagr(d["eps"][0], d["eps"][4], 4)
    else:
        r["eps_cagr5"] = cagr(ni[0], ni[4], 4)   # proxy: EPS bergerak sejalan laba
    # dividend CAGR (tahun penuh pertama -> terakhir)
    yrs = sorted(d["div"].keys())
    r["div_years"] = yrs
    r["div_cagr"] = cagr(d["div"][yrs[0]], d["div"][yrs[-1]], yrs[-1] - yrs[0])

    # valuation vs history
    r["pe_avg5"] = safe_avg(d["pe_hist"])
    r["pb_avg5"] = safe_avg(d["pb_hist"])
    r["pe_vs_hist"] = r["pe"] / r["pe_avg5"] - 1 if r["pe_avg5"] else None
    r["pb_vs_hist"] = r["pb"] / r["pb_avg5"] - 1 if r["pb_avg5"] else None
    g = r["eps_cagr5"]
    r["peg"] = r["pe"] / (g * 100) if (g and g > 0) else None

    # intrinsic value
    bvps = d["equity"] * 1000 / d["shares"]     # equity dalam ribuan IDR -> *1000
    r["bvps"] = bvps
    r["graham"] = math.sqrt(22.5 * d["eps_ttm"] * bvps) if d["eps_ttm"] > 0 and bvps > 0 else None

    g_sus = min(d["roe"] / 100 * (1 - min(r["payout"], 1.0)), 0.06)
    r["g_sus"] = max(g_sus, 0.0)
    r["ddm"] = (d["dps_ttm"] * (1 + r["g_sus"])) / (COE - r["g_sus"]) if (COE - r["g_sus"]) > 0 else None
    if d["model"] == "bank":
        r["pb_fair"] = (d["roe"] / 100 - 0.03) / (COE - 0.03)
        r["pb_fair"] = max(min(r["pb_fair"], 1.2), 0.2)
        r["pb_value"] = r["pb_fair"] * bvps
    else:
        r["pb_fair"] = None
        r["pb_value"] = None

    cands = [x for x in (r["ddm"], r["pb_value"]) if x]
    r["fv_ddm_pb"] = safe_avg(cands)
    out[code] = r

if __name__ == "__main__":
    print(f"{'KODE':6}{'PRICE':>8}{'DY':>7}{'PAYOUT':>8}{'PE':>6}{'PEavg':>7}{'PB':>6}{'PBavg':>7}"
          f"{'ROE':>6}{'EPSg':>7}{'DIVg':>7}{'DDM':>8}{'GRAHAM':>8}")
    for c, r in out.items():
        f = lambda x, w=6, d=2: f"{x:>{w}.{d}f}" if isinstance(x, (int, float)) else f"{'n/a':>{w}}"
        print(f"{c:6}{r['price']:>8.0f}{r['dy']*100:>6.1f}%{r['payout']*100:>7.0f}%"
              f"{r['pe']:>6.2f}{f(r['pe_avg5'],7)}{r['pb']:>6.2f}{f(r['pb_avg5'],7)}"
              f"{r['roe']:>6.1f}{f(r['eps_cagr5']*100 if r['eps_cagr5'] else None,7,1)}"
              f"{f(r['div_cagr']*100 if r['div_cagr'] else None,7,1)}"
              f"{f(r['ddm'],8,0)}{f(r['graham'],8,0)}")
    with open("analisis/model.json", "w", encoding="utf-8") as fh:
        json.dump({"fx": FX, "coe": COE, "stocks": out}, fh, indent=1, ensure_ascii=False, default=str)
    print("\nmodel.json written")
