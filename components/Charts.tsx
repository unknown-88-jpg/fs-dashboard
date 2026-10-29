"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const C = {
  revenue: "var(--chart-1)",
  cost: "var(--chart-2)",
  profit: "var(--chart-3)",
  neg: "var(--destructive)",
  grid: "var(--border)",
  text: "var(--muted-foreground)",
};

const short = (n: number) => {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(1)} M`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)} jt`;
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)} rb`;
  return `${s}${Math.round(a)}`;
};
const full = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));

const tip = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 13,
    color: "var(--foreground)",
    boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
  },
  itemStyle: { color: "var(--foreground)" },
  labelStyle: { color: "var(--foreground)", fontWeight: 600 },
};

export function MonthlyChart({
  data,
}: {
  data: { month: string; pendapatan: number; beban: number; laba: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="month" tick={{ fill: C.text, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={short} tick={{ fill: C.text, fontSize: 12 }} axisLine={false} tickLine={false} width={54} />
        <Tooltip formatter={(v) => full(Number(v))} {...tip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="pendapatan" name="Pendapatan neto" fill={C.revenue} radius={[6, 6, 0, 0]} />
        <Bar dataKey="beban" name="Total beban" fill={C.cost} radius={[6, 6, 0, 0]} />
        <Line dataKey="laba" name="Laba bersih" stroke={C.profit} strokeWidth={2.5} dot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function HBar({
  data,
  color = C.cost,
}: {
  data: { name: string; value: number }[];
  color?: string;
}) {
  const h = Math.max(120, data.length * 44 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} horizontal={false} />
        <XAxis type="number" tickFormatter={short} tick={{ fill: C.text, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tick={{ fill: C.text, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip formatter={(v) => full(Number(v))} cursor={{ fill: "var(--muted)", opacity: 0.5 }} {...tip} />
        <Bar dataKey="value" name="YTD" fill={color} radius={[0, 6, 6, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashflowChart({
  data,
}: {
  data: { month: string; operasi: number; investasi: number; pendanaan: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="month" tick={{ fill: C.text, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={short} tick={{ fill: C.text, fontSize: 12 }} axisLine={false} tickLine={false} width={54} />
        <Tooltip formatter={(v) => full(Number(v))} {...tip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="operasi" name="Operasi" fill={C.revenue} radius={[6, 6, 0, 0]} />
        <Bar dataKey="investasi" name="Investasi" fill={C.cost} radius={[6, 6, 0, 0]} />
        <Bar dataKey="pendanaan" name="Pendanaan" fill={C.profit} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
