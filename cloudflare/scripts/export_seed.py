# -*- coding: utf-8 -*-
"""
Ekspor data/*.DBF menjadi seed.sql untuk Cloudflare D1.

Jalankan dari root repo:
    python cloudflare/scripts/export_seed.py
    python cloudflare/scripts/export_seed.py --out cloudflare/seed.sql
"""
from __future__ import annotations

import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(ROOT, "data")
DEFAULT_OUT = os.path.join(ROOT, "cloudflare", "seed.sql")
sys.path.insert(0, os.path.join(ROOT, "tools"))
from dbf_writer import read_dbf  # noqa: E402

TABLES = ["SAHAM", "VALUASI", "TEKNIKAL", "SKOR", "DIVIDEN", "HISTORIK", "PARAM", "TRANSAKSI"]
# PENGGUNA sengaja tidak diekspor: seed data tidak boleh menimpa akun/password D1.
# Akun admin dikelola lewat API /api/users atau SQL manual.


def sql_value(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int,)):
        return str(value)
    if isinstance(value, float):
        if value != value or value in (float("inf"), float("-inf")):
            return "NULL"
        return repr(value)
    text = str(value).replace("'", "''")
    return f"'{text}'"


def export_table(name: str) -> list[str]:
    path = os.path.join(DATA, f"{name}.DBF")
    if not os.path.exists(path):
        print(f"  lewati {name}: file tidak ada")
        return []
    parsed = read_dbf(open(path, "rb").read())
    columns = [f["name"] for f in parsed["fields"]]
    if name == "TRANSAKSI":
        columns = ["ID", "USER_ID"] + [c for c in columns if c != "ID"]
    lines = []
    for row in parsed["rows"]:
        if name == "TRANSAKSI":
            values = [row.get("ID"), 1] + [row.get(c) for c in columns[2:]]
        else:
            values = [row.get(c) for c in columns]
        lines.append(
            f"INSERT OR REPLACE INTO {name} ({', '.join(columns)}) VALUES ({', '.join(sql_value(v) for v in values)});"
        )
    print(f"  {name:<10} {len(parsed['rows']):>3} baris")
    return lines


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=DEFAULT_OUT)
    args = parser.parse_args()

    print(f"Ekspor DBF -> {args.out}")
    lines = [
        "-- Seed Cloudflare D1 dari data/*.DBF",
        "-- Dibuat oleh cloudflare/scripts/export_seed.py",
        "-- Password hash PBKDF2 di PENGGUNA dipertahankan.",
        "",
    ]
    for name in TABLES:
        for line in export_table(name):
            lines.append(line)
    with open(args.out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(lines) + "\n")
    print(f"Selesai: {args.out} ({len(lines)} baris)")


if __name__ == "__main__":
    main()
