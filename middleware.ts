import { NextRequest, NextResponse } from "next/server";

// Basic Auth sederhana supaya data keuangan tidak terbuka untuk umum.
// Production tanpa DASHBOARD_PASSWORD = ditolak (fail closed).
export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  const user = process.env.DASHBOARD_USER || "admin";

  if (!password) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "DASHBOARD_PASSWORD belum di-set di environment variables.",
        { status: 503 }
      );
    }
    return NextResponse.next();
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const idx = decoded.indexOf(":");
      const u = decoded.slice(0, idx);
      const p = decoded.slice(idx + 1);
      if (u === user && p === password) return NextResponse.next();
    } catch {
      /* fallthrough */
    }
  }

  return new NextResponse("Login diperlukan", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Dashboard Keuangan", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
