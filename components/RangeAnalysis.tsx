"use client";

import { useMemo, useState } from "react";
import type { DailyRow } from "@/lib/parse";
import { MonthlyChart, BalanceChart } from "@/components/Charts";

export interface RangeSeries {
  name: string;
  daily: DailyRow[];
  openBal: { cash: number; ar: number; ap: number; taxIn: number; taxPay: number; rpRec: number; rpPay: number };
  gap?: { net: number; cash: number };
}

type Interval = "day" | "week" | "month" | "quarter";
const INTERVALS: { v: Interval; l: string }[] = [
  { v: "day", l: "Harian" },
  { v: "week", l: "Mingguan" },
  { v: "month", l: "Bulanan" },
  { v: "quarter", l: "Kuartal" },
];
const emptyRow = (d: string): DailyRow => ({
  d, rev: 0, cogs: 0, opex: 0, other: 0, cashIn: 0, cashOut: 0, arNew: 0, arPaid: 0, apNew: 0, apPaid: 0, n: 0,
  dep: 0, int: 0, pay: 0, taxIn: 0, taxPay: 0, rpRec: 0, rpPay: 0, icRev: 0, icCost: 0,
});
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
  // indikator CFO
  ebitda: number;
  interest: number;
  payroll: number;
  taxIn: number; // saldo pajak dibayar dimuka
  taxPay: number; // saldo utang pajak
  rpRec: number; // saldo piutang berelasi
  rpPay: number; // saldo utang berelasi
  icRev: number;
  icCost: number;
  burn: number | null; // burn bulanan (rata-rata 30 hari terakhir), null = kas tidak turun
  runway: number | null; // bulan, null = aman/tidak relevan
}

