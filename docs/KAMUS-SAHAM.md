# Kamus Saham — Istilah dan Rumus di Bursa DBF

Dokumen ini menjelaskan istilah yang muncul di aplikasi, termasuk rumus dan satuannya.
Bukan rekomendasi investasi.

## 1. Istilah harga dan valuasi

| Istilah | Arti | Rumus / catatan |
|---|---|---|
| **Harga** | Harga pasar terakhir per lembar | Dari Yahoo/Excel; satuan Rp |
| **EPS** | Earnings per share, laba per lembar | Laba bersih ÷ jumlah saham |
| **BVPS** | Book value per share, nilai buku per lembar | Ekuitas ÷ jumlah saham |
| **PE** | Price to earnings | `Harga ÷ EPS` |
| **PB** | Price to book | `Harga ÷ BVPS` |
| **DY** | Dividend yield | `DPS ÷ Harga` |
| **DPS** | Dividend per share, dividen per lembar | Dividen tunai 12 bulan terakhir |
| **Payout** | Payout ratio | `DPS ÷ EPS` |
| **FV** | Fair value, nilai wajar model | Bukan target harga pasti |
| **MoS** | Margin of safety | `(FV − Harga) ÷ FV` |
| **PE wajar** | PE acuan analis | Input per emiten |
| **PB wajar** | PB acuan model bank | `clamp((ROE − 3%) ÷ (COE − 3%), 0,20, 1,20)` |
| **DDM** | Dividend discount model | `DPS × (1+g) ÷ (COE − g)` |
| **COE** | Cost of equity | 13,5% pada model ini |
| **TTM** | Trailing twelve months | 12 bulan terakhir |

### Bobot nilai wajar

| Model | Bobot |
|---|---|
| Bank | 60% PB + 40% DDM |
| Siklikal | 60% PE + 40% PB |
| Asuransi | 50% PE + 50% DDM |
| Utilitas | 60% PE + 40% DDM |
| Umum | 45% PE + 35% DDM + 20% PB |

`g` (pertumbuhan abadi) = `min(max(ROE × (1 − payout), 0), 6%)`.

## 2. Profitabilitas dan kesehatan keuangan

| Istilah | Arti | Rumus |
|---|---|---|
| **ROE** | Return on equity | `Laba bersih ÷ Ekuitas × 100%` |
| **ROA** | Return on assets | `Laba bersih ÷ Total aset × 100%` |
| **PM** | Profit margin | `Laba bersih ÷ Pendapatan × 100%` |
| **OM** | Operating margin | `Laba operasi ÷ Pendapatan × 100%` |
| **DER** | Debt to equity ratio | `Total utang ÷ Ekuitas` |
| **CR** | Current ratio | `Aset lancar ÷ Liabilitas jangka pendek` |
| **ICR** | Interest coverage ratio | `EBIT ÷ Beban bunga` |
| **EV/EBITDA** | Enterprise value / EBITDA | `(Market cap + Utang − Kas) ÷ EBITDA` |
| **FCF** | Free cash flow | `Arus kas operasi − Capital expenditure` |
| **Market cap** | Kapitalisasi pasar | `Harga × Jumlah saham` |

Satuan: rasio memakai `x`; margin/ROE/ROA memakai `%`.

## 3. Teknikal

| Istilah | Arti |
|---|---|
| **MA20/50/200** | Moving average 20/50/200 sesi |
| **RSI14** | Relative strength index 14 sesi; <30 oversold, >70 overbought |
| **MACD** | EMA12 − EMA26 |
| **Signal** | EMA9 dari MACD |
| **Histogram** | MACD − Signal |
| **ATR** | Average true range, volatilitas harga |
| **ATR %** | `ATR ÷ Harga × 100%` |
| **HI20/LO20** | High/low 20 sesi |
| **HI52/LO52** | High/low 52 minggu |
| **CHG52** | Perubahan harga 52 minggu |
| **DISTMA20/50/200** | `(Harga ÷ MA − 1) × 100%` |
| **Volume ratio** | Volume hari ini ÷ rata-rata volume |

## 4. Skor dan rekomendasi

Skor total **0–100** dihitung dari enam faktor **0–10**:

| Faktor | Bobot |
|---|---:|
| Fundamental | 20% |
| Valuasi | 20% |
| Dividen | 25% |
| Teknikal | 10% |
| Risiko | 15% |
| Prospek | 10% |

```text
Skor total = (FUND×20% + VAL×20% + DIV×25% + TECH×10% + RISK×15% + PROS×10%) × 10
```

- **Rating**: kategori analis — Menarik / Netral / Kurang menarik.
- **Keputusan**: tindakan yang disarankan — Buy / Buy bertahap / Hold / Wait and See.
- **Bintang**: tingkat keyakinan 1–5, bukan hasil rumus otomatis.

## 5. Portofolio

| Istilah | Arti |
|---|---|
| **Lot** | 1 lot = 100 lembar |
| **Biaya rata-rata** | Total biaya beli ÷ sisa lot; termasuk fee beli |
| **Unrealized P/L** | `Nilai pasar − Modal tersisa` |
| **Realisasi** | Laba/rugi dari transaksi jual |
| **Yield on cost** | `Dividen tahunan ÷ Modal × 100%` |
| **Alokasi** | Bobot nilai posisi terhadap total portofolio |

## 6. Simulasi

| Istilah | Arti |
|---|---|
| **CAGR** | `(Nilai akhir ÷ Nilai awal)^(1/n) − 1` |
| **IRR** | Tingkat pengembalian yang membuat NPV arus kas = 0 |
| **Reinvestasi dividen** | Dividen dibelikan kembali, bukan diambil tunai |

## 7. Istilah data

| Istilah | Arti |
|---|---|
| **DBF** | Format tabel dBase III (fallback) |
| **D1** | Database SQLite Cloudflare |
| **API** | Endpoint Worker untuk membaca/menulis data |
| **PWA** | Progressive Web App, bisa dipasang di Android |
| **FY** | Fiscal year / tahun buku |
| **TTM** | 12 bulan terakhir |

## 8. Yang perlu diingat

- **Nilai wajar** adalah keluaran model dengan asumsi eksplisit, bukan jaminan harga akan naik.
- **MoS positif** berarti harga di bawah nilai wajar model, bukan sinyal beli otomatis.
- **Payout > 100%** perlu dicek terhadap arus kas dan keberlanjutan dividen.
- **ROA/DER/EV** untuk bank tidak selalu sebanding dengan nonbank.
- Data kosong ditampilkan `—`; skor faktor kosong ditampilkan “Belum tersedia”, bukan 0.
