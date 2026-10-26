# -*- coding: utf-8 -*-
"""Validasi arsip ZIP hasil tools/test_zip.mjs memakai zipfile standar Python."""
import struct
import sys
import zipfile

path = sys.argv[1]
with zipfile.ZipFile(path) as z:
    bad = z.testzip()
    assert bad is None, f"CRC gagal: {bad}"
    names = z.namelist()
    print("Berkas:", ", ".join(names))
    dbf = [n for n in names if n.upper().endswith(".DBF")]
    assert dbf, "tidak ada .DBF di dalam arsip"
    for name in dbf:
        data = z.read(name)
        version = data[0]
        nrec, hlen, rlen = struct.unpack("<IHH", data[4:12])
        assert version == 3, f"{name}: versi {version}"
        assert data[hlen + nrec * rlen] == 0x1A, f"{name}: EOF tidak valid"
        print(f"  {name:<12} {nrec:>3} rekaman, header {hlen}, record {rlen}")
print("ZIP valid: CRC, struktur, dan DBF di dalamnya.")
