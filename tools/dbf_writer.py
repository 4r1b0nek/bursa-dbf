# -*- coding: utf-8 -*-
"""Penulis & pembaca DBF (dBase III) minimal, tanpa dependensi.

Dipakai oleh build_dbf.py untuk menghasilkan tabel .DBF yang dibaca
langsung oleh aplikasi web (assets/js/dbf.js) tanpa server.
"""
from __future__ import annotations

import datetime as _dt
import struct
from dataclasses import dataclass
from typing import Any, Iterable, Sequence

ENCODING = "ascii"  # dBase III + ASCII = paling portabel (Excel, LibreOffice, Python)

_TRANSLIT = {
    "\u2013": "-", "\u2014": "-", "\u2018": "'", "\u2019": "'",
    "\u201c": '"', "\u201d": '"', "\u2026": "...", "\u00d7": "x",
    "\u2265": ">=", "\u2264": "<=", "\u00a0": " ", "\u00b7": ".",
}


def sanitize(text: Any) -> str:
    """Ubah teks menjadi ASCII aman untuk DBF."""
    s = "" if text is None else str(text)
    for bad, good in _TRANSLIT.items():
        s = s.replace(bad, good)
    return s.encode(ENCODING, "replace").decode(ENCODING)


def format_number(value: Any, length: int, dec: int) -> str:
    if value is None or value == "":
        return " " * length
    try:
        num = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"nilai numerik tidak valid: {value!r}")
    txt = f"{num:.{dec}f}" if dec else f"{num:.0f}"
    if len(txt) > length:
        # konvensi DBF: nilai yang tidak muat ditandai bintang
        return "*" * length
    return txt.rjust(length)


def format_date(value: Any) -> str:
    if value in (None, ""):
        return " " * 8
    if isinstance(value, _dt.date):
        return value.strftime("%Y%m%d")
    s = str(value).replace("-", "").strip()
    if len(s) != 8 or not s.isdigit():
        raise ValueError(f"tanggal tidak valid: {value!r} (pakai YYYY-MM-DD)")
    return s


@dataclass(frozen=True)
class Field:
    name: str
    type: str          # C, N, D, L, F
    length: int
    dec: int = 0

    def __post_init__(self):
        if len(self.name) > 10:
            raise ValueError(f"nama field > 10 karakter: {self.name}")
        if self.type not in ("C", "N", "D", "L", "F"):
            raise ValueError(f"tipe field tidak didukung: {self.type}")
        if not 1 <= self.length <= 254:
            raise ValueError(f"panjang field {self.name} harus 1..254")
        if self.type not in ("N", "F") and self.dec:
            raise ValueError(f"field {self.name} bertipe {self.type} tidak boleh punya desimal")


@dataclass
class Table:
    name: str
    fields: Sequence[Field]
    rows: Iterable[dict]
    updated: _dt.date = _dt.date.today()

    @property
    def header_length(self) -> int:
        return 32 + 32 * len(self.fields) + 1

    @property
    def record_length(self) -> int:
        return 1 + sum(f.length for f in self.fields)

    def encode_value(self, field: Field, value: Any) -> bytes:
        if field.type == "C":
            txt = sanitize(value)
            if len(txt) > field.length:
                raise ValueError(
                    f"{self.name}.{field.name}: teks {len(txt)} char > {field.length} char: {txt!r}"
                )
            return txt.ljust(field.length).encode(ENCODING)
        if field.type in ("N", "F"):
            return format_number(value, field.length, field.dec).encode(ENCODING)
        if field.type == "D":
            return format_date(value).encode(ENCODING)
        if field.type == "L":
            if value is None:
                return b"?"
            return b"T" if bool(value) else b"F"
        raise AssertionError(field.type)

    def to_bytes(self) -> bytes:
        rows = list(self.rows)
        version = 0x03  # dBase III tanpa memo
        y, m, d = self.updated.year - 1900, self.updated.month, self.updated.day
        header = struct.pack(
            "<BBBBIHH", version, y, m, d, len(rows), self.header_length, self.record_length
        )
        header += b"\x00" * 16          # reserved
        header += b"\x00"               # MDX flag
        header += b"\x03"               # language driver: cp1252
        header += b"\x00\x00"           # reserved
        assert len(header) == 32

        descriptors = b""
        for f in self.fields:
            descriptors += f.name.encode(ENCODING).ljust(11, b"\x00")
            descriptors += f.type.encode(ENCODING)
            descriptors += b"\x00" * 4  # field data address
            descriptors += bytes([f.length, f.dec])
            descriptors += b"\x00" * 14
        assert len(descriptors) == 32 * len(self.fields)

        body = bytearray()
        for row in rows:
            body += b" "  # flag rekaman aktif
            for f in self.fields:
                body += self.encode_value(f, row.get(f.name))
            if len(body) % self.record_length:
                raise AssertionError("panjang rekaman tidak konsisten")
        return header + descriptors + b"\r" + bytes(body) + b"\x1a"


def read_dbf(data: bytes) -> dict:
    """Pembaca independen untuk verifikasi hasil tulis."""
    version = data[0]
    nrec, hlen, rlen = struct.unpack("<IHH", data[4:12])
    fields = []
    pos = 32
    while data[pos] != 0x0D:
        raw = data[pos:pos + 32]
        name = raw[:11].rstrip(b"\x00").decode(ENCODING)
        ftype = chr(raw[11])
        length, dec = raw[16], raw[17]
        fields.append(Field(name, ftype, length, dec))
        pos += 32
    assert pos + 1 == hlen, (pos + 1, hlen)
    expected = 1 + sum(f.length for f in fields)
    assert expected == rlen, (expected, rlen)
    assert data[hlen + nrec * rlen] == 0x1A, "byte EOF tidak ditemukan"

    rows = []
    for i in range(nrec):
        base = hlen + i * rlen
        flag = data[base:base + 1]
        if flag == b"*":
            continue
        cur = base + 1
        row = {}
        for f in fields:
            chunk = data[cur:cur + f.length]
            cur += f.length
            if f.type == "C":
                row[f.name] = chunk.decode(ENCODING, "replace").rstrip()
            elif f.type in ("N", "F"):
                txt = chunk.decode(ENCODING).strip()
                if txt in ("", "*" * len(txt)):
                    row[f.name] = None
                else:
                    row[f.name] = float(txt) if f.dec else int(txt)
            elif f.type == "D":
                txt = chunk.decode(ENCODING).strip()
                row[f.name] = (
                    f"{txt[0:4]}-{txt[4:6]}-{txt[6:8]}" if len(txt) == 8 and txt.isdigit() else None
                )
            elif f.type == "L":
                row[f.name] = {"T": True, "F": False}.get(chr(chunk[0]), None)
            else:
                raise ValueError(f"tipe {f.type} tidak didukung pembaca")
        rows.append(row)
    return {
        "version": version,
        "records": nrec,
        "headerLength": hlen,
        "recordLength": rlen,
        "fields": [f.__dict__ for f in fields],
        "rows": rows,
    }
