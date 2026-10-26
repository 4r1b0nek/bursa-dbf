# -*- coding: utf-8 -*-
"""Mesin analisis: rasio, valuasi, skenario, skor, simulasi."""
import json, math, os
from data import D

FX = 17997.0
COE = 0.135          # biaya ekuitas: BI 5,75% + ERP ~7,75% (crisis-adjusted)

# harga acuan = penutupan terakhir 21 Okt 2026 (tabel historis)
P = {"BJBR": 715, "BJTM": 498, "ADRO": 2360, "PGEO": 980, "IPCC": 990,
     "TLKM": 2080, "POWR": 910, "PTBA": 3080, "TUGU": 1345}

# PE wajar (judgment, berbasis: rata-rata 5 tahun, kualitas laba, payout, ROE)
PE_FAIR = {"BJBR": 6.0, "BJTM": 6.0, "ADRO": 6.2, "PGEO": 16.0, "IPCC": 8.5,
           "TLKM": 14.0, "POWR": 10.0, "PTBA": 6.2, "TUGU": 6.8}

TECH = {
 "BJTM": dict(ma20=507.15, ma50=515.56, rsi=43.8, macd=-6.18, sig=-4.39, hist=-1.79,
              hi20=515, lo20=472, hi50=530, lo50=472, vol_ratio=1.33, atr=6.77, atr_pct=1.36,
              wk=[515,520,525,530,520,520,510,515,510,498]),
 "ADRO": dict(ma20=2482, ma50=2572.2, rsi=41.9, macd=-67.54, sig=-47.45, hist=-20.08,
              hi20=2600, lo20=2210, hi50=2840, lo50=2210, vol_ratio=0.96, atr=64.62, atr_pct=2.74,
              wk=[2570,2610,2650,2690,2600,2600,2430,2600,2510,2360]),
 "PGEO": dict(ma20=976.75, ma50=1019.8, rsi=49.3, macd=-23.87, sig=-22.33, hist=-1.54,
              hi20=1070, lo20=830, hi50=1100, lo50=830, vol_ratio=0.97, atr=32.31, atr_pct=3.30,
              wk=[1100,1005,1035,1035,1040,1090,975,1010,980,980]),
 "IPCC": dict(ma20=1041.75, ma50=1101.4, rsi=38.1, macd=-34.16, sig=-29.51, hist=-4.65,
              hi20=1085, lo20=925, hi50=1175, lo50=925, vol_ratio=1.12, atr=21.54, atr_pct=2.18,
              wk=[1175,1140,1145,1140,1105,1095,1065,1060,1045,990]),
 "TLKM": dict(ma20=2231, ma50=2452.4, rsi=39.5, macd=-127.93, sig=-106.32, hist=-21.61,
              hi20=2410, lo20=1770, hi50=2700, lo50=1770, vol_ratio=1.61, atr=82.31, atr_pct=3.96,
              wk=[2600,2600,2590,2660,2660,2440,2290,2310,2250,2080]),
 "POWR": dict(ma20=936.25, ma50=925.2, rsi=47.9, macd=-10.14, sig=2.10, hist=-12.24,
              hi20=975, lo20=810, hi50=1025, lo50=785, vol_ratio=0.69, atr=26.92, atr_pct=2.96,
              wk=[840,860,920,1005,985,965,950,970,965,910]),
 "PTBA": dict(ma20=3161, ma50=2911.8, rsi=50.4, macd=38.10, sig=93.53, hist=-55.43,
              hi20=3400, lo20=2800, hi50=3400, lo50=2340, vol_ratio=1.09, atr=90.77, atr_pct=2.95,
              wk=[2370,2420,2720,3100,3000,3050,3120,3380,3270,3080]),
 "TUGU": dict(ma20=1456.5, ma50=1428.1, rsi=43.3, macd=-27.23, sig=-1.60, hist=-25.63,
              hi20=1570, lo20=1250, hi50=1645, lo50=1235, vol_ratio=0.96, atr=51.15, atr_pct=3.80,
              wk=[1425,1315,1340,1355,1630,1550,1475,1525,1465,1345]),
}

