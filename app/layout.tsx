import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { COMPANIES } from "@/lib/companies";

export const metadata: Metadata = {
  title: "Dashboard Keuangan",
  description: "Dashboard laporan keuangan yang tersambung ke Google Sheets",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <div className="wrap">
          <div className="topbar">
            <Link href="/" className="brand">
              Dashboard Keuangan
            </Link>
            <nav className="nav">
              <Link href="/">Ringkasan</Link>
              {COMPANIES.map((c) => (
                <Link key={c.slug} href={`/${c.slug}`}>
                  {c.short}
                </Link>
              ))}
            </nav>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
