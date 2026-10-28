# -*- coding: utf-8 -*-
"""
Lengkapi Dashboard_Simulator_14_Saham.xlsx dengan kolom/sheet yang dipakai aplikasi.

Output: Dashboard_Simulator_14_Saham_Updated.xlsx
"""
from __future__ import annotations

import os
import sys
from copy import copy

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WORKSPACE = os.path.dirname(ROOT)
SRC = os.path.join(WORKSPACE, "Dashboard_Simulator_14_Saham.xlsx")
OUT = os.path.join(WORKSPACE, "Dashboard_Simulator_14_Saham_Updated.xlsx")
sys.path.insert(0, HERE)
from dbf_writer import read_dbf  # noqa: E402

COE = 0.135
DIV_GROWTH = 0.03
USD_CODES = {"ADRO", "PGEO", "POWR"}
TEAL = "0F766E"
INPUT_FILL = "FDE68A"


def read_map(name):
    path = os.path.join(ROOT, "data", f"{name}.DBF")
    if not os.path.exists(path):
        return {}
    return {row["KODE"]: row for row in read_dbf(open(path, "rb").read())["rows"]}


def tick(price: float) -> float:
    step = 25 if price >= 2000 else 5 if price >= 500 else 2 if price >= 200 else 1
    return max(step, round(price / step) * step)


def fmt_level(low, high):
    if low is None or high is None:
        return None
    return f"{tick(low):,.0f} - {tick(high):,.0f}".replace(",", ".")


def add_headers(ws, headers, row):
    start = ws.max_column + 1
    previous = ws.cell(row=row, column=start - 1)
    for i, header in enumerate(headers):
        cell = ws.cell(row=row, column=start + i, value=header)
        cell._style = copy(previous._style)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.font = Font(bold=True, color="0B3B37")
        cell.fill = PatternFill("solid", fgColor=INPUT_FILL)
        ws.column_dimensions[get_column_letter(start + i)].width = 18
    return start


def header_style(sheet, count):
    for c in range(1, count + 1):
        cell = sheet.cell(row=1, column=c)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=TEAL)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def read_old_financials(sheet):
    """Baca blok Data Keuangan lama menjadi list per emiten/tahun."""
    out = []
    current = None
    years = None
    for r in range(1, sheet.max_row + 1):
        a = sheet.cell(row=r, column=1).value
        if isinstance(a, str) and " — " in a and len(a.split(" — ")[0].strip()) == 4:
            current = a.split(" — ")[0].strip().upper()
        if isinstance(a, str) and a.strip() == "Indikator":
            years = [sheet.cell(row=r, column=c).value for c in range(2, 8)]
        if not current or not isinstance(a, str) or not a.strip().startswith("DPS"):
            continue
        # Data DPS ada di baris ini; ambil juga baris pendapatan/laba/EPS di atasnya.
        pass
    # Baca ulang per blok agar lebih jelas.
    block = None
    years = None
    for r in range(1, sheet.max_row + 1):
        a = sheet.cell(row=r, column=1).value
        if isinstance(a, str) and " — " in a and len(a.split(" — ")[0].strip()) == 4:
            block = a.split(" — ")[0].strip().upper()
            years = None
            continue
        if not block:
            continue
        if isinstance(a, str) and a.strip() == "Indikator":
            years = [sheet.cell(row=r, column=c).value for c in range(2, 8)]
            continue
        if not years or not isinstance(a, str):
            continue
        key = a.strip().lower()
        for i, year in enumerate(years):
            value = sheet.cell(row=r, column=2 + i).value
            if not isinstance(value, (int, float)):
                continue
            label = str(year).upper()
            tahun = 2026 if label == "TTM" else int(float(year))
            existing = next((x for x in out if x["KODE"] == block and x["TAHUN"] == tahun), None)
            if not existing:
                existing = {"KODE": block, "TAHUN": tahun, "PERIODE": "TTM" if label == "TTM" else "FY"}
                out.append(existing)
            if key.startswith("pendapatan"):
                existing["PENDAPATAN"] = float(value)
            elif key.startswith("laba bersih"):
                existing["LABA_BERSIH"] = float(value)
            elif key.startswith("eps"):
                existing["EPS"] = float(value)
            elif key.startswith("dps"):
                existing["DPS"] = float(value)
    return out


