# Bursa DBF

Aplikasi web untuk analisis **14 saham Bursa Efek Indonesia**. Mode default memakai
**Cloudflare D1 (SQLite)** lewat Worker; fallback `?mode=dbf` tetap membaca tabel
**DBF (dBase III)** di folder [`data/`](data).

**Live:** <https://4r1b0nek.github.io/bursa-dbf/> Ã‚Â· **Repo:** <https://github.com/4r1b0nek/bursa-dbf>

![Dashboard Bursa DBF](docs/preview-dashboard.png)

> Analisis fundamental per **21 Oktober 2026**. Harga saham dapat diperbarui manual atau
> otomatis dari Yahoo Finance setelah tanggal tersebut. Aplikasi ini bukan rekomendasi investasi.

## Kenapa DBF?

DBF adalah format tabel yang sudah dipakai puluhan tahun dan tetap bisa dibuka oleh
**Excel, LibreOffice Calc, Python (`dbfread`), FoxPro**, serta aplikasi akuntansi lama.
Dengan format ini, hasil analisis tidak terkunci di dalam aplikasi web: berkasnya bisa
diperiksa, diolah, atau dicetak dengan alat apa pun.

Aplikasi ini menulis sendiri pembaca/penulis DBF di JavaScript (tanpa library), sehingga
tidak memerlukan server, build step, atau basis data tambahan.

## Fitur

- **Dashboard** Ã¢â‚¬â€ skor 14 emiten, margin of safety, dividend yield, peta valuasi (yield vs MoS),
  dan tesis singkat.
- **Analisis saham** Ã¢â‚¬â€ tabel yang bisa dicari, difilter per sektor/rating, dan diurutkan.
- **Update harga** Ã¢â‚¬â€ tombol **Update harga (Yahoo)** mengambil harga terbaru dan menyimpannya ke D1;
  tersedia juga **Input manual** sebagai fallback.
- **Update otomatis** Ã¢â‚¬â€ Cron Trigger Worker berjalan SeninÃ¢â‚¬â€œJumat **17:15 WIB** untuk mengambil
  Yahoo Finance dan memperbarui D1. Workflow GitHub Actions tetap memperbarui DBF fallback.
- **Lembar analisis** Ã¢â‚¬â€ valuasi (DDM, PE/PB wajar), radar enam faktor, skenario bull/base/bear
  1Ã¢â‚¬â€œ3Ã¢â‚¬â€œ5 tahun, tren 10 minggu, indikator teknikal, riwayat dividen, dan level harga.
- **Portofolio** Ã¢â‚¬â€ jurnal beli/jual, biaya rata-rata, laba/rugi unrealized & realisasi,
  dividen tahunan, yield on cost, alokasi donat. User mengelola portofolionya sendiri;
  admin dapat melihat semua portofolio dengan filter user, tetapi **read-only**.
- **Simulasi** Ã¢â‚¬â€ proyeksi setoran bulanan dengan reinvestasi dividen, lengkap dengan IRR.
- **Login & role** Ã¢â‚¬â€ form login, sesi 8 jam, role `ADMIN`/`USER`, status aktif, dan masa
  berlaku akun (kedaluwarsa otomatis ditolak).
- **Manajemen pengguna** Ã¢â‚¬â€ admin dapat membuat, mengubah, mereset password, dan
  menonaktifkan/mengaktifkan akun. Setiap aksi sensitif diverifikasi ulang dengan password admin.
- **Riwayat upload** Ã¢â‚¬â€ admin mengunggah **Excel Dashboard** (`.xlsx`); data saham, valuasi,
  teknikal, dan log bulanan diperbarui sekaligus. Seluruh user dapat melihat riwayat IHSG,
  yield, MoS, jumlah saham murah/buy, skor, catatan, dan waktu unggah.
- **PWA Android** Ã¢â‚¬â€ dapat dipasang ke layar utama, tampil standalone, dan menyimpan
  app shell untuk dibuka saat offline. Data D1 tetap memerlukan internet.
- **Database** Ã¢â‚¬â€ penjelajah 9 tabel DBF: struktur field, header DBF, pratinjau data,
  unduh satu tabel / ZIP, impor `.DBF`, dan simpan langsung ke folder lokal.
- **Responsif** Ã¢â‚¬â€ dipakai nyaman di desktop maupun ponsel.

