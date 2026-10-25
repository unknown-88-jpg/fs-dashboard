import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// Tombol "Refresh data sekarang": buang cache Sheets, data diambil ulang saat halaman dibuka.
export async function POST(req: NextRequest) {
  revalidateTag("sheets");
  const back = req.headers.get("referer") || new URL("/", req.url).toString();
  return NextResponse.redirect(back, 303);
}
