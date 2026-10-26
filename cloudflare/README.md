# Cloudflare D1 backend

API untuk Bursa DBF: **Cloudflare Worker + D1 (SQLite)**. Browser hanya memanggil
`/api/*`; file DBF dan nama tabel tidak pernah dikirim ke browser.

## Status resource

| Item | Nilai |
|---|---|
| Worker | `bursa-dbf-api` |
| URL | https://bursa-dbf-api.agus-asarry.workers.dev |
| D1 | `bursa-dbf` |
| Region | APAC |
| Database ID | `b1f1ec41-8415-4840-a2ff-4d3b819fc215` |
| Binding | `DB` |
| Tabel | 9 (190 baris data awal) |

## Prasyarat

```bash
node -v
npm install
npx wrangler login
```

## Terapkan skema & data

```bash
# dari folder cloudflare/
npm run db:schema
npm run db:seed
```

Seed dibuat dari DBF:

```bash
python scripts/export_seed.py
```

`seed.sql` bersifat generated dan tidak di-commit. Seed ini **tidak** menyertakan
tabel `PENGGUNA`, jadi menjalankan `npm run db:seed` tidak menimpa akun/password D1.

## Secret

Worker membutuhkan `SESSION_SECRET` (HMAC untuk token login):

```bash
npx wrangler secret put SESSION_SECRET
```

Untuk lokal, buat `.dev.vars`:

```text
SESSION_SECRET=dev-secret-yang-panjang
```

Jangan commit `.dev.vars`.

## Deploy

```bash
npm run deploy
```

## Endpoint

| Method | Path | Akses |
|---|---|---|
| GET | `/api/health` | publik |
| POST | `/api/login` | publik |
| GET | `/api/me` | login |
| POST | `/api/me/password` | login |
| GET | `/api/bootstrap` | login |
| GET/POST | `/api/transactions` | login |
| PATCH/DELETE | `/api/transactions/:id` | login (milik sendiri) |
| GET/POST | `/api/users` | ADMIN |
| PATCH | `/api/users/:id` | ADMIN |
| POST | `/api/users/:id/status` | ADMIN |
| POST | `/api/admin/prices` | ADMIN |

Contoh login (ganti `<password-admin-D1>` dengan password yang diberikan saat setup):

```bash
curl -X POST https://bursa-dbf-api.agus-asarry.workers.dev/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<password-admin-D1>"}'
```

Gunakan token:

```bash
curl https://bursa-dbf-api.agus-asarry.workers.dev/api/bootstrap \
  -H "Authorization: Bearer <token>"
```

## Keamanan

- Password di-hash **PBKDF2-SHA256 100.000 iterasi** (batas Web Crypto Workers;
  nilai 210.000 ditolak runtime).
- Token ditandatangani HMAC-SHA256, berlaku 8 jam, dan setiap request memeriksa
  ulang status/expiry user dari D1.
- Role tidak dipercaya dari token; role dibaca dari D1.
- Jangan menaruh token Cloudflare/D1 di frontend. Browser hanya memegang token login.
- D1 tetap bisa diakses lewat akun Cloudflare Anda; gunakan 2FA dan batasi akses.

## Batasan

- D1 free tier: 5 juta baris dibaca/hari, 100.000 baris ditulis/hari, 5 GB.
- Worker free tier punya batas CPU; hashing password sebaiknya diuji sebelum produksi.
- Frontend GitHub Pages memakai API ini secara default (`store.js`, `auth.js`, transaksi,
  pengguna, dan update harga). Tambahkan `?mode=dbf` untuk fallback ke DBF lokal.
