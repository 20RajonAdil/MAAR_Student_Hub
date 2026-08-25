"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore } from "@/lib/store";
import { Card, Pill } from "@/components/ui";
import { icon } from "@/components/subjectIcon";
import { ProgressChart, type ProgressPoint } from "@/components/ProgressChart";

type Range = "weekly" | "monthly";

function weekLabel(d: Date) {
  // Simple, readable week label (e.g. "3 Aug") rather than a formal ISO
  // week number — clearer for students at a glance.
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

/** Buckets daily mastery snapshots into weekly or monthly points, taking the
 *  latest snapshot within each bucket (mastery is a running level, not
 *  something to sum) so the chart reads as "where mastery stood" per period. */
function bucketHistory(history: { date: string; avgMastery: number }[], range: Range): ProgressPoint[] {
  if (history.length === 0) return [];
  const sorted = [...history].sort((a, b) => (a.date < b.date ? -1 : 1));
  const buckets = new Map<string, { label: string; sortKey: string; avgMastery: number }>();

  for (const point of sorted) {
    const d = new Date(point.date + "T00:00:00");
    let key: string;
    let label: string;
    if (range === "weekly") {
      // Start-of-week (Monday) as the bucket key.
      const day = (d.getDay() + 6) % 7; // 0 = Monday
      const monday = new Date(d);
      monday.setDate(d.getDate() - day);
      key = monday.toISOString().slice(0, 10);
      label = weekLabel(monday);
    } else {
      key = point.date.slice(0, 7); // yyyy-mm
      label = monthLabel(d);
    }
    // Latest snapshot in the bucket wins (sorted ascending, so later
    // entries overwrite earlier ones for the same bucket).
    buckets.set(key, { label, sortKey: key, avgMastery: point.avgMastery });
  }

  return Array.from(buckets.values())
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1))
    .map((b) => ({ label: b.label, mastery: b.avgMastery }));
}

export default function ProgressPage() {
  const { ready } = useRequireProfile();
  const subjects = useStore((s) => s.subjects);
  const diagnostics = useStore((s) => s.diagnostics);
  const masteryHistory = useStore((s) => s.masteryHistory);
  const sessions = useStore((s) => s.sessions);
  const [range, setRange] = useState<Range>("weekly");

  if (!ready) return null;

  const totalStudyMinutes = sessions.reduce((a, s) => a + (s.actualMinutes ?? 0), 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Progress</h1>
            <p className="mt-1 text-[var(--color-ink-soft)]">A subject-by-subject view of where things stand, and how it&apos;s changed.</p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-white p-1">
            {(["weekly", "monthly"] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-colors ${
                  range === r ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {sessions.length > 0 && (
          <p className="mt-3 text-sm text-[var(--color-ink-faint)]">
            {Math.round(totalStudyMinutes)} minutes of focused study logged so far across {sessions.length} session{sessions.length === 1 ? "" : "s"}.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-4">
          {subjects.length === 0 && (
            <Card className="py-12 text-center">
              <p className="text-sm text-[var(--color-ink-soft)]">Activate a subject to start tracking progress.</p>
            </Card>
          )}
          {subjects.map((subject) => {
            const Icon = icon(subject.icon);
            const avg = subject.topics.length ? Math.round(subject.topics.reduce((a, t) => a + t.masteryScore, 0) / subject.topics.length) : 0;
            const latestDiag = diagnostics.filter((d) => d.subjectId === subject.id).at(-1);
            const mastered = subject.topics.filter((t) => t.status === "mastered").length;
            const subjectHistory = masteryHistory.filter((m) => m.subjectId === subject.id);
            const chartData = bucketHistory(subjectHistory, range);
            return (
              <Card key={subject.id}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${subject.color} 15%, white)` }}>
                    <Icon size={20} style={{ color: subject.color }} />
                  </div>
                  <div>
                    <p className="font-semibold">{subject.name}</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">{mastered} of {subject.topics.length} topics mastered</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="font-mono text-lg font-semibold" style={{ color: subject.color }}>{avg}%</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">average mastery</p>
                  </div>
                </div>

                {latestDiag && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {latestDiag.strengths.map((s) => (
                      <Pill key={s} tone="primary">{s}</Pill>
                    ))}
                    {latestDiag.developingAreas.map((s) => (
                      <Pill key={s} tone="amber">{s}</Pill>
                    ))}
                    {latestDiag.weaknesses.map((s) => (
                      <Pill key={s} tone="flag">{s}</Pill>
                    ))}
                  </div>
                )}

                <div className="mt-4">
                  <ProgressChart data={chartData} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
