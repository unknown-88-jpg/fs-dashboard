import type { ReactNode } from "react";

export function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  tone?: "pos" | "neg" | "neutral";
}) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone === "neg" ? "neg" : tone === "pos" ? "pos" : ""}`}>{value}</div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
    </div>
  );
}

export function Delta({ now, prev, invert = false }: { now: number; prev: number | null; invert?: boolean }) {
  if (prev === null || Math.abs(prev) < 1) return <span className="muted">–</span>;
  const d = (now - prev) / Math.abs(prev);
  const up = d >= 0;
  const good = invert ? !up : up;
  return (
    <span className={good ? "pos" : "neg"}>
      {up ? "▲" : "▼"} {new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.abs(d) * 100)}% vs bulan lalu
    </span>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {hint ? <span className="muted small">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}
