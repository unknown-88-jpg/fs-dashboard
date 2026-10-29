import { readFileSync } from "node:fs";
import { parseCsv } from "../lib/csv";
import { buildModelFromTB } from "../lib/tb";
const dir = process.argv[2];
try {
  const m = buildModelFromTB(parseCsv(readFileSync(`${dir}/tb.csv`, "utf8")), parseCsv(readFileSync(`${dir}/ej.csv`, "utf8")));
  const p = m.pl;
  console.log(m.months.join(" "), "| active", m.activeMonths, "| report", m.reportLabel);
  console.log("pendapatan neto", p.revenue.m.map(Math.round), Math.round(p.revenue.ytd));
  console.log("laba bersih   ", p.netProfit.m.map(Math.round), Math.round(p.netProfit.ytd));
  console.log("kas", m.bs.perMonth.map((b) => Math.round(b.cash)), "aset", m.bs.perMonth.map((b) => Math.round(b.totalAssets)));
  console.log("controls", m.controls.map((c) => `${c.label}: ${c.ok ? "OK" : "GAGAL"} ${Math.round(c.maxAbs)}`));
  console.log("jurnal", m.journal!.count, "unposted", m.journal!.unposted);
} catch (e) { console.log("ERROR", (e as Error).message); }
