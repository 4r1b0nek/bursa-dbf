# SOP-ANL-001 — Analisis Ulang Manual 9 Saham BEI

| Atribut | Keterangan |
| --- | --- |
| Nomor dokumen | SOP-ANL-001 |
| Revisi | 1.0 |
| Tanggal berlaku | 24 Oktober 2026 |
| Pemilik proses | Analis riset & model |
| Peninjau | Reviewer independen |
| Pelaksana rilis | Operator repositori |
| Status | Aktif |

## 1. Tujuan

Menjamin analisis ulang 9 emiten dilakukan secara konsisten, dapat diaudit, dan tidak
merusak data portofolio. SOP ini mengatur proses dari pengumpulan data sampai publikasi
snapshot baru ke GitHub Pages.

## 2. Ruang lingkup

**Termasuk:**

- Pembaruan data fundamental, dividen, harga acuan, indikator teknikal, asumsi valuasi,
  skor, rating, tesis, dan level harga.
- Regenerasi seluruh tabel `data/*.DBF` dan `data/manifest.json`.
- Validasi, review, publikasi, dan rollback.

**Tidak termasuk:**

- Update harga harian dari Yahoo Finance — dijalankan terpisah oleh
  `.github/workflows/update-harga.yml`.
- Pencatatan transaksi portofolio — dilakukan pengguna di halaman Portofolio.
- Perubahan kode antarmuka, kecuali perbaikan bug yang menghalangi proses ini.

> Prinsip: **analisis dan update harga dipisahkan**. Analisis ulang menetapkan nilai wajar,
> skor, dan rating. Update harga hanya mengubah harga dan rasio turunannya.

## 3. Peran dan tanggung jawab

| Peran | Tanggung jawab |
| --- | --- |
| **Analis** | Mengumpulkan data, memperbarui `data.py`/`model.py`, menulis tesis, menjalankan build dan uji awal |
| **Reviewer** | Memeriksa unit, sumber, tanggal, konsistensi angka, dan diff; menandatangani checklist |
| **Operator** | Melakukan commit/push, memantau deploy, dan verifikasi pascapublikasi |

Jika hanya ada satu orang, tetap lakukan **review pass** terpisah minimal 30 menit setelah
build, dengan membaca ulang checklist Bagian 10.

## 4. Kapan dijalankan

| Pemicu | Contoh | Target waktu |
| --- | --- | --- |
| Laporan keuangan kuartalan | Q1/Q2/Q3/Q4 | ≤ 5 hari kerja setelah rilis |
| Pengumuman dividen | final/interim, special dividend | ≤ 3 hari kerja |
| Aksi korporasi | stock split, rights issue, bonus share | sebelum ex-date |
| Perubahan asumsi makro | BI rate, ERP, COE, PE wajar | saat asumsi disetujui |
| Koreksi data | salah input, revisi laporan | segera |

**Tidak dipicu oleh** pergerakan harga harian. Untuk harga, gunakan **Saham → Update harga**
atau workflow Yahoo.

## 5. Prasyarat

- Python 3.10+ dan Node.js 18+ (hanya untuk uji).
- Akses tulis ke repositori dan hak menjalankan GitHub Actions.
- `data/` dalam kondisi terakhir sudah di-commit (atau sudah dibackup).
- Sumber data tersedia: stockanalysis.com, laporan emiten, Kontan/CNBC/Antara/IDX Channel.
- Portofolio sudah diekspor: **Portofolio → TRANSAKSI.DBF**.
- Browser siap untuk verifikasi di `http://localhost:8765` atau URL GitHub Pages.

> `build_dbf.py` sekarang **mempertahankan `TRANSAKSI.DBF`** yang sudah ada. Backup tetap
> wajib untuk rollback.

## 6. Prosedur

### Langkah 0 — Bekukan dan backup

1. Pastikan tidak ada perubahan yang belum disimpan di aplikasi. Kalau baru mengubah
   transaksi, klik tombol **TRANSAKSI.DBF** pada halaman Portofolio.
2. Catat jumlah baris `TRANSAKSI.DBF` saat ini.
3. Backup folder data:

   ```powershell
   $stamp = Get-Date -Format "yyyyMMdd-HHmm"
   New-Item -ItemType Directory -Force "backups\$stamp" | Out-Null
   Copy-Item "data\*" "backups\$stamp" -Recurse
   ```

   ```bash
   stamp=$(date +%Y%m%d-%H%M)
   mkdir -p "backups/$stamp"
   cp data/* "backups/$stamp/"
   ```

