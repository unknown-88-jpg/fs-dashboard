// Parser laporan keuangan dari sheet PL / BS / CF (+ status AR / AP).
// Dibuat toleran: baris dicari berdasarkan LABEL (bukan nomor baris) dan kolom
// berdasarkan HEADER bulan, jadi aman kalau ada baris yang disisipkan.

export type Cell = string | number | boolean | null | undefined;

export const MONTH_LABELS = ["Sep-26", "Okt-26", "Nov-26", "Des-26"] as const;

export interface Row {
  label: string;
  m: (number | null)[]; // 4 bulan: Sep, Okt, Nov, Des
  ytd: number | null;
}

export function toNum(c: Cell): number | null {
  if (typeof c === "number") return isFinite(c) ? c : null;
  if (typeof c !== "string") return null;
  let s = c.replace(/\s+/g, "").replace(/Rp/gi, "");
  if (s === "" ) return null;
  if (s === "-" || s === "–") return 0;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    neg = !neg;
    s = s.slice(1);
  }
  // format Indonesia (1.234,5) vs. English (1,234.5)
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

function monthKey(h: string): number | "ytd" | null {
  const s = h.toLowerCase().trim();
  if (s.includes("ytd")) return "ytd";
  if (s.startsWith("sep")) return 0;
  if (s.startsWith("oct") || s.startsWith("okt")) return 1;
  if (s.startsWith("nov")) return 2;
  if (s.startsWith("des") || s.startsWith("dec")) return 3;
  return null;
}