| Portofolio | Lembar analisis |
| --- | --- |
| ![Portofolio](docs/preview-portofolio.png) | ![Analisis](docs/preview-analisis.png) |

## Login & hak akses

<img src="docs/preview-login.png" alt="Form login Bursa DBF" width="520">

Mode default memakai **API Cloudflare D1**. Password admin D1 dibuat saat setup dan
**tidak disimpan di repositori**; buat akun user lewat **Pengguna Ã¢â€ â€™ Tambah pengguna**.
Password `Bursa#2026!123` hanya berlaku untuk fallback DBF (`?mode=dbf`), yang memakai
akun bootstrap di [`tools/build_dbf.py`](tools/build_dbf.py).

| Fitur | ADMIN | USER |
| --- | :---: | :---: |
| Dashboard, analisis saham, portofolio, simulasi | Ã¢Å“â€œ | Ã¢Å“â€œ |
| Tambah/ubah transaksi portofolio | Ã¢â‚¬â€ | Ã¢Å“â€œ |
| Melihat semua portofolio user + filter | Ã¢Å“â€œ | Ã¢â‚¬â€ |
| Update harga | Ã¢Å“â€œ | Ã¢â‚¬â€ |
| Manajemen pengguna & role | Ã¢Å“â€œ | Ã¢â‚¬â€ |
| Ekspor/impor DBF & Database browser | Ã¢Å“â€œ* | Ã¢â‚¬â€ |

\* Hanya pada fallback DBF (`?mode=dbf`). Pada mode D1, tombol dan halaman DBF
disembunyikan karena browser tidak lagi menerima file database.

Aturan akun:

- Sesi login berlaku **8 jam** atau sampai tab ditutup.
- User dengan `STATUS = NONAKTIF` atau `EXPIRED` yang sudah lewat tidak bisa login.
- User baru dan akun bootstrap wajib mengganti password pada login pertama.
- Admin tidak bisa menonaktifkan/menurunkan akun sendiri, dan sistem menolak menghapus admin aktif terakhir.
- Aksi tambah/ubah/nonaktifkan pengguna meminta **password admin** sebagai verifikasi ulang.

> **Keamanan.** Pada mode D1, login dan role diperiksa Worker; browser tidak menerima
> `PENGGUNA.DBF`, hash password, atau file database. Token disimpan di `sessionStorage`.
> Pada fallback `?mode=dbf`, pemeriksaan role berjalan di browser dan `PENGGUNA.DBF`
> dapat dibaca publik Ã¢â‚¬â€ gunakan hanya untuk pengembangan lokal.

## Backend Cloudflare D1 (SQLite)

Tersedia backend terpisah di **Cloudflare Worker + D1**:

- API: https://bursa-dbf-api.agus-asarry.workers.dev
- Database: D1 `bursa-dbf` (SQLite, region APAC), 10 tabel, 14 saham, 236 baris.
- Browser hanya memanggil `/api/*`; file DBF dan nama tabel tidak dikirim ke browser.
- Login, role, expiry, dan CRUD pengguna diperiksa di server.
- Kode, skema, dan panduan deploy: [`cloudflare/README.md`](cloudflare/README.md).

Frontend sudah memakai API ini secara default: `store.js` memanggil `/api/bootstrap`,
`auth.js` memakai `/api/login`, dan transaksi/pengguna dikirim ke Worker. Tambahkan
`?mode=dbf` pada URL untuk fallback ke aplikasi DBF lama.

## Template Excel analisis

Workbook yang sudah dilengkapi kolom aplikasi:

[**Dashboard_Simulator_14_Saham_v2.xlsx**](docs/Dashboard_Simulator_14_Saham_v2.xlsx)

Kolom/sheet tambahan:

- `Dashboard`: ROA, DER, EV/EBITDA, level akumulasi/beli/target/cut loss, ringkasan,
  market cap, PM/OM, CR/ICR, FCF, Debt, Equity, Cash.
- `Valuasi & Skenario`: DDM, PB wajar, FV low/high, DDM low/high.
- `Data Keuangan` v2: tabel tidy `KODE-TAHUN` dengan pendapatan, laba, EPS, DPS,
  aset, ekuitas, utang, kas, EBITDA, FCF.
- `Ringkasan 5 Tahun`: CAGR pendapatan/laba, ROE, DER, PM.
- `Skor`: FUND, VAL, DIV, TECH, RISK, PROS, TOTAL (0â€“10 per faktor).
- `Dividen`: riwayat DPS 2022â€“2026.
- `Historik`: placeholder untuk 10 minggu harga.
- `Cara Update` mencatat `VERSI_TEMPLATE = 2.0`.