BJBR_CLOSES = [785,785,790,790,790,785,790,790,795,785,790,790,790,795,795,800,805,805,
               800,800,795,795,795,795,790,795,755,765,760,765,765,755,755,760,760,755,
               750,760,760,760,755,755,745,755,750,750,715,685,725,715]

def _mean(a): return sum(a)/len(a)
def _ema(v, p):
    k = 2/(p+1); e = _mean(v[:p]); out=[e]
    for i in range(p, len(v)):
        e = v[i]*k + e*(1-k); out.append(e)
    return out
def _rsi(c, p=14):
    g=l=0.0
    for i in range(1, p+1):
        d=c[i]-c[i-1]; g += max(d,0); l += max(-d,0)
    g/=p; l/=p
    for i in range(p+1, len(c)):
        d=c[i]-c[i-1]; g=(g*(p-1)+max(d,0))/p; l=(l*(p-1)+max(-d,0))/p
    return 100.0 if l==0 else 100-100/(1+g/l)

def bjbr_tech():
    c = BJBR_CLOSES
    e12, e26 = _ema(c,12), _ema(c,26)
    off = len(e12)-len(e26)
    ml = [e12[i+off]-x for i,x in enumerate(e26)]
    s = _ema(ml,9)
    atr = _mean([abs(c[i]-c[i-1]) for i in range(len(c)-13, len(c))])
    wk = [c[i] for i in range(4, len(c), 5)]
    return dict(ma20=round(_mean(c[-20:]),2), ma50=round(_mean(c),2), rsi=round(_rsi(c),1),
                macd=round(ml[-1],2), sig=round(s[-1],2), hist=round(ml[-1]-s[-1],2),
                hi20=max(c[-20:]), lo20=min(c[-20:]), hi50=max(c), lo50=min(c),
                vol_ratio=1.02, atr=round(atr,2), atr_pct=round(atr/c[-1]*100,2), wk=wk)
TECH["BJBR"] = bjbr_tech()

ASSUME = {"BJBR": (0.08, 0.04, -0.04), "BJTM": (0.09, 0.05, -0.03),
          "ADRO": (0.06, -0.02, -0.12), "PGEO": (0.10, 0.06, 0.00),
          "IPCC": (0.08, 0.04, -0.05), "TLKM": (0.06, 0.02, -0.06),
          "POWR": (0.07, 0.03, -0.04), "PTBA": (0.05, -0.03, -0.12),
          "TUGU": (0.10, 0.05, -0.06)}

SCORES = {"BJBR": (6, 8, 7, 4, 4, 5), "BJTM": (5, 9, 7, 4, 3, 5),
          "ADRO": (7, 5, 6, 5, 5, 7), "PGEO": (6, 3, 5, 5, 6, 7),
          "IPCC": (8, 7, 8, 3, 3, 6), "TLKM": (6, 8, 7, 3, 5, 6),
          "POWR": (7, 3, 7, 7, 5, 7), "PTBA": (6, 4, 3, 7, 5, 7),
          "TUGU": (7, 7, 8, 4, 5, 6)}
W = dict(fund=0.20, val=0.20, div=0.25, tech=0.10, risk=0.15, pros=0.10)

def cagr(v0, v1, n):
    if not v0 or not v1 or v0 <= 0 or v1 <= 0 or n <= 0: return None
    return (v1/v0)**(1/n) - 1

