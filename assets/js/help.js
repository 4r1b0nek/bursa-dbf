/* help.js — Pusat Bantuan: Manual Book, Kamus Saham, FAQ. */

const TABS = [
  ["manual", "Manual Book"],
  ["kamus", "Kamus Saham"],
  ["faq", "FAQ"],
];

function tabs(active) {
  return `<nav class="help-tabs" aria-label="Submenu bantuan">
    ${TABS.map(([key, label]) => `<a href="#/bantuan/${key}" class="${active === key ? "active" : ""}" ${active === key ? 'aria-current="page"' : ""}>${label}</a>`).join("")}
  </nav>`;
}

function manual() {
  return `
  <div class="card">
    <h3>1. Login dan role</h3>
    <p>Masuk memakai akun yang diberikan admin. Sesi berlaku 8 jam atau sampai tab ditutup.</p>
    <div class="table-wrap mt-2">
      <table class="data">
        <thead><tr><th>Fitur</th><th>ADMIN</th><th>USER</th></tr></thead>
        <tbody>
          <tr><td>Ringkasan, Saham, Portofolio, Simulasi, Bantuan</td><td class="center">✓</td><td class="center">✓</td></tr>
          <tr><td>Tambah/ubah transaksi portofolio sendiri</td><td class="center">—</td><td class="center">✓</td></tr>
          <tr><td>Melihat semua portofolio user</td><td class="center">✓</td><td class="center">—</td></tr>
          <tr><td>Update harga, upload Excel, kelola pengguna</td><td class="center">✓</td><td class="center">—</td></tr>
        </tbody>
      </table>
    </div>
    <p class="small muted mt-2">Admin bersifat read-only untuk transaksi portofolio. Hanya user pemilik akun yang dapat mengubah portofolionya.</p>
  </div>

  <div class="card mt-3">
    <h3>2. Halaman aplikasi</h3>
    <ul class="help-list">
      <li><b>Ringkasan</b> — skor, margin of safety, dividend yield, peta valuasi, dan tesis singkat.</li>
      <li><b>Saham</b> — tabel 14 emiten; klik baris untuk membuka lembar analisis, valuasi, skenario, teknikal, dan dividen.</li>
      <li><b>Portofolio</b> — catat transaksi beli/jual, lihat biaya rata-rata, laba/rugi, alokasi, dan dividen.</li>
      <li><b>Simulasi</b> — proyeksi setoran bulanan dengan reinvestasi dividen dan IRR.</li>
      <li><b>Riwayat Upload</b> — unggah Excel analisis (admin) dan lihat riwayat unggahan.</li>
      <li><b>Pengguna</b> — admin membuat, mengubah, menonaktifkan akun, dan mengatur masa berlaku.</li>
    </ul>
  </div>

  <div class="card mt-3">
    <h3>3. Upload Excel analisis</h3>
    <ol class="help-list">
      <li>Buka <b>Riwayat Upload</b>.</li>
      <li>Klik <b>Upload Data</b>, pilih file <span class="mono">.xlsx</span>.</li>
      <li>Tunggu proses selesai. Data saham, valuasi, teknikal, skor, dividen, dan log bulanan diperbarui.</li>
      <li>Periksa toast jumlah saham dan bulan log yang diperbarui.</li>
    </ol>
    <div class="callout mt-2">
      <div><b>Penting.</b> Gunakan template terbaru dan jangan mengubah nama sheet/header.
      File lama tetap diterima, tetapi kolom yang tidak ada akan kosong.</div>
    </div>
  </div>

  <div class="card mt-3">
    <h3>4. Pasang di Android (PWA)</h3>
    <ol class="help-list">
      <li>Buka aplikasi di Chrome Android.</li>
      <li>Login, lalu klik tombol <b>Pasang</b> atau menu Chrome → <b>Add to Home screen</b>.</li>
      <li>Ikon Bursa DBF muncul dan aplikasi terbuka tanpa address bar.</li>
    </ol>
    <p class="small muted">App shell dapat dibuka offline; data D1 tetap memerlukan internet.</p>
  </div>

  <div class="card mt-3">
    <h3>5. Troubleshooting</h3>
    <ul class="help-list">
      <li><b>Tidak bisa login</b> — cek username/password, status akun, dan tanggal kedaluwarsa.</li>
      <li><b>Upload gagal</b> — pastikan file .xlsx, sheet dan header tidak diubah, lalu coba lagi.</li>
      <li><b>Data kosong (—)</b> — field tersebut belum ada di Excel. Lengkapi di template.</li>
      <li><b>Harga berbeda</b> — harga dari Yahoo dapat delayed dan berubah setelah analisis.</li>
      <li><b>Tampilan lama</b> — hard refresh atau buka ulang PWA.</li>
    </ul>
  </div>`;
}

