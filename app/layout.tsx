import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { COMPANIES } from "@/lib/companies";
import { NavLinks } from "@/components/NavLinks";

export const metadata: Metadata = {
  title: "Dashboard Keuangan",
  description: "Dashboard laporan keuangan yang tersambung ke Google Sheets",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const items = [
    { href: "/", label: "Ringkasan" },
    ...COMPANIES.map((c) => ({ href: `/${c.slug}`, label: c.short, dot: true })),
  ];
  return (
    <html lang="id">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <Link href="/" className="brand">
              <span className="brand-mark">FS</span>
              <span>
                Dashboard Keuangan
                <small>Laporan per PT</small>
              </span>
            </Link>
            <div>
              <div className="nav-label">Menu</div>
              <NavLinks items={items} />
            </div>
          </aside>
          <div className="main">
            <header className="topbar">
              <Link href="/" className="brand">
                <span className="brand-mark">FS</span>
              </Link>
              <NavLinks items={items.map((i) => ({ ...i, dot: false }))} />
            </header>
            <div className="wrap">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
