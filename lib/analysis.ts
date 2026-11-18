import type { CompanyModel } from "./parse";

export type Tone = "ok" | "warn" | "bad" | "none";
export type Fmt = "x" | "pct" | "days" | "rp" | "months";

export interface Indicator {
  key: string;
  label: string;
  hint: string;
  fmt: Fmt;
  group:
    | "Likuiditas"
    | "Solvabilitas"
    | "Profitabilitas"
    | "Utang & piutang"
    | "Kas & modal kerja"
    | "EBITDA, bunga & biaya"
    | "Pajak"
    | "Antar entitas (pihak berelasi)";
  values: (number | null)[]; // per bulan aktif (urut m.activeMonths)
  tone: Tone; // penilaian bulan terakhir
}

const div = (a: number, b: number): number | null => (Math.abs(b) < 1 ? null : a / b);
const DAYS = (label: string) => {
  // "Sep-26" -> jumlah hari bulan itu
  const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const [m, y] = label.split("-");
  const mi = MON.indexOf(m);
  return mi < 0 ? 30 : new Date(2000 + Number(y), mi + 1, 0).getDate();
};

/** Tinggi = bagus. */
const high = (v: number | null, ok: number, warn: number): Tone =>
  v === null ? "none" : v >= ok ? "ok" : v >= warn ? "warn" : "bad";
/** Rendah = bagus. */
const low = (v: number | null, ok: number, warn: number): Tone =>
  v === null ? "none" : v <= ok ? "ok" : v <= warn ? "warn" : "bad";

