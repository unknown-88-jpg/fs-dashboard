import type { CompanyModel } from "@/lib/parse";
import { pct, rp, rpShort } from "@/lib/format";

const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const PKP_LIMIT = 4.8e9;

/** Bulan laporan "Okt-26" -> {y, m(0-11)} */
function parseLabel(label: string): { y: number; m: number } | null {
  const [mm, yy] = label.split("-");
  const m = MON.indexOf(mm);
  return m < 0 || !yy ? null : { y: 2000 + Number(yy), m };
}

function deadlines(label: string) {
  const p = parseLabel(label);
  if (!p) return [];
  const ny = p.m === 11 ? p.y + 1 : p.y;
  const nm = (p.m + 1) % 12;
  const last = new Date(ny, nm + 1, 0).getDate();
  const f = (d: number) => `${d} ${MON[nm]} ${ny}`;
  return [
    { what: "Setor PPh 21, 22, 23, 26, 4(2), dan 25", when: f(10) },
    { what: "Lapor SPT Masa PPh", when: f(20) },
    { what: "Setor dan lapor SPT Masa PPN", when: f(last) },
  ];
}

export function TaxPanel({ m }: { m: CompanyModel }) {
  const c = m.cfo;
  if (!c || m.reportIdx < 0) return null;
  const i = m.reportIdx;
  const prevLabel = i > 0 ? m.months[i - 1] : null;
  const dimuka = c.taxRows.filter((r) => r.kind === "dimuka");
  const utang = c.taxRows.filter((r) => r.kind === "utang");
  const net = c.taxPayable[i] - c.taxPrepaid[i];

  const act = m.activeMonths.length || 1;
  const gross = m.pl.revenueGross.ytd;
  const runRate = (gross / act) * 12;
  const used = gross / PKP_LIMIT;
  const tone = used >= 0.95 ? "bad" : used >= 0.75 ? "warn" : "ok";

  const rows = (list: typeof c.taxRows) =>
    list.map((r) => (
      <tr key={r.kind + r.name}>
        <td>{r.name}</td>
        {prevLabel ? <td>{r.prev === null ? "–" : rp(r.prev)}</td> : null}
        <td>{rp(r.cur)}</td>
      </tr>
    ));

  return (
    <div className="grid g-2">
      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>Posisi pajak</th>
              {prevLabel ? <th>{prevLabel}</th> : null}
              <th>{m.reportLabel}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="group"><td colSpan={prevLabel ? 3 : 2}>Pajak dibayar dimuka (aset)</td></tr>
            {dimuka.length ? rows(dimuka) : <tr><td colSpan={prevLabel ? 3 : 2} className="muted">Tidak ada saldo.</td></tr>}
            <tr className="group"><td colSpan={prevLabel ? 3 : 2}>Utang pajak (liabilitas)</td></tr>
            {utang.length ? rows(utang) : <tr><td colSpan={prevLabel ? 3 : 2} className="muted">Tidak ada saldo.</td></tr>}
            <tr className="total">
              <td>{net >= 0 ? "Posisi bersih: kurang bayar" : "Posisi bersih: lebih bayar"}</td>
              {prevLabel ? <td>{rp(c.taxPayable[i - 1] - c.taxPrepaid[i - 1])}</td> : null}
              <td className={net >= 0 ? "" : "pos"}>{rp(net)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="chart-title">Jatuh tempo untuk masa pajak {m.reportLabel}</div>
        <div className="checks">
          {deadlines(m.reportLabel).map((d) => (
            <div className="check" key={d.what}>
              <span>{d.what}</span>
              <strong>{d.when}</strong>
            </div>
          ))}
        </div>
        <div className="chart-title" style={{ marginTop: 18 }}>Omzet terhadap batas Rp 4,8 M</div>
        <div className="bar-track" role="img" aria-label={`Omzet ${pct(used)} dari batas`}>
          <div className={`bar-fill ${tone}`} style={{ width: `${Math.min(100, used * 100)}%` }} />
        </div>
        <div className="muted small" style={{ marginTop: 8 }}>
          Omzet bruto {m.months[0]} s.d. {m.reportLabel}: {rpShort(gross)} ({pct(used)} dari batas). Proyeksi setahun dengan
          laju sekarang: {rpShort(runRate)}. Angka ini hanya dari periode yang ada di TB; konfirmasi dengan konsultan pajak
          untuk batas PKP dan PPh final UMKM yang berlaku.
        </div>
      </div>
    </div>
  );
}

export function RelatedPanel({ m }: { m: CompanyModel }) {
  const c = m.cfo;
  if (!c || m.reportIdx < 0) return null;
  const i = m.reportIdx;
  const prevLabel = i > 0 ? m.months[i - 1] : null;
  const rec = c.relRows.filter((r) => r.side === "piutang");
  const pay = c.relRows.filter((r) => r.side === "utang");
  const net = c.relRec[i] - c.relPay[i];
  const icRevY = c.icRev.reduce((s, v) => s + v, 0);
  const icCostY = c.icCost.reduce((s, v) => s + v, 0);
  const cols = prevLabel ? 3 : 2;
  const rows = (list: typeof c.relRows) =>
    list.map((r) => (
      <tr key={r.side + r.name}>
        <td>{r.name}</td>
        {prevLabel ? <td>{r.prev === null ? "–" : rp(r.prev)}</td> : null}
        <td>{rp(r.cur)}</td>
      </tr>
    ));
  if (!c.relRows.length && Math.abs(icRevY) + Math.abs(icCostY) < 1) {
    return <div className="card muted">Tidak ada saldo atau transaksi dengan pihak berelasi pada periode ini.</div>;
  }
  return (
    <div className="card scroll">
      <table>
        <thead>
          <tr>
            <th>Pihak berelasi</th>
            {prevLabel ? <th>{prevLabel}</th> : null}
            <th>{m.reportLabel}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="group"><td colSpan={cols}>Piutang</td></tr>
          {rec.length ? rows(rec) : <tr><td colSpan={cols} className="muted">Tidak ada saldo.</td></tr>}
          <tr className="group"><td colSpan={cols}>Utang</td></tr>
          {pay.length ? rows(pay) : <tr><td colSpan={cols} className="muted">Tidak ada saldo.</td></tr>}
          <tr className="total">
            <td>{net >= 0 ? "Posisi bersih: entitas ini menalangi pihak lain" : "Posisi bersih: entitas ini dibiayai pihak lain"}</td>
            {prevLabel ? <td>{rp(c.relRec[i - 1] - c.relPay[i - 1])}</td> : null}
            <td>{rp(net)}</td>
          </tr>
        </tbody>
      </table>
      <div className="muted small" style={{ padding: "8px 12px 4px" }}>
        Transaksi antar perusahaan sejak {m.months[0]}: pendapatan {rpShort(icRevY)}, beban {rpShort(icCostY)}. Bagian ini perlu dieliminasi
        saat menggabungkan laporan grup.
      </div>
    </div>
  );
}

const pctN = (v: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(v * 100) + "%";

export function CostStructure({ m }: { m: CompanyModel }) {
  const rev = m.pl.revenue.ytd;
  const cogs = m.pl.cogs.ytd;
  const opex = m.pl.opex.ytd;
  const total = cogs + opex;
  const lines = [
    ...(m.cogsLines ?? []).map((l) => ({ ...l, grp: "Beban pokok" })),
    ...m.opexLines.map((l) => ({ ...l, grp: "Beban usaha" })),
  ].sort((a, b) => b.ytd - a.ytd);
  if (!lines.length || total <= 0) return null;
  const payroll = m.cfo ? m.cfo.payroll.reduce((s, v) => s + v, 0) : null;
  return (
    <div className="card scroll">
      <table>
        <thead>
          <tr>
            <th>Pos biaya</th>
            <th>Kelompok</th>
            <th>YTD (Rp)</th>
            <th>% pendapatan</th>
            <th>% total biaya</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.grp + l.label}>
              <td>{l.label}</td>
              <td>{l.grp}</td>
              <td>{rp(l.ytd)}</td>
              <td>{rev > 0 ? pctN(l.ytd / rev) : "–"}</td>
              <td>
                {pctN(l.ytd / total)}{" "}
                <span className="share-bar" style={{ width: Math.max(2, (l.ytd / total) * 60) }} />
              </td>
            </tr>
          ))}
          <tr className="total">
            <td>Total biaya</td>
            <td></td>
            <td>{rp(total)}</td>
            <td>{rev > 0 ? pctN(total / rev) : "–"}</td>
            <td>100%</td>
          </tr>
        </tbody>
      </table>
      <div className="muted small" style={{ padding: "8px 12px 4px" }}>
        Beban pokok {pctN(cogs / total)} dari total biaya (cenderung ikut volume penjualan), beban usaha {pctN(opex / total)} (cenderung tetap).
        {payroll !== null && rev > 0 ? ` Biaya gaji dan tenaga kerja ${rpShort(payroll)} = ${pctN(payroll / rev)} dari pendapatan.` : ""}
      </div>
    </div>
  );
}

