import type { CompanyModel } from "@/lib/parse";
import { buildIndicators, fmtValue, type Tone } from "@/lib/analysis";

const LABEL: Record<Tone, string> = { ok: "Sehat", warn: "Waspada", bad: "Perlu perhatian", none: "–" };
const BADGE: Record<Tone, string> = { ok: "ok", warn: "warn", bad: "bad", none: "" };

export function Matrix({ m }: { m: CompanyModel }) {
  const inds = buildIndicators(m);
  if (!inds.length) return null;
  const cols = m.activeMonths.map((i) => m.months[i]);
  const groups = [...new Set(inds.map((x) => x.group))];
  return (
    <div className="card scroll">
      <table>
        <thead>
          <tr>
            <th>Indikator</th>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
            <th>Status {cols[cols.length - 1]}</th>
          </tr>
        </thead>
        <tbody>
          {groups.flatMap((g) => [
            <tr key={g} className="group">
              <td colSpan={cols.length + 2}>{g}</td>
            </tr>,
            ...inds
              .filter((x) => x.group === g)
              .map((x) => (
                <tr key={x.key}>
                  <td>
                    {x.label}
                    <div className="muted small hint">{x.hint}</div>
                  </td>
                  {x.values.map((v, i) => (
                    <td key={i} className={v !== null && v < 0 && x.fmt === "rp" ? "neg" : ""}>
                      {fmtValue(v, x.fmt)}
                    </td>
                  ))}
                  <td>{x.tone === "none" ? <span className="muted">–</span> : <span className={`badge ${BADGE[x.tone]}`}>{LABEL[x.tone]}</span>}</td>
                </tr>
              )),
          ])}
        </tbody>
      </table>
    </div>
  );
}