function kamus() {
  return `
  <div class="card">
    <h3>Valuasi</h3>
    <div class="table-wrap mt-2"><table class="data">
      <thead><tr><th>Istilah</th><th>Arti</th><th>Rumus</th></tr></thead>
      <tbody>
        <tr><td><b>EPS</b></td><td>Laba per lembar</td><td class="mono">Laba bersih ÷ jumlah saham</td></tr>
        <tr><td><b>BVPS</b></td><td>Nilai buku per lembar</td><td class="mono">Ekuitas ÷ jumlah saham</td></tr>
        <tr><td><b>DPS</b></td><td>Dividen tunai per lembar (12 bulan/TTM)</td><td class="mono">Total dividen ÷ jumlah saham</td></tr>
        <tr><td><b>PE</b></td><td>Price to earnings</td><td class="mono">Harga ÷ EPS</td></tr>
        <tr><td><b>PB</b></td><td>Price to book</td><td class="mono">Harga ÷ BVPS</td></tr>
        <tr><td><b>DY</b></td><td>Dividend yield</td><td class="mono">DPS ÷ Harga</td></tr>
        <tr><td><b>Payout</b></td><td>Porsi laba dibagikan</td><td class="mono">DPS ÷ EPS</td></tr>
        <tr><td><b>FV</b></td><td>Nilai wajar model</td><td class="mono">Bobot PE / PB / DDM</td></tr>
        <tr><td><b>MoS</b></td><td>Margin of safety</td><td class="mono">(FV − Harga) ÷ FV</td></tr>
        <tr><td><b>DDM</b></td><td>Dividend discount model</td><td class="mono">DPS × (1+g) ÷ (COE − g)</td></tr>
        <tr><td><b>CAGR</b></td><td>Pertumbuhan majemuk</td><td class="mono">(akhir ÷ awal)^(1/n) − 1</td></tr>
      </tbody>
    </table></div>
  </div>

  <div class="card mt-3">
    <h3>Contoh simulasi: BMRI</h3>
    <p>Contoh memakai data BMRI 28 Oktober 2026. 1 lot = 100 lembar; simulasi membeli 10 lot.</p>
    <div class="table-wrap mt-2"><table class="data">
      <thead><tr><th>Data / rumus</th><th class="num">Nilai</th></tr></thead>
      <tbody>
        <tr><td>Harga</td><td class="num">Rp3.790</td></tr>
        <tr><td>EPS</td><td class="num">Rp687,14</td></tr>
        <tr><td>BVPS</td><td class="num">Rp3.244,40</td></tr>
        <tr><td>DPS TTM</td><td class="num">Rp476,96</td></tr>
        <tr><td>PE = Harga ÷ EPS</td><td class="num">5,52x</td></tr>
        <tr><td>PB = Harga ÷ BVPS</td><td class="num">1,17x</td></tr>
        <tr><td>Dividend yield = DPS ÷ Harga</td><td class="num">12,58%</td></tr>
        <tr><td>Payout = DPS ÷ EPS</td><td class="num">69,4%</td></tr>
        <tr><td>Nilai wajar model</td><td class="num">Rp6.174,41</td></tr>
        <tr><td>MoS = (FV − Harga) ÷ FV</td><td class="num">38,6%</td></tr>
        <tr><td>Modal 10 lot = 1.000 × Rp3.790</td><td class="num">Rp3.790.000</td></tr>
        <tr><td>Dividen 10 lot = 1.000 × Rp476,96</td><td class="num">Rp476.960</td></tr>
        <tr><td>Yield on cost = Rp476.960 ÷ Rp3.790.000</td><td class="num">12,58%</td></tr>
        <tr><td>Potensi ke nilai wajar = 1.000 × (6.174,41 − 3.790)</td><td class="num">Rp2.384.410</td></tr>
      </tbody>
    </table></div>
    <p class="small muted mt-2">Angka sebelum pajak, fee, dan perubahan harga. MoS positif bukan jaminan harga naik;
    ini hanya ilustrasi cara memakai istilah di kamus.</p>
  </div>

  <div class="card mt-3">
    <h3>Profitabilitas dan risiko</h3>
    <div class="table-wrap mt-2"><table class="data">
      <thead><tr><th>Istilah</th><th>Arti</th><th>Rumus</th></tr></thead>
      <tbody>
        <tr><td><b>ROE</b></td><td>Return on equity</td><td class="mono">Laba bersih ÷ Ekuitas</td></tr>
        <tr><td><b>ROA</b></td><td>Return on assets</td><td class="mono">Laba bersih ÷ Total aset</td></tr>
        <tr><td><b>PM</b></td><td>Profit margin</td><td class="mono">Laba bersih ÷ Pendapatan</td></tr>
        <tr><td><b>OM</b></td><td>Operating margin</td><td class="mono">Laba operasi ÷ Pendapatan</td></tr>
        <tr><td><b>DER</b></td><td>Debt to equity</td><td class="mono">Total utang ÷ Ekuitas</td></tr>
        <tr><td><b>CR</b></td><td>Current ratio</td><td class="mono">Aset lancar ÷ Liabilitas jangka pendek</td></tr>
        <tr><td><b>ICR</b></td><td>Interest coverage</td><td class="mono">EBIT ÷ Beban bunga</td></tr>
        <tr><td><b>EV/EBITDA</b></td><td>Valuasi enterprise</td><td class="mono">(Market cap + Utang − Kas) ÷ EBITDA</td></tr>
        <tr><td><b>FCF</b></td><td>Free cash flow</td><td class="mono">Arus kas operasi − Capex</td></tr>
      </tbody>
    </table></div>
  </div>

  <div class="card mt-3">
    <h3>Teknikal</h3>
    <ul class="help-list">
      <li><b>MA20/50/200</b> — rata-rata harga 20/50/200 sesi.</li>
      <li><b>RSI14</b> — 0–100; di bawah 30 oversold, di atas 70 overbought.</li>
      <li><b>MACD</b> — EMA12 − EMA26; signal EMA9; histogram selisihnya.</li>
      <li><b>ATR</b> — rata-rata rentang harga; ATR % = ATR ÷ harga.</li>
      <li><b>DISTMA</b> — (harga ÷ MA − 1) × 100%.</li>
      <li><b>HI/LO52</b> — harga tertinggi/terendah 52 minggu.</li>
    </ul>
  </div>

  <div class="card mt-3">
    <h3>Skor dan portofolio</h3>
    <p>Skor total 0–100 dari enam faktor 0–10: Fundamental 20%, Valuasi 20%, Dividen 25%,
    Teknikal 10%, Risiko 15%, Prospek 10%.</p>
    <ul class="help-list">
      <li><b>Rating</b> — Menarik / Netral / Kurang menarik (kategori analis).</li>
      <li><b>Keputusan</b> — Buy / Buy bertahap / Hold / Wait and See.</li>
      <li><b>Bintang</b> — keyakinan 1–5, bukan hasil rumus.</li>
      <li><b>Lot</b> — 1 lot = 100 lembar.</li>
      <li><b>Yield on cost</b> — dividen tahunan ÷ modal.</li>
    </ul>
  </div>`;
}