Parser aplikasi mendeteksi format `Data Keuangan` baru dan tetap menerima file lama
(fallback ke kolom Dashboard). ROA/DER/EV/EBITDA dihitung otomatis jika aset/ekuitas/
utang/EBITDA tersedia; skor faktor emiten baru tetap perlu diisi manual.

## Kamus saham

Daftar istilah dan rumus yang dipakai aplikasi (PE, PB, DER, ROE, DDM, MoS, RSI, skor,
CAGR, dan lainnya):

[**docs/KAMUS-SAHAM.md**](docs/KAMUS-SAHAM.md)

## PWA di Android

Aplikasi sudah dapat dipasang sebagai **Progressive Web App**:

1. Buka https://4r1b0nek.github.io/bursa-dbf/ di **Chrome Android**.
2. Login, lalu tunggu beberapa saat.
3. Klik tombol **Pasang** di kanan atas, atau menu Chrome Ã¢â€ â€™ **Add to Home screen**.
4. Aplikasi muncul sebagai ikon **Bursa DBF** dan terbuka tanpa address bar.

Yang tersedia:

- `manifest.webmanifest` Ã¢â‚¬â€ nama, ikon 192/512/maskable, shortcut, standalone.
- `sw.js` Ã¢â‚¬â€ cache app shell; tidak menyimpan API D1 atau file DBF.
- `assets/js/pwa.js` Ã¢â‚¬â€ registrasi service worker dan tombol Pasang.
- Offline: halaman login/app shell tetap terbuka; data D1 memerlukan koneksi.
- iOS: gunakan **Share Ã¢â€ â€™ Add to Home Screen** (tanpa prompt khusus).

## Jalankan secara lokal

```bash
python -m http.server 8765
# mode default: API D1
# fallback DBF: http://localhost:8765/?mode=dbf
```

Atau server apa pun (Live Server VS Code, `npx serve`, Nginx, dan sebagainya) yang menyajikan
folder ini sebagai root.

## Publikasi ke GitHub Pages

Repositori ini sudah disiapkan untuk GitHub Pages (workflow ada di
[`.github/workflows/pages.yml`](.github/workflows/pages.yml)).

1. Buat repositori baru di GitHub, lalu dari folder ini:

   ```bash
   git init
   git add .
   git commit -m "Bursa DBF: analisis 9 saham dengan penyimpanan DBF"
   git branch -M main
   git remote add origin https://github.com/USERNAME/bursa-dbf.git
   git push -u origin main
   ```

2. Buka **Settings Ã¢â€ â€™ Pages Ã¢â€ â€™ Build and deployment**, pilih **Source: GitHub Actions**.
3. Workflow akan berjalan pada setiap push ke `main`. Situs tersedia di
   `https://USERNAME.github.io/bursa-dbf/`.

Tidak ada build step: GitHub Pages menyajikan `index.html`, `assets/`, dan `data/` apa adanya.

> Catatan: repository ini berisi berkas `.DBF` biner. Pastikan Git tidak mengabaikannya
> (`.gitattributes` tidak diperlukan; `.gitignore` hanya mengecualikan cache Python/Node).

## Bagaimana data disimpan?

Mode default:

```text
GitHub Pages  Ã¢â€â‚¬Ã¢â€â‚¬/api/bootstrapÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº  Cloudflare Worker  Ã¢â€â‚¬Ã¢â€â‚¬SQLÃ¢â€â‚¬Ã¢â€â‚¬Ã¢â€“Âº  D1 (SQLite)
      Ã¢â€â€š                                  Ã¢â€â€š
      Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ login/token (sessionStorage) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
```

1. **Saat login**, `auth.js` memanggil `POST /api/login`; token HMAC disimpan di
   `sessionStorage`.
2. **Data analisis** diambil dari `/api/bootstrap` (saham, valuasi, teknikal, skor,
   dividen, historik, parameter, dan transaksi milik user). Browser tidak menerima
   file `.DBF` atau hash password.
3. **Transaksi dan pengguna** ditulis lewat API ke D1, sehingga berlaku lintas perangkat.
4. **Fallback DBF** (`?mode=dbf`) memakai alur lama: `data/*.DBF` Ã¢â€ â€™ localStorage Ã¢â€ â€™
   Unduh ZIP / Simpan ke folder. Ini hanya untuk pengembangan lokal.

