import { unstable_cache } from "next/cache";
import { fetchSheets } from "./sheets";
import { buildModel, type CompanyModel } from "./parse";
import type { Company } from "./companies";

const TTL = Number(process.env.SHEETS_CACHE_SECONDS || 600);

async function fetchModel(c: Company): Promise<CompanyModel> {
  const d = await fetchSheets({ sheetId: c.sheetId, scriptUrl: c.scriptUrl });
  return buildModel({ pl: d.PL ?? [], bs: d.BS ?? [], cf: d.CF ?? [], ar: d.AR, ap: d.AP });
}

// Di-cache di Vercel Data Cache selama TTL. Kalau fetch gagal, error di-throw
// sehingga hasil gagal TIDAK ikut ter-cache.
export function getCompanyModel(c: Company): Promise<CompanyModel> {
  return unstable_cache(() => fetchModel(c), ["company-model", c.sheetId, c.scriptUrl ?? ""], {
    revalidate: TTL,
    tags: ["sheets"],
  })();
}

export async function safeModel(
  c: Company
): Promise<{ ok: true; model: CompanyModel } | { ok: false; error: string }> {
  try {
    return { ok: true, model: await getCompanyModel(c) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
