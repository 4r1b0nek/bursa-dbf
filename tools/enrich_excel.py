# -*- coding: utf-8 -*-
"""
Tambahkan kolom/sheet yang dibutuhkan aplikasi ke Dashboard_Simulator_14_Saham.xlsx.
Output: Dashboard_Simulator_14_Saham_Updated.xlsx
"""
from __future__ import annotations

import os
import sys
from copy import copy
from datetime import date

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


def read_map(name):
    path = os.path.join(ROOT, "data", f"{name}.DBF")
    if not os.path.exists(path):
        return {}
    return {row["KODE"]: row for row in read_dbf(open(path, "rb").read())["rows"]}


def tick(price: float) -> float:
    if price >= 2000:
        step = 25
    elif price >= 500:
        step = 5
    elif price >= 200:
        step = 2
    else:
        step = 1
    return max(step, round(price / step) * step)


def fmt_level(low, high):
    if low is None or high is None:
        return None
    return f"{tick(low):,.0f} - {tick(high):,.0f}".replace(",", ".")


def append_headers(ws, headers, row=5):
    start = ws.max_column + 1
    style = ws.cell(row=row, column=start - 1)._style
    for i, header in enumerate(headers):
        cell = ws.cell(row=row, column=start + i, value=header)
        cell._style = copy(style)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.font = Font(bold=True, color="0B3B37")
        cell.fill = PatternFill("solid", fgColor="FDE68A")
        ws.column_dimensions[get_column_letter(start + i)].width = 18
    return start


