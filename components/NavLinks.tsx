"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string; dot?: boolean }[] }) {
  const path = usePathname();
  return (
    <nav className="nav">
      {items.map((it) => (
        <Link key={it.href} href={it.href} data-active={path === it.href}>
          {it.dot ? <span className="dot" /> : null}
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
