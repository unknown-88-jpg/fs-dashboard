import { JWT } from "google-auth-library";
import type { Cell } from "./parse";

function getClient() {
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error("GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY belum di-set.");
  }
  return new JWT({
    email,
    key: rawKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

/** Ambil beberapa range sekaligus (1 request). Nilai angka dikembalikan sebagai number. */
export async function batchGet(spreadsheetId: string, ranges: string[]): Promise<Cell[][][]> {
  // Mode uji lokal (tanpa kredensial): MOCK_DATA_DIR berisi <spreadsheetId>.json = { "PL": [[...]], ... }
  if (process.env.MOCK_DATA_DIR) {
    const { readFileSync } = await import("node:fs");
    const data = JSON.parse(readFileSync(`${process.env.MOCK_DATA_DIR}/${spreadsheetId}.json`, "utf8"));
    return ranges.map((r) => data[r.split("!")[0]] ?? []);
  }
  const params = new URLSearchParams();
  ranges.forEach((r) => params.append("ranges", r));
  params.set("valueRenderOption", "UNFORMATTED_VALUE");
  params.set("majorDimension", "ROWS");
  const res = await getClient().request<{ valueRanges?: { values?: Cell[][] }[] }>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params}`,
  });
  return (res.data.valueRanges ?? []).map((v) => v.values ?? []);
}
