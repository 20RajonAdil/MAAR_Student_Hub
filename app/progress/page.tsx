"use client";

import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore } from "@/lib/store";
import { Card, Pill } from "@/components/ui";
import { icon } from "@/components/subjectIcon";

export default function ProgressPage() {
  const { ready } = useRequireProfile();
  const subjects = useStore((s) => s.subjects);
  const diagnostics = useStore((s) => s.diagnostics);
  if (!ready) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="font-display text-3xl font-semibold">Progress</h1>
        <p className="mt-1 text-[var(--color-ink-soft)]">A subject-by-subject view of where things stand.</p>

        <div className="mt-6 flex flex-col gap-4">
          {subjects.map((subject) => {
            const Icon = icon(subject.icon);
            const avg = subject.topics.length ? Math.round(subject.topics.reduce((a, t) => a + t.masteryScore, 0) / subject.topics.length) : 0;
            const latestDiag = diagnostics.filter((d) => d.subjectId === subject.id).at(-1);
            const mastered = subject.topics.filter((t) => t.status === "mastered").length;
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
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
