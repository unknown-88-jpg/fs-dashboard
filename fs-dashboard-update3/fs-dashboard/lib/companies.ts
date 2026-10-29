export type Source =
  | { kind: "script"; url?: string } // Apps Script web app (tab PL/BS/CF/AR/AP)
  | { kind: "csv"; tbUrl?: string; ejUrl?: string }; // Publish to web CSV (tab TB + Entry Jurnal)

export interface Company {
  slug: string;
  name: string;
  short: string;
  sheetId?: string; // hanya untuk tombol "Buka spreadsheet"
  source: Source;
}

// Semua PT dibaca dari link "Publish to web" (CSV) tab TB dan Entry Jurnal.
// Fallback: kalau <PREFIX>_TB_CSV_URL kosong tapi <PREFIX>_SCRIPT_URL ada, pakai Apps Script lama (tab PL/BS/CF/AR/AP).
function sourceFor(prefix: string): Source {
  const tb = process.env[`${prefix}_TB_CSV_URL`];
  const ej = process.env[`${prefix}_EJ_CSV_URL`];
  const script = process.env[`${prefix}_SCRIPT_URL`];
  if (!tb && !ej && script) return { kind: "script", url: script };
  return { kind: "csv", tbUrl: tb, ejUrl: ej };
}

export const COMPANIES: Company[] = [
  {
    slug: "fuku",
    name: "PT Fuku Aksa Arta",
    short: "FUKU",
    sheetId: process.env.FUKU_SHEET_ID || "1oPeHBC6tomdLMmOCZtiaALQ_xoRGu0SQtI6tbZAWL6o",
    source: sourceFor("FUKU"),
  },
  {
    slug: "hitaloka",
    name: "PT Hita Loka Manava",
    short: "Hitaloka",
    sheetId: process.env.HITALOKA_SHEET_ID || "1eKfZ_4q0QdX_MqC8q7CIzX4DZHLsQfOyLeEumvpncwY",
    source: sourceFor("HITALOKA"),
  },
  {
    slug: "dorma",
    name: "PT Dorma Teknologi Indonesia",
    short: "Dorma",
    sheetId: process.env.DORMA_SHEET_ID || undefined,
    source: sourceFor("DORMA"),
  },
];

export const getCompany = (slug: string) => COMPANIES.find((c) => c.slug === slug);

/** Kunci cache: berubah kalau URL sumber berubah. */
export const sourceKey = (c: Company) =>
  c.source.kind === "script" ? `s:${c.source.url ?? ""}` : `c:${c.source.tbUrl ?? ""}|${c.source.ejUrl ?? ""}`;