GitHub Pages tetap statis, tetapi data dinamis sekarang disimpan di D1.

## Memperbarui data

> Untuk analisis ulang penuh (fundamental, valuasi, rating, tesis), ikuti prosedur baku di
> [`docs/SOP-Analisis-Ulang.md`](docs/SOP-Analisis-Ulang.md). Dokumen tersebut memuat backup,
> urutan pengerjaan, checklist review, publikasi, dan rollback.

### 1. Harga saham (lewat UI)

Buka **Saham Ã¢â€ â€™ Update harga (Yahoo)**, lalu konfirmasi. Worker mengambil harga emiten,
menghitung ulang `PE`, `PB`, `DY`, dan `MoS`, lalu menyimpannya ke D1. Tombol **Input manual**
tetap tersedia jika Yahoo gagal. Nilai wajar, skor, dan indikator teknikal **tidak** dihitung ulang.

Tanggal pembaruan disimpan di `PARAM.HARGA_PER` dan ditampilkan pada catatan tabel Saham/Portofolio.
Setelah disimpan, status berubah menjadi *Ã¢â‚¬Å“belum dieksporÃ¢â‚¬Â*: unduh **SAHAM.DBF** dan **VALUASI.DBF**
(atau **ZIP**), atau gunakan **Database Ã¢â€ â€™ Simpan ke folder** agar berkas `.DBF` ikut berubah.

### 2. Update otomatis dari Yahoo Finance

Workflow [`.github/workflows/update-harga.yml`](.github/workflows/update-harga.yml) berjalan
otomatis **SeninÃ¢â‚¬â€œJumat pukul 17.15 WIB** (setelah sesi IDX tutup), dan bisa dijalankan manual
dari tab **Actions Ã¢â€ â€™ Update harga (Yahoo Finance) Ã¢â€ â€™ Run workflow**.

Agar bot dapat melakukan commit, set **Settings Ã¢â€ â€™ Actions Ã¢â€ â€™ General Ã¢â€ â€™ Workflow permissions**
ke **Read and write permissions**. Workflow hanya berjalan pada branch default.

Yang dilakukan:

1. `python tools/update_harga_live.py` mengambil harga 9 emiten dari endpoint publik
   `query1.finance.yahoo.com/v8/finance/chart/<KODE>.JK` (tanpa API key).
2. `HARGA`, `MCAP_T`, `PE`, `PB`, `DY`, `MOS`, dan `UPDAT` diperbarui di `SAHAM.DBF`;
   `MOS` di `VALUASI.DBF`; `HARGA_PER` dan `HARGA_SUMBER` di `PARAM.DBF`.
3. Perubahan di-commit oleh bot, lalu GitHub Pages di-deploy ulang.

Menjalankan manual di komputer:

```bash
python tools/update_harga_live.py --dry-run   # lihat harga, tanpa menulis
python tools/update_harga_live.py             # tulis DBF + manifest
```

Batasan yang perlu diketahui:

- Yahoo Finance **bukan API resmi**, harga bisa delayed, dan endpoint dapat berubah atau
  membatasi permintaan. Skrip mencoba ulang 3Ãƒâ€” dan membatalkan penulisan bila kurang dari
  5 dari 9 ticker berhasil.
- Workflow hanya berjalan pada repositori GitHub (butuh `contents: write`); untuk lokal,
  jalankan skripnya manual atau lewat Task Scheduler.
- Harga saham diperbarui, tetapi **nilai wajar, skor, rating, dan indikator teknikal tidak**
  dihitung ulang Ã¢â‚¬â€ itu tetap hasil analisis 21 Oktober 2026.

### 3. Jurnal transaksi (lewat UI)

Buka **Portofolio**:

- **Tambah transaksi** untuk membeli/menjual.
- Ikon **pensil** untuk mengubah baris, ikon **tempat sampah** untuk menghapus.
- Semua perubahan langsung tersimpan di browser (status di header berubah menjadi
  *Ã¢â‚¬Å“belum dieksporÃ¢â‚¬Â*).

Agar masuk ke berkas DBF: klik **TRANSAKSI.DBF** (unduh) atau buka **Database Ã¢â€ â€™ Simpan ke folder**
dan pilih folder `data/`. Di GitHub, commit berkas `data/TRANSAKSI.DBF` yang baru.