def main():
    wb = openpyxl.load_workbook(SRC)
    ws = wb["Dashboard"]
    val = wb["Valuasi & Skenario"]
    tech = wb["Teknikal"]

    saham = read_map("SAHAM")
    valuasi = read_map("VALUASI")
    teknikal = read_map("TEKNIKAL")
    skor = read_map("SKOR")

    headers = [
        "ROA (%)", "DER (x)", "EV/EBITDA (x)", "Level Akumulasi", "Level Beli",
        "Target", "Cut Loss", "Ringkasan", "Market Cap (Rp T)", "PM (%)", "OM (%)",
        "CR (x)", "ICR (x)", "FCF", "Debt", "Equity", "Cash",
    ]
    start = append_headers(ws, headers)

    # Peta baris Dashboard
    rows = {}
    for r in range(6, ws.max_row + 1):
        code = ws.cell(row=r, column=1).value
        if isinstance(code, str) and len(code.strip()) == 4:
            rows[code.strip().upper()] = r

    # Peta Teknikal
    trows = {}
    for r in range(5, tech.max_row + 1):
        code = tech.cell(row=r, column=1).value
        if isinstance(code, str) and len(code.strip()) == 4:
            trows[code.strip().upper()] = r

    for code, r in rows.items():
        price = ws.cell(row=r, column=4).value
        fv = ws.cell(row=r, column=15).value
        roe = ws.cell(row=r, column=12).value
        sector = ws.cell(row=r, column=3).value or ""
        rating = ws.cell(row=r, column=18).value or ""
        decision = ws.cell(row=r, column=19).value or ""
        score = ws.cell(row=r, column=17).value

        old = saham.get(code)
        if old:
            ws.cell(row=r, column=start + 0, value=old.get("ROA"))
            ws.cell(row=r, column=start + 1, value=old.get("DER"))
            ws.cell(row=r, column=start + 2, value=old.get("EVEBITDA"))
            ws.cell(row=r, column=start + 3, value=old.get("LEVEL_AKUM"))
            ws.cell(row=r, column=start + 4, value=old.get("LEVEL_BUY"))
            ws.cell(row=r, column=start + 5, value=old.get("TARGET"))
            ws.cell(row=r, column=start + 6, value=old.get("CUTLOSS"))
            ws.cell(row=r, column=start + 7, value=old.get("RINGKASAN"))
            ws.cell(row=r, column=start + 8, value=old.get("MCAP_T"))
            ws.cell(row=r, column=start + 9, value=old.get("PM"))
            ws.cell(row=r, column=start + 10, value=old.get("OM"))
            ws.cell(row=r, column=start + 11, value=old.get("CR"))
            ws.cell(row=r, column=start + 12, value=old.get("ICR"))
            ws.cell(row=r, column=start + 13, value=old.get("FCF"))
            ws.cell(row=r, column=start + 14, value=old.get("DEBT"))
            ws.cell(row=r, column=start + 15, value=old.get("EQUITY"))
            ws.cell(row=r, column=start + 16, value=old.get("CASH"))
        else:
            # Emiten baru: level dihitung dari ATR, diberi catatan.
            tr = trows.get(code)
            atr = tech.cell(row=tr, column=13).value if tr else None
            if price and atr:
                akum_lo, akum_hi = price - 1.5 * atr, price - 0.5 * atr
                buy_lo, buy_hi = price - 0.5 * atr, price + 0.5 * atr
                cut = price - 2 * atr
                ws.cell(row=r, column=start + 3, value=fmt_level(akum_lo, akum_hi))
                ws.cell(row=r, column=start + 4, value=fmt_level(buy_lo, buy_hi))
                ws.cell(row=r, column=start + 6, value=tick(cut))
            ws.cell(row=r, column=start + 5, value=fv)
            ws.cell(row=r, column=start + 7, value=f"{sector} · skor {score} · {rating} · {decision}")

    # Valuasi: kolom tambahan
    vheaders = ["DDM", "PB Wajar", "FV Low", "FV High", "DDM Low", "DDM High"]
    vstart = append_headers(val, vheaders, row=4)
    vrows = {}
    for r in range(5, val.max_row + 1):
        code = val.cell(row=r, column=1).value
        if isinstance(code, str) and len(code.strip()) == 4:
            vrows[code.strip().upper()] = r

    for code, r in vrows.items():
        old = valuasi.get(code)
        d = rows.get(code)
        dps = ws.cell(row=d, column=7).value if d else None
        roe = ws.cell(row=d, column=12).value if d else None
        fv = ws.cell(row=r, column=5).value
        bull = [val.cell(row=r, column=c).value for c in (8, 9, 10)]
        bear = [val.cell(row=r, column=c).value for c in (14, 15, 16)]
        if old:
            ddm, pbf, flo, fhi = old.get("DDM"), old.get("PBF"), old.get("FV_LO"), old.get("FV_HI")
            dlo, dhi = old.get("DDM_LO"), old.get("DDM_HI")
        else:
            ddm = dps * (1 + DIV_GROWTH) / (COE - DIV_GROWTH) if dps else None
            pbf = roe / COE if roe else None
            flo, fhi = min([x for x in bear if x is not None], default=None), max([x for x in bull if x is not None], default=None)
            dlo, dhi = (ddm * 0.85, ddm * 1.15) if ddm else (None, None)
        for i, value in enumerate((ddm, pbf, flo, fhi, dlo, dhi)):
            val.cell(row=r, column=vstart + i, value=value)

    # Sheet Skor
    if "Skor" in wb.sheetnames:
        del wb["Skor"]
    sk = wb.create_sheet("Skor")
    sk.append(["KODE", "FUND", "VAL", "DIV", "TECH", "RISK", "PROS", "TOTAL", "CATATAN"])
    for c in range(1, 10):
        sk.cell(row=1, column=c).font = Font(bold=True, color="FFFFFF")
        sk.cell(row=1, column=c).fill = PatternFill("solid", fgColor="0F766E")
    for code, r in rows.items():
        old = skor.get(code)
        sk.append([
            code,
            old.get("FUND") if old else None,
            old.get("VAL") if old else None,
            old.get("DIV") if old else None,
            old.get("TECH") if old else None,
            old.get("RISK") if old else None,
            old.get("PROS") if old else None,
            ws.cell(row=r, column=17).value,
            "Isi 0–10; untuk emiten baru belum tersedia." if not old else "",
        ])
    for col, width in {"A": 8, "B": 7, "C": 7, "D": 7, "E": 7, "F": 7, "G": 7, "H": 8, "I": 42}.items():
        sk.column_dimensions[col].width = width

    # Sheet Dividen dari Data Keuangan
    if "Dividen" in wb.sheetnames:
        del wb["Dividen"]
    dv = wb.create_sheet("Dividen")
    dv.append(["KODE", "TAHUN", "DPS", "TIPE"])
    for c in range(1, 5):
        dv.cell(row=1, column=c).font = Font(bold=True, color="FFFFFF")
        dv.cell(row=1, column=c).fill = PatternFill("solid", fgColor="0F766E")
    dk = wb["Data Keuangan"]
    current = None
    years = None
    for r in range(1, dk.max_row + 1):
        a = dk.cell(row=r, column=1).value
        if isinstance(a, str) and " — " in a and len(a.split(" — ")[0].strip()) == 4:
            current = a.split(" — ")[0].strip().upper()
        if isinstance(a, str) and a.strip() == "Indikator":
            years = [dk.cell(row=r, column=c).value for c in range(2, 8)]
        if current and isinstance(a, str) and a.strip().startswith("DPS"):
            for i, year in enumerate(years or []):
                value = dk.cell(row=r, column=2 + i).value
                if isinstance(value, (int, float)) and year:
                    label = "TTM" if str(year).upper() == "TTM" else "FINAL"
                    real_year = 2026 if label == "TTM" else int(float(year))
                    dv.append([current, real_year, float(value), label])
    for col, width in {"A": 8, "B": 8, "C": 12, "D": 10}.items():
        dv.column_dimensions[col].width = width

    # Sheet Historik (placeholder)
    if "Historik" in wb.sheetnames:
        del wb["Historik"]
    hs = wb.create_sheet("Historik")
    hs.append(["KODE", "MINGGU", "PERIODE", "HARGA"])
    hs.append([None, None, None, "Isi minimal 10 minggu per saham untuk grafik tren harga."])
    for c in range(1, 5):
        hs.cell(row=1, column=c).font = Font(bold=True, color="FFFFFF")
        hs.cell(row=1, column=c).fill = PatternFill("solid", fgColor="0F766E")
    for col, width in {"A": 8, "B": 8, "C": 12, "D": 52}.items():
        hs.column_dimensions[col].width = width

    # Catatan asumsi
    cu = wb["Cara Update"]
    notes = [
        ("ROA / DER / EV/EBITDA", "Manual", "Kolom baru; isi dari laporan keuangan. Jika kosong, aplikasi menampilkan —."),
        ("Level harga", "Manual/otomatis", "Emiten lama memakai level lama; emiten baru dihitung dari ATR. Periksa kembali sebelum dipakai."),
        ("DDM / PB Wajar / FV Low-High", "Formula", "DDM: DPS×(1+3%)/(13,5%−3%). PB wajar: ROE/13,5%. FV Low/High: skenario Bear/Bull."),
        ("Skor faktor", "Manual", "Sheet Skor; 0–10 per faktor. Total 0–100 dari Dashboard."),
        ("Riwayat dividen", "Manual", "Sheet Dividen; diisi dari Data Keuangan 2022–2026."),
        ("Historik harga", "Manual", "Sheet Historik; minimal 10 minggu per saham."),
    ]
    start_row = cu.max_row + 2
    for i, (a, b, c) in enumerate(notes):
        cu.cell(row=start_row + i, column=1, value=a)
        cu.cell(row=start_row + i, column=2, value=b)
        cu.cell(row=start_row + i, column=3, value=c)

    wb.save(OUT)
    print("saved", OUT)
    print("stocks", len(rows), "dividends", dv.max_row - 1)


if __name__ == "__main__":
    main()
