"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Flame, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore } from "@/lib/store";
import { Button, Card, Pill } from "@/components/ui";
import { ProgressChart, ProgressPoint } from "@/components/ProgressChart";
import { icon } from "@/components/subjectIcon";

export default function DashboardPage() {
  const { ready, profile } = useRequireProfile();
  const subjects = useStore((s) => s.subjects);
  const planItems = useStore((s) => s.planItems);
  const togglePlanItem = useStore((s) => s.togglePlanItem);
  const activity = useStore((s) => s.activity);
  const diagnostics = useStore((s) => s.diagnostics);
  const weaknesses = useStore((s) => s.weaknesses);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const progressData: ProgressPoint[] = useMemo(() => {
    return diagnostics
      .slice()
      .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
      .map((d, i) => {
        const ratio = d.attempts.filter((a) => a.correct === true).length / Math.max(1, d.attempts.length);
        return { label: `Check-in ${i + 1}`, mastery: Math.round(ratio * 100) };
      });
  }, [diagnostics]);

  if (!ready || !profile) return null;

  const activeWeaknesses = weaknesses.filter((w) => w.status === "active");
  const firstName = profile.name.split(" ")[0];

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="font-display text-3xl font-semibold">Welcome back, {firstName}</h1>
        <p className="mt-1 text-[var(--color-ink-soft)]">Here's what's worth your time today.</p>

        {/* Focus Today */}
        <Card className="mt-6 border-[var(--color-amber)]/30 bg-gradient-to-br from-[var(--color-amber-dim)] to-white">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#8a5c17]" />
            <h2 className="font-semibold">Focus Today</h2>
          </div>
          {planItems.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
              Nothing urgent right now — great time for a bit of practice to keep things fresh.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2.5">
              {planItems.slice(0, 3).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-4 py-3">
                  <div>
                    <p className={`text-sm font-medium ${item.done ? "text-[var(--color-ink-faint)] line-through" : ""}`}>{item.suggestedAction}</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">{item.reason}</p>
                  </div>
                  <Button size="sm" variant={item.done ? "secondary" : "amber"} onClick={() => togglePlanItem(item.id)}>
                    {item.done ? "Done" : "Start"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Progress chart */}
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Your progress</h2>
              <Pill tone="primary">All time</Pill>
            </div>
            <div className="mt-4">
              <ProgressChart data={progressData} />
            </div>
          </Card>

          {/* Weaknesses / goals */}
          <Card>
            <h2 className="font-semibold">Active learning goals</h2>
            {activeWeaknesses.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-ink-soft)]">No active goals — nice and clear.</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {activeWeaknesses.slice(0, 4).map((w) => (
                  <li key={w.id}>
                    <Link href={`/subjects/${w.subjectId}`} className="block rounded-xl border border-[var(--color-line)] p-3 hover:border-[var(--color-primary)]">
                      <p className="text-sm font-medium">{w.topicName}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{w.reason}</p>
                      {w.isInference && <Pill tone="amber" className="mt-2">Possible pattern — not confirmed yet</Pill>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Subjects */}
        <div className="mt-6 flex flex-col gap-4">
          {subjects.map((subject) => {
            const isOpen = expanded[subject.id] ?? subject === subjects[0];
            const avgMastery = subject.topics.length
              ? Math.round(subject.topics.reduce((a, t) => a + t.masteryScore, 0) / subject.topics.length)
              : 0;
            const Icon = icon(subject.icon);
            return (
              <Card key={subject.id}>
                <button
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setExpanded((e) => ({ ...e, [subject.id]: !isOpen }))}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${subject.color} 15%, white)` }}>
                      <Icon size={20} style={{ color: subject.color }} />
                    </div>
                    <div>
                      <p className="font-semibold">{subject.name}</p>
                      <p className="text-xs text-[var(--color-ink-faint)]">{avgMastery}% average mastery</p>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {isOpen && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {subject.topics.map((topic) => (
                      <div key={topic.id} className="rounded-lg border border-[var(--color-line)] px-3 py-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm">{topic.name}</p>
                          <span className="font-mono text-xs text-[var(--color-ink-faint)]">{topic.masteryScore}%</span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/5">
                          <div className="h-full rounded-full" style={{ width: `${topic.masteryScore}%`, background: subject.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <Link href={`/subjects/${subject.id}`}>
                    <Button variant="secondary" size="sm">Open {subject.name} workspace</Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Recent activity */}
        <Card className="mt-6">
          <h2 className="font-semibold">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-soft)]">Your activity will show up here as you go.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-[var(--color-line)]">
              {activity.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <Flame size={14} className="text-[var(--color-amber)]" /> {a.label}
                  </span>
                  <span className="text-xs text-[var(--color-ink-faint)]">{new Date(a.at).toLocaleDateString("en-GB")}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
