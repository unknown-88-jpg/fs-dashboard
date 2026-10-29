export type Source =
  | { kind: "script"; url?: string } // Apps Script web app (tab PL/BS/CF/AR/AP)
  | { kind: "csv"; tbUrl?: string; ejUrl?: string }; // Publish to web CSV (tab TB + Entry Jurnal)

export interface Company {
  slug: string;
  name: string;
  short: string;
  prefix: string; // awalan nama env, mis. LIXUS_PT -> LIXUS_PT_TB_CSV_URL
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
    prefix: "FUKU",
    sheetId: process.env.FUKU_SHEET_ID || "1oPeHBC6tomdLMmOCZtiaALQ_xoRGu0SQtI6tbZAWL6o",
    source: sourceFor("FUKU"),
  },
  {
    slug: "hitaloka",
    name: "PT Hita Loka Manava",
    short: "Hitaloka",
    prefix: "HITALOKA",
    sheetId: process.env.HITALOKA_SHEET_ID || "1eKfZ_4q0QdX_MqC8q7CIzX4DZHLsQfOyLeEumvpncwY",
    source: sourceFor("HITALOKA"),
  },
  {
    slug: "dorma",
    name: "PT Dorma Teknologi Indonesia",
    short: "Dorma",
    prefix: "DORMA",
    sheetId: process.env.DORMA_SHEET_ID || undefined,
    source: sourceFor("DORMA"),
  },
  {
    slug: "lixus-pt",
    name: "PT Lintas Ekspansi Usaha",
    short: "Lixus PT",
    prefix: "LIXUS_PT",
    sheetId: process.env.LIXUS_PT_SHEET_ID || undefined,
    source: sourceFor("LIXUS_PT"),
  },
  {
    slug: "lixus-cv",
    name: "CV Lintas Ekspansi Usaha",
    short: "Lixus CV",
    prefix: "LIXUS_CV",
    sheetId: process.env.LIXUS_CV_SHEET_ID || undefined,
    source: sourceFor("LIXUS_CV"),
  },
  {
    slug: "nec-creative",
    name: "PT Nilai Ekosistem Commercial - Creative",
    short: "NEC Creative",
    prefix: "NEC_CREATIVE",
    sheetId: process.env.NEC_CREATIVE_SHEET_ID || undefined,
    source: sourceFor("NEC_CREATIVE"),
  },
  {
    slug: "nec-commercial",
    name: "PT NEC - Commercial",
    short: "NEC Commercial",
    prefix: "NEC_COMMERCIAL",
    sheetId: process.env.NEC_COMMERCIAL_SHEET_ID || undefined,
    source: sourceFor("NEC_COMMERCIAL"),
  },
];

export const getCompany = (slug: string) => COMPANIES.find((c) => c.slug === slug);

/** Kunci cache: berubah kalau URL sumber berubah. */
export const sourceKey = (c: Company) =>
  c.source.kind === "script" ? `s:${c.source.url ?? ""}` : `c:${c.source.tbUrl ?? ""}|${c.source.ejUrl ?? ""}`;
