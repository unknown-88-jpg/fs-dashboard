// Mesin laporan dari TB + Entry Jurnal.
// Membaca tab TB (saldo awal + mutasi neto bulanan per akun, lengkap dengan mapping
// "Pos Laporan Keuangan" & "Pos Arus Kas") dan tab Entry Jurnal, lalu menghitung
// laba rugi, neraca, arus kas (metode tidak langsung) dan ringkasan jurnal.
// Jumlah bulan mengikuti kolom TB, jadi bisa Mei-Des (8 bulan) atau periode lain.

import {
  toNum,
  type BalanceSnapshot,
  type Cell,
  type CompanyModel,
  type Control,
  type JournalSummary,
  type JournalTx,
  type Line,
} from "./parse";

const MON: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};
const MON_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

interface YMD {
  y: number;
  m: number;
  d: number;
}

export function parseDate(c: Cell): YMD | null {
  if (c === null || c === undefined || c === "") return null;
  if (typeof c === "number") {
    // serial tanggal Excel/Sheets
    if (c < 20000 || c > 80000) return null;
    const dt = new Date(Math.round((c - 25569) * 86400000));
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }
  if (typeof c !== "string") return null;
  const s = c.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  // dd-mm-yyyy, dd/mm/yyyy (hari lebih dulu, format Indonesia)
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    if (+m[2] < 1 || +m[2] > 12) return null;
    return { y, m: +m[2], d: +m[1] };
  }
  // 31-May-26, 31 Mei 2026
  m = s.match(/^(\d{1,2})[-/ ]+([A-Za-z]{3,})[-/ ,.]*(\d{2,4})$/);
  if (m) {
    const mon = MON[m[2].slice(0, 3).toLowerCase()];
    if (!mon) return null;
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return { y, m: mon, d: +m[1] };
  }
  return null;
}

const ymKey = (d: YMD) => d.y * 12 + (d.m - 1);
const monthLabel = (d: YMD) => `${MON_ID[d.m - 1]}-${String(d.y).slice(-2)}`;
const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const fmtDate = (d: YMD) =>
  `${String(d.d).padStart(2, "0")}-${String(d.m).padStart(2, "0")}-${d.y}`;

interface Acct {
  no: number;
  name: string;
  pos: string;
  cfPos: string;
  rep: "N" | "L"; // Neraca / Laba rugi
  open: number;
  mut: number[]; // mutasi neto bulanan, D+ / K-
}

const zeros = (n: number) => new Array<number>(n).fill(0);
const sumArr = (a: number[]) => a.reduce((x, y) => x + y, 0);
const line = (label: string, m: number[]): Line => ({ label, m: m.map((v) => v + 0), ytd: sumArr(m) + 0 });

function isInvesting(l: string) {
  return /^(perolehan aset|penempatan|piutang jangka panjang)/i.test(l);
}
function isFinancing(l: string) {
  return /(pinjaman|liabilitas sewa|pemegang saham|setoran modal|dividen|ekuitas)/i.test(l);
}

