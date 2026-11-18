import type { CompanyModel } from "./parse";
import { runwayOf } from "./analysis";
import { rpShort } from "./format";

export type AlertLevel = "bad" | "warn" | "info";
export interface Alert {
  level: AlertLevel;
  area: "Kas" | "Ekuitas" | "Kinerja" | "Piutang" | "Pajak" | "Data" | "Jurnal" | "Konsentrasi";
  title: string;
  detail: string;
}

const ORDER: Record<AlertLevel, number> = { bad: 0, warn: 1, info: 2 };
const pctS = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v * 100) + "%";
const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
void MON;

/** Peringatan dini dari TB dan Entry Jurnal. Ambang batas sengaja konservatif; sesuaikan di sini. */
export function buildAlerts(m: CompanyModel): Alert[] {
  const out: Alert[] = [];
  if (m.source !== "tb" || m.reportIdx < 0) return out;
  const i = m.reportIdx;
  const bs = m.bs.current;
  const pl = m.pl;
  const add = (level: AlertLevel, area: Alert["area"], title: string, detail: string) =>
    out.push({ level, area, title, detail });

  // ---- data dan kontrol ----
  for (const c of m.controls) {
    if (!c.ok) add("bad", "Data", `Kontrol gagal: ${c.label}`, c.note ?? `Selisih terbesar ${rpShort(c.maxAbs)}. Angka laporan belum bisa dipercaya penuh.`);
  }
  const q = m.quality;
  if (q?.openingZero) {
    add("warn", "Data", "Saldo awal TB masih nol", "Semua saldo awal akun neraca nol. Wajar untuk entitas yang baru berdiri; kalau bukan, kas, ekuitas, dan rasio neraca belum mencerminkan posisi sebenarnya, jadi isi saldo awal di TB.");
  }
  if (q && q.abnormal.length) {
    const top = q.abnormal.slice(0, 3).map((a) => `${a.name} (${rpShort(a.bal)})`).join("; ");
    add("warn", "Data", `${q.abnormal.length} akun neraca bersaldo tidak wajar`, `Aset bersaldo kredit atau liabilitas bersaldo debit: ${top}${q.abnormal.length > 3 ? ", dan lainnya" : ""}. Biasanya salah akun, salah arah jurnal, atau pembayaran melebihi tagihan.`);
  }
  if (q?.emptyMonths.length) {
    add("warn", "Data", `Bulan tanpa transaksi: ${q.emptyMonths.join(", ")}`, "Ada bulan kosong di antara bulan yang berisi transaksi. Pastikan jurnal bulan itu belum terlewat.");
  }

  // ---- kas dan ekuitas ----
  if (bs.cash <= 0) add("bad", "Kas", `Kas ${bs.cash < 0 ? "negatif" : "nol"} (${rpShort(bs.cash)})`, "Saldo kas dan setara kas tidak positif di bulan laporan. Cek pencatatan bank atau saldo awal.");
  const rw = runwayOf(m);
  if (rw && rw.state === "terbatas" && rw.months !== null) {
    if (rw.months < 3) add("bad", "Kas", `Runway kas ${rw.months.toFixed(1)} bulan`, `Kas ${rpShort(rw.cash)} dengan burn rata-rata ${rpShort(rw.burn)} per bulan (3 bulan terakhir).`);
    else if (rw.months < 6) add("warn", "Kas", `Runway kas ${rw.months.toFixed(1)} bulan`, `Kas ${rpShort(rw.cash)} dengan burn rata-rata ${rpShort(rw.burn)} per bulan.`);
  }
  if (bs.equity < 0) add("bad", "Ekuitas", `Ekuitas negatif (${rpShort(bs.equity)})`, "Kerugian kumulatif sudah melebihi modal. Perlu suntikan modal atau restrukturisasi utang.");
  const cl = bs.currentLiabilities ?? bs.liabilities;
  if (cl > 0 && bs.currentAssets / cl < 1) {
    add("bad", "Kas", `Rasio lancar ${(bs.currentAssets / cl).toFixed(2)}x`, `Aset lancar ${rpShort(bs.currentAssets)} lebih kecil dari liabilitas jangka pendek ${rpShort(cl)}.`);
  }

  // ---- kinerja ----
  const am = m.activeMonths;
  if (am.length >= 2) {
    const prev = am[am.length - 2];
    const r0 = pl.revenue.m[prev];
    const r1 = pl.revenue.m[i];
    if (r0 > 0 && r1 < r0 * 0.7) add("warn", "Kinerja", `Pendapatan turun ${pctS(1 - r1 / r0)} dari bulan lalu`, `${m.months[prev]}: ${rpShort(r0)} menjadi ${m.months[i]}: ${rpShort(r1)}.`);
  }
  let lossStreak = 0;
  for (let k = am.length - 1; k >= 0 && pl.netProfit.m[am[k]] < 0; k--) lossStreak++;
  if (lossStreak >= 2) add("warn", "Kinerja", `Rugi bersih ${lossStreak} bulan berturut-turut`, `Sampai ${m.months[i]}, laba bersih kumulatif ${rpShort(pl.netProfit.ytd)}.`);
  else if (pl.netProfit.ytd < 0) add("info", "Kinerja", `Laba bersih kumulatif negatif (${rpShort(pl.netProfit.ytd)})`, "Bulan terakhir tidak rugi, tetapi akumulasi sejak awal periode masih rugi.");

  // ---- piutang, pajak ----
  const last3 = am.slice(-3);
  const rev3 = last3.reduce((s, k) => s + pl.revenue.m[k], 0) / (last3.length || 1); // rata-rata 3 bulan, supaya bulan sepi tidak menggelembungkan DSO
  if (rev3 > 0 && bs.receivables > 0) {
    const dso = (bs.receivables / rev3) * 30;
    if (dso > 90) add("warn", "Piutang", `Umur piutang sekitar ${Math.round(dso)} hari`, `Piutang ${rpShort(bs.receivables)} setara lebih dari 3 bulan penjualan (rata-rata 3 bulan terakhir). Tagih atau periksa piutang macet.`);
  }
  if (m.cfo) {
    const c = m.cfo;
    const used = pl.revenueGross.ytd / 4.8e9;
    if (used >= 0.95) add("bad", "Pajak", `Omzet ${pctS(used)} dari batas Rp 4,8 M`, "Hampir atau sudah melewati batas PKP dan PPh final UMKM. Konfirmasi status pajak ke konsultan.");
    else if (used >= 0.75) add("warn", "Pajak", `Omzet ${pctS(used)} dari batas Rp 4,8 M`, "Mendekati batas PKP dan PPh final UMKM. Siapkan rencana pajak.");
    if (bs.totalAssets > 0 && c.relRec[i] / bs.totalAssets > 0.2) {
      add("warn", "Piutang", `Piutang pihak berelasi ${pctS(c.relRec[i] / bs.totalAssets)} dari total aset`, `${rpShort(c.relRec[i])} tertahan di pemegang saham atau entitas grup, tidak tersedia sebagai kas.`);
    }
  }

  // ---- jurnal ----
  const j = m.journal;
  if (j) {
    if (j.noDesc) add("info", "Jurnal", `${j.noDesc} baris jurnal tanpa keterangan`, "Sulit diaudit dan konsentrasi pelanggan tidak terbaca. Lengkapi kolom Keterangan.");
    if (j.dupes?.length) {
      const d = j.dupes[0];
      add("warn", "Jurnal", `${j.dupes.length} kelompok jurnal tampak ganda`, `Contoh: "${d.desc}" ${rpShort(d.amount)} tanggal ${d.date}, tercatat ${d.count} kali. Bisa sah (transaksi berulang), tetapi perlu dicek.`);
    }
    if (j.futureDated) add("warn", "Jurnal", `${j.futureDated} baris jurnal bertanggal di masa depan`, "Kemungkinan salah ketik tanggal atau tahun.");
    const rc = j.revConc;
    if (rc && rc.total > 0 && rc.top.length) {
      const t1 = rc.top[0].value / rc.total;
      const t3 = rc.top.slice(0, 3).reduce((s, x) => s + x.value, 0) / rc.total;
      if (t1 <= 0.5 && t3 > 0.9 && rc.count > 3) add("warn", "Konsentrasi", `3 sumber = ${pctS(t3)} pendapatan`, `${rc.top.slice(0, 3).map((x) => x.name).join(", ")}. Ketergantungan tinggi pada sedikit pelanggan.`);
      if (t1 > 0.5 && rc.count > 1) add("warn", "Konsentrasi", `${pctS(t1)} pendapatan dari satu sumber`, `"${rc.top[0].name}" menyumbang ${rpShort(rc.top[0].value)} dari ${rpShort(rc.total)}. Kehilangan sumber ini berdampak besar.`);
    }
  }

  return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}

export const countAlerts = (a: Alert[]) => ({
  bad: a.filter((x) => x.level === "bad").length,
  warn: a.filter((x) => x.level === "warn").length,
  info: a.filter((x) => x.level === "info").length,
});
