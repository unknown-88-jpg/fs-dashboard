import type { Cell } from "./parse";
import { parseCsv } from "./csv";
import type { Company } from "./companies";

export type SheetData = Record<string, Cell[][]>;

/** Mode uji lokal: MOCK_DATA_DIR/<key>.json (script) atau MOCK_DATA_DIR/<slug>-tb.csv & -ej.csv (csv). */
async function mockDir() {
  const dir = process.env.MOCK_DATA_DIR;
  if (!dir) return null;
  const { readFileSync } = await import("node:fs");
  return { dir, read: (f: string) => readFileSync(`${dir}/${f}`, "utf8") };
}

/** Ambil tab PL/BS/CF/AR/AP dari endpoint Apps Script milik spreadsheet. */
export async function fetchScript(c: Company, url?: string): Promise<SheetData> {
  const mock = await mockDir();
  if (mock) return JSON.parse(mock.read(`${c.sheetId}.json`));
  const token = process.env.SHEETS_TOKEN;
  if (!url || !token) {
    throw new Error("URL Apps Script atau SHEETS_TOKEN belum di-set di Environment Variables.");
  }
  const full = `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  const res = await fetch(full, { cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`Apps Script balas HTTP ${res.status}`);
  const text = await res.text();
  let data: SheetData & { error?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Apps Script tidak balas JSON. Cek deployment: Execute as 'Me' dan Who has access 'Anyone'.");
  }
  if ((data as { error?: string }).error) {
    throw new Error(`Apps Script menolak: ${(data as { error?: string }).error} (token tidak cocok?)`);
  }
  return data;
}

/** Ambil satu tab yang dipublikasikan sebagai CSV (File > Share > Publish to web). */
export async function fetchCsv(c: Company, which: "tb" | "ej", url?: string): Promise<Cell[][]> {
  const mock = await mockDir();
  if (mock) return parseCsv(mock.read(`${c.slug}-${which}.csv`));
  const label = which === "tb" ? "DORMA_TB_CSV_URL (tab TB)" : "DORMA_EJ_CSV_URL (tab Entry Jurnal)";
  if (!url) throw new Error(`${label} belum di-set di Environment Variables.`);
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`${label} bukan URL yang valid.`);
  }
  if (u.protocol !== "https:" || u.hostname !== "docs.google.com") {
    throw new Error(`${label} harus berupa link docs.google.com hasil Publish to web.`);
  }
  const res = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`Link CSV ${which.toUpperCase()} balas HTTP ${res.status}. Publikasi sudah dihentikan?`);
  const text = await res.text();
  if (/^\s*<(!doctype|html)/i.test(text)) {
    throw new Error(`Link ${label} balas halaman HTML, bukan CSV. Pastikan formatnya CSV (output=csv).`);
  }
  return parseCsv(text);
}