### 4. Data analisis (harga, fundamental, dividen, valuasi)

Tabel referensi sengaja hanya-baca dari UI supaya angka model tetap konsisten. Alur yang disarankan:

1. Perbarui sumber angka di [`tools/data.py`](tools/data.py) dan/atau [`tools/model.py`](tools/model.py).
2. Jalankan:

   ```bash
   python tools/build_dbf.py
   ```

   Perintah ini menulis ulang **semua** tabel di `data/` beserta `manifest.json`.
   `TRANSAKSI.DBF` yang sudah ada **dipertahankan**; gunakan `--reset-transaksi` hanya jika
   memang ingin mengembalikan 5 transaksi contoh. Akun di `PENGGUNA.DBF` juga dipertahankan;
   `--reset-pengguna` mengembalikan akun admin bootstrap.
3. Buka aplikasi Ã¢â€ â€™ **Database Ã¢â€ â€™ Ambil data terbaru**. Tabel referensi dimuat ulang dari berkas
   `.DBF` baru; jurnal transaksi di browser **tetap dipertahankan**.
4. Untuk GitHub: commit `data/*.DBF` dan `data/manifest.json`, lalu push.

Panduan cepat lokasi angka:

| Ingin mengubah | Berkas / lokasi |
| --- | --- |
| Harga acuan, PE wajar, COE, asumsi skenario, bobot skor | `tools/model.py` Ã¢â‚¬â€ `P`, `PE_FAIR`, `COE`, `ASSUME`, `W` |
| MA20/MA50, RSI, MACD, ATR, volume ratio | `tools/model.py` Ã¢â‚¬â€ dict `TECH` |
| MA200, harga 52 pekan, perubahan 52 pekan | `tools/data.py` Ã¢â‚¬â€ `ma200`, `hi52`, `lo52`, `chg52` |
| EPS, ekuitas, jumlah saham, ROE, DER, FCF, rasio | `tools/data.py` Ã¢â‚¬â€ field per emiten |
| DPS tahunan & DPS 12 bulan | `tools/data.py` Ã¢â‚¬â€ dict `div`, `div_regular`, `dps_ttm` |
| Rating, keputusan, level harga, ringkasan tesis | `tools/build_dbf.py` Ã¢â‚¬â€ dict `CATATAN` |
| Tanggal data yang tampil di aplikasi | `tools/build_dbf.py` Ã¢â‚¬â€ `DATA_DATE` |
| Jurnal transaksi | UI Portofolio, atau `data/TRANSAKSI.DBF` |
| Akun, role, status, masa berlaku | UI **Pengguna**, atau `data/PENGGUNA.DBF` |

### 5. Mengedit DBF secara langsung

Kalau hanya ingin mengubah beberapa angka, berkas `data/SAHAM.DBF` / `VALUASI.DBF` bisa dibuka
dengan LibreOffice Calc, Excel, atau skrip Python, lalu disimpan kembali sebagai **dBASE III**.
Setelah berkas diganti, klik **Database Ã¢â€ â€™ Ambil data terbaru**.

Perhatikan kolom turunan: kalau `HARGA` diubah, kolom `PE`, `PB`, `DY`, dan `MOS` juga perlu
disesuaikan agar konsisten (`PE = HARGA / EPS`, `PB = HARGA / BVPS`, `DY = DPS / HARGA`,
`MOS = (FV - HARGA) / FV`). Cara paling aman tetap regenerasi lewat `build_dbf.py`.

### 6. Impor tabel dari aplikasi

**Database Ã¢â€ â€™ Impor** menerima satu atau beberapa `.DBF`. Tabel dengan nama yang sama akan
diganti di memori browser. Impor hanya mengubah salinan browser Ã¢â‚¬â€ gunakan **Unduh .DBF/ZIP**
atau **Simpan ke folder** agar perubahan permanen.

> Catatan: tombol **Muat ulang data awal** menghapus salinan browser (termasuk transaksi) dan
> memuat ulang DBF dari server. Gunakan **Ambil data terbaru** kalau hanya ingin memperbarui
> data referensi tanpa kehilangan portofolio.

## Tabel DBF

Semua tabel memakai kunci `KODE` (kecuali `PARAM`).

