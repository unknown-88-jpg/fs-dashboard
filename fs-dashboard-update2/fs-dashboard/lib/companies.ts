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

export const COMPANIES: Company[] = [
  {
    slug: "fuku",
    name: "PT Fuku Aksa Arta",
    short: "FUKU",
    sheetId: process.env.FUKU_SHEET_ID || "1oPeHBC6tomdLMmOCZtiaALQ_xoRGu0SQtI6tbZAWL6o",
    source: { kind: "script", url: process.env.FUKU_SCRIPT_URL },
  },
  {
    slug: "hitaloka",
    name: "PT Hita Loka Manava",
    short: "Hitaloka",
    sheetId: process.env.HITALOKA_SHEET_ID || "1eKfZ_4q0QdX_MqC8q7CIzX4DZHLsQfOyLeEumvpncwY",
    source: { kind: "script", url: process.env.HITALOKA_SCRIPT_URL },
  },
  {
    slug: "dorma",
    name: "PT Dorma Teknologi Indonesia",
    short: "Dorma",
    sheetId: process.env.DORMA_SHEET_ID || undefined,
    source: { kind: "csv", tbUrl: process.env.DORMA_TB_CSV_URL, ejUrl: process.env.DORMA_EJ_CSV_URL },
  },
];

export const getCompany = (slug: string) => COMPANIES.find((c) => c.slug === slug);

/** Kunci cache: berubah kalau URL sumber berubah. */
export const sourceKey = (c: Company) =>
  c.source.kind === "script" ? `s:${c.source.url ?? ""}` : `c:${c.source.tbUrl ?? ""}|${c.source.ejUrl ?? ""}`;