export function buildModelFromTB(tbRows: Cell[][], ejRows: Cell[][]): CompanyModel {
  // ---------- 1. TB: header dan blok kolom ----------
  const hi = tbRows.findIndex((r, i) => i < 8 && r.some((c) => /^\*?no\.?\s*akun$/i.test(String(c ?? "").trim())));
  if (hi < 0) throw new Error("Tab TB: baris header (*NoAkun) tidak ditemukan. Cek link CSV mengarah ke tab TB.");
  const hdr = tbRows[hi];
  const grp = hi > 0 ? tbRows[hi - 1] : [];
  const colOf = (name: string) => hdr.findIndex((c) => norm(c) === name);
  const cName = colOf("*namaakun") >= 0 ? colOf("*namaakun") : 1;
  const cPos = colOf("pos laporan keuangan");
  const cCf = colOf("pos arus kas");
  const cTipe = colOf("tipe");
  const cRep = colOf("laporan");
  if ([cPos, cTipe, cRep].some((c) => c < 0)) {
    throw new Error("Tab TB: kolom Pos Laporan Keuangan / Tipe / Laporan tidak ditemukan.");
  }
  const gIdx = (prefix: string) => grp.findIndex((c) => norm(c).startsWith(prefix));
  const gOpen = gIdx("saldo awal neto");
  const gMut = gIdx("mutasi neto");
  if (gMut < 0) throw new Error("Tab TB: blok 'Mutasi Neto Bulanan' tidak ditemukan.");
  const nonEmptyGroups = grp.map((c, i) => (norm(c) ? i : -1)).filter((i) => i > gMut);
  const gMutEnd = nonEmptyGroups.length ? nonEmptyGroups[0] : hdr.length;

  const monthCols: { col: number; ymd: YMD }[] = [];
  for (let c = gMut; c < gMutEnd; c++) {
    const d = parseDate(hdr[c]);
    if (d) monthCols.push({ col: c, ymd: d });
  }
  if (!monthCols.length) throw new Error("Tab TB: header tanggal bulanan tidak terbaca.");
  const n = monthCols.length;
  const months = monthCols.map((x) => monthLabel(x.ymd));
  const monthIdxByKey = new Map(monthCols.map((x, i) => [ymKey(x.ymd), i]));

  // ---------- 2. Akun ----------
  const accts: Acct[] = [];
  for (let r = hi + 1; r < tbRows.length; r++) {
    const row = tbRows[r];
    if (norm(row[cTipe]) !== "detail") continue;
    const rep = norm(row[cRep]);
    if (!rep.startsWith("neraca") && !rep.startsWith("laba")) continue;
    const no = toNum(row[0]);
    if (no === null) continue;
    accts.push({
      no,
      name: String(row[cName] ?? "").trim(),
      pos: String(row[cPos] ?? "").trim(),
      cfPos: cCf >= 0 ? String(row[cCf] ?? "").trim() : "",
      rep: rep.startsWith("neraca") ? "N" : "L",
      open: gOpen >= 0 ? toNum(row[gOpen]) ?? 0 : 0,
      mut: monthCols.map((x) => toNum(row[x.col]) ?? 0),
    });
  }
  const byNo = new Map(accts.map((a) => [a.no, a]));
  const lead = (a: Acct) => String(a.no)[0];
  const L = accts.filter((a) => a.rep === "L");
  const N = accts.filter((a) => a.rep === "N");

  // ---------- 3. Laba rugi (D+ / K-  ->  pendapatan positif) ----------
  const monthly = (list: Acct[], sign: 1 | -1) =>
    zeros(n).map((_, i) => list.reduce((s, a) => s + sign * a.mut[i], 0));
  const group = (list: Acct[], sign: 1 | -1): Line[] => {
    const m = new Map<string, number[]>();
    for (const a of list) {
      const k = a.pos || a.name;
      const cur = m.get(k) ?? zeros(n);
      a.mut.forEach((v, i) => (cur[i] += sign * v));
      m.set(k, cur);
    }
    return [...m.entries()].map(([k, v]) => line(k, v));
  };
  const nz = (l: Line) => Math.abs(l.ytd) > 0.5 || l.m.some((v) => Math.abs(v) > 0.5);

  const isReturn = (a: Acct) => /^retur/i.test(a.pos);
  const rev = L.filter((a) => lead(a) === "4");
  const revGrossAcc = rev.filter((a) => !isReturn(a));
  const retAcc = rev.filter(isReturn);
  const cogsAcc = L.filter((a) => lead(a) === "5");
  const opexAcc = L.filter((a) => lead(a) === "6");
  const otherAcc = L.filter((a) => lead(a) === "7");
  const taxAcc = L.filter((a) => lead(a) === "8");
  const unknownL = L.filter((a) => !["4", "5", "6", "7", "8"].includes(lead(a)));

  const revenueGross = monthly(revGrossAcc, -1);
  const returns = monthly(retAcc, -1);
  const revenue = revenueGross.map((v, i) => v + returns[i]);
  const cogs = monthly(cogsAcc, 1);
  const grossProfit = revenue.map((v, i) => v - cogs[i]);
  const opex = monthly(opexAcc, 1);
  const operatingProfit = grossProfit.map((v, i) => v - opex[i]);
  const otherNet = monthly(otherAcc, -1);
  const tax = monthly(taxAcc, 1);
  const netProfit = operatingProfit.map((v, i) => v + otherNet[i] - tax[i] - unknownL.reduce((s, a) => s + a.mut[i], 0));

  const revenueLines = group(revGrossAcc, -1).filter(nz);
  const cogsLines = group(cogsAcc, 1).filter(nz).sort((a, b) => b.ytd - a.ytd);
  const opexLines = group(opexAcc, 1).filter(nz).sort((a, b) => b.ytd - a.ytd);

  // ---------- 4. Entry Jurnal ----------
  const ejHi = ejRows.findIndex((r, i) => i < 8 && r.some((c) => norm(c) === "tanggal"));
  const ej = ejHi >= 0 ? ejRows[ejHi] : [];
  const ejCol = (re: RegExp) => ej.findIndex((c) => re.test(norm(c)));
  const eDate = ejCol(/^tanggal/);
  const eDesc = ejCol(/^keterangan/);
  const eRef = ejCol(/^ref/);
  const eAmt = ejCol(/^nominal/);
  const eDeb = ejCol(/^coa 1/);
  const eCre = ejCol(/^coa 2/);
  if (ejHi < 0 || [eDate, eAmt, eDeb, eCre].some((c) => c < 0)) {
    throw new Error("Tab Entry Jurnal: header (Tanggal, Nominal, COA 1, COA 2) tidak ditemukan. Cek link CSV mengarah ke tab Entry Jurnal.");
  }

  const perMonthCount = zeros(n);
  const revParty = new Map<string, number>();
  const costParty = new Map<string, number>();
  const txs: JournalTx[] = [];
  let count = 0;
  let unposted = 0;
  const nameOf = (no: number | null) => (no !== null ? byNo.get(no)?.name ?? String(no) : "");

  for (let r = ejHi + 1; r < ejRows.length; r++) {
    const row = ejRows[r];
    const d = parseDate(row[eDate]);
    const amt = toNum(row[eAmt]);
    const debNo = toNum(row[eDeb]);
    const creNo = toNum(row[eCre]);
    if (!d && (amt === null || amt === 0) && debNo === null && creNo === null) continue; // baris kosong
    if (amt === null || amt === 0) continue;
    count++;
    const mi = d ? monthIdxByKey.get(ymKey(d)) : undefined;
    const okDeb = debNo !== null && byNo.has(debNo);
    const okCre = creNo !== null && byNo.has(creNo);
    if (!d || mi === undefined || !okDeb || !okCre) {
      unposted++;
      continue;
    }
    perMonthCount[mi]++;
    const desc = String(row[eDesc] ?? "").replace(/\s+/g, " ").trim() || "(tanpa keterangan)";
    const dLead = String(debNo)[0];
    const cLead = String(creNo)[0];
    if (cLead === "4") revParty.set(desc, (revParty.get(desc) ?? 0) + amt);
    if (dLead === "4") revParty.set(desc, (revParty.get(desc) ?? 0) - amt);
    if (dLead === "5" || dLead === "6") costParty.set(desc, (costParty.get(desc) ?? 0) + amt);
    if (cLead === "5" || cLead === "6") costParty.set(desc, (costParty.get(desc) ?? 0) - amt);
    txs.push({
      date: fmtDate(d),
      desc,
      ref: String(row[eRef] ?? "").trim(),
      debit: nameOf(debNo),
      credit: nameOf(creNo),
      amount: amt,
    });
  }
  const top = (m: Map<string, number>) =>
    [...m.entries()]
      .filter(([, v]) => v > 0.5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  const journal: JournalSummary = {
    count,
    perMonth: perMonthCount,
    topRevenueParties: top(revParty),
    topCostParties: top(costParty),
    largest: [...txs].sort((a, b) => b.amount - a.amount).slice(0, 8),
    unposted,
  };

  // ---------- 5. Neraca ----------
  const profitCum: number[] = [];
  const lrOpen = L.reduce((s, a) => s + a.open, 0);
  netProfit.reduce((acc, v, i) => ((profitCum[i] = acc + v), acc + v), -lrOpen);

  const bal = (a: Acct, i: number) => a.open + a.mut.slice(0, i + 1).reduce((s, v) => s + v, 0);
  const isCash = (a: Acct) => norm(a.pos) === "kas dan setara kas";
  const snap = (i: number): BalanceSnapshot => {
    const assets = N.filter((a) => lead(a) === "1");
    const sumB = (l: Acct[]) => l.reduce((s, a) => s + bal(a, i), 0);
    const current = assets.filter((a) => String(a.no).startsWith("11"));
    const nonCurrent = assets.filter((a) => !String(a.no).startsWith("11"));
    return {
      cash: sumB(assets.filter(isCash)),
      receivables: sumB(assets.filter((a) => norm(a.pos).startsWith("piutang usaha"))),
      currentAssets: sumB(current),
      nonCurrentAssets: sumB(nonCurrent),
      totalAssets: sumB(assets),
      liabilities: -sumB(N.filter((a) => lead(a) === "2")),
      equity: -sumB(N.filter((a) => lead(a) === "3")) + profitCum[i],
    };
  };
  const perMonthBs = zeros(n).map((_, i) => snap(i));

  // bulan aktif = ada mutasi laba rugi atau ada baris jurnal
  const activeMonths = zeros(n)
    .map((_, i) => i)
    .filter((i) => perMonthCount[i] > 0 || L.some((a) => Math.abs(a.mut[i]) > 0.5) || N.some((a) => Math.abs(a.mut[i]) > 0.5));
  const reportIdx = activeMonths.length ? activeMonths[activeMonths.length - 1] : -1;
  const curBs = perMonthBs[reportIdx >= 0 ? reportIdx : 0];
  const prevBs = reportIdx > 0 ? perMonthBs[reportIdx - 1] : null;

  // ---------- 6. Arus kas (tidak langsung) ----------
  const opF = [...netProfit];
  const invF = zeros(n);
  const finF = zeros(n);
  for (const a of N) {
    if (isCash(a)) continue;
    const label = a.cfPos || "Lainnya";
    const tgt = isInvesting(label) ? invF : isFinancing(label) ? finF : opF;
    a.mut.forEach((v, i) => (tgt[i] -= v));
  }
  const netChange = opF.map((v, i) => v + invF[i] + finF[i]);
  const cashAccts = N.filter((a) => lead(a) === "1" && isCash(a));
  const cashBegin = cashAccts.reduce((s, a) => s + a.open, 0);

  // ---------- 7. Kontrol ----------
  const tol = 500; // toleransi pembulatan (CSV publish menampilkan angka bulat)
  const imbalance = zeros(n).map((_, i) => accts.reduce((s, a) => s + a.mut[i], 0));
  const bsDiff = perMonthBs.map((b, i) => b.totalAssets - b.liabilities - b.equity);
  const maxAbs = (a: number[]) => a.reduce((x, y) => Math.max(x, Math.abs(y)), 0);
  const controls: Control[] = [
    { sheet: "TB", label: "Total mutasi TB = 0 (jurnal seimbang)", ok: maxAbs(imbalance) <= tol, maxAbs: maxAbs(imbalance) },
    { sheet: "Neraca", label: "Aset = Liabilitas + Ekuitas", ok: maxAbs(bsDiff) <= tol, maxAbs: maxAbs(bsDiff) },
    {
      sheet: "Jurnal",
      label: "Baris jurnal yang terposting ke TB",
      ok: unposted === 0,
      maxAbs: unposted,
      note: `${unposted} baris tidak terposting (akun tidak valid atau tanggal di luar periode)`,
    },
  ];

  return {
    fetchedAt: new Date().toISOString(),
    source: "tb",
    months,
    activeMonths,
    reportIdx,
    reportLabel: reportIdx >= 0 ? months[reportIdx] : "–",
    pl: {
      revenueGross: line("Pendapatan bruto", revenueGross),
      returns: line("Retur & potongan", returns),
      revenue: line("Pendapatan neto", revenue),
      cogs: line("Beban pokok", cogs),
      grossProfit: line("Laba bruto", grossProfit),
      opex: line("Beban usaha", opex),
      operatingProfit: line("Laba usaha", operatingProfit),
      otherNet: line("Pendapatan (beban) lain-lain", otherNet),
      tax: line("Beban pajak penghasilan", tax),
      netProfit: line("Laba bersih", netProfit),
    },
    revenueLines,
    opexLines,
    cogsLines,
    journal,
    bs: { current: curBs, previous: prevBs, perMonth: perMonthBs },
    cf: {
      operating: line("Operasi", opF),
      investing: line("Investasi", invF),
      financing: line("Pendanaan", finF),
      netChange: line("Kenaikan kas", netChange),
      cashBegin,
      cashEnd: curBs.cash,
    },
    controls,
    subledger: { ar: { status: null, diff: null }, ap: { status: null, diff: null } },
  };
}