| Tabel | Isi | Baris | Field |
| --- | --- | ---: | ---: |
| `SAHAM.DBF` | Profil, harga, rasio, nilai wajar, rating, level harga, tesis | 9 | 39 |
| `VALUASI.DBF` | DDM, PE/PB wajar, bobot model, MoS, skenario 1/3/5 tahun | 9 | 23 |
| `TEKNIKAL.DBF` | MA20/50/200, RSI, MACD, ATR, volume ratio, jarak MA | 9 | 19 |
| `SKOR.DBF` | Skor 0Ã¢â‚¬â€œ10 untuk 6 faktor + skor total | 9 | 8 |
| `DIVIDEN.DBF` | DPS per tahun; dividen reguler dan spesial dipisah | 46 | 4 |
| `HISTORIK.DBF` | 10 penutupan mingguan terakhir per emiten | 90 | 4 |
| `TRANSAKSI.DBF` | Jurnal beli/jual portofolio (dapat diedit dari UI) | 5 | 8 |
| `PENGGUNA.DBF` | Akun login: role, status, masa berlaku, hash PBKDF2 + salt | 1 | 13 |
| `PARAM.DBF` | Metadata: tanggal data, tanggal & sumber harga, FX, COE, disclaimer | 11 | 2 |

Tipe field: `C` (teks), `N` (numerik), `D` (tanggal `YYYYMMDD`), `L` (logika).
Berkas ditulis sebagai dBase III versi `0x03`, encoding ASCII/CP1252, tanpa memo.
Nilai kosong disimpan sebagai spasi; teks panjang dipotong pada 254 karakter (batas dBase III).

Angka kunci pada snapshot analisis 21 Oktober 2026:

- **BJBR** Ã¢â‚¬â€ yield 12,0%; **BJTM** Ã¢â‚¬â€ MoS +48%; **TUGU** Ã¢â‚¬â€ skor 65,5 (tertinggi);
  **PGEO/POWR** Ã¢â‚¬â€ harga di atas nilai wajar model.
- Metode nilai wajar berbeda per model bisnis: bank (60% PB + 40% DDM),
  siklikal (60% PE + 40% PB), utilitas (60% PE + 40% DDM), asuransi (50% PE + 50% DDM),
  infrastruktur (45% PE + 35% DDM + 20% PB). Bobot tersimpan di `VALUASI.BOBOT`.

## Struktur repositori

```text
.
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ index.html                  # shell aplikasi
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ manifest.webmanifest        # manifest PWA Android
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ sw.js                       # service worker app shell
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ assets/
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ css/style.css           # design system
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ icons/                  # ikon PWA 192/512/maskable/apple
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ js/
Ã¢â€â€š       Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ app.js              # routing, view, form transaksi, login & pengguna
Ã¢â€â€š       Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ auth.js             # sesi, PBKDF2, login, CRUD pengguna & role
Ã¢â€â€š       Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ pwa.js              # registrasi service worker + install prompt
Ã¢â€â€š       Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ excel.js            # parser Excel Dashboard 14 saham
Ã¢â€â€š       Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ store.js            # load DBF/API, portofolio, simulasi
Ã¢â€â€š       Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ dbf.js              # pembaca & penulis DBF
Ã¢â€â€š       Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ charts.js           # grafik SVG tanpa dependensi
Ã¢â€â€š       Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ zip.js              # penulis ZIP (store) untuk ekspor
Ã¢â€â€š       Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ format.js           # format angka/locale Indonesia
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ data/                       # 10 berkas .DBF (9 manifest + LOG_BULAN) + manifest.json
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ tools/
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ build_dbf.py            # regenerasi DBF dari mesin analisis (Python)
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ update_harga_live.py    # ambil harga Yahoo Finance Ã¢â€ â€™ tulis DBF
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ dbf_writer.py           # penulis/pembaca DBF untuk build
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ data.py, model.py       # dataset + model valuasi (sumber angka)
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ make_icons.py           # membuat ikon PWA dari Pillow
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ test_dbf.mjs            # uji roundtrip byte-identik
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ test_app.mjs            # uji join data, portofolio, simulasi, grafik
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ test_auth.mjs           # uji login, role, expiry, CRUD pengguna
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ test_zip.mjs            # membuat arsip ZIP
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ test_zip.py             # validasi CRC & struktur DBF di dalam ZIP
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ docs/                       # tangkapan layar + SOP-Analisis-Ulang.md
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ .github/workflows/
    Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ pages.yml               # deploy GitHub Pages
    Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ update-harga.yml        # cron harga Yahoo Finance
```

## Regenerasi data & pengujian