export function buildIndicators(m: CompanyModel): Indicator[] {
  const act = m.activeMonths;
  if (!act.length || m.source !== "tb") return [];
  const pl = m.pl;
  let cumNet = 0;
  const cum: Record<number, number> = {};
  for (let i = 0; i < m.months.length; i++) {
    cumNet += pl.netProfit.m[i];
    cum[i] = cumNet;
  }

  const per = (f: (i: number) => number | null) => act.map((i) => f(i));
  const bs = (i: number) => m.bs.perMonth[i];
  const cl = (i: number) => bs(i).currentLiabilities ?? bs(i).liabilities;
  const cost = (i: number) => pl.cogs.m[i] + pl.opex.m[i];

  const out: Indicator[] = [];
  const add = (
    group: Indicator["group"],
    key: string,
    label: string,
    hint: string,
    fmt: Fmt,
    f: (i: number) => number | null,
    tone: (v: number | null) => Tone
  ) => {
    const values = per(f);
    out.push({ key, label, hint, fmt, group, values, tone: tone(values[values.length - 1] ?? null) });
  };

  add("Likuiditas", "cr", "Rasio lancar", "Aset lancar ÷ liabilitas jangka pendek. Aman ≥ 1,5x", "x",
    (i) => (cl(i) > 0 ? div(bs(i).currentAssets, cl(i)) : null), (v) => high(v, 1.5, 1));
  add("Likuiditas", "qr", "Rasio cepat", "(Kas + piutang usaha) ÷ liabilitas jangka pendek. Aman ≥ 1x", "x",
    (i) => (cl(i) > 0 ? div(bs(i).cash + bs(i).receivables, cl(i)) : null), (v) => high(v, 1, 0.5));
  add("Likuiditas", "cash", "Rasio kas", "Kas ÷ liabilitas jangka pendek. Aman ≥ 0,2x", "x",
    (i) => (cl(i) > 0 ? div(bs(i).cash, cl(i)) : null), (v) => high(v, 0.2, 0.1));
  add("Likuiditas", "wc", "Modal kerja", "Aset lancar − liabilitas jangka pendek", "rp",
    (i) => bs(i).currentAssets - cl(i), (v) => (v === null ? "none" : v >= 0 ? "ok" : "bad"));

  add("Solvabilitas", "der", "Debt to equity", "Total liabilitas ÷ ekuitas. Aman ≤ 1x (ekuitas negatif = bahaya)", "x",
    (i) => (bs(i).equity <= 0 ? null : div(bs(i).liabilities, bs(i).equity)),
    (v) => (v === null ? "bad" : low(v, 1, 2)));
  add("Solvabilitas", "dar", "Debt ratio", "Total liabilitas ÷ total aset. Aman ≤ 50%", "pct",
    (i) => div(bs(i).liabilities, bs(i).totalAssets), (v) => low(v, 0.5, 0.8));

  add("Profitabilitas", "gpm", "Gross margin", "Laba bruto ÷ pendapatan neto bulan itu", "pct",
    (i) => div(pl.grossProfit.m[i], pl.revenue.m[i]), (v) => high(v, 0.3, 0.15));
  add("Profitabilitas", "opm", "Operating margin", "Laba usaha ÷ pendapatan neto bulan itu", "pct",
    (i) => div(pl.operatingProfit.m[i], pl.revenue.m[i]), (v) => high(v, 0.1, 0));
  add("Profitabilitas", "npm", "Net margin", "Laba bersih ÷ pendapatan neto bulan itu", "pct",
    (i) => div(pl.netProfit.m[i], pl.revenue.m[i]), (v) => high(v, 0.1, 0));
  add("Profitabilitas", "roa", "ROA (kumulatif)", "Laba bersih sejak awal periode ÷ total aset (tidak disetahunkan)", "pct",
    (i) => div(cum[i], bs(i).totalAssets), (v) => high(v, 0.05, 0));
  add("Profitabilitas", "roe", "ROE (kumulatif)", "Laba bersih sejak awal periode ÷ ekuitas (tidak disetahunkan)", "pct",
    (i) => (bs(i).equity <= 0 ? null : div(cum[i], bs(i).equity)), (v) => high(v, 0.1, 0));

  add("Utang & piutang", "ar", "Saldo piutang usaha", "Piutang usaha akhir bulan", "rp",
    (i) => bs(i).receivables, () => "none");
  add("Utang & piutang", "ap", "Saldo utang usaha", "Utang usaha akhir bulan", "rp",
    (i) => bs(i).payables ?? null, () => "none");
  add("Utang & piutang", "dso", "Umur piutang (DSO)", "Piutang akhir ÷ pendapatan bulan itu × jumlah hari. Aman ≤ 45 hari", "days",
    (i) => {
      const r = div(bs(i).receivables, pl.revenue.m[i]);
      return r === null ? null : r * DAYS(m.months[i]);
    }, (v) => low(v, 45, 90));
  add("Utang & piutang", "dpo", "Umur utang (DPO)", "Utang usaha akhir ÷ (beban pokok + usaha) bulan itu × jumlah hari (estimasi)", "days",
    (i) => {
      const r = div(bs(i).payables ?? 0, cost(i));
      return r === null ? null : r * DAYS(m.months[i]);
    }, () => "none");
  add("Utang & piutang", "arap", "Piutang ÷ utang usaha", "Di atas 1x berarti tagihan ke pelanggan lebih besar dari tagihan pemasok", "x",
    (i) => div(bs(i).receivables, bs(i).payables ?? 0), () => "none");
  add("Utang & piutang", "net", "Posisi piutang − utang", "Piutang usaha dikurangi utang usaha", "rp",
    (i) => bs(i).receivables - (bs(i).payables ?? 0), (v) => (v === null ? "none" : v >= 0 ? "ok" : "warn"));

  const c = m.cfo;
  if (c) {
    const days = (i: number) => DAYS(m.months[i]);
    const nz = (v: number | null, f: (x: number) => number) => (v === null ? null : f(v));
    const burn3 = (i: number) => {
      // rata-rata kas bersih keluar 3 bulan aktif terakhir sampai bulan i (positif = kas turun)
      const idx = act.filter((k) => k <= i).slice(-3);
      return idx.length ? idx.reduce((s, k) => s - m.cf.netChange.m[k], 0) / idx.length : 0;
    };
    const dso = (i: number) => {
      const r = div(bs(i).receivables, pl.revenue.m[i]);
      return r === null ? null : r * days(i);
    };
    const dio = (i: number) => {
      const inv = bs(i).inventory ?? 0;
      if (Math.abs(inv) < 1) return 0;
      const r = div(inv, pl.cogs.m[i]);
      return r === null ? null : r * days(i);
    };
    const dpo = (i: number) => {
      const r = div(bs(i).payables ?? 0, cost(i));
      return r === null ? null : r * days(i);
    };
    let cumOcf = 0;
    const cumOcfAt: Record<number, number> = {};
    for (let i = 0; i < m.months.length; i++) {
      cumOcf += m.cf.operating.m[i];
      cumOcfAt[i] = cumOcf;
    }
    let cumRev = 0;
    const cumRevAt: Record<number, number> = {};
    for (let i = 0; i < m.months.length; i++) {
      cumRev += pl.revenueGross.m[i];
      cumRevAt[i] = cumRev;
    }
    const ebitda = (i: number) => pl.operatingProfit.m[i] + c.dep[i];

    add("Kas & modal kerja", "burn", "Burn kas bersih", "Kas bersih keluar per bulan (negatif = kas bertambah)", "rp",
      (i) => -m.cf.netChange.m[i], () => "none");
    add("Kas & modal kerja", "runway", "Runway kas", "Kas ÷ rata-rata burn 3 bulan terakhir. Aman ≥ 6 bulan, ≥ 3 bulan waspada", "months",
      (i) => (bs(i).cash <= 0 ? 0 : burn3(i) <= 0 ? 999 : bs(i).cash / burn3(i)), (v) => high(v, 6, 3));
    add("Kas & modal kerja", "ocf", "Arus kas operasi", "Laba bersih disesuaikan perubahan modal kerja (metode tidak langsung)", "rp",
      (i) => m.cf.operating.m[i], (v) => (v === null ? "none" : v >= 0 ? "ok" : "warn"));
    add("Kas & modal kerja", "fcf", "Free cash flow", "Arus kas operasi + arus kas investasi", "rp",
      (i) => m.cf.operating.m[i] + m.cf.investing.m[i], (v) => (v === null ? "none" : v >= 0 ? "ok" : "warn"));
    add("Kas & modal kerja", "conv", "Konversi kas (kumulatif)", "Arus kas operasi ÷ laba bersih sejak awal periode. Aman ≥ 80%; kosong bila laba kumulatif ≤ 0", "pct",
      (i) => (cum[i] > 0 ? div(cumOcfAt[i], cum[i]) : null), (v) => high(v, 0.8, 0.5));
    add("Kas & modal kerja", "dio", "Umur persediaan (DIO)", "Persediaan ÷ beban pokok × jumlah hari", "days", dio, () => "none");
    add("Kas & modal kerja", "ccc", "Siklus konversi kas (CCC)", "DSO + DIO − DPO. Makin pendek makin baik; negatif berarti pemasok membiayai operasional", "days",
      (i) => {
        const a = dso(i);
        const b = dio(i);
        const d = dpo(i);
        return a === null || b === null ? null : a + b - (d ?? 0);
      }, (v) => low(v, 45, 90));

    add("EBITDA, bunga & biaya", "ebitda", "EBITDA", "Laba usaha + penyusutan & amortisasi", "rp", ebitda,
      (v) => (v === null ? "none" : v >= 0 ? "ok" : "bad"));
    add("EBITDA, bunga & biaya", "ebitdam", "Margin EBITDA", "EBITDA ÷ pendapatan neto bulan itu. Aman ≥ 15%", "pct",
      (i) => div(ebitda(i), pl.revenue.m[i]), (v) => high(v, 0.15, 0));
    add("EBITDA, bunga & biaya", "int", "Beban bunga", "Beban keuangan (bunga bank, sewa, antar perusahaan)", "rp",
      (i) => c.interest[i], () => "none");
    add("EBITDA, bunga & biaya", "icr", "Cakupan bunga", "EBITDA ÷ beban bunga. Aman ≥ 3x; kosong bila tidak ada bunga", "x",
      (i) => (c.interest[i] > 1 ? div(ebitda(i), c.interest[i]) : null), (v) => (v === null ? "none" : high(v, 3, 1.5)));
    add("EBITDA, bunga & biaya", "payroll", "Beban gaji ÷ pendapatan", "Beban karyawan + tenaga kerja langsung ÷ pendapatan neto. Wajar ≤ 40% untuk jasa", "pct",
      (i) => div(c.payroll[i], pl.revenue.m[i]), (v) => low(v, 0.4, 0.6));
    add("EBITDA, bunga & biaya", "bep", "Titik impas pendapatan", "Beban usaha ÷ gross margin bulan itu (beban usaha dianggap tetap)", "rp",
      (i) => {
        const gm = div(pl.grossProfit.m[i], pl.revenue.m[i]);
        return gm === null || gm <= 0.01 ? null : pl.opex.m[i] / gm;
      }, () => "none");
    add("EBITDA, bunga & biaya", "mos", "Pendapatan ÷ titik impas", "Di atas 1x berarti sudah melewati titik impas", "x",
      (i) => {
        const gm = div(pl.grossProfit.m[i], pl.revenue.m[i]);
        return gm === null || gm <= 0.01 || pl.opex.m[i] < 1 ? null : pl.revenue.m[i] / (pl.opex.m[i] / gm);
      }, (v) => high(v, 1.2, 1));

    add("Pajak", "taxpre", "Pajak dibayar dimuka", "PPN masukan + PPh dibayar dimuka (aset)", "rp", (i) => c.taxPrepaid[i], () => "none");
    add("Pajak", "taxpay", "Utang pajak", "PPN keluaran + utang PPh + pajak lainnya (liabilitas)", "rp", (i) => c.taxPayable[i], () => "none");
    add("Pajak", "taxnet", "Posisi pajak bersih", "Utang pajak − pajak dibayar dimuka (positif = kurang bayar)", "rp",
      (i) => c.taxPayable[i] - c.taxPrepaid[i], () => "none");
    add("Pajak", "pkp", "Omzet ÷ batas Rp 4,8 M", "Omzet bruto kumulatif sejak awal periode ÷ Rp 4,8 miliar (batas PKP dan PPh final UMKM). Konfirmasi ke konsultan pajak", "pct",
      (i) => cumRevAt[i] / 4.8e9, (v) => low(v, 0.75, 0.95));

    add("Antar entitas (pihak berelasi)", "relrec", "Piutang pihak berelasi", "Termasuk antar perusahaan (IC), pemegang saham, dan usaha berelasi", "rp",
      (i) => c.relRec[i], () => "none");
    add("Antar entitas (pihak berelasi)", "relpay", "Utang pihak berelasi", "Termasuk antar perusahaan (IC), pemegang saham, dan usaha berelasi", "rp",
      (i) => c.relPay[i], () => "none");
    add("Antar entitas (pihak berelasi)", "relnet", "Posisi bersih berelasi", "Piutang − utang pihak berelasi (positif = entitas ini menalangi pihak lain)", "rp",
      (i) => c.relRec[i] - c.relPay[i], () => "none");
    add("Antar entitas (pihak berelasi)", "icrev", "Pendapatan antar perusahaan", "Pendapatan dari entitas lain dalam grup", "rp",
      (i) => c.icRev[i], () => "none");
    add("Antar entitas (pihak berelasi)", "iccost", "Beban antar perusahaan", "Beban pokok dan beban usaha ke entitas lain dalam grup", "rp",
      (i) => c.icCost[i], () => "none");
    void nz;
  }

  return out;
}

