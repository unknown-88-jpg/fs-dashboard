import { notFound } from "next/navigation";
import { getCompany } from "@/lib/companies";
import { safeModel } from "@/lib/data";
import type { Line } from "@/lib/parse";
import { pct, rp, rpShort, wibTime } from "@/lib/format";
import { CashflowChart, HBar, MonthlyChart } from "@/components/Charts";
import { Delta, Kpi, Section } from "@/components/Ui";

export const dynamic = "force-dynamic";

const isOk = (s: string | null) => !!s && /^ok$/i.test(s.trim());

export default async function CompanyPage({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const c = getCompany(company);
  if (!c) notFound();

  const r = await safeModel(c);
  if (!r.ok) {
    return (
      <div className="err">
        <strong>Gagal ambil data {c.name}</strong>
        <div style={{ margin: "6px 0" }}>
          {c.source.kind === "csv" ? (
            <>
              Cek env <code>{c.short.toUpperCase()}_TB_CSV_URL</code> dan <code>{c.short.toUpperCase()}_EJ_CSV_URL</code>{" "}
              di Vercel, dan pastikan publikasi web di spreadsheet masih aktif.
            </>
          ) : (
            <>
              Cek env <code>{c.short.toUpperCase()}_SCRIPT_URL</code> dan <code>SHEETS_TOKEN</code> di Vercel, dan
              pastikan deployment Apps Script-nya aktif.
            </>
          )}
        </div>
        <code>{r.error}</code>
      </div>
    );
  }

  const m = r.model;
  const { pl, bs, cf } = m;
  const idx = m.reportIdx;
  const act = m.activeMonths;
  const sheetUrl = c.sheetId ? `https://docs.google.com/spreadsheets/d/${c.sheetId}/edit` : null;
  const isTb = m.source === "tb";

  if (idx < 0) {
    return (
      <>
        <h1>{c.name}</h1>
        <p className="muted">Belum ada transaksi di sheet. Isi Entry Jurnal dulu.</p>
      </>
    );
  }

  const prevRev = idx > 0 ? pl.revenue.m[idx - 1] : null;
  const grossMargin = pl.revenue.ytd ? pl.grossProfit.ytd / pl.revenue.ytd : null;
  const netMargin = pl.revenue.ytd ? pl.netProfit.ytd / pl.revenue.ytd : null;

  const chartData = act.map((i) => ({
    month: m.months[i],
    pendapatan: pl.revenue.m[i],
    beban: pl.cogs.m[i] + pl.opex.m[i],
    laba: pl.netProfit.m[i],
  }));
  const cfData = act.map((i) => ({
    month: m.months[i],
    operasi: cf.operating.m[i],
    investasi: cf.investing.m[i],
    pendanaan: cf.financing.m[i],
  }));

  const plRows: { l: Line; cls?: string; neg?: boolean }[] = [
    { l: { ...pl.revenueGross, label: "Pendapatan bruto" } },
    { l: { ...pl.returns, label: "Retur & potongan" }, cls: "sub" },
    { l: { ...pl.revenue, label: "Pendapatan neto" }, cls: "total" },
    { l: { ...pl.cogs, label: "Beban pokok", m: pl.cogs.m.map((v) => -v), ytd: -pl.cogs.ytd } },
    { l: { ...pl.grossProfit, label: "Laba bruto" }, cls: "total" },
    { l: { ...pl.opex, label: "Beban usaha", m: pl.opex.m.map((v) => -v), ytd: -pl.opex.ytd } },
    { l: { ...pl.operatingProfit, label: "Laba usaha" }, cls: "total" },
    { l: { ...pl.otherNet, label: "Pendapatan (beban) lain-lain" } },
    ...(Math.abs(pl.tax.ytd) > 0.5 || pl.tax.m.some((v) => Math.abs(v) > 0.5)
      ? [{ l: { ...pl.tax, label: "Beban pajak penghasilan", m: pl.tax.m.map((v) => -v), ytd: -pl.tax.ytd } }]
      : []),
    { l: { ...pl.netProfit, label: "Laba (rugi) bersih" }, cls: "total" },
  ];

  const cur = bs.current;
  const prev = bs.previous;
  const bsRows: { label: string; key: keyof typeof cur; cls?: string }[] = [
    { label: "Kas dan setara kas", key: "cash" },
    { label: "Piutang usaha", key: "receivables" },
    { label: "Aset lancar", key: "currentAssets", cls: "total" },
    { label: "Aset tidak lancar", key: "nonCurrentAssets", cls: "total" },
    { label: "Total aset", key: "totalAssets", cls: "total" },
    { label: "Total liabilitas", key: "liabilities" },
    { label: "Total ekuitas", key: "equity" },
  ];

  const failed = m.controls.filter((x) => !x.ok);
  const subs = [
    { name: "Aging piutang (AR) vs TB", s: m.subledger.ar },
    { name: "Aging utang (AP) vs TB", s: m.subledger.ap },
  ];

  return (
    <>
      <div className="head">
        <div>
          <h1>{c.name}</h1>
          <div className="muted small">
            Periode {m.months[0]} s.d. {m.reportLabel} · diambil {wibTime(new Date(m.fetchedAt))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {sheetUrl ? (
            <a className="btn" href={sheetUrl} target="_blank" rel="noreferrer">
              Buka spreadsheet
            </a>
          ) : null}
          <form action="/api/refresh" method="post">
            <button className="btn" type="submit">
              Refresh
            </button>
          </form>
        </div>
      </div>

      <div className="grid g-kpi">
        <Kpi
          label="Pendapatan neto (YTD)"
          value={rpShort(pl.revenue.ytd)}
          sub={<Delta now={pl.revenue.m[idx]} prev={prevRev} />}
        />
        <Kpi label="Laba bruto (YTD)" value={rpShort(pl.grossProfit.ytd)} sub={`Gross margin ${pct(grossMargin)}`} />
        <Kpi
          label="Laba bersih (YTD)"
          value={rpShort(pl.netProfit.ytd)}
          tone={pl.netProfit.ytd < 0 ? "neg" : "pos"}
          sub={`Net margin ${pct(netMargin)}`}
        />
        <Kpi
          label={`Kas akhir ${m.reportLabel}`}
          value={rpShort(cur.cash)}
          sub={prev ? <Delta now={cur.cash} prev={prev.cash} /> : undefined}
        />
        <Kpi label="Piutang usaha" value={rpShort(cur.receivables)} sub={`Total aset ${rpShort(cur.totalAssets)}`} />
        <Kpi
          label="Ekuitas"
          value={rpShort(cur.equity)}
          tone={cur.equity < 0 ? "neg" : "neutral"}
          sub={`Liabilitas ${rpShort(cur.liabilities)}`}
        />
      </div>

      <Section title="Pendapatan, beban, dan laba per bulan">
        <div className="card">
          <MonthlyChart data={chartData} />
        </div>
      </Section>

      <div className="grid g-2">
        <Section title="Komposisi pendapatan" hint="YTD">
          <div className="card">
            <HBar
              color="var(--chart-1)"
              data={[...m.revenueLines].sort((a, b) => b.ytd - a.ytd).map((l) => ({
                name: l.label.replace(/^Pendapatan\s+/i, ""),
                value: l.ytd,
              }))}
            />
          </div>
        </Section>
        {m.cogsLines && m.cogsLines.length ? (
          <Section title="Beban pokok" hint="YTD">
            <div className="card">
              <HBar
                color="var(--chart-2)"
                data={m.cogsLines.map((l) => ({ name: l.label, value: l.ytd }))}
              />
            </div>
          </Section>
        ) : null}
        <Section title="Beban usaha" hint="YTD">
          <div className="card">
            <HBar
              color="var(--chart-2)"
              data={m.opexLines.map((l) => ({ name: l.label.replace(/^Beban\s+/i, ""), value: l.ytd }))}
            />
          </div>
        </Section>
      </div>

      <Section title="Laba rugi ringkas">
        <div className="card scroll">
          <table>
            <thead>
              <tr>
                <th>Rp</th>
                {act.map((i) => (
                  <th key={i}>{m.months[i]}</th>
                ))}
                <th>YTD</th>
              </tr>
            </thead>
            <tbody>
              {plRows.map(({ l, cls }) => (
                <tr key={l.label} className={cls}>
                  <td>{l.label}</td>
                  {act.map((i) => (
                    <td key={i} className={l.m[i] < 0 && cls === "total" ? "neg" : ""}>
                      {rp(l.m[i])}
                    </td>
                  ))}
                  <td className={l.ytd < 0 && cls === "total" ? "neg" : ""}>{rp(l.ytd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid g-2">
        <Section title="Neraca ringkas">
          <div className="card scroll">
            <table>
              <thead>
                <tr>
                  <th>Rp</th>
                  {prev ? <th>{m.months[idx - 1]}</th> : null}
                  <th>{m.reportLabel}</th>
                </tr>
              </thead>
              <tbody>
                {bsRows.map((b) => (
                  <tr key={b.key} className={b.cls}>
                    <td>{b.label}</td>
                    {prev ? <td>{rp(prev[b.key])}</td> : null}
                    <td className={cur[b.key] < 0 ? "neg" : ""}>{rp(cur[b.key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Arus kas" hint={`Kas awal ${rpShort(cf.cashBegin)} → akhir ${rpShort(cf.cashEnd)}`}>
          <div className="card">
            <CashflowChart data={cfData} />
          </div>
        </Section>
      </div>

      {m.journal ? (
        <>
          <div className="grid g-2">
            <Section title="Penjualan per keterangan jurnal" hint="Top 8, total periode">
              <div className="card">
                {m.journal.topRevenueParties.length ? (
                  <HBar color="var(--chart-1)" data={m.journal.topRevenueParties} />
                ) : (
                  <span className="muted small">Belum ada jurnal penjualan.</span>
                )}
              </div>
            </Section>
            <Section title="Pengeluaran beban per keterangan jurnal" hint="Top 8 (beban pokok + beban usaha)">
              <div className="card">
                {m.journal.topCostParties.length ? (
                  <HBar color="var(--chart-2)" data={m.journal.topCostParties} />
                ) : (
                  <span className="muted small">Belum ada jurnal beban.</span>
                )}
              </div>
            </Section>
          </div>

          <Section title="Transaksi terbesar" hint={`${m.journal.count} baris Entry Jurnal`}>
            <div className="card scroll">
              <table>
                <thead>
                  <tr>
                    <th>Keterangan</th>
                    <th>Tanggal</th>
                    <th>Debit</th>
                    <th>Kredit</th>
                    <th>Rp</th>
                  </tr>
                </thead>
                <tbody>
                  {m.journal.largest.map((t, i) => (
                    <tr key={i}>
                      <td>{t.desc}</td>
                      <td>{t.date}</td>
                      <td>{t.debit}</td>
                      <td>{t.credit}</td>
                      <td>{rp(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      ) : null}

      <Section
        title="Pengecekan data"
        hint={isTb ? "Dihitung dari TB dan Entry Jurnal" : "Dibaca dari kolom control & status di spreadsheet"}
      >
        <div className="card checks">
          <div className="check">
            <span>
              {isTb ? "Kontrol internal data" : "Kontrol internal PL / BS / CF"}{" "}
              <span className="muted small">({m.controls.length - failed.length}/{m.controls.length} lolos)</span>
            </span>
            <span className={`badge ${failed.length ? "bad" : "ok"}`}>{failed.length ? "Ada selisih" : "OK"}</span>
          </div>
          {failed.map((f) => (
            <div className="check" key={f.sheet + f.label}>
              <span className="small">
                {f.sheet}: {f.label}
              </span>
              <span className="neg small">{f.note ?? `selisih ${rp(f.maxAbs)}`}</span>
            </div>
          ))}
          {(isTb ? [] : subs).map(({ name, s }) => (
            <div className="check" key={name}>
              <span>
                {name}
                {s.diff !== null && s.diff !== 0 && !isOk(s.status) ? (
                  <span className="muted small">
                    {" "}
                    · selisih {typeof s.diff === "number" ? rp(s.diff) : s.diff}
                  </span>
                ) : null}
              </span>
              <span className={`badge ${isOk(s.status) ? "ok" : "warn"}`}>{s.status ?? "tidak ada"}</span>
            </div>
          ))}
        </div>
      </Section>

      <footer>
        {isTb
          ? `Sumber: tab TB dan Entry Jurnal spreadsheet ${c.short}. Laba rugi, neraca, dan arus kas (tidak langsung) dihitung dari mapping akun di TB. Angka dari link publish-to-web dibulatkan ke Rupiah.`
          : `Sumber: sheet PL, BS, CF, AR, AP pada spreadsheet ${c.short}.`}{" "}
        Nilai dalam Rupiah.
      </footer>
    </>
  );
}
