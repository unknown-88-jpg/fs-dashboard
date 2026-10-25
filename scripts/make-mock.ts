// Bikin data mock dari file export teks: npx tsx scripts/make-mock.ts <file> <spreadsheetId> <outDir>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const [file, id, out] = process.argv.slice(2);
const t = readFileSync(file, "utf8");
function csv(text: string) {
  const rows: (string | number)[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const o: Record<string, unknown> = {};
for (const p of t.split(/^## Sheet name: /m).slice(1)) {
  const nl = p.indexOf("\n");
  o[p.slice(0, nl).trim()] = csv(p.slice(nl + 1));
}
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/${id}.json`, JSON.stringify(o));
