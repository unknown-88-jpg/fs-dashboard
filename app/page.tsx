import Link from "next/link";
import { COMPANIES } from "@/lib/companies";
import { safeModel } from "@/lib/data";
import { pct, rp, rpShort, wibTime } from "@/lib/format";
import { Kpi, Section } from "@/components/Ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const results = await Promise.all(COMPANIES.map(async (c) => ({ c, r: await safeModel(c) })));
  const fetched = results.find((x) => x.r.ok);
  const at = fetched && fetched.r.ok ? new Date(fetched.r.model.fetchedAt) : null;

  const oks = results.flatMap(({ c, r }) => (r.ok ? [{ c, m: r.model }] : []));
  const sum = (f: (m: (typeof oks)[number]["m"]) => number) => oks.reduce((a, x) => a + f(x.m), 0);
  const tot = {
    revenue: sum((m) => m.pl.revenue.ytd),
    gross: sum((m) => m.pl.grossProfit.ytd),
    net: sum((m) => m.pl.netProfit.ytd),
    cash: sum((m) => m.bs.current.cash),
    receivables: sum((m) => m.bs.current.receivables),
    assets: sum((m) => m.bs.current.totalAssets),
    liabilities: sum((m) => m.bs.current.liabilities),
    equity: sum((m) => m.bs.current.equity),
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Ringkasan</h1>
          <div className="muted small">
            {at ? `Data diambil dari Google Sheets: ${wibTime(at)}` : "Data belum bisa diambil"}
          </div>
        </div>
        <form action="/api/refresh" method="post">
          <button className="btn primary" type="submit">
            Refresh data sekarang
          </button>
        </form>
      </div>

      {oks.length > 0 ? (
        <>
          <div className="grid g-kpi">
            <Kpi label="Pendapatan neto (YTD)" value={rpShort(tot.revenue)} sub={`Gabungan ${oks.length} entitas`} />
            <Kpi
              label="Laba bruto (YTD)"
              value={rpShort(tot.gross)}
              sub={`Gross margin ${pct(tot.revenue ? tot.gross / tot.revenue : null)}`}
            />
            <Kpi
              label="Laba bersih (YTD)"
              value={rpShort(tot.net)}
              tone={tot.net < 0 ? "neg" : "pos"}
              sub={`Net margin ${pct(tot.revenue ? tot.net / tot.revenue : null)}`}
            />
            <Kpi label="Kas akhir" value={rpShort(tot.cash)} sub={`Piutang ${rpShort(tot.receivables)}`} />
            <Kpi label="Total aset" value={rpShort(tot.assets)} sub={`Liabilitas ${rpShort(tot.liabilities)}`} />
            <Kpi label="Ekuitas" value={rpShort(tot.equity)} tone={tot.equity < 0 ? "neg" : "neutral"} />
          </div>

          <Section
            title="Perbandingan entitas"
            hint="Penjumlahan sederhana, tanpa eliminasi transaksi antar entitas"
          >
            <div className="card scroll">
              <table>
                <thead>
                  <tr>
                    <th>Entitas</th>
                    <th>Periode</th>
                    <th>Pendapatan neto</th>
                    <th>Laba bersih</th>
                    <th>Net margin</th>
                    <th>Kas</th>
                    <th>Total aset</th>
                    <th>Ekuitas</th>
                  </tr>
                </thead>
                <tbody>
                  {oks.map(({ c, m }) => (
                    <tr key={c.slug}>
                      <td>
                        <Link href={`/${c.slug}`}>{c.short}</Link>
                      </td>
                      <td>
                        {m.months[0]} – {m.reportLabel}
                      </td>
                      <td>{rp(m.pl.revenue.ytd)}</td>
                      <td className={m.pl.netProfit.ytd < 0 ? "neg" : ""}>{rp(m.pl.netProfit.ytd)}</td>
                      <td>{pct(m.pl.revenue.ytd ? m.pl.netProfit.ytd / m.pl.revenue.ytd : null)}</td>
                      <td className={m.bs.current.cash < 0 ? "neg" : ""}>{rp(m.bs.current.cash)}</td>
                      <td>{rp(m.bs.current.totalAssets)}</td>
                      <td className={m.bs.current.equity < 0 ? "neg" : ""}>{rp(m.bs.current.equity)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Total gabungan</td>
                    <td></td>
                    <td>{rp(tot.revenue)}</td>
                    <td className={tot.net < 0 ? "neg" : ""}>{rp(tot.net)}</td>
                    <td>{pct(tot.revenue ? tot.net / tot.revenue : null)}</td>
                    <td className={tot.cash < 0 ? "neg" : ""}>{rp(tot.cash)}</td>
                    <td>{rp(tot.assets)}</td>
                    <td className={tot.equity < 0 ? "neg" : ""}>{rp(tot.equity)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>
        </>
      ) : null}

      <Section title="Per entitas">
      <div className="grid g-2">
        {results.map(({ c, r }) => {
          if (!r.ok) {
            return (
              <div className="err" key={c.slug}>
                <strong>{c.name}</strong>
                <div style={{ marginTop: 6 }}>Gagal ambil data dari spreadsheet.</div>
                <code>{r.error}</code>
              </div>
            );
          }
          const m = r.model;
          const margin = m.pl.revenue.ytd ? m.pl.netProfit.ytd / m.pl.revenue.ytd : null;
          return (
            <Link href={`/${c.slug}`} className="card co-card" key={c.slug}>
              <h3>{c.name}</h3>
              <div className="muted small">{m.months[0]} s.d. {m.reportLabel} (YTD periode berjalan)</div>
              <div className="co-stats">
                <div>
                  <div className="l">Pendapatan neto</div>
                  <div className="v">{rpShort(m.pl.revenue.ytd)}</div>
                </div>
                <div>
                  <div className="l">Laba bersih</div>
                  <div className={`v ${m.pl.netProfit.ytd < 0 ? "neg" : "pos"}`}>{rpShort(m.pl.netProfit.ytd)}</div>
                </div>
                <div>
                  <div className="l">Net margin</div>
                  <div className="v">{pct(margin)}</div>
                </div>
                <div>
                  <div className="l">Kas akhir</div>
                  <div className="v">{rpShort(m.bs.current.cash)}</div>
                </div>
                <div>
                  <div className="l">Total aset</div>
                  <div className="v">{rpShort(m.bs.current.totalAssets)}</div>
                </div>
                <div>
                  <div className="l">Ekuitas</div>
                  <div className={`v ${m.bs.current.equity < 0 ? "neg" : ""}`}>{rpShort(m.bs.current.equity)}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      </Section>

      <footer>
        Angka dibaca langsung dari spreadsheet masing-masing PT, jadi dashboard ini otomatis ikut berubah
        saat Entry Jurnal di spreadsheet diisi. Cache {Number(process.env.SHEETS_CACHE_SECONDS || 600) / 60} menit.
        Total gabungan adalah penjumlahan sederhana per entitas (tanpa eliminasi antar entitas, dan periode tiap entitas bisa berbeda), bukan laporan konsolidasi resmi.
      </footer>
    </>
  );
}