export function parseStatement(values: Cell[][]): Row[] {
  let cols: Record<number, number | "ytd"> = {};
  let hdr = -1;
  for (let i = 0; i < values.length; i++) {
    const tmp: Record<number, number | "ytd"> = {};
    values[i].forEach((c, j) => {
      if (j >= 1 && typeof c === "string") {
        const k = monthKey(c);
        if (k !== null) tmp[j] = k;
      }
    });
    if (Object.keys(tmp).length >= 3) {
      hdr = i;
      cols = tmp;
      break;
    }
  }
  if (hdr < 0) return [];
  const rows: Row[] = [];
  for (let i = hdr + 1; i < values.length; i++) {
    const r = values[i];
    const label = String(r[0] ?? "").replace(/\s+/g, " ").trim();
    if (!label) continue;
    const m: (number | null)[] = [null, null, null, null];
    let ytd: number | null = null;
    for (const [j, k] of Object.entries(cols)) {
      const v = toNum(r[Number(j)]);
      if (k === "ytd") ytd = v;
      else m[k] = v;
    }
    rows.push({ label, m, ytd });
  }
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function find(rows: Row[], label: string): Row | undefined {
  const t = norm(label);
  return rows.find((r) => norm(r.label) === t);
}
export function findStarts(rows: Row[], prefix: string): Row | undefined {
  const t = norm(prefix);
  return rows.find((r) => norm(r.label).startsWith(t));
}

const hasValues = (r: Row) => r.m.some((v) => v !== null) || r.ytd !== null;
const sum = (r: Row) => r.m.reduce<number>((a, v) => a + (v ?? 0), 0);
const ytdOf = (r: Row | undefined) => (r ? r.ytd ?? sum(r) : 0);

export interface Line {
  label: string;
  m: number[];
  ytd: number;
}
const toLine = (r: Row, flip = false): Line => {
  const k = flip ? -1 : 1;
  return { label: r.label, m: r.m.map((v) => (v ?? 0) * k + 0), ytd: ytdOf(r) * k + 0 };
};
const zeroLine = (label: string): Line => ({ label, m: [0, 0, 0, 0], ytd: 0 });
const lineOf = (r: Row | undefined, label: string, flip = false) =>
  r ? toLine(r, flip) : zeroLine(label);

export interface Control {
  sheet: string;
  label: string;
  ok: boolean;
  maxAbs: number;
  note?: string; // kalau ada, ditampilkan menggantikan "selisih Rp ..."
}

export interface JournalParty {
  name: string;
  value: number;
}
export interface JournalTx {
  date: string; // dd-mm-yyyy
  desc: string;
  ref: string;
  debit: string;
  credit: string;
  amount: number;
}
export interface JournalSummary {
  count: number;
  perMonth: number[]; // jumlah baris jurnal per bulan
  topRevenueParties: JournalParty[]; // keterangan dengan penjualan terbesar
  topCostParties: JournalParty[]; // keterangan dengan beban pokok/usaha terbesar
  largest: JournalTx[]; // transaksi terbesar
  unposted: number; // baris dengan akun tidak ada di COA / akun header
}
export interface SubledgerStatus {
  status: string | null;
  diff: number | string | null;
}

export interface BalanceSnapshot {
  cash: number;
  receivables: number;
  currentAssets: number;
  nonCurrentAssets: number;
  totalAssets: number;
  liabilities: number;
  equity: number;
}

export interface CompanyModel {
  fetchedAt: string;
  source: "statements" | "tb"; // statements = baca tab PL/BS/CF, tb = hitung dari TB + Entry Jurnal
  months: string[]; // label bulan, mis. ["Sep-26", ...]
  activeMonths: number[]; // index bulan yang punya transaksi P&L
  reportIdx: number; // bulan laporan terakhir (-1 = belum ada data)
  reportLabel: string;
  pl: {
    revenueGross: Line;
    returns: Line;
    revenue: Line;
    cogs: Line; // positif = beban
    grossProfit: Line;
    opex: Line; // positif = beban
    operatingProfit: Line;
    otherNet: Line;
    tax: Line; // beban pajak penghasilan (positif = beban); nol bila tidak dipisah
    netProfit: Line;
  };
  revenueLines: Line[];
  opexLines: Line[];
  cogsLines?: Line[];
  journal?: JournalSummary;
  bs: { current: BalanceSnapshot; previous: BalanceSnapshot | null; perMonth: BalanceSnapshot[] };
  cf: {
    operating: Line;
    investing: Line;
    financing: Line;
    netChange: Line;
    cashBegin: number;
    cashEnd: number;
  };
  controls: Control[];
  subledger: { ar: SubledgerStatus; ap: SubledgerStatus };
}

function section(rows: Row[], startLabel: string, endPrefixes: string[]): Row[] {
  const s = rows.findIndex((r) => norm(r.label) === norm(startLabel));
  if (s < 0) return [];
  let e = rows.length;
  for (let i = s + 1; i < rows.length; i++) {
    const l = norm(rows[i].label);
    if (endPrefixes.some((p) => l.startsWith(norm(p)))) {
      e = i;
      break;
    }
  }
  return rows.slice(s + 1, e);
}

function snapshot(bs: Row[], idx: number): BalanceSnapshot {
  const at = (r: Row | undefined) => (r?.m[idx] ?? 0) as number;
  const cash = at(find(bs, "Kas dan setara kas"));
  const rec = at(find(bs, "Piutang usaha - pihak ketiga, neto"));
  const cur = at(find(bs, "Jumlah Aset Lancar"));
  const nonCur = at(find(bs, "Jumlah Aset Tidak Lancar"));
  const total = at(find(bs, "JUMLAH ASET"));
  const liab = at(find(bs, "JUMLAH LIABILITAS"));
  const eq = at(find(bs, "JUMLAH EKUITAS"));
  return {
    cash,
    receivables: rec,
    currentAssets: cur,
    nonCurrentAssets: nonCur,
    totalAssets: total,
    liabilities: liab,
    equity: eq,
  };
}

function controlsOf(sheet: string, rows: Row[]): Control[] {
  return rows
    .filter((r) => norm(r.label).startsWith("control") && hasValues(r))
    .map((r) => {
      const vals = [...r.m, r.ytd].filter((v): v is number => v !== null);
      const maxAbs = vals.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
      return { sheet, label: r.label, ok: maxAbs < 1, maxAbs };
    });
}

function subledgerOf(values: Cell[][]): SubledgerStatus {
  let status: string | null = null;
  let diff: number | string | null = null;
  const nextVal = (r: Cell[], from: number) => {
    for (let j = from + 1; j < r.length; j++) {
      const c = r[j];
      if (c !== "" && c !== null && c !== undefined) return c;
    }
    return null;
  };
  for (const r of values) {
    r.forEach((c, j) => {
      if (typeof c !== "string") return;
      const t = norm(c);
      if (t === "status" && status === null) {
        const v = nextVal(r, j);
        if (v !== null) status = String(v).trim();
      }
      if (t.startsWith("selisih rincian vs tb") && diff === null) {
        const v = nextVal(r, j);
        if (v !== null) diff = typeof v === "number" ? v : toNum(v) ?? String(v).trim();
      }
    });
  }
  return { status, diff };
}

export function buildModel(input: {
  pl: Cell[][];
  bs: Cell[][];
  cf: Cell[][];
  ar?: Cell[][];
  ap?: Cell[][];
}): CompanyModel {
  const pl = parseStatement(input.pl);
  const bs = parseStatement(input.bs);
  const cf = parseStatement(input.cf);

  const revNet = findStarts(pl, "Pendapatan Usaha - Neto");
  const revGross = findStarts(pl, "Jumlah Pendapatan Usaha Bruto") ?? revNet;
  const returns = find(pl, "Retur dan potongan penjualan");
  const cogsRow = findStarts(pl, "Jumlah Beban Pokok");
  const gross = findStarts(pl, "LABA (RUGI) BRUTO");
  const opexRow = find(pl, "Jumlah Beban Usaha");
  const opProfit = find(pl, "LABA (RUGI) USAHA");
  const other = findStarts(pl, "Jumlah Pendapatan (Beban) Lain-lain");
  const net = find(pl, "LABA (RUGI) PERIODE BERJALAN");

  const model: CompanyModel["pl"] = {
    revenueGross: lineOf(revGross, "Pendapatan bruto"),
    returns: lineOf(returns, "Retur & potongan"),
    revenue: lineOf(revNet, "Pendapatan neto"),
    cogs: lineOf(cogsRow, "Beban pokok", true),
    grossProfit: lineOf(gross, "Laba bruto"),
    opex: lineOf(opexRow, "Beban usaha", true),
    operatingProfit: lineOf(opProfit, "Laba usaha"),
    otherNet: lineOf(other, "Lain-lain"),
    tax: zeroLine("Pajak"),
    netProfit: lineOf(net, "Laba bersih"),
  };

  // Bulan aktif = ada angka P&L yang tidak nol
  const activeMonths = [0, 1, 2, 3].filter((i) =>
    [model.revenueGross, model.cogs, model.opex, model.netProfit].some((l) => Math.abs(l.m[i]) > 0.5)
  );
  const reportIdx = activeMonths.length ? activeMonths[activeMonths.length - 1] : -1;

  const revenueLines = section(pl, "PENDAPATAN USAHA", ["Jumlah Pendapatan Usaha Bruto", "Pendapatan Usaha - Neto", "Retur"])
    .filter((r) => hasValues(r) && !norm(r.label).startsWith("jumlah") && Math.abs(ytdOf(r)) > 0.5)
    .map((r) => toLine(r));
  const opexLines = section(pl, "BEBAN USAHA", ["Jumlah Beban Usaha"])
    .filter((r) => hasValues(r) && Math.abs(ytdOf(r)) > 0.5)
    .map((r) => toLine(r, true))
    .sort((a, b) => b.ytd - a.ytd);

  const perMonth = [0, 1, 2, 3].map((i) => snapshot(bs, i));
  const cur = reportIdx >= 0 ? perMonth[reportIdx] : perMonth[0];
  const prev = reportIdx > 0 ? perMonth[reportIdx - 1] : null;

  const opCF = findStarts(cf, "Arus Kas Bersih dari Aktivitas Operasi");
  const invCF = findStarts(cf, "Arus Kas Bersih dari Aktivitas Investasi");
  const finCF = findStarts(cf, "Arus Kas Bersih dari Aktivitas Pendanaan");
  const chgCF = findStarts(cf, "KENAIKAN (PENURUNAN) BERSIH KAS");
  const begCF = findStarts(cf, "KAS DAN SETARA KAS AWAL");
  const endCF = findStarts(cf, "KAS DAN SETARA KAS AKHIR");

  const controls = [
    ...controlsOf("PL", pl),
    ...controlsOf("BS", bs),
    ...controlsOf("CF", cf),
  ];

  return {
    fetchedAt: new Date().toISOString(),
    source: "statements",
    months: [...MONTH_LABELS],
    activeMonths,
    reportIdx,
    reportLabel: reportIdx >= 0 ? MONTH_LABELS[reportIdx] : "–",
    pl: model,
    revenueLines,
    opexLines,
    bs: { current: cur, previous: prev, perMonth },
    cf: {
      operating: lineOf(opCF, "Operasi"),
      investing: lineOf(invCF, "Investasi"),
      financing: lineOf(finCF, "Pendanaan"),
      netChange: lineOf(chgCF, "Kenaikan kas"),
      cashBegin: begCF ? begCF.ytd ?? begCF.m.find((v) => v !== null) ?? 0 : 0,
      cashEnd: endCF ? endCF.ytd ?? [...endCF.m].reverse().find((v) => v !== null) ?? 0 : 0,
    },
    controls,
    subledger: {
      ar: input.ar ? subledgerOf(input.ar) : { status: null, diff: null },
      ap: input.ap ? subledgerOf(input.ap) : { status: null, diff: null },
    },
  };
}
