"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useRequireProfile } from "@/lib/useRequireProfile";
import { useStore, SUBJECT_LIBRARY } from "@/lib/store";
import { Card, Button } from "@/components/ui";
import { icon } from "@/components/subjectIcon";
import type { SubjectId } from "@/lib/types";

const AVAILABLE: SubjectId[] = ["maths", "english", "biology", "chemistry", "physics"];

export default function SubjectsPage() {
  const { ready } = useRequireProfile();
  const subjects = useStore((s) => s.subjects);
  const activateSubjects = useStore((s) => s.activateSubjects);

  if (!ready) return null;

  const inactive = AVAILABLE.filter((id) => !subjects.find((s) => s.id === id));

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="font-display text-3xl font-semibold">Your subjects</h1>
        <p className="mt-1 text-[var(--color-ink-soft)]">Each subject has its own workspace, notes, practice and progress.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {subjects.map((subject) => {
            const Icon = icon(subject.icon);
            const avgMastery = subject.topics.length
              ? Math.round(subject.topics.reduce((a, t) => a + t.masteryScore, 0) / subject.topics.length)
              : 0;
            return (
              <Link key={subject.id} href={`/subjects/${subject.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${subject.color} 15%, white)` }}>
                    <Icon size={22} style={{ color: subject.color }} />
                  </div>
                  <p className="mt-3 font-semibold">{subject.name}</p>
                  <p className="mt-1 text-sm text-[var(--color-ink-faint)]">{avgMastery}% average mastery · {subject.topics.length} topics</p>
                </Card>
              </Link>
            );
          })}
        </div>

        {inactive.length > 0 && (
          <div className="mt-8">
            <p className="mb-3 text-xs font-medium tracking-wide text-[var(--color-ink-faint)] uppercase">Add another subject</p>
            <div className="flex flex-wrap gap-3">
              {inactive.map((id) => {
                const lib = SUBJECT_LIBRARY[id];
                return (
                  <Button key={id} variant="secondary" onClick={() => activateSubjects([...subjects.map((s) => s.id), id])}>
                    <Plus size={16} /> {lib?.name ?? id}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
