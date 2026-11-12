"use client";

import { useMemo, useState } from "react";
import type { DailyRow } from "@/lib/parse";
import { MonthlyChart, BalanceChart } from "@/components/Charts";

export interface RangeSeries {
  name: string;
  daily: DailyRow[];
  openBal: { cash: number; ar: number; ap: number };
  gap?: { net: number; cash: number };
}

type Interval = "day" | "week" | "month" | "quarter";
const INTERVALS: { v: Interval; l: string }[] = [
  { v: "day", l: "Harian" },
  { v: "week", l: "Mingguan" },
  { v: "month", l: "Bulanan" },
  { v: "quarter", l: "Kuartal" },
];
const DAY = 86400000;
const toMs = (s: string) => Date.parse(s + "T00:00:00Z");
const toStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const rp = (n: number) => (Math.abs(n) < 0.5 ? "0" : (n < 0 ? "-" : "") + nf.format(Math.abs(Math.round(n))));
const short = (n: number) => {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  const f = (v: number, d: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: d }).format(v);
  if (a >= 1e9) return `${s}Rp ${f(a / 1e9, 2)} M`;
  if (a >= 1e6) return `${s}Rp ${f(a / 1e6, 1)} jt`;
  if (a >= 1e3) return `${s}Rp ${f(a / 1e3, 0)} rb`;
  return `${s}Rp ${f(a, 0)}`;
};

