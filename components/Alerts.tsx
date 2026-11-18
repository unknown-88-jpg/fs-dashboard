import type { Alert } from "@/lib/alerts";
import { countAlerts } from "@/lib/alerts";

const LABEL = { bad: "Kritis", warn: "Waspada", info: "Catatan" } as const;
const CLS = { bad: "bad", warn: "warn", info: "" } as const;

export function AlertList({ alerts }: { alerts: Alert[] }) {
  const n = countAlerts(alerts);
  if (!alerts.length) {
    return (
      <div className="card">
        <span className="badge ok">Aman</span> <span className="muted">Tidak ada peringatan dari pengecekan otomatis.</span>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="alert-summary">
        {n.bad ? <span className="badge bad">{n.bad} kritis</span> : null}
        {n.warn ? <span className="badge warn">{n.warn} waspada</span> : null}
        {n.info ? <span className="badge">{n.info} catatan</span> : null}
      </div>
      <div className="checks">
        {alerts.map((a, idx) => (
          <div className="alert-row" key={idx}>
            <span className={`badge ${CLS[a.level]}`}>{LABEL[a.level]}</span>
            <div>
              <div className="alert-title">
                {a.title} <span className="muted small">· {a.area}</span>
              </div>
              <div className="muted small">{a.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