M = {}
for code, d in D.items():
    p = P[code]
    r = dict(code=code, name=d["name"], sector=d["sector"], model=d["model"],
             price=p, mcap=d["mcap"])
    eps = d["eps_ttm"]
    bvps = d["equity"]*1e6/d["shares"]
    r.update(eps=eps, bvps=bvps, pe=p/eps, pb=p/bvps, dy=d["dps_ttm"]/p,
             dps=d["dps_ttm"], payout=d["dps_ttm"]/eps, roe=d["roe"], roa=d["roa"],
             pm=d["pm"], om=d["om"], der=d["der"], cr=d["cr"], icr=d["icr"],
             ev_ebitda=d["ev_ebitda"], fcf=d["fcf"], debt=d["debt"],
             equity=d["equity"], cash=d["cash"])
    r["pe_avg5"] = _mean([x for x in d["pe_hist"] if x])
    r["pb_avg5"] = _mean([x for x in d["pb_hist"] if x])
    r["pe_vs_hist"] = r["pe"]/r["pe_avg5"] - 1
    r["pb_vs_hist"] = r["pb"]/r["pb_avg5"] - 1

    basis = d["growth_basis"]
    rev = d["rev"] if basis == "IDR" else d["rev_usd"]
    ni  = d["ni"]  if basis == "IDR" else d["ni_usd"]
    r["rev_cagr5"], r["ni_cagr5"] = cagr(rev[0], rev[4], 4), cagr(ni[0], ni[4], 4)
    r["eps_cagr5"] = cagr(d["eps"][0], d["eps"][4], 4) if basis == "IDR" else r["ni_cagr5"]
    yrs = sorted(d["div"])
    r["div_cagr"] = cagr(d["div"][yrs[0]], d["div"][yrs[-1]], yrs[-1]-yrs[0])
    r["div_first"], r["div_last"] = d["div"][yrs[0]], d["div"][yrs[-1]]
    r["div_span"] = f"{yrs[0]}-{yrs[-1]}"

    g_sus = max(0.0, min(d["roe"]/100*(1-min(r["payout"],1.0)), 0.06))
    r["ddm"] = d["dps_ttm"]*(1+g_sus)/(COE-g_sus)
    r["ddm_lo"] = d["dps_ttm"]*(1+g_sus)/(COE+0.015-g_sus)
    r["ddm_hi"] = d["dps_ttm"]*(1+g_sus)/(COE-0.015-g_sus)
    if d["model"] == "bank":
        r["pb_fair"] = max(0.20, min(1.20, (d["roe"]/100-0.03)/(COE-0.03)))
        r["pb_value"] = r["pb_fair"]*bvps
    else:
        r["pb_fair"] = r["pb_value"] = None
    r["pe_fair"] = PE_FAIR[code]
    r["pe_value"] = eps*r["pe_fair"]

    if d["model"] == "bank":
        r["fv"] = 0.6*r["pb_value"] + 0.4*r["ddm"]; wts = "60% PB + 40% DDM"
    elif d["model"] == "cyclical":
        r["fv"] = 0.6*r["pe_value"] + 0.4*(r["pb_avg5"]*bvps); wts = "60% PE + 40% PB"
    elif d["model"] == "insurer":
        r["fv"] = 0.5*r["pe_value"] + 0.5*r["ddm"]; wts = "50% PE + 50% DDM"
    elif d["model"] == "utility":
        r["fv"] = 0.6*r["pe_value"] + 0.4*r["ddm"]; wts = "60% PE + 40% DDM"
    else:
        r["fv"] = 0.45*r["pe_value"] + 0.35*r["ddm"] + 0.20*(r["pb_avg5"]*bvps)
        wts = "45% PE + 35% DDM + 20% PB"
    r["fv_weights"] = wts
    r["fv_lo"] = min(r["ddm_lo"], r["fv"]*0.88)
    r["fv_hi"] = max(r["ddm_hi"], r["fv"]*1.12)
    r["mos"] = (r["fv"]-p)/r["fv"]

    gb, gm, gw = ASSUME[code]
    sc = {}
    for nm, g, pe_f in (("bull", gb, r["pe_fair"]*1.15), ("base", gm, r["pe_fair"]),
                        ("bear", gw, r["pe_fair"]*0.70)):
        t = {}
        for yr in (1, 3, 5):
            pe_use = (r["pe"]+pe_f)/2 if yr == 1 else pe_f
            t[yr] = eps*(1+g)**yr*pe_use
        sc[nm] = t
    r["scen"] = sc

    t = TECH[code]
    r.update(ma20=t["ma20"], ma50_t=t["ma50"], rsi14=t["rsi"], macd=t["macd"],
             macd_sig=t["sig"], macd_hist=t["hist"], hi20=t["hi20"], lo20=t["lo20"],
             hi52=d["hi52"], lo52=d["lo52"], atr=t["atr"], atr_pct=t["atr_pct"],
             vol_ratio=t["vol_ratio"], wk=t["wk"],
             dist_ma20=(p/t["ma20"]-1)*100, dist_ma50=(p/t["ma50"]-1)*100,
             dist_ma200=(p/d["ma200"]-1)*100, chg52=d["chg52"])

    s = SCORES[code]
    tot = s[0]*W["fund"]+s[1]*W["val"]+s[2]*W["div"]+s[3]*W["tech"]+s[4]*W["risk"]+s[5]*W["pros"]
    r["scores"] = dict(zip(("fund","val","div","tech","risk","pros"), s))
    r["score_total"] = round(tot*10, 1)
    M[code] = r