function ConcTable({ title, c }: { title: string; c: NonNullable<NonNullable<CompanyModel["journal"]>["revConc"]> }) {
  const share = (n: number) => (c.total > 0 ? n / c.total : 0);
  const t1 = c.top[0] ? share(c.top[0].value) : 0;
  const t3 = share(c.top.slice(0, 3).reduce((s, x) => s + x.value, 0));
  const t5 = share(c.top.reduce((s, x) => s + x.value, 0));
  return (
    <div className="card scroll">
      <div className="chart-title">{title}</div>
      <table>
        <thead>
          <tr>
            <th>Pelanggan / keterangan</th>
            <th>Rp</th>
            <th>Porsi</th>
          </tr>
        </thead>
        <tbody>
          {c.top.map((x) => (
            <tr key={x.name}>
              <td>{x.name}</td>
              <td>{rp(x.value)}</td>
              <td>
                {pctN(share(x.value))} <span className="share-bar" style={{ width: Math.max(2, share(x.value) * 60) }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="muted small" style={{ padding: "8px 12px 4px" }}>
        Terbesar 1: {pctN(t1)} · 3 terbesar: {pctN(t3)} · 5 terbesar: {pctN(t5)} dari {c.count} keterangan berbeda.
      </div>
    </div>
  );
}

export function Concentration({ m }: { m: CompanyModel }) {
  const j = m.journal;
  if (!j?.revConc?.top.length && !j?.costConc?.top.length) return null;
  return (
    <>
      <div className="grid g-2">
        {j?.revConc?.top.length ? <ConcTable title="Konsentrasi pendapatan" c={j.revConc} /> : null}
        {j?.costConc?.top.length ? <ConcTable title="Konsentrasi biaya" c={j.costConc} /> : null}
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>
        Dikelompokkan per nama di awal kolom Keterangan bila berformat "(PT Contoh) ...", selain itu per keterangan penuh. Hasilnya paling akurat bila keterangan memuat nama pelanggan atau pemasok yang konsisten.
      </div>
    </>
  );
}