function bucketStart(ms: number, iv: Interval): number {
  const d = new Date(ms);
  if (iv === "day") return ms;
  if (iv === "week") return ms - ((d.getUTCDay() + 6) % 7) * DAY; // Senin
  if (iv === "month") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  return Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1);
}
function nextStart(ms: number, iv: Interval): number {
  const d = new Date(ms);
  if (iv === "day") return ms + DAY;
  if (iv === "week") return ms + 7 * DAY;
  if (iv === "month") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1);
}
function label(a: number, b: number, iv: Interval): string {
  const da = new Date(a);
  const db = new Date(b);
  const dm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]}`;
  if (iv === "day") return `${dm(da)} ${String(da.getUTCFullYear()).slice(2)}`;
  if (iv === "week") return a === b ? dm(da) : `${dm(da)} – ${dm(db)}`;
  if (iv === "month") return `${MON[da.getUTCMonth()]} ${da.getUTCFullYear()}`;
  return `Q${Math.floor(da.getUTCMonth() / 3) + 1} ${da.getUTCFullYear()}`;
}

interface Bucket {
  label: string;
  rev: number;
  cost: number;
  net: number;
  cashIn: number;
  cashOut: number;
  arNew: number;
  arPaid: number;
  apNew: number;
  apPaid: number;
  cash: number;
  ar: number;
  ap: number;
}

export function RangeAnalysis({ series, title }: { series: RangeSeries[]; title?: string }) {
  const { rows, open, gap } = useMemo(() => {
    const m = new Map<string, DailyRow>();
    for (const s of series)
      for (const r of s.daily) {
        const t = m.get(r.d) ?? { d: r.d, rev: 0, cogs: 0, opex: 0, other: 0, cashIn: 0, cashOut: 0, arNew: 0, arPaid: 0, apNew: 0, apPaid: 0, n: 0 };
        (Object.keys(r) as (keyof DailyRow)[]).forEach((k) => {
          if (k !== "d") (t[k] as number) += r[k] as number;
        });
        m.set(r.d, t);
      }
    return {
      rows: [...m.values()].sort((a, b) => (a.d < b.d ? -1 : 1)),
      open: series.reduce((o, s) => ({ cash: o.cash + s.openBal.cash, ar: o.ar + s.openBal.ar, ap: o.ap + s.openBal.ap }), { cash: 0, ar: 0, ap: 0 }),
      gap: series.reduce((g, s) => ({ net: g.net + (s.gap?.net ?? 0), cash: g.cash + (s.gap?.cash ?? 0) }), { net: 0, cash: 0 }),
    };
  }, [series]);

  const min = rows[0]?.d ?? "";
  const max = rows[rows.length - 1]?.d ?? "";
  const [from, setFrom] = useState(min);
  const [to, setTo] = useState(max);
  const spanDays = from && to ? Math.round((toMs(to) - toMs(from)) / DAY) + 1 : 0;
  const [iv, setIv] = useState<Interval>(spanDays <= 45 ? "day" : spanDays <= 200 ? "week" : "month");

  const preset = (days: number | "all") => {
    if (days === "all") {
      setFrom(min);
      setTo(max);
      setIv(spanDaysOf(min, max) <= 45 ? "day" : spanDaysOf(min, max) <= 200 ? "week" : "month");
      return;
    }
    const f = toStr(Math.max(toMs(min), toMs(max) - (days - 1) * DAY));
    setFrom(f);
    setTo(max);
    setIv(days <= 45 ? "day" : "week");
  };
  const spanDaysOf = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY) + 1;

  const { buckets, tot } = useMemo(() => {
    const out: Bucket[] = [];
    if (!from || !to || from > to) return { buckets: out, tot: null };
    const fMs = toMs(from);
    const tMs = toMs(to);
    let ri = 0;
    let cash = open.cash;
    let ar = open.ar;
    let ap = open.ap;
    const advance = (untilMs: number, acc?: Bucket, lo?: number) => {
      while (ri < rows.length && toMs(rows[ri].d) <= untilMs) {
        const r = rows[ri++];
        cash += r.cashIn - r.cashOut;
        ar += r.arNew - r.arPaid;
        ap += r.apNew - r.apPaid;
        if (acc && lo !== undefined && toMs(r.d) >= lo) {
          acc.rev += r.rev;
          acc.cost += r.cogs + r.opex;
          acc.net += r.rev - r.cogs - r.opex + r.other;
          acc.cashIn += r.cashIn;
          acc.cashOut += r.cashOut;
          acc.arNew += r.arNew;
          acc.arPaid += r.arPaid;
          acc.apNew += r.apNew;
          acc.apPaid += r.apPaid;
        }
      }
    };
    advance(fMs - DAY); // saldo awal rentang
    let s = bucketStart(fMs, iv);
    let guard = 0;
    while (s <= tMs && guard++ < 800) {
      const lo = Math.max(s, fMs);
      const hi = Math.min(nextStart(s, iv) - DAY, tMs);
      const b: Bucket = { label: label(lo, hi, iv), rev: 0, cost: 0, net: 0, cashIn: 0, cashOut: 0, arNew: 0, arPaid: 0, apNew: 0, apPaid: 0, cash: 0, ar: 0, ap: 0 };
      advance(hi, b, lo);
      b.cash = cash;
      b.ar = ar;
      b.ap = ap;
      out.push(b);
      s = nextStart(s, iv);
    }
    const sum = (k: keyof Bucket) => out.reduce((a, b) => a + (b[k] as number), 0);
    const last = out[out.length - 1];
    return {
      buckets: out,
      tot: {
        rev: sum("rev"), cost: sum("cost"), net: sum("net"), cashIn: sum("cashIn"), cashOut: sum("cashOut"),
        arNew: sum("arNew"), arPaid: sum("arPaid"), apNew: sum("apNew"), apPaid: sum("apPaid"),
        cash: last?.cash ?? 0, ar: last?.ar ?? 0, ap: last?.ap ?? 0,
      },
    };
  }, [rows, open, from, to, iv]);

  if (!rows.length) return null;
  const tone = (n: number) => (n < 0 ? "neg" : "");
  const kpis: { l: string; v: number; sub?: string; t?: boolean }[] = tot
    ? [
        { l: "Pendapatan", v: tot.rev },
        { l: "Beban (pokok + usaha)", v: tot.cost },
        { l: "Laba bersih", v: tot.net, t: true, sub: tot.rev ? `Margin ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format((tot.net / tot.rev) * 100)}%` : undefined },
        { l: "Kas masuk", v: tot.cashIn },
        { l: "Kas keluar", v: tot.cashOut, sub: `Bersih ${short(tot.cashIn - tot.cashOut)}` },
        { l: "Tagihan baru ke pelanggan", v: tot.arNew, sub: `Pelunasan ${short(tot.arPaid)}` },
        { l: "Tagihan baru dari pemasok", v: tot.apNew, sub: `Dibayar ${short(tot.apPaid)}` },
        { l: "Saldo akhir rentang", v: tot.cash, sub: `Piutang ${short(tot.ar)} · Utang ${short(tot.ap)}` },
      ]
    : [];

  return (
    <div>
      <div className="range-bar">
        <div className="field">
          <label>Dari</label>
          <input type="date" value={from} min={min} max={to || max} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>Sampai</label>
          <input type="date" value={to} min={from || min} max={max} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="field">
          <label>Interval</label>
          <div className="seg">
            {INTERVALS.map((x) => (
              <button key={x.v} type="button" data-on={iv === x.v} onClick={() => setIv(x.v)}>
                {x.l}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Cepat</label>
          <div className="seg">
            <button type="button" onClick={() => preset(7)}>7 hari</button>
            <button type="button" onClick={() => preset(30)}>30 hari</button>
            <button type="button" onClick={() => preset("all")}>Semua</button>
          </div>
        </div>
      </div>
      <div className="muted small" style={{ margin: "6px 0 12px" }}>
        {title ?? "Data"} dari Entry Jurnal, {min} s.d. {max}. {spanDays > 0 ? `${spanDays} hari dipilih, ${buckets.length} baris.` : ""}
      </div>

      {tot ? (
        <>
          <div className="grid g-kpi">
            {kpis.map((k) => (
              <div className="card kpi" key={k.l}>
                <div className="kpi-label">{k.l}</div>
                <div className={`kpi-value ${k.t ? tone(k.v) : ""}`}>{short(k.v)}</div>
                {k.sub ? <div className="kpi-sub">{k.sub}</div> : null}
              </div>
            ))}
          </div>
          <div className="grid g-2" style={{ marginTop: 16 }}>
            <div className="card">
              <div className="chart-title">Pendapatan, beban, dan laba</div>
              <MonthlyChart data={buckets.map((b) => ({ month: b.label, pendapatan: b.rev, beban: b.cost, laba: b.net }))} />
            </div>
            <div className="card">
              <div className="chart-title">Saldo kas, piutang, dan utang usaha</div>
              <BalanceChart data={buckets.map((b) => ({ month: b.label, kas: b.cash, piutang: b.ar, utang: b.ap }))} />
            </div>
          </div>
          <div className="card scroll" style={{ marginTop: 16, maxHeight: 460, overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Pendapatan</th>
                  <th>Beban</th>
                  <th>Laba</th>
                  <th>Kas masuk</th>
                  <th>Kas keluar</th>
                  <th>Piutang baru</th>
                  <th>Pelunasan</th>
                  <th>Utang baru</th>
                  <th>Bayar utang</th>
                  <th>Saldo kas</th>
                  <th>Saldo piutang</th>
                  <th>Saldo utang</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b, i) => (
                  <tr key={i}>
                    <td>{b.label}</td>
                    <td>{rp(b.rev)}</td>
                    <td>{rp(b.cost)}</td>
                    <td className={tone(b.net)}>{rp(b.net)}</td>
                    <td>{rp(b.cashIn)}</td>
                    <td>{rp(b.cashOut)}</td>
                    <td>{rp(b.arNew)}</td>
                    <td>{rp(b.arPaid)}</td>
                    <td>{rp(b.apNew)}</td>
                    <td>{rp(b.apPaid)}</td>
                    <td className={tone(b.cash)}>{rp(b.cash)}</td>
                    <td>{rp(b.ar)}</td>
                    <td>{rp(b.ap)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Total rentang</td>
                  <td>{rp(tot.rev)}</td>
                  <td>{rp(tot.cost)}</td>
                  <td className={tone(tot.net)}>{rp(tot.net)}</td>
                  <td>{rp(tot.cashIn)}</td>
                  <td>{rp(tot.cashOut)}</td>
                  <td>{rp(tot.arNew)}</td>
                  <td>{rp(tot.arPaid)}</td>
                  <td>{rp(tot.apNew)}</td>
                  <td>{rp(tot.apPaid)}</td>
                  <td className={tone(tot.cash)}>{rp(tot.cash)}</td>
                  <td>{rp(tot.ar)}</td>
                  <td>{rp(tot.ap)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>
            Piutang baru = debit piutang usaha, pelunasan = kredit piutang usaha; utang baru = kredit utang usaha, bayar utang = debit utang usaha.
            Kas masuk/keluar tidak menghitung pemindahan antar akun kas.
            {Math.abs(gap.net) > 1000 || Math.abs(gap.cash) > 1000
              ? ` Catatan: laporan bulanan (TB) memuat penyesuaian di luar Entry Jurnal (mis. penyusutan dari tab Fixed Asset) — selisih laba bersih ${short(gap.net)} dan kas ${short(gap.cash)} untuk seluruh periode, jadi total rentang penuh bisa beda dengan laporan bulanan.`
              : ""}
          </div>
        </>
      ) : (
        <div className="muted">Rentang tanggal tidak valid.</div>
      )}
    </div>
  );
}
