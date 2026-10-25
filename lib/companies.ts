export interface Company {
  slug: string;
  name: string;
  short: string;
  sheetId: string; // hanya dipakai untuk tombol "Buka spreadsheet"
  scriptUrl?: string; // URL web app Apps Script (env)
}

export const COMPANIES: Company[] = [
  {
    slug: "fuku",
    name: "PT Fuku Aksa Arta",
    short: "FUKU",
    sheetId: process.env.FUKU_SHEET_ID || "1oPeHBC6tomdLMmOCZtiaALQ_xoRGu0SQtI6tbZAWL6o",
    scriptUrl: process.env.FUKU_SCRIPT_URL,
  },
  {
    slug: "hitaloka",
    name: "PT Hita Loka Manava",
    short: "Hitaloka",
    sheetId: process.env.HITALOKA_SHEET_ID || "1eKfZ_4q0QdX_MqC8q7CIzX4DZHLsQfOyLeEumvpncwY",
    scriptUrl: process.env.HITALOKA_SCRIPT_URL,
  },
];

export const getCompany = (slug: string) => COMPANIES.find((c) => c.slug === slug);
