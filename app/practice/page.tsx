"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui";
import { icon } from "@/components/subjectIcon";

export default function PracticeHub() {
  const { ready } = useRequireProfile();
  const subjects = useStore((s) => s.subjects);
  if (!ready) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="font-display text-3xl font-semibold">Practice</h1>
        <p className="mt-1 text-[var(--color-ink-soft)]">Pick a subject to see topics worth practising today.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {subjects.map((subject) => {
            const Icon = icon(subject.icon);
            const weakest = subject.topics.slice().sort((a, b) => a.masteryScore - b.masteryScore)[0];
            return (
              <Link key={subject.id} href={`/subjects/${subject.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${subject.color} 15%, white)` }}>
                    <Icon size={22} style={{ color: subject.color }} />
                  </div>
                  <p className="mt-3 font-semibold">{subject.name}</p>
                  {weakest && <p className="mt-1 text-sm text-[var(--color-ink-faint)]">Suggested: {weakest.name}</p>}
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
