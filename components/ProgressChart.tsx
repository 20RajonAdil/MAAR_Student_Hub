"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export interface ProgressPoint {
  label: string;
  mastery: number;
}

export function ProgressChart({ data }: { data: ProgressPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[var(--color-line)] text-sm text-[var(--color-ink-faint)]">
        Complete a diagnostic or a few practice sessions to see your trend here.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="masteryFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-ink-faint)" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--color-ink-faint)" }} axisLine={false} tickLine={false} width={30} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: "1px solid var(--color-line)", fontSize: 12 }}
          formatter={(v) => [`${v}%`, "Mastery"]}
        />
        <Area type="monotone" dataKey="mastery" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#masteryFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