def simulate(monthly=5_000_000, years=20, price_g=0.06, div_yield=0.085, div_g=0.05):
    price, dps, shares = 1.0, div_yield, 0.0
    pm = (1+price_g)**(1/12)-1
    marks, invested = {}, 0.0
    for m in range(1, years*12+1):
        if m > 1 and (m-1) % 12 == 0:
            dps *= (1+div_g)
        price *= (1+pm)
        shares += (monthly + shares*dps/12)/price
        invested += monthly
        if m % 12 == 0:
            marks[m//12] = dict(value=shares*price, income=shares*dps, invested=invested)
    return marks

SIM = {c: simulate(monthly=c, price_g=0.05, div_yield=0.08, div_g=0.05)
       for c in (2_000_000, 5_000_000, 10_000_000)}
SIM_TR = {rt: simulate(monthly=5_000_000, price_g=rt-0.08) for rt in (0.10, 0.12, 0.14)}

if __name__ == "__main__":
    hdr = f"{'KODE':5}{'PRICE':>7}{'PE':>6}{'PEf':>6}{'PB':>6}{'DY':>7}{'PAY':>6}{'FV':>7}{'MoS':>7}{'SKOR':>6}"
    print(hdr); print("-"*len(hdr))
    for c, r in M.items():
        print(f"{c:5}{r['price']:>7.0f}{r['pe']:>6.2f}{r['pe_fair']:>6.1f}{r['pb']:>6.2f}"
              f"{r['dy']*100:>6.1f}%{r['payout']*100:>5.0f}%{r['fv']:>7.0f}{r['mos']*100:>6.0f}%{r['score_total']:>6.1f}")
    print("\nSkenario 1y/3y/5y:")
    for c, r in M.items():
        s = r["scen"]
        print(f"{c:5} bull {s['bull'][1]:>6.0f}{s['bull'][3]:>6.0f}{s['bull'][5]:>6.0f} | "
              f"base {s['base'][1]:>6.0f}{s['base'][3]:>6.0f}{s['base'][5]:>6.0f} | "
              f"bear {s['bear'][1]:>6.0f}{s['bear'][3]:>6.0f}{s['bear'][5]:>6.0f}")
    print("\nSimulasi Rp5jt/bln (nilai, income/tahun):")
    for y in (10, 15, 20):
        v = SIM[5_000_000][y]
        print(f"  {y}y: {v['value']/1e9:.2f} M | {v['income']/1e6:.1f} jt/thn | modal {v['invested']/1e9:.2f} M")
    out = dict(fx=FX, coe=COE, stocks=M, sim=SIM, sim_tr=SIM_TR)
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model.json")
    json.dump(out, open(path, "w", encoding="utf-8"), indent=1, ensure_ascii=False, default=str)
    print("\nmodel.json written")
