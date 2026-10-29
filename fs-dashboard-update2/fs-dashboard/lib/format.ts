const full = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Rupiah lengkap, negatif pakai tanda minus. */
export function rp(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "–";
  if (Math.abs(n) < 0.5) return "0";
  return (n < 0 ? "-" : "") + full.format(Math.abs(Math.round(n)));
}

/** Rupiah ringkas: 1,2 M / 311,6 jt / 45 rb. */
export function rpShort(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "–";
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const f = (v: number, d = 1) =>
    new Intl.NumberFormat("id-ID", { maximumFractionDigits: d }).format(v);
  if (a >= 1e12) return `${sign}Rp ${f(a / 1e12, 2)} T`;
  if (a >= 1e9) return `${sign}Rp ${f(a / 1e9, 2)} M`;
  if (a >= 1e6) return `${sign}Rp ${f(a / 1e6, 1)} jt`;
  if (a >= 1e3) return `${sign}Rp ${f(a / 1e3, 0)} rb`;
  return `${sign}Rp ${f(a, 0)}`;
}

export function pct(n: number | null | undefined, d = 1): string {
  if (n == null || !isFinite(n)) return "–";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: d }).format(n * 100) + "%";
}

export function wibTime(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(d) + " WIB";
}