/** Runway kas bulan laporan: kas ÷ rata-rata burn 3 bulan aktif terakhir. */
export function runwayOf(m: CompanyModel): { cash: number; burn: number; months: number | null; state: "negatif" | "aman" | "terbatas" } | null {
  if (m.source !== "tb" || m.reportIdx < 0) return null;
  const idx = m.activeMonths.slice(-3);
  const burn = idx.reduce((s, k) => s - m.cf.netChange.m[k], 0) / idx.length;
  const cash = m.bs.current.cash;
  if (cash <= 0) return { cash, burn, months: 0, state: "negatif" };
  if (burn <= 0) return { cash, burn, months: null, state: "aman" };
  return { cash, burn, months: cash / burn, state: "terbatas" };
}

export function fmtValue(v: number | null, f: Fmt): string {
  if (v === null || !isFinite(v)) return "–";
  if (Math.abs(v) < 1e-9) v = 0; // hindari "-0"
  const nf = (d: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: d });
  if (f === "x") return nf(2).format(v) + "x";
  if (f === "pct") return nf(1).format(v * 100) + "%";
  if (f === "months") return v >= 999 ? "Aman" : nf(1).format(v) + " bln";
  if (f === "days") return nf(0).format(Math.abs(v) < 0.5 ? 0 : v) + " hari";
  const a = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (a >= 1e9) return `${s}${nf(2).format(a / 1e9)} M`;
  if (a >= 1e6) return `${s}${nf(1).format(a / 1e6)} jt`;
  if (a >= 1e3) return `${s}${nf(0).format(a / 1e3)} rb`;
  return `${s}${nf(0).format(a)}`;
}
