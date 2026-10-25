import { unstable_cache } from "next/cache";
import { batchGet } from "./sheets";
import { buildModel, type CompanyModel } from "./parse";
import type { Company } from "./companies";

const TTL = Number(process.env.SHEETS_CACHE_SECONDS || 600);

async function fetchModel(sheetId: string): Promise<CompanyModel> {
  const [pl, bs, cf, ar, ap] = await batchGet(sheetId, [
    "PL!A1:H90",
    "BS!A1:H90",
    "CF!A1:H90",
    "AR!A1:N220",
    "AP!A1:N220",
  ]);
  return buildModel({ pl, bs, cf, ar, ap });
}

// Di-cache di Vercel Data Cache selama TTL. Kalau fetch gagal, error di-throw
// sehingga hasil gagal TIDAK ikut ter-cache.
export function getCompanyModel(c: Company): Promise<CompanyModel> {
  return unstable_cache(() => fetchModel(c.sheetId), ["company-model", c.sheetId], {
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
