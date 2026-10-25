# Dashboard Keuangan (Google Sheets → Vercel)

Dashboard Next.js yang baca langsung sheet **PL, BS, CF, AR, AP** dari dua spreadsheet:

- PT Fuku Aksa Arta (`FUKU_SHEET_ID`)
- PT Hita Loka Manava (`HITALOKA_SHEET_ID`)

Data selalu ikut spreadsheet: tiap halaman dibuka, server ambil data terbaru dari Sheets
(di-cache 10 menit, atur lewat `SHEETS_CACHE_SECONDS`). Tombol **Refresh** buang cache langsung.
Tidak perlu cron.

## 1. Bikin service account Google (sekali saja, ±5 menit)

1. https://console.cloud.google.com → pilih/buat project.
2. **APIs & Services → Library** → cari **Google Sheets API** → Enable.
3. **IAM & Admin → Service Accounts → Create** (nama bebas, mis. `dashboard-reader`, tanpa role).
4. Buka service account-nya → tab **Keys → Add key → JSON**. File JSON terunduh.
5. Dari JSON itu ambil `client_email` dan `private_key`.
6. Buka **kedua spreadsheet** → Share → tempel `client_email` → role **Viewer**.

## 2. Deploy ke Vercel

```bash
npm i -g vercel
cd fs-dashboard
vercel          # ikuti prompt, framework Next.js terdeteksi otomatis
```

Atau push ke GitHub lalu **Add New → Project** di vercel.com.

Isi Environment Variables (Project → Settings → Environment Variables):

| Nama | Isi |
|---|---|
| `GOOGLE_CLIENT_EMAIL` | `client_email` dari JSON |
| `GOOGLE_PRIVATE_KEY` | `private_key` dari JSON (paste apa adanya, `\n` boleh tetap tertulis) |
| `DASHBOARD_PASSWORD` | password login dashboard (wajib) |
| `DASHBOARD_USER` | username, default `admin` |
| `FUKU_SHEET_ID`, `HITALOKA_SHEET_ID` | opsional, sudah ada default dari link yang dikasih |

Lalu `vercel --prod` (atau Redeploy) supaya env terbaca.

> Production tanpa `DASHBOARD_PASSWORD` sengaja ditolak (503) supaya data keuangan tidak kebuka publik.

## 3. Jalankan lokal

```bash
cp .env.example .env.local   # isi kredensial
npm install
npm run dev
```

## Cara kerja parser (`lib/parse.ts`)

- Baris dicari lewat **label** (mis. "LABA (RUGI) PERIODE BERJALAN"), kolom lewat **header bulan**
  (Sep-26, Okt-26, ...). Aman kalau lu nyisipin baris, tapi **jangan ganti teks label** di PL/BS/CF.
- Bulan "aktif" = bulan yang ada angka P&L-nya. Kartu KPI pakai bulan aktif terakhir.
- Status AR/AP dan kontrol (selisih 0) dibaca dari sheet dan ditampilkan di panel "Pengecekan data".
- Struktur kolom dibatasi Sep–Des 2026 (4 bulan). Kalau template tahun depan beda, ubah `MONTH_LABELS`
  dan `monthKey()` di `lib/parse.ts`.

## Tambah PT baru

Tambah satu objek di `lib/companies.ts` (slug, nama, sheetId), share spreadsheet-nya ke service account.
Pastikan sheet punya tab `PL`, `BS`, `CF` dengan format yang sama.

## Tes parser tanpa kredensial

`npx tsx scripts/test-parse.ts file_export_fuku file_export_hitaloka`
