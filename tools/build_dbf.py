# -*- coding: utf-8 -*-
"""
Membangun seluruh tabel DBF aplikasi dari mesin analisis 9 emiten BEI.

Jalankan dari folder mana pun:
    python tools/build_dbf.py

Sumber angka: data.py (fundamental & dividen) + model.py (valuasi, skor,
skenario, teknikal). Hasil: data/*.DBF + data/manifest.json.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA_DIR = os.path.join(ROOT, "data")
sys.path.insert(0, HERE)

from dbf_writer import Field, Table, read_dbf          # noqa: E402
from data import D                                     # noqa: E402
from model import M                                    # noqa: E402

BUILD_DATE = dt.date.today()
DATA_DATE = "2026-10-21"

CATATAN = {
    "TLKM": dict(
        rating="Menarik", keputusan="Beli bertahap", bintang=4.0,
        akum="1.850 - 2.000", buy="2.000 - 2.100", target="2.450 / 2.900", cutloss=1750,
        ringkas=("De-rating ekstrem: PE 11,5x vs rata-rata 5 tahun 16,3x, PB 1,52x vs 2,35x, "
                 "yield 10,7%. Laba stabil, katalis divestasi NeutraDC. Beli bertahap; payout "
                 "di atas 100% dan tren turun menahan rekomendasi lebih kuat."),
    ),
    "BJBR": dict(
        rating="Menarik", keputusan="Beli bertahap", bintang=4.0,
        akum="660 - 700", buy="700 - 725", target="800 / 900", cutloss=640,
        ringkas=("Yield 12,0%, PB 0,38x, laba H1-2026 +58,8%, tetapi NPL naik ke 3,3% dan "
                 "peringkat turun ke idAA-. Valuasi murah dengan risiko kualitas aset nyata: "
                 "beli bertahap, posisi maksimal 12-14%."),
    ),
    "BJTM": dict(
        rating="Menarik", keputusan="Beli bertahap", bintang=4.0,
        akum="465 - 490", buy="490 - 505", target="540 / 605", cutloss=460,
        ringkas=("PB 0,35x, yield 11,4%, payout 55%: harga bank dalam kondisi stres. Kunci tesis "
                 "adalah NPL 3,88%; jika kualitas aset stabil, re-rating ke PB 0,55 berarti +57%. "
                 "Batasi posisi 8-10%."),
    ),
    "TUGU": dict(
        rating="Menarik", keputusan="Beli", bintang=4.0,
        akum="1.235 - 1.300", buy="1.300 - 1.380", target="1.570 / 1.705", cutloss=1180,
        ringkas=("Laba dan dividen tumbuh kuat (CAGR DPS 30,8%) dengan payout rendah 39%, "
                 "valuasi PE 5,2x dan PB 0,48x di bawah rata-rata. Risiko: laba asuransi berayun "
                 "dan ketergantungan pada Pertamina. Posisi 10-12%."),
    ),
    "IPCC": dict(
        rating="Menarik", keputusan="Beli posisi kecil", bintang=4.0,
        akum="900 - 950", buy="950 - 1.000", target="1.100 / 1.250", cutloss=880,
        ringkas=("ROE 19,1%, neraca bersih, dividen besar dan bertumbuh (CAGR DPS 24,9%), yield "
                 "11,4%. Risiko: likuiditas tipis, tarif stagnan, tren teknikal turun. Beli "
                 "posisi kecil maksimal 8%, akumulasi di 900-950."),
    ),
    "ADRO": dict(
        rating="Netral", keputusan="Hold", bintang=3.0,
        akum="2.150 - 2.250", buy="2.250 - 2.380", target="2.600 / 2.860", cutloss=2150,
        ringkas=("Yield 11,2% dan buyback menarik, tetapi PE 6,5x sudah di atas rata-rata "
                 "historis, FCF negatif saat dividen sekitar 100% laba, dan harga batubara di "
                 "puncak siklus. Hold; tunggu koreksi ke 2.150. Posisi satelit maksimal 8%."),
    ),
    "POWR": dict(
        rating="Netral", keputusan="Pantau", bintang=3.0,
        akum="820 - 870", buy="850 - 880", target="1.025 / 1.100", cutloss=800,
        ringkas=("Bisnis membaik dan cerita data center nyata, tetapi PE 30% di atas rata-rata "
                 "historis dengan pertumbuhan laba masih negatif. Yield 8,1% belum mengompensasi "
                 "risiko eksekusi. Pantau; akumulasi di 820-870."),
    ),
    "PTBA": dict(
        rating="Kurang menarik", keputusan="Pantau", bintang=2.0,
        akum="2.800 - 2.950", buy="2.950 - 3.080", target="3.400 / 3.600", cutloss=2700,
        ringkas=("Yield hanya 3,7%, harga naik 31% mendekati puncak 52 minggu, dan laba sangat "
                 "bergantung pada harga batubara. Tidak memenuhi target passive income; tunggu "
                 "koreksi. Untuk eksposur batubara, ADRO memiliki yield lebih baik."),
    ),
    "PGEO": dict(
        rating="Kurang menarik", keputusan="Pantau", bintang=2.0,
        akum="830 - 900", buy="900 - 950", target="1.070 / 1.200", cutloss=800,
        ringkas=("Bisnis bagus dan prospek jangka panjang (target 1 GW 2028), tetapi yield 5% "
                 "terlalu kecil dan valuasi belum mengompensasi risiko tarif serta ketergantungan "
                 "PLN. Pantau; masuk hanya di 830-900."),
    ),
}

TABLES = []


def rnd(value, digits=2):
    return None if value is None else round(float(value), digits)


def mcap_trillion(code: str) -> float:
    d = D[code]
    return round(M[code]["price"] * d["shares"] / 1e12, 2)


def add(name, label, description, fields, rows):
    table = Table(name=name, fields=fields, rows=rows, updated=BUILD_DATE)
    payload = table.to_bytes()
    path = os.path.join(DATA_DIR, f"{name}.DBF")
    with open(path, "wb") as fh:
        fh.write(payload)
    parsed = read_dbf(payload)
    assert parsed["records"] == len(rows), (name, parsed["records"], len(rows))
    assert len(parsed["rows"]) == len(rows), (name, "jumlah baris tidak cocok")
    TABLES.append(
        dict(name=name, file=f"{name}.DBF", label=label, description=description,
             records=len(rows), fields=len(fields), bytes=len(payload),
             sha1=hashlib.sha1(payload).hexdigest()[:12])
    )
    print(f"  {name:<11} {len(rows):>3} baris  {len(fields):>2} field  {len(payload):>6} byte")
    return parsed


def build_saham():
    fields = [
        Field("KODE", "C", 4), Field("NAMA", "C", 34), Field("SEKTOR", "C", 26),
        Field("MODEL", "C", 9), Field("HARGA", "N", 12, 2), Field("MCAP_T", "N", 10, 2),
        Field("EPS", "N", 10, 2), Field("BVPS", "N", 10, 2), Field("PE", "N", 8, 2),
        Field("PB", "N", 8, 3), Field("DY", "N", 8, 4), Field("DPS", "N", 10, 2),
        Field("PAYOUT", "N", 8, 4), Field("ROE", "N", 7, 2), Field("ROA", "N", 7, 2),
        Field("PM", "N", 7, 2), Field("OM", "N", 7, 2), Field("DER", "N", 7, 2),
        Field("CR", "N", 8, 2), Field("ICR", "N", 8, 2), Field("EVEBITDA", "N", 8, 2),
        Field("FCF", "N", 14, 0), Field("DEBT", "N", 14, 0), Field("EQUITY", "N", 14, 0),
        Field("CASH", "N", 14, 0), Field("PEAVG5", "N", 8, 2), Field("PBAVG5", "N", 8, 3),
        Field("FV", "N", 10, 2), Field("MOS", "N", 8, 4), Field("SKOR", "N", 5, 1),
        Field("RATING", "C", 16), Field("KEPUTUSAN", "C", 22), Field("BINTANG", "N", 3, 1),
        Field("LEVEL_AKUM", "C", 24), Field("LEVEL_BUY", "C", 24), Field("TARGET", "C", 28),
        Field("CUTLOSS", "N", 10, 2), Field("RINGKASAN", "C", 254), Field("UPDAT", "D", 8),
    ]
    rows = []
    for code, r in M.items():
        d, c = D[code], CATATAN[code]
        rows.append(dict(
            KODE=code, NAMA=d["name"], SEKTOR=d["sector"], MODEL=d["model"],
            HARGA=r["price"], MCAP_T=mcap_trillion(code), EPS=r["eps"], BVPS=r["bvps"],
            PE=r["pe"], PB=r["pb"], DY=r["dy"], DPS=r["dps"], PAYOUT=r["payout"],
            ROE=r["roe"], ROA=r["roa"], PM=r["pm"], OM=r["om"], DER=r["der"], CR=r["cr"],
            ICR=r["icr"], EVEBITDA=r["ev_ebitda"], FCF=r["fcf"], DEBT=r["debt"],
            EQUITY=r["equity"], CASH=r["cash"], PEAVG5=r["pe_avg5"], PBAVG5=r["pb_avg5"],
            FV=r["fv"], MOS=r["mos"], SKOR=r["score_total"], RATING=c["rating"],
            KEPUTUSAN=c["keputusan"], BINTANG=c["bintang"], LEVEL_AKUM=c["akum"],
            LEVEL_BUY=c["buy"], TARGET=c["target"], CUTLOSS=c["cutloss"],
            RINGKASAN=c["ringkas"], UPDAT=DATA_DATE,
        ))
    return add("SAHAM", "Master saham",
               "Profil, harga, rasio fundamental, nilai wajar, dan rekomendasi 9 emiten.",
               fields, rows)


def build_valuasi():
    fields = [
        Field("KODE", "C", 4), Field("MODEL", "C", 9), Field("BOBOT", "C", 34),
        Field("DDM", "N", 10, 2), Field("DDM_LO", "N", 10, 2), Field("DDM_HI", "N", 10, 2),
        Field("PEFAIR", "N", 7, 2), Field("PEVALUE", "N", 10, 2),
        Field("PBF", "N", 7, 3), Field("PBVALUE", "N", 10, 2),
        Field("FV", "N", 10, 2), Field("FV_LO", "N", 10, 2), Field("FV_HI", "N", 10, 2),
        Field("MOS", "N", 8, 4),
        Field("BULL1", "N", 10, 2), Field("BULL3", "N", 10, 2), Field("BULL5", "N", 10, 2),
        Field("BASE1", "N", 10, 2), Field("BASE3", "N", 10, 2), Field("BASE5", "N", 10, 2),
        Field("BEAR1", "N", 10, 2), Field("BEAR3", "N", 10, 2), Field("BEAR5", "N", 10, 2),
    ]
    rows = []
    for code, r in M.items():
        sc = r["scen"]
        rows.append(dict(
            KODE=code, MODEL=r["model"], BOBOT=r["fv_weights"],
            DDM=r["ddm"], DDM_LO=r["ddm_lo"], DDM_HI=r["ddm_hi"],
            PEFAIR=r["pe_fair"], PEVALUE=r["pe_value"], PBF=r["pb_fair"],
            PBVALUE=r["pb_value"], FV=r["fv"], FV_LO=r["fv_lo"], FV_HI=r["fv_hi"],
            MOS=r["mos"],
            BULL1=sc["bull"][1], BULL3=sc["bull"][3], BULL5=sc["bull"][5],
            BASE1=sc["base"][1], BASE3=sc["base"][3], BASE5=sc["base"][5],
            BEAR1=sc["bear"][1], BEAR3=sc["bear"][3], BEAR5=sc["bear"][5],
        ))
    return add("VALUASI", "Model valuasi",
               "Nilai wajar (DDM, PE, PB), bobot model, margin of safety, dan skenario 1/3/5 tahun.",
               fields, rows)


def build_teknika():
    fields = [
        Field("KODE", "C", 4), Field("MA20", "N", 10, 2), Field("MA50", "N", 10, 2),
        Field("MA200", "N", 10, 2), Field("RSI14", "N", 6, 2),
        Field("MACD", "N", 9, 2), Field("MACDSIG", "N", 9, 2),
        Field("MACDHIST", "N", 9, 2), Field("HI20", "N", 10, 2), Field("LO20", "N", 10, 2),
        Field("HI52", "N", 10, 2), Field("LO52", "N", 10, 2), Field("ATR", "N", 8, 2),
        Field("ATRPCT", "N", 6, 2), Field("VOLRATIO", "N", 6, 2), Field("CHG52", "N", 8, 2),
        Field("DISTMA20", "N", 8, 2), Field("DISTMA50", "N", 8, 2),
        Field("DISTMA200", "N", 8, 2),
    ]
    rows = []
    for code, r in M.items():
        rows.append(dict(
            KODE=code, MA20=r["ma20"], MA50=r["ma50_t"], MA200=D[code]["ma200"],
            RSI14=r["rsi14"],
            MACD=r["macd"], MACDSIG=r["macd_sig"], MACDHIST=r["macd_hist"],
            HI20=r["hi20"], LO20=r["lo20"], HI52=r["hi52"], LO52=r["lo52"],
            ATR=r["atr"], ATRPCT=r["atr_pct"], VOLRATIO=r["vol_ratio"],
            CHG52=r["chg52"], DISTMA20=r["dist_ma20"], DISTMA50=r["dist_ma50"],
            DISTMA200=r["dist_ma200"],
        ))
    return add("TEKNIKAL", "Indikator teknikal",
               "MA, RSI, MACD, ATR, volume ratio, dan jarak harga terhadap rata-rata.",
               fields, rows)


def build_skor():
    fields = [
        Field("KODE", "C", 4), Field("FUND", "N", 3, 0), Field("VAL", "N", 3, 0),
        Field("DIV", "N", 3, 0), Field("TECH", "N", 3, 0), Field("RISK", "N", 3, 0),
        Field("PROS", "N", 3, 0), Field("TOTAL", "N", 4, 1),
    ]
    rows = []
    for code, r in M.items():
        s = r["scores"]
        rows.append(dict(KODE=code, FUND=s["fund"], VAL=s["val"], DIV=s["div"],
                         TECH=s["tech"], RISK=s["risk"], PROS=s["pros"],
                         TOTAL=r["score_total"]))
    return add("SKOR", "Skor multi-faktor",
               "Skor 0-10 untuk fundamental, valuasi, dividen, teknikal, risiko, dan prospek.",
               fields, rows)


def build_dividen():
    fields = [
        Field("KODE", "C", 4), Field("TAHUN", "N", 4, 0), Field("DPS", "N", 10, 2),
        Field("TIPE", "C", 8),
    ]
    rows = []
    for code, d in D.items():
        reguler = d.get("div_regular", {})
        for year in sorted(d["div"]):
            total = d["div"][year]
            if year in reguler:
                base = reguler[year]
                rows.append(dict(KODE=code, TAHUN=year, DPS=base, TIPE="REGULER"))
                extra = round(total - base, 2)
                if extra > 0.01:
                    rows.append(dict(KODE=code, TAHUN=year, DPS=extra, TIPE="SPESIAL"))
            else:
                rows.append(dict(KODE=code, TAHUN=year, DPS=total, TIPE="TOTAL"))
    rows.sort(key=lambda r: (r["KODE"], r["TAHUN"], r["TIPE"]))
    return add("DIVIDEN", "Riwayat dividen",
               "Dividen tunai per tahun (DPS) per emiten; emiten siklikal dipisah reguler/spesial.",
               fields, rows)


def build_histori():
    fields = [
        Field("KODE", "C", 4), Field("MINGGU", "N", 3, 0), Field("PERIODE", "C", 6),
        Field("HARGA", "N", 10, 2),
    ]
    rows = []
    for code, r in M.items():
        wk = list(r["wk"])
        while len(wk) < 10:
            wk.insert(0, wk[0])
        for i, price in enumerate(wk[-10:], start=1):
            rows.append(dict(KODE=code, MINGGU=i, PERIODE=f"W{i}", HARGA=price))
    return add("HISTORIK", "Harga mingguan",
               "Sepuluh penutupan mingguan terakhir per emiten (untuk grafik tren).",
               fields, rows)


def build_transaksi(preserve=True):
    fields = [
        Field("ID", "N", 5, 0), Field("TANGGAL", "D", 8), Field("KODE", "C", 4),
        Field("JENIS", "C", 5), Field("LOT", "N", 8, 0), Field("HARGA", "N", 12, 2),
        Field("FEE", "N", 12, 2), Field("CATATAN", "C", 60),
    ]
    sample = [
        dict(ID=1, TANGGAL="2026-07-14", KODE="TLKM", JENIS="BELI", LOT=40,
             HARGA=2250, FEE=13500, CATATAN="Contoh: cicilan bulanan"),
        dict(ID=2, TANGGAL="2026-08-05", KODE="BJBR", JENIS="BELI", LOT=120,
             HARGA=730, FEE=13140, CATATAN="Contoh: akumulasi dividen"),
        dict(ID=3, TANGGAL="2026-09-02", KODE="TUGU", JENIS="BELI", LOT=30,
             HARGA=1380, FEE=6210, CATATAN="Contoh: posisi inti"),
        dict(ID=4, TANGGAL="2026-09-18", KODE="IPCC", JENIS="BELI", LOT=25,
             HARGA=1010, FEE=3788, CATATAN="Contoh: posisi kecil"),
        dict(ID=5, TANGGAL="2026-10-06", KODE="TLKM", JENIS="JUAL", LOT=10,
             HARGA=2120, FEE=3180, CATATAN="Contoh: trimming"),
    ]

    rows = sample
    existing = os.path.join(DATA_DIR, "TRANSAKSI.DBF")
    if preserve and os.path.exists(existing):
        with open(existing, "rb") as fh:
            parsed = read_dbf(fh.read())
        rows = parsed["rows"]
        print(f"  TRANSAKSI: mempertahankan {len(rows)} baris dari berkas lama")

    return add("TRANSAKSI", "Transaksi portofolio",
               "Jurnal beli/jual (lot, harga, fee). Satu-satunya tabel yang Anda tulis dari UI.",
               fields, rows)


def build_param():
    fields = [Field("KUNCI", "C", 16), Field("NILAI", "C", 80)]
    rows = [
        dict(KUNCI="APLIKASI", NILAI="Bursa DBF"),
        dict(KUNCI="VERSI", NILAI="1.0.0"),
        dict(KUNCI="TANGGAL_DATA", NILAI=DATA_DATE),
        dict(KUNCI="HARGA_PER", NILAI=DATA_DATE),
        dict(KUNCI="HARGA_SUMBER", NILAI=f"Riset {DATA_DATE}"),
        dict(KUNCI="MATA_UANG", NILAI="IDR"),
        dict(KUNCI="FX_USD", NILAI="17997"),
        dict(KUNCI="COE", NILAI="0.135"),
        dict(KUNCI="SUMBER", NILAI="stockanalysis.com; riset berita Kontan, CNBC, Antara, IDX Channel"),
        dict(KUNCI="METODE", NILAI="DDM + PE/PB relatif; bobot per model bisnis"),
        dict(KUNCI="CATATAN", NILAI="Nilai wajar adalah estimasi model, bukan rekomendasi investasi."),
    ]
    return add("PARAM", "Parameter aplikasi",
               "Metadata: tanggal data, FX, cost of equity, dan catatan metode.",
               fields, rows)


def write_manifest():
    manifest = dict(
        app="Bursa DBF",
        version="1.0.0",
        generated=dt.datetime.now().replace(microsecond=0).isoformat(),
        dataDate=DATA_DATE,
        encoding="ascii / dBase III (cp1252 driver)",
        source=f"stockanalysis.com + riset berita (Kontan, CNBC, Antara, IDX Channel), {DATA_DATE}",
        fx=17997,
        coe=0.135,
        tables=TABLES,
    )
    path = os.path.join(DATA_DIR, "manifest.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print(f"  manifest.json  {len(TABLES)} tabel")


def main(reset_transaksi=False):
    os.makedirs(DATA_DIR, exist_ok=True)
    print(f"Bangun DBF untuk {len(M)} emiten -> {DATA_DIR}")
    build_saham()
    build_valuasi()
    build_teknika()
    build_skor()
    build_dividen()
    build_histori()
    build_transaksi(preserve=not reset_transaksi)
    build_param()
    write_manifest()
    total = sum(t["bytes"] for t in TABLES)
    print(f"Selesai: {len(TABLES)} tabel, {total} byte.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bangun ulang seluruh tabel DBF analisis")
    parser.add_argument(
        "--reset-transaksi",
        action="store_true",
        help="ganti TRANSAKSI.DBF dengan 5 contoh (default: pertahankan yang sudah ada)",
    )
    main(reset_transaksi=parser.parse_args().reset_transaksi)
