# -*- coding: utf-8 -*-
"""
Ambil harga terakhir 9 emiten dari Yahoo Finance, lalu perbarui tabel DBF.

Sumber : https://query1.finance.yahoo.com/v8/finance/chart/<KODE>.JK
         (tanpa API key, data delayed, bukan API resmi Yahoo)

Yang diperbarui:
  SAHAM     : HARGA, MCAP_T, PE, PB, DY, MOS, UPDAT
  VALUASI   : MOS
  PARAM     : HARGA_PER, HARGA_SUMBER
  manifest  : ukuran + sha1 tabel yang berubah, priceUpdated, priceSource

Yang TIDAK diubah: nilai wajar, rating, skor, indikator teknikal, skenario.
Jalankan:
    python tools/update_harga_live.py --dry-run
    python tools/update_harga_live.py
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_DATA = os.path.join(ROOT, "data")

sys.path.insert(0, HERE)
from dbf_writer import Field, Table, read_dbf  # noqa: E402

JKT = dt.timezone(dt.timedelta(hours=7))
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}.JK?interval=1d&range=5d"


def http_json(url: str, timeout: int) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_yahoo(code: str, timeout: int, retries: int) -> dict:
    url = YAHOO_BASE.format(ticker=code)
    last_error = None
    for attempt in range(retries + 1):
        try:
            payload = http_json(url, timeout)
            if payload.get("chart", {}).get("error"):
                raise RuntimeError(payload["chart"]["error"].get("description") or "Yahoo error")
            result = payload["chart"]["result"][0]
            meta = result["meta"]
            price = meta.get("regularMarketPrice")
            if not price:
                closes = [c for c in result.get("indicators", {}).get("quote", [{}])[0].get("close", []) if c]
                price = closes[-1] if closes else None
            if not price or float(price) <= 0:
                raise RuntimeError("harga tidak tersedia")
            return {
                "price": float(price),
                "time": meta.get("regularMarketTime"),
                "previous": meta.get("chartPreviousClose") or meta.get("previousClose"),
                "currency": meta.get("currency"),
            }
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError, KeyError, RuntimeError) as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(0.8 * (attempt + 1))
    raise RuntimeError(f"{code}: {last_error}")


def read_table(path: str):
    with open(path, "rb") as fh:
        parsed = read_dbf(fh.read())
    fields = [Field(f["name"], f["type"], f["length"], f["dec"]) for f in parsed["fields"]]
    return fields, parsed["rows"]


def write_table(path: str, fields, rows, updated: dt.date) -> bytes:
    payload = Table(os.path.basename(path).replace(".DBF", ""), fields, rows, updated=updated).to_bytes()
    tmp = f"{path}.tmp"
    with open(tmp, "wb") as fh:
        fh.write(payload)
    os.replace(tmp, path)
    return payload


def set_param(rows, key: str, value: str) -> bool:
    for row in rows:
        if row["KUNCI"] == key:
            if row["NILAI"] == value:
                return False
            row["NILAI"] = value
            return True
    rows.append({"KUNCI": key, "NILAI": value})
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Perbarui harga saham dari Yahoo Finance")
    parser.add_argument("--data-dir", default=DEFAULT_DATA, help="folder berisi tabel .DBF")
    parser.add_argument("--dry-run", action="store_true", help="ambil harga tanpa menulis berkas")
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--min-success", type=int, default=5, help="batalkan jika kurang dari N ticker berhasil")
    parser.add_argument("--sleep", type=float, default=0.4, help="jeda antar ticker (detik)")
    args = parser.parse_args()

    data_dir = os.path.abspath(args.data_dir)
    saham_path = os.path.join(data_dir, "SAHAM.DBF")
    valuasi_path = os.path.join(data_dir, "VALUASI.DBF")
    param_path = os.path.join(data_dir, "PARAM.DBF")
    manifest_path = os.path.join(data_dir, "manifest.json")
    for path in (saham_path, valuasi_path, param_path, manifest_path):
        if not os.path.exists(path):
            print(f"Berkas tidak ditemukan: {path}", file=sys.stderr)
            return 2

    saham_fields, saham_rows = read_table(saham_path)
    val_fields, val_rows = read_table(valuasi_path)
    param_fields, param_rows = read_table(param_path)
    codes = [row["KODE"] for row in saham_rows]

    print(f"Mengambil harga {len(codes)} emiten dari Yahoo Finance…")
    quotes, errors = {}, []
    for i, code in enumerate(codes):
        try:
            quote = fetch_yahoo(code, args.timeout, args.retries)
            quotes[code] = quote
            try:
                prev = float(quote.get("previous") or 0) or None
            except (TypeError, ValueError):
                prev = None
            chg = (quote["price"] / prev - 1) if prev else None
            print(f"  {code:<5} {quote['price']:>9,.0f}" + (f"  ({chg:+.1%})" if chg is not None else ""))
        except Exception as exc:  # noqa: BLE001
            errors.append(str(exc))
            print(f"  {code:<5} GAGAL: {exc}")
        if args.sleep and i < len(codes) - 1:
            time.sleep(args.sleep)

    if len(quotes) < args.min_success:
        print(f"\nHanya {len(quotes)}/{len(codes)} berhasil (minimum {args.min_success}). Tidak ada yang ditulis.", file=sys.stderr)
        return 1

    stamps = [q["time"] for q in quotes.values() if q.get("time")]
    stamp = max(stamps) if stamps else time.time()
    price_date = dt.datetime.fromtimestamp(stamp, JKT).date()
    now = dt.datetime.now(JKT)

    changed = []
    for row in saham_rows:
        code = row["KODE"]
        quote = quotes.get(code)
        if not quote:
            continue
        new_price = quote["price"]
        old_price = row.get("HARGA")
        if old_price and abs(float(old_price) - new_price) < 0.005:
            continue

        if old_price and old_price > 0 and row.get("MCAP_T"):
            shares = float(row["MCAP_T"]) * 1e12 / float(old_price)
            row["MCAP_T"] = round(new_price * shares / 1e12, 2)
        row["HARGA"] = new_price
        row["PE"] = new_price / row["EPS"] if row.get("EPS") else None
        row["PB"] = new_price / row["BVPS"] if row.get("BVPS") else None
        row["DY"] = row["DPS"] / new_price if row.get("DPS") else None
        row["MOS"] = (row["FV"] - new_price) / row["FV"] if row.get("FV") else None
        row["UPDAT"] = price_date.isoformat()
        changed.append((code, old_price, new_price))

    if not changed:
        print("\nTidak ada perubahan harga. Berkas tidak ditulis.")
        return 0

    date_iso = price_date.isoformat()
    label = "Yahoo Finance (delayed)"
    param_changed = set_param(param_rows, "HARGA_PER", date_iso)
    param_changed |= set_param(param_rows, "HARGA_SUMBER", label)

    changed_codes = {c for c, _, _ in changed}
    for row in val_rows:
        if row["KODE"] not in changed_codes:
            continue
        src = next((r for r in saham_rows if r["KODE"] == row["KODE"]), None)
        if src and src.get("MOS") is not None:
            row["MOS"] = src["MOS"]

    print("\nPerubahan:")
    for code, old, new in changed:
        print(f"  {code:<5} {float(old or 0):>9,.0f} -> {new:>9,.0f}  ({(new / old - 1) if old else 0:+.1%})")
    print(f"  Tanggal harga: {date_iso} · {len(changed)}/{len(codes)} berubah")

    if args.dry_run:
        print("\n[dry-run] tidak ada berkas yang ditulis.")
        return 0

    written = {}
    written["SAHAM"] = write_table(saham_path, saham_fields, saham_rows, price_date)
    written["VALUASI"] = write_table(valuasi_path, val_fields, val_rows, price_date)
    written["PARAM"] = write_table(param_path, param_fields, param_rows, price_date)

    with open(manifest_path, encoding="utf-8") as fh:
        manifest = json.load(fh)
    for meta in manifest.get("tables", []):
        if meta["name"] in written:
            payload = written[meta["name"]]
            meta["records"] = len(saham_rows if meta["name"] == "SAHAM" else val_rows if meta["name"] == "VALUASI" else param_rows)
            meta["bytes"] = len(payload)
            meta["sha1"] = hashlib.sha1(payload).hexdigest()[:12]
    manifest["priceUpdated"] = now.isoformat(timespec="seconds")
    manifest["priceSource"] = label
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=1, ensure_ascii=False)
        fh.write("\n")

    if errors:
        print(f"\nPeringatan: {len(errors)} ticker gagal, data lama dipertahankan.")
    print(f"Selesai: {date_iso}, {len(changed)} harga diperbarui.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
