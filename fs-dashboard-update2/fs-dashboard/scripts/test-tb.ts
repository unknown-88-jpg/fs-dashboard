// Uji mesin TB+Jurnal: npx tsx scripts/test-tb.ts <dir berisi tb.csv, ej.csv, ref.json>
import { readFileSync } from "node:fs";
import { parseCsv } from "../lib/csv";
import { buildModelFromTB } from "../lib/tb";

const dir = process.argv[2];
const m = buildModelFromTB(
  parseCsv(readFileSync(`${dir}/tb.csv`, "utf8")),
  parseCsv(readFileSync(`${dir}/ej.csv`, "utf8"))
);
const ref = JSON.parse(readFileSync(`${dir}/ref.json`, "utf8"));
console.log("months", m.months.join(" "), "| active", m.activeMonths, "| report", m.reportLabel, "| source", m.source);

let bad = 0;
function cmp(name: string, got: number[], want: number[], tol = 60) {
  // want: 8 bulan + YTD (9 nilai)
  const g = [...got, got.reduce((a, b) => a + b, 0)];
  const ok = want.every((w, i) => Math.abs((g[i] ?? 0) - w) <= tol);
  if (!ok) bad++;
  console.log(ok ? "OK  " : "BEDA", name.padEnd(28), ok ? "" : `\n   got  ${g.map(Math.round)}\n   want ${want.map(Math.round)}`);
}
const p = m.pl;
const R = ref.PL;
cmp("Pendapatan bruto", p.revenueGross.m, R["Jumlah Pendapatan Usaha Bruto"]);
cmp("Pendapatan neto", p.revenue.m, R["PENDAPATAN USAHA - NETO"]);
cmp("Beban pokok (neg)", p.cogs.m.map((v) => -v), R["Jumlah Beban Pokok Pendapatan"]);
cmp("Laba bruto", p.grossProfit.m, R["LABA (RUGI) BRUTO"]);
cmp("Beban usaha (neg)", p.opex.m.map((v) => -v), R["Jumlah Beban Usaha"]);
cmp("Laba usaha", p.operatingProfit.m, R["LABA (RUGI) USAHA"]);
cmp("Lain-lain", p.otherNet.m, R["Jumlah Pendapatan (Beban) Lain-lain - Neto"]);
cmp("Laba bersih", p.netProfit.m, R["LABA (RUGI) PERIODE BERJALAN"]);

// neraca: tab BS menyimpan saldo akhir bulanan, kolom ke-9 = YTD (= saldo terakhir)
const B = ref.BS;
const bsCmp = (name: string, f: (i: number) => number, want: number[]) => {
  const got = m.bs.perMonth.map((_, i) => f(i));
  cmp(name, got.slice(0, 8), [...want.slice(0, 8), got[got.length - 1]], 60);
};
// untuk neraca, "YTD" dibandingkan sebagai saldo bulan terakhir, jadi pakai cmp manual
function cmpBal(name: string, got: number[], want: number[]) {
  const ok = got.every((g, i) => Math.abs(g - want[i]) <= 60);
  if (!ok) bad++;
  console.log(ok ? "OK  " : "BEDA", name.padEnd(28), ok ? "" : `\n   got  ${got.map(Math.round)}\n   want ${want.slice(0, 8).map(Math.round)}`);
}
cmpBal("Kas", m.bs.perMonth.map((b) => b.cash), B["Kas dan setara kas"]);
cmpBal("Aset lancar", m.bs.perMonth.map((b) => b.currentAssets), B["Jumlah Aset Lancar"]);
cmpBal("Aset tidak lancar", m.bs.perMonth.map((b) => b.nonCurrentAssets), B["Jumlah Aset Tidak Lancar"]);
cmpBal("Total aset", m.bs.perMonth.map((b) => b.totalAssets), B["JUMLAH ASET"]);
cmpBal("Liabilitas", m.bs.perMonth.map((b) => b.liabilities), B["JUMLAH LIABILITAS"]);
cmpBal("Ekuitas", m.bs.perMonth.map((b) => b.equity), B["JUMLAH EKUITAS"]);

const C = ref.CF;
cmp("CF operasi", m.cf.operating.m, C["Arus Kas Bersih dari Aktivitas Operasi"]);
cmp("CF investasi", m.cf.investing.m, C["Arus Kas Bersih dari Aktivitas Investasi"]);
cmp("CF pendanaan", m.cf.financing.m, C["Arus Kas Bersih dari Aktivitas Pendanaan"]);
cmp("CF kenaikan kas", m.cf.netChange.m, C["KENAIKAN (PENURUNAN) BERSIH KAS DAN SETARA KAS"]);
console.log("kas awal/akhir", m.cf.cashBegin, m.cf.cashEnd, "(sheet akhir:", Math.round(C["KAS DAN SETARA KAS AKHIR PERIODE"][8]) + ")");

console.log("controls", m.controls.map((c) => `${c.label}: ${c.ok ? "OK" : "GAGAL"} (${Math.round(c.maxAbs)})`));
const j = m.journal!;
console.log("jurnal", { count: j.count, perMonth: j.perMonth, unposted: j.unposted });
console.log("top pendapatan", j.topRevenueParties.slice(0, 4));
console.log("top beban", j.topCostParties.slice(0, 3));
console.log("terbesar", j.largest.slice(0, 2));
console.log("revenueLines", m.revenueLines.map((l) => `${l.label}=${Math.round(l.ytd)}`));
console.log("cogsLines", m.cogsLines!.map((l) => `${l.label}=${Math.round(l.ytd)}`));
console.log("opexLines", m.opexLines.map((l) => `${l.label}=${Math.round(l.ytd)}`));
console.log(bad ? `\n${bad} PERBANDINGAN BEDA` : "\nSEMUA COCOK dengan tab PL/BS/CF");
process.exit(bad ? 1 : 0);
