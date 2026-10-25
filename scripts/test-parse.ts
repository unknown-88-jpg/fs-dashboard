// Uji parser memakai file contoh (export teks dari kedua spreadsheet).
// Jalankan: npx tsx scripts/test-parse.ts <file1> <file2>
import { readFileSync } from "node:fs";
import { buildModel, type Cell } from "../lib/parse";

function csv(text: string): Cell[][] {
  const rows: Cell[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function sheets(file: string): Record<string, Cell[][]> {
  const t = readFileSync(file, "utf8");
  const out: Record<string, Cell[][]> = {};
  const parts = t.split(/^## Sheet name: /m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf("\n");
    out[p.slice(0, nl).trim()] = csv(p.slice(nl + 1));
  }
  return out;
}

for (const f of process.argv.slice(2)) {
  const s = sheets(f);
  const m = buildModel({ pl: s.PL, bs: s.BS, cf: s.CF, ar: s.AR, ap: s.AP });
  console.log("=====", f);
  console.log("active", m.activeMonths, "report", m.reportLabel);
  const p = m.pl;
  for (const k of ["revenueGross","returns","revenue","cogs","grossProfit","opex","operatingProfit","otherNet","netProfit"] as const)
    console.log(k.padEnd(16), JSON.stringify(p[k].m), p[k].ytd);
  console.log("revenueLines", m.revenueLines.map(l => `${l.label}=${l.ytd}`));
  console.log("opexLines", m.opexLines.map(l => `${l.label}=${l.ytd}`));
  console.log("bs.cur", m.bs.current, "prev", m.bs.previous);
  console.log("cf", m.cf.operating.m, m.cf.operating.ytd, m.cf.investing.ytd, m.cf.financing.ytd, m.cf.cashBegin, m.cf.cashEnd);
  console.log("controls", m.controls.map(c => `${c.sheet}:${c.ok}`).join(" "));
  console.log("subledger", JSON.stringify(m.subledger));
}