Prasyarat: **Python 3.10+** (tanpa paket tambahan) dan **Node.js 18+** (hanya untuk uji).

```bash
# bangun ulang seluruh .DBF dari tools/data.py + tools/model.py
python tools/build_dbf.py

# uji DBF: baca Ã¢â€ â€™ tulis Ã¢â€ â€™ bandingkan byte dengan berkas asli
node tools/test_dbf.mjs

# uji logika aplikasi: join tabel, portofolio, simulasi, semua grafik
node tools/test_app.mjs

# uji login, role, status, expiry, dan CRUD pengguna
node tools/test_auth.mjs

# uji ZIP: buat arsip, validasi CRC + struktur DBF di dalamnya
node tools/test_zip.mjs demo.zip
python tools/test_zip.py demo.zip

# cek harga Yahoo tanpa menulis apa pun
python tools/update_harga_live.py --dry-run
```

`build_dbf.py` juga menulis ulang `data/manifest.json` (jumlah baris, ukuran, SHA-1 singkat).
Transaksi portofolio dan akun pengguna dipertahankan; tambahkan `--reset-transaksi` /
`--reset-pengguna` hanya untuk mengembalikan data contoh.

## Kompatibilitas

- **Browser**: Chrome, Edge, Firefox, Safari versi modern (ES modules, `Intl`, `fetch`).
- **Simpan ke folder**: hanya Chromium (Chrome/Edge) dengan HTTPS atau `localhost`; browser lain
  memakai tombol unduh.
- **Berkas DBF**: dapat dibuka di Excel/LibreOffice (impor sebagai dBASE), Python
  (`dbfread`), FoxPro, dan alat DBF lain. Tidak menggunakan memo field.

## Batasan

- Data analisis statis per **21 Oktober 2026**. Harga dapat diperbarui manual lewat UI atau
  otomatis dari Yahoo Finance; nilai wajar/skor tetap mengacu analisis tersebut.
- 14 emiten: **BMRI, BBRI, BBCA, BJBR, BJTM, TLKM, HMSP, CLEO, ADRO, PTBA, PGEO, POWR, IPCC, TUGU**.
- Portofolio awal berisi **5 transaksi contoh** (bertanda Ã¢â‚¬Å“Contoh:Ã¢â‚¬Â); hapus lewat tombol
  **Hapus semua** di halaman Portofolio bila ingin mulai dari nol.
- Tabel referensi (`SAHAM`, `VALUASI`, dst.) tidak dapat diedit bebas dari UI Ã¢â‚¬â€ hanya harga
  lewat **Update harga**. Untuk mengubah field lain:
  sunting `tools/data.py` / `tools/model.py` (atau impor `.DBF` lain), lalu jalankan
  `python tools/build_dbf.py`.
- Nilai wajar dan skenario adalah keluaran model dengan asumsi eksplisit Ã¢â‚¬â€ bukan saran
  beli/jual. Angka dapat berbeda bila asumsi COE, PE wajar, atau pertumbuhan diubah.
- Teks DBF dibatasi ASCII/CP1252; karakter di luar itu akan disanitasi.
- Repositori publik masih menyertakan `data/*.DBF` untuk fallback `?mode=dbf`. Aplikasi mode
  D1 tidak memuat berkas itu, tetapi URL langsungnya tetap dapat diakses dari GitHub. Untuk
  menyembunyikan total, hapus `data/` dari repo/artefak deploy atau jadikan repo privat.

## Sumber data

- **Fundamental, dividen, dan valuasi:** **stockanalysis.com** (statistics, dividend, financials,
  ratios), diverifikasi silang dengan pemberitaan **Kontan, CNBC Indonesia, Antara, dan
  IDX Channel** per 21 Oktober 2026.
- **Harga terbaru:** **Yahoo Finance** (chart v8, delayed) lewat
  [`tools/update_harga_live.py`](tools/update_harga_live.py). Yahoo bukan API resmi; harga
  dapat berbeda dari harga acuan analisis dan bukan untuk diperdagangkan secara otomatis.

Semua angka adalah data publik; tidak ada angka yang direkayasa. Rumus valuasi, skor, dan
simulasi berada di [`tools/model.py`](tools/model.py) dan dapat diaudit.

## Lisensi

Kode aplikasi: [MIT](LICENSE). Data dan narasi analisis disediakan untuk tujuan edukasi;
bukan rekomendasi investasi. Keputusan investasi sepenuhnya tanggung jawab pengguna.