4. Simpan catatan sumber di log Bagian 11.

### Langkah 1 — Kumpulkan data

Isi tabel kerja untuk setiap emiten yang berubah. Minimal catat:

| Kode | Field | Nilai lama | Nilai baru | Sumber | Tanggal akses | Catatan |
| --- | --- | --- | --- | --- | --- | --- |
| TLKM | `eps_ttm` | 181,57 | … | Laporan Q3 | 2026-10-31 | … |

Aturan pengumpulan:

- Gunakan **harga penutupan** hari bursa terakhir, bukan harga intraday.
- Konsisten dengan satuan yang sudah ada (lihat Lampiran A).
- Simpan URL/sumber di log; jangan mengandalkan ingatan.
- Jika angka tidak tersedia, gunakan `None`/kosong — **jangan mengarang**.
- Untuk emiten siklikal, pisahkan dividen reguler dan spesial.

### Langkah 2 — Perbarui `tools/data.py`

Per emiten, perbarui field yang berubah:

- Profil: `name`, `sector`, `mcap`, `shares`.
- Harga & teknikal: `price`, `ma50`, `ma200`, `rsi`, `chg52`, `hi52`, `lo52`, `avgvol`.
- Fundamental: `pe`, `fwdpe`, `pb`, `ps`, `ev_ebitda`, `roe`, `roa`, `der`, `cr`, `icr`,
  `rev_ttm`, `ni_ttm`, `eps_ttm`, `pm`, `om`, `fcf`, `debt`, `equity`, `cash`.
- Riwayat: `rev`, `ni`, `eps`, `pe_hist`, `pb_hist`.
- Dividen: `div`, `div_regular` (ADRO), `dps_ttm`.
- Basis pertumbuhan: `model`, `growth_basis`.

**Jangan mengubah struktur dict** tanpa menyesuaikan `model.py` dan `build_dbf.py`.

### Langkah 3 — Perbarui `tools/model.py`

| Bagian | Isi |
| --- | --- |
| `P` | Harga acuan per emiten |
| `PE_FAIR` | PE wajar per emiten |
| `COE` | Cost of equity (samakan dengan `PARAM.COE` di `build_dbf.py`) |
| `TECH` | MA20/MA50, RSI, MACD, ATR, volume ratio, 10 harga mingguan |
| `ASSUME` | Pertumbuhan bull/base/bear |
| `SCORES` | Skor 6 faktor (0–10) |
| `W` | Bobot skor; total harus 1,00 |

Periksa bahwa `TECH["KODE"]["wk"]` berisi **10 angka** dan `ASSUME` berisi 3 angka
(bull, base, bear). Jika mengubah `COE`, ubah juga nilai di `build_param()`.

### Langkah 4 — Perbarui narasi dan tanggal

Di `tools/build_dbf.py`:

1. `DATA_DATE` → tanggal snapshot, format `YYYY-MM-DD`.
2. `CATATAN` per emiten:
   - `rating`: `Menarik` / `Netral` / `Kurang menarik`.
   - `keputusan`: mis. `Beli bertahap`, `Hold`, `Pantau`.
   - `bintang`, `akum`, `buy`, `target`, `cutloss`.
   - `ringkas`: maksimal **254 karakter ASCII**.
3. `PARAM.HARGA_SUMBER` otomatis menjadi `Riset <DATA_DATE>`; tidak perlu diedit manual.
4. `manifest.source` otomatis memakai `DATA_DATE`.

Tesis harus konsisten dengan skor dan valuasi. Jika harga berubah tetapi tesis belum
diperbarui, gunakan label tanggal analisis pada tesis (sudah otomatis di UI).

### Langkah 5 — Bangun ulang DBF

```bash
python tools/build_dbf.py
```

Hasil yang diharapkan:

```text
SAHAM         9 baris
VALUASI       9 baris
TEKNIKAL      9 baris
SKOR          9 baris
DIVIDEN      46 baris
HISTORIK     90 baris
TRANSAKSI    N baris (dipertahankan)
PARAM        11 baris
Selesai: 8 tabel
```