def main():
    wb = openpyxl.load_workbook(SRC)
    ws = wb["Dashboard"]
    val = wb["Valuasi & Skenario"]
    tech = wb["Teknikal"]
    saham = read_map("SAHAM")
    valuasi = read_map("VALUASI")
    skor = read_map("SKOR")

    # ---------------------------------------------------------- Dashboard
    dash_headers = [
        "ROA (%)", "DER (x)", "EV/EBITDA (x)", "Level Akumulasi", "Level Beli",
        "Target", "Cut Loss", "Ringkasan", "Market Cap (Rp T)", "PM (%)", "OM (%)",
        "CR (x)", "ICR (x)", "FCF", "Debt", "Equity", "Cash",
    ]
    dstart = add_headers(ws, dash_headers, 5)
    drows = {}
    for r in range(6, ws.max_row + 1):
        code = ws.cell(row=r, column=1).value
        if isinstance(code, str) and len(code.strip()) == 4:
            drows[code.strip().upper()] = r

    trows = {}
    for r in range(5, tech.max_row + 1):
        code = tech.cell(row=r, column=1).value
        if isinstance(code, str) and len(code.strip()) == 4:
            trows[code.strip().upper()] = r

    for code, r in drows.items():
        old = saham.get(code)
        price = ws.cell(row=r, column=4).value
        fv = ws.cell(row=r, column=15).value
        sector = ws.cell(row=r, column=3).value or ""
        rating = ws.cell(row=r, column=18).value or ""
        decision = ws.cell(row=r, column=19).value or ""
        score = ws.cell(row=r, column=17).value
        values = [None] * len(dash_headers)
        if old:
            values = [
                old.get("ROA"), old.get("DER"), old.get("EVEBITDA"),
                old.get("LEVEL_AKUM"), old.get("LEVEL_BUY"), old.get("TARGET"),
                old.get("CUTLOSS"), old.get("RINGKASAN"), old.get("MCAP_T"),
                old.get("PM"), old.get("OM"), old.get("CR"), old.get("ICR"),
                old.get("FCF"), old.get("DEBT"), old.get("EQUITY"), old.get("CASH"),
            ]
        else:
            tr = trows.get(code)
            atr = tech.cell(row=tr, column=13).value if tr else None
            if price and atr:
                values[3] = fmt_level(price - 1.5 * atr, price - 0.5 * atr)
                values[4] = fmt_level(price - 0.5 * atr, price + 0.5 * atr)
                values[6] = tick(price - 2 * atr)
            values[5] = fv
            values[7] = f"{sector} · skor {score} · {rating} · {decision}"
        for i, value in enumerate(values):
            ws.cell(row=r, column=dstart + i, value=value)

    # ---------------------------------------------------------- Valuasi
    vheaders = ["DDM", "PB Wajar", "FV Low", "FV High", "DDM Low", "DDM High"]
    vstart = add_headers(val, vheaders, 4)
    vrows = {}
    for r in range(5, val.max_row + 1):
        code = val.cell(row=r, column=1).value
        if isinstance(code, str) and len(code.strip()) == 4:
            vrows[code.strip().upper()] = r

    for code, r in vrows.items():
        old = valuasi.get(code)
        d = drows.get(code)
        dps = ws.cell(row=d, column=7).value if d else None
        roe = ws.cell(row=d, column=12).value if d else None
        bull = [val.cell(row=r, column=c).value for c in (8, 9, 10)]
        bear = [val.cell(row=r, column=c).value for c in (14, 15, 16)]
        if old:
            values = [old.get("DDM"), old.get("PBF"), old.get("FV_LO"), old.get("FV_HI"), old.get("DDM_LO"), old.get("DDM_HI")]
        else:
            ddm = dps * (1 + DIV_GROWTH) / (COE - DIV_GROWTH) if dps else None
            pbf = roe / COE if roe else None
            flo = min([x for x in bear if x is not None], default=None)
            fhi = max([x for x in bull if x is not None], default=None)
            values = [ddm, pbf, flo, fhi, ddm * 0.85 if ddm else None, ddm * 1.15 if ddm else None]
        for i, value in enumerate(values):
            val.cell(row=r, column=vstart + i, value=value)

    # ---------------------------------------------------------- Skor
    if "Skor" in wb.sheetnames:
        del wb["Skor"]
    sk = wb.create_sheet("Skor")
    sk.append(["KODE", "FUND", "VAL", "DIV", "TECH", "RISK", "PROS", "TOTAL", "CATATAN"])
    for code, r in drows.items():
        old = skor.get(code)
        sk.append([
            code,
            old.get("FUND") if old else None, old.get("VAL") if old else None,
            old.get("DIV") if old else None, old.get("TECH") if old else None,
            old.get("RISK") if old else None, old.get("PROS") if old else None,
            ws.cell(row=r, column=17).value,
            "Isi 0–10; untuk emiten baru belum tersedia." if not old else "",
        ])
    header_style(sk, 9)
    for col, width in {"A": 8, "B": 7, "C": 7, "D": 7, "E": 7, "F": 7, "G": 7, "H": 8, "I": 42}.items():
        sk.column_dimensions[col].width = width

    # ---------------------------------------------------------- Data Keuangan
    old_dk = wb["Data Keuangan"]
    old_rows = read_old_financials(old_dk)
    old_dk.title = "Data Keuangan (lama)"
    if "Data Keuangan" in wb.sheetnames:
        del wb["Data Keuangan"]
    dk = wb.create_sheet("Data Keuangan")
    dk_headers = [
        "KODE", "NAMA", "TAHUN", "PERIODE", "MATA_UANG", "SATUAN",
        "PENDAPATAN", "LABA_OPERASI", "LABA_BERSIH", "EPS", "DPS",
        "TOTAL_ASET", "TOTAL_EKUITAS", "TOTAL_UTANG", "KAS", "EBITDA", "FCF",
        "SHARES", "SUMBER", "CATATAN",
    ]
    dk.append(dk_headers)
    name_by_code = {code: ws.cell(row=r, column=2).value for code, r in drows.items()}
    for row in old_rows:
        code = row["KODE"]
        old = saham.get(code)
        if code in USD_CODES:
            currency, unit = "USD", "Juta"
        else:
            currency, unit = "IDR", "Triliun"
        total_aset = total_ekuitas = total_utang = kas = None
        if row["PERIODE"] == "TTM" and old and currency == "IDR":
            net = row.get("LABA_BERSIH")
            roa = old.get("ROA")
            if net and roa:
                total_aset = net / (roa / 100)
            if old.get("EQUITY"):
                total_ekuitas = old["EQUITY"] / 1e6
            if old.get("DEBT"):
                total_utang = old["DEBT"] / 1e6
            if old.get("CASH"):
                kas = old["CASH"] / 1e6
        dk.append([
            code, name_by_code.get(code), row["TAHUN"], row["PERIODE"], currency, unit,
            row.get("PENDAPATAN"), None, row.get("LABA_BERSIH"), row.get("EPS"), row.get("DPS"),
            total_aset, total_ekuitas, total_utang, kas, None, None, None,
            "Data Keuangan 2021-2025", "ADRO/PGEO/POWR dalam USD juta" if code in USD_CODES else "",
        ])
    header_style(dk, len(dk_headers))
    dk.freeze_panes = "A2"
    for i, width in enumerate([8, 28, 8, 9, 11, 10, 13, 13, 13, 9, 9, 13, 14, 13, 11, 11, 12, 12, 22, 30], 1):
        dk.column_dimensions[get_column_letter(i)].width = width

    # ---------------------------------------------------------- Dividen
    if "Dividen" in wb.sheetnames:
        del wb["Dividen"]
    dv = wb.create_sheet("Dividen")
    dv.append(["KODE", "TAHUN", "DPS", "TIPE"])
    for row in old_rows:
        if row.get("DPS"):
            dv.append([row["KODE"], row["TAHUN"], row["DPS"], "TTM" if row["PERIODE"] == "TTM" else "FINAL"])
    header_style(dv, 4)
    for col, width in {"A": 8, "B": 8, "C": 12, "D": 10}.items():
        dv.column_dimensions[col].width = width

    # ---------------------------------------------------------- Ringkasan 5 Tahun
    if "Ringkasan 5 Tahun" in wb.sheetnames:
        del wb["Ringkasan 5 Tahun"]
    rs = wb.create_sheet("Ringkasan 5 Tahun")
    rs.append([
        "KODE", "NAMA", "PENDAPATAN TTM", "LABA BERSIH TTM", "EPS TTM", "DPS TTM",
        "CAGR PENDAPATAN", "CAGR LABA", "ROE", "DER", "PM", "OM",
    ])
    by_code = {}
    for row in old_rows:
        by_code.setdefault(row["KODE"], []).append(row)
    for code in drows:
        rows = sorted(by_code.get(code, []), key=lambda x: x["TAHUN"])
        latest = next((x for x in rows if x["PERIODE"] == "TTM"), rows[-1] if rows else {})
        first = next((x for x in rows if x["TAHUN"] == 2021), None)
        def cagr(now, then):
            if not now or not then or then <= 0:
                return None
            return (now / then) ** (1 / 5) - 1
        eq = latest.get("TOTAL_EKUITAS") if latest else None
        utang = latest.get("TOTAL_UTANG") if latest else None
        aset = latest.get("TOTAL_ASET") if latest else None
        laba = latest.get("LABA_BERSIH") if latest else None
        rev = latest.get("PENDAPATAN") if latest else None
        rs.append([
            code, name_by_code.get(code),
            rev, laba, latest.get("EPS"), latest.get("DPS"),
            cagr(rev, first.get("PENDAPATAN") if first else None),
            cagr(laba, first.get("LABA_BERSIH") if first else None),
            laba / eq if laba and eq else None,
            utang / eq if utang and eq else None,
            laba / rev if laba and rev else None,
            None,
        ])
    header_style(rs, 12)
    rs.freeze_panes = "A2"
    for i in range(1, 13):
        rs.column_dimensions[get_column_letter(i)].width = 16
    for r in range(2, rs.max_row + 1):
        for c in (7, 8, 9, 10, 11):
            rs.cell(row=r, column=c).number_format = "0.0%"
        rs.cell(row=r, column=10).number_format = '0.00"x"'

    # ---------------------------------------------------------- Historik
    if "Historik" in wb.sheetnames:
        del wb["Historik"]
    hs = wb.create_sheet("Historik")
    hs.append(["KODE", "MINGGU", "PERIODE", "HARGA"])
    hs.append([None, None, None, "Isi minimal 10 minggu per saham untuk grafik tren harga."])
    header_style(hs, 4)
    for col, width in {"A": 8, "B": 8, "C": 12, "D": 55}.items():
        hs.column_dimensions[col].width = width

    # ---------------------------------------------------------- Catatan
    cu = wb["Cara Update"]
    notes = [
        ("VERSI_TEMPLATE", "2.0", "Template dengan Data Keuangan tidy + Ringkasan 5 Tahun."),
        ("Data Keuangan", "Tabel tidy", "Satu baris per emiten-tahun; lihat sheet Data Keuangan."),
        ("ROA / DER / EV", "Otomatis", "Dihitung dari total aset/ekuitas/utang/EBITDA jika tersedia."),
        ("Skor faktor", "Manual", "Sheet Skor; 0–10 per faktor. Total 0–100 dari Dashboard."),
        ("Historik harga", "Manual", "Sheet Historik; minimal 10 minggu per saham."),
    ]
    start_row = cu.max_row + 2
    for i, (a, b, c) in enumerate(notes):
        cu.cell(row=start_row + i, column=1, value=a)
        cu.cell(row=start_row + i, column=2, value=b)
        cu.cell(row=start_row + i, column=3, value=c)

    wb.save(OUT)
    print("saved", OUT)
    print("stocks", len(drows), "financial rows", len(old_rows))


if __name__ == "__main__":
    main()
