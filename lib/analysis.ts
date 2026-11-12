import type { CompanyModel } from "./parse";

export type Tone = "ok" | "warn" | "bad" | "none";
export type Fmt = "x" | "pct" | "days" | "rp";

export interface Indicator {
  key: string;
  label: string;
  hint: string;
  fmt: Fmt;
  group: "Likuiditas" | "Solvabilitas" | "Profitabilitas" | "Utang & piutang";
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
    (i) => div(bs(i).currentAssets, cl(i)), (v) => high(v, 1.5, 1));
  add("Likuiditas", "qr", "Rasio cepat", "(Kas + piutang usaha) ÷ liabilitas jangka pendek. Aman ≥ 1x", "x",
    (i) => div(bs(i).cash + bs(i).receivables, cl(i)), (v) => high(v, 1, 0.5));
  add("Likuiditas", "cash", "Rasio kas", "Kas ÷ liabilitas jangka pendek. Aman ≥ 0,2x", "x",
    (i) => div(bs(i).cash, cl(i)), (v) => high(v, 0.2, 0.1));
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

  return out;
}

export function fmtValue(v: number | null, f: Fmt): string {
  if (v === null || !isFinite(v)) return "–";
  if (Math.abs(v) < 1e-9) v = 0; // hindari "-0"
  const nf = (d: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: d });
  if (f === "x") return nf(2).format(v) + "x";
  if (f === "pct") return nf(1).format(v * 100) + "%";
  if (f === "days") return nf(0).format(Math.abs(v) < 0.5 ? 0 : v) + " hari";
  const a = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (a >= 1e9) return `${s}${nf(2).format(a / 1e9)} M`;
  if (a >= 1e6) return `${s}${nf(1).format(a / 1e6)} jt`;
  if (a >= 1e3) return `${s}${nf(0).format(a / 1e3)} rb`;
  return `${s}${nf(0).format(a)}`;
}