Jika jumlah transaksi berubah drastis, **hentikan proses** dan pulihkan backup.
Jangan gunakan `--reset-transaksi` kecuali memang ingin mengembalikan 5 contoh.

### Langkah 6 — Validasi teknis

```bash
node tools/test_dbf.mjs        # roundtrip byte-identik
node tools/test_app.mjs        # join, portofolio, simulasi, grafik
python tools/update_harga_live.py --dry-run   # opsional, cek kewajaran harga Yahoo
```

Lalu periksa manual:

- [ ] 9 `KODE` ada di `SAHAM`, `VALUASI`, `TEKNIKAL`, `SKOR`.
- [ ] `DIVIDEN` = 46 baris; `HISTORIK` = 90 baris.
- [ ] `TRANSAKSI` sama dengan jumlah sebelum build.
- [ ] Tidak ada `***` pada kolom numerik.
- [ ] `HARGA`, `FV`, `EPS`, `BVPS` > 0.
- [ ] `MOS = (FV - HARGA) / FV` cocok dengan `VALUASI.MOS`.
- [ ] `PE = HARGA / EPS`, `PB = HARGA / BVPS`, `DY = DPS / HARGA`.
- [ ] `manifest.json` mencatat 8 tabel dan `dataDate` baru.

### Langkah 7 — Review

Reviewer memeriksa:

- [ ] Sumber dan tanggal setiap angka yang berubah tercatat.
- [ ] Satuan benar (Rp juta vs US$ juta vs rupiah per saham).
- [ ] Tidak ada field yang tidak sengaja kosong.
- [ ] Perubahan skor/rating masuk akal dan dijelaskan di tesis.
- [ ] `git diff` hanya menyentuh file yang dimaksud.
- [ ] Uji Langkah 6 lulus.
- [ ] Checklist ini ditandatangani di log.

Jika ada yang gagal, kembali ke langkah terkait. **Jangan push saat review belum selesai.**

### Langkah 8 — Publikasi

```bash
git status
git diff --stat
git add tools/data.py tools/model.py tools/build_dbf.py data
git commit -m "analisis: snapshot 2026-10-31"
git push
```

- Workflow `pages.yml` akan men-deploy GitHub Pages.
- Workflow harga harian tidak perlu dijalankan; biarkan jadwalnya berjalan.
- Jangan meng-commit folder `backups/`.

### Langkah 9 — Verifikasi pascapublikasi

1. Tunggu workflow **Deploy GitHub Pages** hijau.
2. Buka situs, lakukan hard refresh (`Ctrl+Shift+R`).
3. Di aplikasi: **Database → Ambil data terbaru** (transaksi dipertahankan).
4. Periksa:
   - [ ] Footer menampilkan `Harga per … · Fundamental per <DATA_DATE>`.
   - [ ] Jumlah baris 8 tabel benar.
   - [ ] Harga, FV, MoS, skor emiten yang diubah sesuai.
   - [ ] Portofolio masih berisi transaksi yang sama.
   - [ ] Tidak ada error di konsol browser.
   - [ ] Tampilan mobile 390 px tidak rusak.

### Langkah 10 — Arsipkan

Isi log Bagian 11 dan simpan backup minimal 2 snapshot terakhir. Catat commit hash
yang dipublikasikan.

## 7. Kriteria selesai

- Seluruh checklist Langkah 6, 7, dan 9 tercentang.
- `dataDate` di `manifest.json` = tanggal snapshot baru.
- Situs GitHub Pages menampilkan data baru.
- Jumlah transaksi tidak berubah.
- Tidak ada perubahan tak terkait di commit.

## 8. Rollback

**Sebelum push:**

```bash
git restore data tools/data.py tools/model.py tools/build_dbf.py
```

**Setelah push:**

```bash
git revert <commit-hash>
git push
```

Jangan `git push --force` ke branch utama.

Jika `TRANSAKSI.DBF` rusak:

1. Salin kembali dari `backups/<stamp>/TRANSAKSI.DBF`.
2. Buka aplikasi → **Database → Impor** → pilih file tersebut.
3. **Simpan ke folder** atau **Unduh .DBF**.
4. Commit perbaikan.

Setelah rollback, lakukan hard refresh dan **Ambil data terbaru**.

## 9. Penanganan masalah

