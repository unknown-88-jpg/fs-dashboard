import Link from "next/link";
import { COMPANIES } from "@/lib/companies";
import { safeModel } from "@/lib/data";
import { pct, rpShort, wibTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const results = await Promise.all(COMPANIES.map(async (c) => ({ c, r: await safeModel(c) })));
  const fetched = results.find((x) => x.r.ok);
  const at = fetched && fetched.r.ok ? new Date(fetched.r.model.fetchedAt) : null;

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
          <button className="btn" type="submit">
            Refresh data sekarang
          </button>
        </form>
      </div>

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
              <div className="muted small">Sep s.d. {m.reportLabel} (YTD periode berjalan)</div>
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

      <footer>
        Angka dibaca langsung dari sheet PL, BS, CF masing-masing PT, jadi dashboard ini otomatis ikut berubah
        saat Entry Jurnal di spreadsheet diisi. Cache {Number(process.env.SHEETS_CACHE_SECONDS || 600) / 60} menit.
        Dua PT ditampilkan terpisah, bukan konsolidasi.
      </footer>
    </>
  );
}