export function RangeAnalysis({ series, title }: { series: RangeSeries[]; title?: string }) {
  const { rows, open, gap } = useMemo(() => {
    const m = new Map<string, DailyRow>();
    for (const s of series)
      for (const r of s.daily) {
        const t = m.get(r.d) ?? emptyRow(r.d);
        (Object.keys(r) as (keyof DailyRow)[]).forEach((k) => {
          if (k !== "d") (t[k] as number) += r[k] as number;
        });
        m.set(r.d, t);
      }
    return {
      rows: [...m.values()].sort((a, b) => (a.d < b.d ? -1 : 1)),
      open: series.reduce(
        (o, s) => ({
          cash: o.cash + s.openBal.cash,
          ar: o.ar + s.openBal.ar,
          ap: o.ap + s.openBal.ap,
          taxIn: o.taxIn + s.openBal.taxIn,
          taxPay: o.taxPay + s.openBal.taxPay,
          rpRec: o.rpRec + s.openBal.rpRec,
          rpPay: o.rpPay + s.openBal.rpPay,
        }),
        { cash: 0, ar: 0, ap: 0, taxIn: 0, taxPay: 0, rpRec: 0, rpPay: 0 }
      ),
      gap: series.reduce((g, s) => ({ net: g.net + (s.gap?.net ?? 0), cash: g.cash + (s.gap?.cash ?? 0) }), { net: 0, cash: 0 }),
    };
  }, [series]);

  const min = rows[0]?.d ?? "";
  const max = rows[rows.length - 1]?.d ?? "";
  const [from, setFrom] = useState(min);
  const [to, setTo] = useState(max);
  const spanDays = from && to ? Math.round((toMs(to) - toMs(from)) / DAY) + 1 : 0;
  const [view, setView] = useState<"ops" | "cfo">("ops");
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
    let taxIn = open.taxIn;
    let taxPay = open.taxPay;
    let rpRec = open.rpRec;
    let rpPay = open.rpPay;
    const advance = (untilMs: number, acc?: Bucket, lo?: number) => {
      while (ri < rows.length && toMs(rows[ri].d) <= untilMs) {
        const r = rows[ri++];
        cash += r.cashIn - r.cashOut;
        ar += r.arNew - r.arPaid;
        ap += r.apNew - r.apPaid;
        taxIn += r.taxIn;
        taxPay += r.taxPay;
        rpRec += r.rpRec;
        rpPay += r.rpPay;
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
          acc.ebitda += r.rev - r.cogs - r.opex + r.dep;
          acc.interest += r.int;
          acc.payroll += r.pay;
          acc.icRev += r.icRev;
          acc.icCost += r.icCost;
        }
      }
    };
    advance(fMs - DAY); // saldo awal rentang
    let s = bucketStart(fMs, iv);
    let guard = 0;
    while (s <= tMs && guard++ < 800) {
      const lo = Math.max(s, fMs);
      const hi = Math.min(nextStart(s, iv) - DAY, tMs);
      const b: Bucket = { label: label(lo, hi, iv), rev: 0, cost: 0, net: 0, cashIn: 0, cashOut: 0, arNew: 0, arPaid: 0, apNew: 0, apPaid: 0, cash: 0, ar: 0, ap: 0, ebitda: 0, interest: 0, payroll: 0, taxIn: 0, taxPay: 0, rpRec: 0, rpPay: 0, icRev: 0, icCost: 0, burn: null, runway: null };
      advance(hi, b, lo);
      b.cash = cash;
      b.ar = ar;
      b.ap = ap;
      b.taxIn = taxIn;
      b.taxPay = taxPay;
      b.rpRec = rpRec;
      b.rpPay = rpPay;
      // burn: kas bersih keluar selama 30 hari sampai akhir interval (atau sejak data pertama bila lebih pendek)
      const winStart = Math.max(hi - 29 * DAY, toMs(rows[0].d));
      const winDays = Math.round((hi - winStart) / DAY) + 1;
      let net30 = 0;
      for (const r of rows) {
        const t = toMs(r.d);
        if (t >= winStart && t <= hi) net30 += r.cashIn - r.cashOut;
      }
      const burnM = (-net30 / winDays) * 30;
      b.burn = burnM > 0 ? burnM : null;
      b.runway = cash <= 0 ? 0 : burnM > 0 ? cash / burnM : null;
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
        ebitda: sum("ebitda"), interest: sum("interest"), payroll: sum("payroll"), icRev: sum("icRev"), icCost: sum("icCost"),
        taxIn: last?.taxIn ?? 0, taxPay: last?.taxPay ?? 0, rpRec: last?.rpRec ?? 0, rpPay: last?.rpPay ?? 0,
        burn: last?.burn ?? null, runway: last?.runway ?? null,
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
        { l: "EBITDA", v: tot.ebitda, t: true, sub: tot.rev ? `Margin ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format((tot.ebitda / tot.rev) * 100)}%` : undefined },
        { l: "Runway kas (akhir rentang)", v: tot.cash, sub: tot.runway === null ? "Aman, kas tidak turun" : tot.runway === 0 ? `Burn ${short(tot.burn ?? 0)}/bln` : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(tot.runway)} bulan · burn ${short(tot.burn ?? 0)}/bln` },
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
                <div className={`kpi-value ${k.t || k.l.startsWith("Runway") ? tone(k.v) : ""}`}>{k.l.startsWith("Runway") ? (tot.runway === null ? "Aman" : tot.runway === 0 ? "Kas ≤ 0" : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(tot.runway)} bln`) : short(k.v)}</div>
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
          <div className="seg" style={{ marginTop: 16 }}>
            <button type="button" data-on={view === "ops"} onClick={() => setView("ops")}>Operasional, piutang & utang</button>
            <button type="button" data-on={view === "cfo"} onClick={() => setView("cfo")}>Indikator CFO</button>
          </div>
          {view === "cfo" ? (
            <div className="card scroll" style={{ marginTop: 8, maxHeight: 460, overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Periode</th>
                    <th>EBITDA</th>
                    <th>Margin</th>
                    <th>Bunga</th>
                    <th>Gaji</th>
                    <th>Gaji ÷ pend.</th>
                    <th>Burn/bln</th>
                    <th>Runway</th>
                    <th>Pajak dimuka</th>
                    <th>Utang pajak</th>
                    <th>Piutang berelasi</th>
                    <th>Utang berelasi</th>
                    <th>Pend. IC</th>
                    <th>Beban IC</th>
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((b, i) => (
                    <tr key={i}>
                      <td>{b.label}</td>
                      <td className={tone(b.ebitda)}>{rp(b.ebitda)}</td>
                      <td>{b.rev ? `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format((b.ebitda / b.rev) * 100)}%` : "–"}</td>
                      <td>{rp(b.interest)}</td>
                      <td>{rp(b.payroll)}</td>
                      <td>{b.rev ? `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format((b.payroll / b.rev) * 100)}%` : "–"}</td>
                      <td>{b.burn === null ? "–" : rp(b.burn)}</td>
                      <td className={b.runway !== null && b.runway < 3 ? "neg" : ""}>
                        {b.runway === null ? "Aman" : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(b.runway)} bln`}
                      </td>
                      <td>{rp(b.taxIn)}</td>
                      <td>{rp(b.taxPay)}</td>
                      <td>{rp(b.rpRec)}</td>
                      <td>{rp(b.rpPay)}</td>
                      <td>{rp(b.icRev)}</td>
                      <td>{rp(b.icCost)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Total rentang</td>
                    <td className={tone(tot.ebitda)}>{rp(tot.ebitda)}</td>
                    <td>{tot.rev ? `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format((tot.ebitda / tot.rev) * 100)}%` : "–"}</td>
                    <td>{rp(tot.interest)}</td>
                    <td>{rp(tot.payroll)}</td>
                    <td>{tot.rev ? `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format((tot.payroll / tot.rev) * 100)}%` : "–"}</td>
                    <td>{tot.burn === null ? "–" : rp(tot.burn)}</td>
                    <td>{tot.runway === null ? "Aman" : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(tot.runway)} bln`}</td>
                    <td>{rp(tot.taxIn)}</td>
                    <td>{rp(tot.taxPay)}</td>
                    <td>{rp(tot.rpRec)}</td>
                    <td>{rp(tot.rpPay)}</td>
                    <td>{rp(tot.icRev)}</td>
                    <td>{rp(tot.icCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
          <div className="card scroll" style={{ marginTop: 8, maxHeight: 460, overflowY: "auto" }}>
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
          )}
          <div className="muted small" style={{ marginTop: 8 }}>
            Burn dan runway dihitung dari kas bersih 30 hari terakhir sampai akhir tiap interval. EBITDA = laba usaha + penyusutan yang lewat jurnal.
            Saldo pajak dan pihak berelasi dihitung dari jurnal dan saldo awal TB.{" "}
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
