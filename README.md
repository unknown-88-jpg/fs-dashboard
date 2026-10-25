# Dashboard Keuangan (Google Sheets → Vercel)

Dashboard Next.js yang baca (lewat Apps Script) sheet **PL, BS, CF, AR, AP** dari dua spreadsheet:

- PT Fuku Aksa Arta (`FUKU_SHEET_ID`)
- PT Hita Loka Manava (`HITALOKA_SHEET_ID`)

Data selalu ikut spreadsheet: tiap halaman dibuka, server ambil data terbaru dari Sheets
(di-cache 10 menit, atur lewat `SHEETS_CACHE_SECONDS`). Tombol **Refresh** buang cache langsung.
Tidak perlu cron.

## 1. Pasang Apps Script di tiap spreadsheet (tanpa Google Cloud)

Ulangi untuk **kedua** spreadsheet (FUKU dan Hitaloka):

1. Buka spreadsheet → **Extensions → Apps Script**.
2. Hapus isi editor, paste seluruh isi `apps-script/Code.gs`.
3. Ganti `TOKEN` di baris atas dengan teks acak panjang (misal 30+ karakter). Pakai token **yang sama** di kedua spreadsheet.
4. Klik **Deploy → New deployment → ikon gear → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Klik **Deploy**, izinkan akses saat diminta (Advanced → Go to ... → Allow).
6. Copy **Web app URL** (berakhiran `/exec`).

Data tidak bisa dibaca tanpa token. Script hanya mengembalikan tab PL, BS, CF, AR, AP.

> Kalau isi script diubah, deploy ulang lewat **Manage deployments → Edit → New version** supaya URL tetap sama.

## 2. Deploy ke Vercel (via GitHub)

Import repo di vercel.com/new, lalu isi Environment Variables:

| Nama | Isi |
|---|---|
| `FUKU_SCRIPT_URL` | Web app URL spreadsheet FUKU |
| `HITALOKA_SCRIPT_URL` | Web app URL spreadsheet Hitaloka |
| `SHEETS_TOKEN` | token yang sama dengan di Code.gs |
| `DASHBOARD_PASSWORD` | password login dashboard (wajib) |
| `DASHBOARD_USER` | username, default `admin` |

Setelah mengubah env, **Redeploy** supaya terbaca.

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

Tambah satu objek di `lib/companies.ts` (slug, nama, sheetId, scriptUrl dari env baru), pasang `Code.gs` di spreadsheet-nya.
Pastikan sheet punya tab `PL`, `BS`, `CF` dengan format yang sama.

## Tes parser tanpa kredensial

`npx tsx scripts/test-parse.ts file_export_fuku file_export_hitaloka`