| Gejala | Penyebab umum | Tindakan |
| --- | --- | --- |
| `teks ... > 254 char` | `RINGKASAN` terlalu panjang | Pendekkan tesis, maks. 254 karakter ASCII |
| `***` di DBF | Angka melebihi lebar field | Perkecil nilai atau sesuaikan lebar field di `build_dbf.py` |
| Build gagal `KeyError` | Field baru belum ada di `data.py` | Lengkapi dict atau sesuaikan `model.py` |
| Uji aplikasi gagal | Data tidak konsisten | Baca pesan `FAIL`, perbaiki, ulangi build |
| Situs masih data lama | Cache/localStorage | Hard refresh, lalu **Ambil data terbaru** |
| Portofolio hilang | `TRANSAKSI.DBF` tertimpa | Pulihkan backup/Impor, ekspor ulang |
| Harga Yahoo berbeda | Delay/data vendor | Wajar; analisis tetap memakai `P` sampai update harga |
| Actions gagal push | Workflow permissions | Settings → Actions → General → Read and write |

## 10. Checklist ringkas (cetak)

```text
[ ] Backup data + TRANSAKSI.DBF
[ ] Data fundamental & dividen diperbarui
[ ] P, PE_FAIR, COE, TECH, ASSUME, SCORES diperbarui
[ ] CATATAN + DATA_DATE diperbarui
[ ] build_dbf.py dijalankan, TRANSAKSI tetap
[ ] test_dbf.mjs lulus
[ ] test_app.mjs lulus
[ ] Cek 9 KODE, 46 DIVIDEN, 90 HISTORIK
[ ] Review angka & satuan
[ ] Commit + push
[ ] Pages hijau, hard refresh, Ambil data terbaru
[ ] Portofolio & tampilan mobile dicek
[ ] Log diisi
```

## 11. Log pelaksanaan

| Tanggal | Analis | Reviewer | Snapshot | Emiten berubah | Commit | Catatan |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

## Lampiran A — Satuan dan field penting

| Field | Satuan | Catatan |
| --- | --- | --- |
| `price`, `ma50`, `ma200`, `hi52`, `lo52`, `dps_ttm`, `eps_ttm` | Rupiah per saham | Harga IDR, bukan sen |
| `shares` | Lembar | 10,52e9 = 10,52 miliar lembar |
| `rev_ttm`, `ni_ttm`, `fcf`, `debt`, `equity`, `cash` | **Rp juta** | `equity × 1e6 / shares = BVPS` |
| `rev_usd`, `ni_usd`, `ni_ttm_usd` | **US$ juta** | Untuk ADRO, PGEO, POWR |
| `div`, `dps_ttm` | Rupiah per saham | Bukan persen |
| `chg52` | Persen | `-6.49` berarti −6,49% |
| `roe`, `roa`, `pm`, `om` | Persen | `9.38` berarti 9,38% |
| `payout`, `dy`, `mos` | Rasio 0–1 | Ditampilkan sebagai persen oleh UI |
| `score_*` | 0–10 | Bobot di `W` |
| `DATA_DATE` | `YYYY-MM-DD` | Menjadi `PARAM.TANGGAL_DATA` dan `manifest.dataDate` |

## Lampiran B — Perintah cepat

```bash
# backup
cp -r data "backups/$(date +%Y%m%d-%H%M)"

# bangun ulang (transaksi dipertahankan)
python tools/build_dbf.py

# bangun ulang + reset 5 transaksi contoh
python tools/build_dbf.py --reset-transaksi

# uji
node tools/test_dbf.mjs
node tools/test_app.mjs

# cek harga terbaru tanpa menulis
python tools/update_harga_live.py --dry-run

# publikasi
git add tools/data.py tools/model.py tools/build_dbf.py data
git commit -m "analisis: snapshot YYYY-MM-DD"
git push
```

## Lampiran C — Sumber data

| Kategori | Sumber utama | Verifikasi |
| --- | --- | --- |
| Laporan keuangan & rasio | stockanalysis.com | laporan emiten / IDX |
| Dividen | stockanalysis.com dividend | pengumuman emiten |
| Harga & 52 pekan | Yahoo Finance | harga penutupan IDX |
| Berita & konteks | Kontan, CNBC Indonesia, Antara, IDX Channel | minimal 1 sumber pembanding |
| Aksi korporasi | IDX / emiten | jadwal cum/ex |

Semua angka wajib berasal dari data publik. **Dilarang mengarang angka atau sumber.**
