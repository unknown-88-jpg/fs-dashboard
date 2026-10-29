# Dashboard Keuangan (Google Sheets → Vercel)

Dashboard Next.js untuk tujuh entitas: **FUKU**, **Hitaloka**, **Dorma**, **Lixus PT**, **Lixus CV**, **NEC Creative**, **NEC Commercial**. Data dibaca dari dua tab tiap spreadsheet,
**TB** dan **Entry Jurnal**, lewat link *Publish to web* (CSV). Tanpa Google Cloud, tanpa Apps Script, tanpa token.

Laba rugi, neraca, dan arus kas (tidak langsung) dihitung dari mapping akun di TB
("Pos Laporan Keuangan" dan "Pos Arus Kas"). Ringkasan jurnal (penjualan/beban per keterangan, transaksi terbesar)
dihitung dari Entry Jurnal. Jumlah bulan mengikuti kolom TB (Sep-Des atau Mei-Des).

Data di-cache 10 menit (`SHEETS_CACHE_SECONDS`). Tombol **Refresh** membuang cache langsung. Tidak perlu cron.

## 1. Publish tab TB dan Entry Jurnal (per spreadsheet, dua kali)

1. Buka spreadsheet → **File → Share → Publish to web** (Bagikan → Publikasikan di web).
2. Tab **Link**. Dropdown kiri: ganti "Seluruh dokumen" jadi tab **TB**. Dropdown kanan: **Comma-separated values (.csv)**.
3. Klik **Publish**, copy link. Ulangi untuk tab **Entry Jurnal**.
4. Jangan centang "Batasi akses ke ..." (kalau dicentang, server tidak bisa membaca CSV).
5. Biarkan "Terbitkan ulang secara otomatis saat perubahan dibuat" tercentang.

Ada 14 link: TB dan Entry Jurnal untuk masing-masing dari 7 entitas.

## 2. Deploy ke Vercel (via GitHub)

Import repo di vercel.com/new, lalu isi Environment Variables:

| Nama | Isi |
|---|---|
| `FUKU_TB_CSV_URL` / `FUKU_EJ_CSV_URL` | link CSV tab TB / Entry Jurnal FUKU |
| `HITALOKA_TB_CSV_URL` / `HITALOKA_EJ_CSV_URL` | link CSV tab TB / Entry Jurnal Hitaloka |
| `DORMA_TB_CSV_URL` / `DORMA_EJ_CSV_URL` | link CSV tab TB / Entry Jurnal Dorma |
| `LIXUS_PT_TB_CSV_URL` / `LIXUS_PT_EJ_CSV_URL` | link CSV tab TB / Entry Jurnal PT Lixus |
| `LIXUS_CV_TB_CSV_URL` / `LIXUS_CV_EJ_CSV_URL` | link CSV tab TB / Entry Jurnal CV Lixus |
| `NEC_CREATIVE_TB_CSV_URL` / `NEC_CREATIVE_EJ_CSV_URL` | link CSV tab TB / Entry Jurnal NEC Creative |
| `NEC_COMMERCIAL_TB_CSV_URL` / `NEC_COMMERCIAL_EJ_CSV_URL` | link CSV tab TB / Entry Jurnal NEC Commercial |
| `DASHBOARD_PASSWORD` | password login dashboard (wajib) |
| `DASHBOARD_USER` | username, default `admin` |

Setelah mengubah env, **Redeploy** supaya terbaca.

> Production tanpa `DASHBOARD_PASSWORD` sengaja ditolak (503) supaya data keuangan tidak kebuka publik.

## Catatan penting

- Link publish-to-web bisa dibaca **siapa pun yang punya link**, tanpa login. Jangan dibagikan. Untuk menutup:
  Publish to web → "Konten yang dipublikasikan & setelan" → **Hentikan publikasi**. Publikasi ulang menghasilkan link baru.
- CSV memuat angka sesuai tampilan sheet (dibulatkan ke Rupiah), jadi selisih beberapa Rupiah bisa muncul.
- Panel "Pengecekan data" memeriksa: total mutasi TB = 0, aset = liabilitas + ekuitas, dan baris jurnal yang
  tidak terposting (akun tidak ada di COA atau tanggal di luar periode).
- Status aging AR/AP tidak lagi ditampilkan (sumbernya tab AR/AP, yang tidak dibaca).
- Dua template TB didukung: (A) kolom "Mutasi Neto Bulanan (D+ / K-)" (Dorma, FUKU) dan
  (B) empat kolom per bulan Mutasi D / Mutasi K / Saldo D / Saldo K (Hitaloka). Jangan ganti teks header
  (`*NoAkun`, `Pos Laporan Keuangan`, `Pos Arus Kas`, `Tipe`, `Laporan`) dan struktur blok bulan.

## Jalankan lokal

```bash
cp .env.example .env.local   # isi link CSV dan password
npm install
npm run dev
```

## Uji mesin tanpa Vercel

- `npx tsx scripts/try-tb.ts <folder berisi tb.csv dan ej.csv>` menampilkan ringkasan hasil hitung.
- `npx tsx scripts/test-tb.ts <folder berisi tb.csv, ej.csv, ref.json>` membandingkan dengan tab PL/BS/CF (Dorma).

## Tambah PT baru

Tambah satu objek di `lib/companies.ts` (slug, nama, prefix env), publish tab TB dan Entry Jurnal-nya,
isi `<PREFIX>_TB_CSV_URL` dan `<PREFIX>_EJ_CSV_URL`.

## Fallback Apps Script (opsional, lama)

Kalau `<PREFIX>_TB_CSV_URL` kosong tetapi `<PREFIX>_SCRIPT_URL` ada, dashboard memakai Apps Script
(`apps-script/Code.gs`) yang membaca tab PL, BS, CF, AR, AP dengan `SHEETS_TOKEN`. Tidak perlu dipakai bila semuanya CSV.