function faq() {
  const items = [
    ["Kenapa ada data yang kosong (—)?", "Field tersebut belum tersedia di Excel. Untuk emiten baru, ROA/DER/EV/EBITDA dan skor faktor sering belum ada. Lengkapi di sheet Data Keuangan/Skor lalu upload ulang."],
    ["Kenapa upload Excel gagal?", "Pastikan file .xlsx, sheet dan header tidak diubah, serta kolom KODE/TAHUN/PERIODE terisi. Cek pesan error di toast."],
    ["Kenapa harga berbeda dengan aplikasi lain?", "Harga berasal dari Yahoo Finance dan dapat delayed. Cron berjalan hari kerja pukul 17.15 WIB; admin juga dapat menekan Update harga (Yahoo)."],
    ["Apakah admin bisa mengubah portofolio user?", "Tidak. Admin hanya dapat melihat semua portofolio. Transaksi hanya dapat diubah user pemilik akun."],
    ["Bagaimana mengganti password?", "Klik ikon kunci di kanan atas, masukkan password lama dan password baru."],
    ["Apakah aplikasi bisa dipakai offline?", "App shell dapat dibuka offline, tetapi data D1 dan login memerlukan internet."],
    ["Kenapa radar skor 0/10?", "Skor faktor belum diisi. Aplikasi versi terbaru menampilkan 'Skor faktor belum tersedia', bukan 0."],
    ["Kenapa analisis tanggalnya berbeda dengan harga?", "Tanggal analisis berasal dari workbook; harga dapat diperbarui otomatis setelahnya."],
    ["Bagaimana membuat akun user?", "Admin membuka Pengguna → Tambah pengguna, mengisi role, password awal, dan masa berlaku."],
  ];
  return `<div class="card">
    ${items.map(([q, a]) => `<details class="faq">
      <summary>${q}</summary>
      <p>${a}</p>
    </details>`).join("")}
  </div>`;
}

export function renderHelp(section = "manual") {
  const active = ["manual", "kamus", "faq"].includes(section) ? section : "manual";
  const content = active === "kamus" ? kamus() : active === "faq" ? faq() : manual();
  return `
  <div class="section-head">
    <div>
      <h2>Pusat Bantuan</h2>
      <p>Manual penggunaan, istilah saham, dan pertanyaan yang sering muncul.</p>
    </div>
  </div>
  ${tabs(active)}
  <div class="mt-3">${content}</div>`;
}
