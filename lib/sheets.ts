import type { Cell } from "./parse";

export type SheetData = Record<string, Cell[][]>;

/**
 * Ambil data tab PL/BS/CF/AR/AP dari endpoint Apps Script milik spreadsheet.
 * Mode uji lokal: set MOCK_DATA_DIR berisi <spreadsheetId>.json = { "PL": [[...]], ... }
 */
export async function fetchSheets(opts: { sheetId: string; scriptUrl?: string }): Promise<SheetData> {
  if (process.env.MOCK_DATA_DIR) {
    const { readFileSync } = await import("node:fs");
    return JSON.parse(readFileSync(`${process.env.MOCK_DATA_DIR}/${opts.sheetId}.json`, "utf8"));
  }
  const token = process.env.SHEETS_TOKEN;
  if (!opts.scriptUrl || !token) {
    throw new Error("URL Apps Script atau SHEETS_TOKEN belum di-set di Environment Variables.");
  }
  const url = `${opts.scriptUrl}${opts.scriptUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`Apps Script balas HTTP ${res.status}`);
  const text = await res.text();
  let data: SheetData & { error?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "Apps Script tidak balas JSON. Cek deployment: Execute as 'Me' dan Who has access 'Anyone'."
    );
  }
  if ((data as { error?: string }).error) {
    throw new Error(`Apps Script menolak: ${(data as { error?: string }).error} (token tidak cocok?)`);
  }
  return data;
}
